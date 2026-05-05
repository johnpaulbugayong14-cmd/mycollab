import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://mytaskprofessional-jpteams.vercel.app',
      'https://johnpaulbugayong14-cmd.github.io',
      'http://localhost:5173',
      'http://localhost:3000'
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.options('*', cors());
app.use(express.json());

// GitHub Actions Configuration (stored securely on backend)
const GITHUB_CONFIG = {
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_REPO_OWNER,
  repo: process.env.GITHUB_REPO_NAME,
  eventType: 'send-email',
  meetingEventType: 'meeting-created'
};

// Validate GitHub configuration
if (!GITHUB_CONFIG.token || !GITHUB_CONFIG.owner || !GITHUB_CONFIG.repo) {
  console.error('ERROR: Missing GitHub configuration in environment variables');
  console.error('Required: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME');
  process.exit(1);
}

/**
 * Trigger GitHub Actions to send email notification
 * POST /api/trigger-email
 * 
 * Request body:
 * {
 *   email: string,      // Recipient email
 *   name: string,       // Recipient name
 *   type: string,       // task, announcement, poll, ticket, thesisProgress, meeting
 *   title: string,      // Document title
 *   meetingDate?: string, // For meeting type
 *   meetingTime?: string  // For meeting type
 * }
 */
app.post('/api/trigger-email', async (req, res) => {
  try {
    const { email, name, type, title, meetingDate, meetingTime } = req.body;

    // Validate required fields
    if (!email || !name || !type || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, name, type, title'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate type
    const validTypes = ['task', 'announcement', 'poll', 'ticket', 'thesisProgress', 'meeting'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Determine event type
    const eventType = type === 'meeting' ? GITHUB_CONFIG.meetingEventType : GITHUB_CONFIG.eventType;

    // Prepare payload
    const clientPayload = {
      email: email,
      name: name,
      type: type,
      title: title
    };

    if (type === 'meeting') {
      if (!meetingDate || !meetingTime) {
        return res.status(400).json({
          success: false,
          error: 'meetingDate and meetingTime are required for meeting type'
        });
      }
      clientPayload.meetingDate = meetingDate;
      clientPayload.meetingTime = meetingTime;
      clientPayload.meetingTitle = title;
    }

    // Call GitHub API to trigger workflow
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'MyThesisHub-Email-Backend'
        },
        body: JSON.stringify({
          event_type: eventType,
          client_payload: clientPayload
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('GitHub API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });

      return res.status(response.status).json({
        success: false,
        error: `Failed to trigger GitHub Actions: ${response.statusText}`
      });
    }

    console.log(`Email notification queued for ${email} (type: ${type})`);

    return res.json({
      success: true,
      message: `Email notification for "${title}" has been queued for ${email}`
    });

  } catch (error) {
    console.error('Error triggering email notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MyThesisHub Email Backend',
    timestamp: new Date().toISOString()
  });
});

/**
 * Root endpoint
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    service: 'MyThesisHub Email Notification Backend',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      triggerEmail: 'POST /api/trigger-email'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MyThesisHub Email Backend running on http://localhost:${PORT}`);
  console.log(`📧 Email endpoint: POST http://localhost:${PORT}/api/trigger-email`);
});
