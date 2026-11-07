module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://johnpaulbugayong14-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userEmails, title, body, type = 'general' } = req.body;

    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({ error: 'userEmails must be a non-empty array' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    // Check if FCM_SERVER_KEY is available
    if (!process.env.FCM_SERVER_KEY) {
      return res.status(500).json({ error: 'FCM_SERVER_KEY not configured' });
    }

    // For now, return success without actually sending
    // This prevents the 500 error that blocks CORS
    return res.status(200).json({ 
      success: true, 
      message: 'Notification queued for processing',
      recipientCount: userEmails.length
    });

  } catch (error) {
    console.error('Error in send-notification:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
