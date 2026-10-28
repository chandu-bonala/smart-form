import asyncio
from datetime import timedelta, timezone

from datetime import datetime

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.form import Form
from app.models.question import Question
from app.models.response import Response
from app.models.answer import Answer
from app.models.enums import UserRole, FormStatus, QuestionType
from app.services.form_service import create_form_version, list_responses_by_form_version


async def main():
    async with AsyncSessionLocal() as db:
        # find or create test user
        result = await db.execute("""SELECT id FROM users WHERE email = 'test+version@example.com'""")
        row = result.first()
        if row:
            user_id = row[0]
            print('Reusing user', user_id)
        else:
            user = User(name='Version Tester', email='test+version@example.com', password_hash='x', role=UserRole.ADMIN)
            db.add(user)
            await db.commit()
            await db.refresh(user)
            user_id = user.id
            print('Created user', user_id)

        # create form
        form = Form(owner_id=user_id, title='Versioning Test', description='Test form', status=FormStatus.DRAFT, is_public=False, form_slug='version-test')
        db.add(form)
        await db.flush()

        # add initial question
        q1 = Question(form_id=form.id, title='Q1', question_type=QuestionType.SHORT_TEXT, required=False, order_index=0)
        db.add(q1)
        await db.commit()
        await db.refresh(form)
        await db.refresh(q1)

        # Publish -> create version 1
        form.status = FormStatus.PUBLISHED
        form.is_public = True
        await db.commit()
        await db.refresh(form)
        v1 = await create_form_version(db, form, 1)
        print('Created version 1 snapshot, questions:', len(v1.schema_snapshot.get('questions', [])))

        # create a response for version 1
        r1 = Response(form_id=form.id, submitted_by=None, respondent_email='a@example.com', submitted_at=datetime.now(timezone.utc) + timedelta(seconds=1))
        r1.answers.append(Answer(question_id=q1.id, answer='answer v1'))
        db.add(r1)
        await db.commit()
        await db.refresh(r1)
        print('Added response for v1:', r1.id)

        # Edit form: add question and revert to draft
        q2 = Question(form_id=form.id, title='Q2', question_type=QuestionType.SHORT_TEXT, required=False, order_index=1)
        db.add(q2)
        # simulate edit reverting to draft
        form.status = FormStatus.DRAFT
        form.is_public = False
        await db.commit()
        await db.refresh(form)
        print('Edited form; now status', form.status)

        # Publish again -> create version 2
        form.status = FormStatus.PUBLISHED
        form.is_public = True
        await db.commit()
        await db.refresh(form)
        v2 = await create_form_version(db, form, 2)
        print('Created version 2 snapshot, questions:', len(v2.schema_snapshot.get('questions', [])))

        # create a response for version 2
        r2 = Response(form_id=form.id, submitted_by=None, respondent_email='b@example.com', submitted_at=datetime.now(timezone.utc) + timedelta(seconds=2))
        r2.answers.append(Answer(question_id=q2.id, answer='answer v2'))
        db.add(r2)
        await db.commit()
        await db.refresh(r2)
        print('Added response for v2:', r2.id)

        # Query responses per version
        responses_v1, total_v1 = await list_responses_by_form_version(db, form.id, 1)
        responses_v2, total_v2 = await list_responses_by_form_version(db, form.id, 2)
        print('Version 1 responses:', total_v1)
        for r in responses_v1:
            print(' -', r.id, [(a.question_id, a.answer) for a in r.answers])
        print('Version 2 responses:', total_v2)
        for r in responses_v2:
            print(' -', r.id, [(a.question_id, a.answer) for a in r.answers])


if __name__ == '__main__':
    asyncio.run(main())
