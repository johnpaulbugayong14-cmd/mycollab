module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  const allowedOrigins = [
    'https://johnpaulbugayong14-cmd.github.io',
    'https://mytaskprofessional-jpteams.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, name, type, title, meetingDate, meetingTime } = req.body || {};

    if (!email || !name || !type || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, name, type, title'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const validTypes = ['task', 'announcement', 'poll', 'ticket', 'thesisProgress', 'meeting'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    if (!githubToken || !repoOwner || !repoName) {
      return res.status(500).json({ success: false, error: 'GitHub configuration is missing on the server' });
    }

    if (type === 'meeting' && (!meetingDate || !meetingTime)) {
      return res.status(400).json({
        success: false,
        error: 'meetingDate and meetingTime are required for meeting type'
      });
    }

    const clientPayload = { email, name, type, title };
    if (type === 'meeting') {
      clientPayload.meetingDate = meetingDate;
      clientPayload.meetingTime = meetingTime;
      clientPayload.meetingTitle = title;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'MyCollab-Email-Backend'
        },
        body: JSON.stringify({
          event_type: type === 'meeting' ? 'meeting-created' : 'send-email',
          client_payload: clientPayload
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `GitHub API error: ${response.statusText}`,
        details: text
      });
    }

    return res.status(200).json({
      success: true,
      message: `Email notification queued for ${email}`
    });
  } catch (error) {
    console.error('trigger-email error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
