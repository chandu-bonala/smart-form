# Web deployment (Render)

The repository now includes a Render Blueprint at `render.yaml`. It defines the FastAPI API, PostgreSQL database, persistent upload disk, and Expo static website as one deployment. Connect the GitHub repository in Render and create a Blueprint from the repository root.

## Services in the Blueprint

- **API:** Python 3.13, built from `app/requirements.txt`, starts with Uvicorn, and uses `/ready` for readiness checks.
- **Database:** Render PostgreSQL in Singapore, with the internal connection URL wired to the API.
- **Uploads:** A 1 GB persistent disk mounted at `/var/data`; uploaded files are configured under `/var/data/uploads`.
- **Website:** Expo web export from `SmartForm/`, served as a static site with SPA route rewrites. The hosted build pins Node 22.16.0.

When Render prompts for values marked `sync: false`, enter:

- `CORS_ORIGINS`: `https://smartform-web.onrender.com` (use the actual static-site URL Render assigns).
- `EXPO_PUBLIC_API_BASE_URL`: `https://smartform-api.onrender.com` (use the actual API URL Render assigns; do not add `/api/v1`).
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: the Google OAuth web client ID configured for the deployed web origin.
- `GEMINI_API_KEY`: the existing server-side Gemini key, if AI features should be enabled.
- `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL`: email delivery credentials, if verification emails should be enabled.
- `GOOGLE_CLIENT_IDS`: the OAuth client IDs accepted by the API.

The Blueprint generates a production `SECRET_KEY`. It also sets `ENVIRONMENT=production`, disables debug, links the database, and configures persistent uploads. The Expo API URL is a public build-time setting; keep Gemini, SMTP, OAuth client secrets, and database credentials on the backend only.

If the Render URLs differ from those service names, set the actual URLs in the two variables above and trigger a new web build after changing `EXPO_PUBLIC_API_BASE_URL`.

## Database setup

The API pre-deploy command runs `python scripts/prepare_database.py`. It creates and baselines the initial schema on a blank database, then applies later migrations on subsequent deploys. It refuses to stamp a partial, unversioned schema.

## File uploads

The API writes uploads and avatars locally, so the Blueprint attaches a persistent disk. Render requires a paid API service for persistent disks and limits a disk-backed service to one instance. See [Render persistent disks](https://render.com/docs/disks).

## Before launch

- Update the Google OAuth client configuration to allow the deployed web origin.
- Keep `.env` out of Git and enter API credentials only in Render's environment variables.
- If any credential-like values previously committed in the repository were real, rotate them before making the repository public.

The current Blueprint uses Render's Starter API plan, a 256 MB PostgreSQL plan, and 1 GB of disk, alongside the free static site. Render currently lists these at about **$17.25/month** before bandwidth/storage overages and applicable taxes; verify the final price in your Render dashboard before creating resources. See [Render pricing](https://render.com/pricing).

## Local frontend production export

From `SmartForm/`, run:

```bash
npm ci
npm run build:web
```

This writes the static website to `SmartForm/dist/`. Set `EXPO_PUBLIC_API_BASE_URL` to the public API URL for production builds.
