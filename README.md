# KompanionAI Backend

OAuth backend for Google Calendar, Drive, and Gmail integration.

## Features

- Google OAuth 2.0 authentication
- Calendar API (read/write events)
- Drive API (list/download files)
- Gmail API (read/send emails)
- Token refresh endpoint

## Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `kompanion-ai-backend`
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. Click **Download JSON** to get your client secret
6. Note down:
   - Client ID: `622748485610-f9f00ibv9svabbi9vqsl6eq8c95bgolc.apps.googleusercontent.com`
   - Client Secret: (from downloaded JSON)

### 2. Deploy to Vercel

1. Create a new GitHub repository (e.g., `kompanion-backend`)
2. Push this code to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/kompanion-backend.git
   git push -u origin main
   ```

3. Go to [Vercel Dashboard](https://vercel.com/dashboard)
4. Click **Add New** → **Project**
5. Import your GitHub repository
6. Configure environment variables:
   - `GOOGLE_CLIENT_ID`: `622748485610-f9f00ibv9svabbi9vqsl6eq8c95bgolc.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET`: (your client secret)
   - `BACKEND_URL`: (leave empty, will be set after deployment)
   - `MOBILE_REDIRECT_URI`: `manus20241217222156://oauth/callback`

7. Click **Deploy**

8. After deployment, copy your Vercel URL (e.g., `https://kompanion-backend.vercel.app`)

9. Go back to Vercel → **Settings** → **Environment Variables**
10. Update `BACKEND_URL` with your Vercel URL

11. Redeploy (Vercel → **Deployments** → **Redeploy**)

### 3. Update Google OAuth Redirect URIs

1. Go back to Google Cloud Console → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Add **Authorized redirect URIs**:
   - `https://YOUR_VERCEL_URL.vercel.app/auth/google/callback`
   - `manus20241217222156://oauth/callback`

4. Click **Save**

### 4. Test the Backend

Visit: `https://YOUR_VERCEL_URL.vercel.app/`

You should see:
```json
{
  "status": "ok",
  "service": "KompanionAI Backend",
  "version": "1.0.0"
}
```

## API Endpoints

### Authentication

- `GET /auth/google/url` - Generate OAuth URL
- `GET /auth/google/callback` - OAuth callback (handles redirect)
- `POST /auth/google/refresh` - Refresh access token

### Calendar

- `GET /api/calendar/events` - List upcoming events
- `POST /api/calendar/events` - Create new event

### Drive

- `GET /api/drive/files` - List files
- `GET /api/drive/files/:fileId` - Download file

### Gmail

- `GET /api/gmail/messages` - List emails
- `POST /api/gmail/send` - Send email

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

Server runs on `http://localhost:3000`

## Notes

- All API endpoints (except auth) require `access_token` header
- Tokens expire after 1 hour, use refresh endpoint
- Mobile app handles token storage and refresh automatically
