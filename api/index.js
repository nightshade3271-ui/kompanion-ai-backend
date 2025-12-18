const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://kompanion-ai-backend.vercel.app/auth/google/callback'
);

// Scopes for Calendar, Drive, and Gmail
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'KompanionAI Backend',
    version: '1.0.0',
  });
});

// Generate OAuth URL
app.get('/auth/google/url', (req, res) => {
  const { state, redirect_uri } = req.query;

  // Package state and mobile redirect_uri into a base64 string
  const stateObj = JSON.stringify({
    state: state || 'default',
    redirect_uri: redirect_uri || process.env.MOBILE_REDIRECT_URI || 'kompanion-ai://oauth/callback'
  });
  const encodedState = Buffer.from(stateObj).toString('base64');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: encodedState,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  res.json({ url: authUrl });
});

// OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Get user info
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Parse state to get mobile redirect URI
    let mobileRedirect = process.env.MOBILE_REDIRECT_URI || 'kompanion-ai://oauth/callback';
    let originalState = 'default';

    if (state) {
      try {
        const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        mobileRedirect = stateObj.redirect_uri || mobileRedirect;
        originalState = stateObj.state || originalState;
      } catch (e) {
        console.error('Failed to parse state:', e);
        originalState = state; // Fallback to raw state if not base64 JSON
      }
    }

    // Redirect back to mobile app with tokens
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_in: tokens.expiry_date ? String(tokens.expiry_date) : '',
      email: userInfo.email || '',
      name: userInfo.name || '',
      picture: userInfo.picture || '',
      state: originalState,
    });

    const redirectUrl = `${mobileRedirect}${mobileRedirect.includes('?') ? '&' : '?'}${params.toString()}`;

    console.log('Redirecting to mobile app:', redirectUrl);

    // Redirect to the mobile app scheme
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Failed to exchange authorization code',
      message: error.message,
    });
  }
});

// Refresh access token
app.post('/auth/google/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    oauth2Client.setCredentials({ refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();

    res.json({
      access_token: credentials.access_token,
      expires_in: credentials.expiry_date,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: error.message,
    });
  }
});

// Calendar API endpoints
app.get('/api/calendar/events', async (req, res) => {
  const { access_token } = req.headers;

  if (!access_token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    oauth2Client.setCredentials({ access_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data);
  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({
      error: 'Failed to fetch calendar events',
      message: error.message,
    });
  }
});

app.post('/api/calendar/events', async (req, res) => {
  const { access_token } = req.headers;
  const event = req.body;

  if (!access_token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    oauth2Client.setCredentials({ access_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    res.json(response.data);
  } catch (error) {
    console.error('Calendar create error:', error);
    res.status(500).json({
      error: 'Failed to create calendar event',
      message: error.message,
    });
  }
});

// Drive API endpoints
app.get('/api/drive/files', async (req, res) => {
  const { access_token } = req.headers;
  const { query, pageSize = 10 } = req.query;

  if (!access_token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    oauth2Client.setCredentials({ access_token });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.list({
      pageSize: parseInt(pageSize),
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      q: query || "trashed=false",
    });

    res.json(response.data);
  } catch (error) {
    console.error('Drive API error:', error);
    res.status(500).json({
      error: 'Failed to fetch drive files',
      message: error.message,
    });
  }
});

app.get('/api/drive/files/:fileId', async (req, res) => {
  const { access_token } = req.headers;
  const { fileId } = req.params;

  if (!access_token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    oauth2Client.setCredentials({ access_token });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.get({
      fileId,
      alt: 'media',
    });

    res.send(response.data);
  } catch (error) {
    console.error('Drive download error:', error);
    res.status(500).json({
      error: 'Failed to download file',
      message: error.message,
    });
  }
});

// Gmail API endpoints
app.get('/api/gmail/messages', async (req, res) => {
  const { access_token } = req.headers;
  const { maxResults = 10, query } = req.query;

  if (!access_token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    oauth2Client.setCredentials({ access_token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(maxResults),
      q: query || '',
    });

    res.json(response.data);
  } catch (error) {
    console.error('Gmail API error:', error);
    res.status(500).json({
      error: 'Failed to fetch emails',
      message: error.message,
    });
  }
});

app.post('/api/gmail/send', async (req, res) => {
  const { access_token } = req.headers;
  const { to, subject, body } = req.body;

  if (!access_token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    oauth2Client.setCredentials({ access_token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body,
    ].join('\n');

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Gmail send error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message,
    });
  }
});

// Start server (for local development)
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KompanionAI Backend running on port ${PORT}`);
  });
}

// Export for Vercel

module.exports = app;
