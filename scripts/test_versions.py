import asyncio
from datetime import datetime

from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal, init_db
from app.schemas.user import UserCreate
from app.services.auth_service import register_user, get_user_by_email
from app.schemas.form import FormCreate
from app.services.form_service import create_form, publish_form, create_question, create_response, create_form_version, list_responses_by_form_version
from app.schemas.question import QuestionCreate
from app.schemas.response import ResponseCreate, AnswerCreate


async def main():
    print('Initializing DB (if needed)')
    await init_db()

    async with AsyncSessionLocal() as db:
        # Create or get test user
        test_email = 'test+versions@example.com'
        existing = await get_user_by_email(db, test_email)
        if existing:
            user = existing
            print('Using existing user', user.email)
        else:
            print('Registering test user')
            user = await register_user(db, UserCreate(name='Version Tester', email=test_email, password='password123'))
            print('Created user', user.email)

        # Create a form
        form_payload = FormCreate(owner_id=user.id, title='Versioned Form', description='Test form for versions', form_slug=None)
        form = await create_form(db, form_payload)
        print('Created form', form.id)

        # Publish form (version 1)
        print('Publishing version 1')
        await publish_form(db, form, publish=True)
        # compute next version number
        result = await db.execute(select(func.max(func.coalesce(select(func.max).corresponding_column, 0))))

        # Instead compute via FormVersion table
        from app.models.form_version import FormVersion
        r = await db.execute(select(func.max(FormVersion.version_number)).where(FormVersion.form_id == form.id))
        version_count = (r.scalar() or 0) + 1
        await create_form_version(db, form, version_count)
        print('Created form version', version_count)

        # Submit two responses to version 1
        for i in range(2):
            resp_payload = ResponseCreate(
                form_id=form.id,
                submitted_by=None,
                respondent_email=f'user{i+1}@example.com',
                completion_time=5.0 + i,
                answers=[AnswerCreate(question_id='', answer=f'Initial answer {i+1}')],
            )
            # We need at least one question to attach answers properly; create a question first
        
        # Create a question (this will revert published form to draft per service logic)
        q = await create_question(db, QuestionCreate(form_id=form.id, title='Q1', question_type='short_text', placeholder='Ans', required=False, order_index=0, options=[]))
        print('Created question', q.id)

        # Since creating question reverts to draft, publish again to create version 2 later
        # Submit responses now (they will belong to version 1 if timestamps are earlier than version 2 creation)
        for i in range(2):
            resp_payload = ResponseCreate(
                form_id=form.id,
                submitted_by=None,
                respondent_email=f'user_v1_{i+1}@example.com',
                completion_time=4.5 + i,
                answers=[AnswerCreate(question_id=q.id, answer=f'Answer v1_{i+1}')],
            )
            await create_response(db, resp_payload)
            print('Submitted response for v1', i+1)

        # Wait a second to ensure timestamps differ
        await asyncio.sleep(1)

        # Publish again -> version 2
        print('Publishing version 2')
        await publish_form(db, form, publish=True)
        r = await db.execute(select(func.max(FormVersion.version_number)).where(FormVersion.form_id == form.id))
        version_count = (r.scalar() or 0) + 1
        await create_form_version(db, form, version_count)
        print('Created form version', version_count)

        # Submit responses for version 2
        for i in range(3):
            resp_payload = ResponseCreate(
                form_id=form.id,
                submitted_by=None,
                respondent_email=f'user_v2_{i+1}@example.com',
                completion_time=3.0 + i,
                answers=[AnswerCreate(question_id=q.id, answer=f'Answer v2_{i+1}')],
            )
            await create_response(db, resp_payload)
            print('Submitted response for v2', i+1)

        # Now list responses by version
        print('\nListing responses for version 1')
        resp_v1, total_v1 = await list_responses_by_form_version(db, form.id, 1)
        print('Total v1 responses:', total_v1)
        for r in resp_v1:
            print(' -', r.id, r.respondent_email, r.submitted_at, [(a.question_id, a.answer) for a in r.answers])

        print('\nListing responses for version 2')
        resp_v2, total_v2 = await list_responses_by_form_version(db, form.id, 2)
        print('Total v2 responses:', total_v2)
        for r in resp_v2:
            print(' -', r.id, r.respondent_email, r.submitted_at, [(a.question_id, a.answer) for a in r.answers])


if __name__ == '__main__':
    asyncio.run(main())
