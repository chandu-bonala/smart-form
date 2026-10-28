# Smart Form Builder

Smart Form Builder is a full-stack form creation and response platform.

## Backend

- FastAPI
- SQLAlchemy 2 async ORM
- Alembic migrations
- PostgreSQL

### Run

```bash
uvicorn app.main:app --reload --port 8080
```

### Docs

- Swagger UI: `/docs`
- ReDoc: `/redoc`

## Frontend

The `SmartForm` app is an Expo React Native project.

### Run

```bash
cd SmartForm
npm install
npm run start
```

## Setup

1. Set environment variables in `.env`.
2. Install backend dependencies from `app/requirements.txt`.
3. Run Alembic migrations.
4. Start the backend and frontend.

## Deploy

The Render Blueprint deploys the API, PostgreSQL database, persistent uploads, and web frontend. See [DEPLOYMENT.md](DEPLOYMENT.md) before creating hosted resources.
