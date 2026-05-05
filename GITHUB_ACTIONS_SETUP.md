# GitHub Actions Email Notification System Setup

## Step 1: Get Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a **16-character password** (e.g., `bkey lffu wabp ezsj`)
4. Copy this password (remove spaces if needed)

## Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:

   **Secret 1:**
   - Name: `GMAIL_USER`
   - Value: `mythesishubautonotify@gmail.com`

   **Secret 2:**
   - Name: `GMAIL_PASS`
   - Value: `bkeylfuuwabpezsj` (16-char password without spaces)

## Step 3: Push the Workflow

1. Ensure `.github/workflows/send-email.yml` is in your repository
2. Commit and push to GitHub
3. The workflow is now ready to use

## Step 4: Trigger Email from Frontend

### JavaScript (Fetch API)

```javascript
async function sendEmailNotification(email, name, type, title) {
  const GITHUB_TOKEN = 'your_github_personal_access_token';
  const REPO_OWNER = 'your_username';
  const REPO_NAME = 'repository_name';

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'send-email',
          client_payload: {
            email: email,
            name: name,
            type: type,  // task, announcement, poll, ticket, thesisProgress
            title: title
          }
        })
      }
    );

    if (response.ok) {
      console.log('Email notification triggered successfully');
    } else {
      console.error('Failed to trigger email:', response.statusText);
    }
  } catch (error) {
    console.error('Error triggering email:', error);
  }
}

// Example usage:
sendEmailNotification(
  'user@example.com',
  'John Doe',
  'task',
  'Complete thesis chapter 3'
);
```

### Using in Your App

Integrate into your admin.js or member.js when creating tasks/announcements:

```javascript
// After task creation in Firestore
async function createTask() {
  // ... existing code to save to Firestore ...
  
  // Get assigned users
  const assignedUserIds = ['user1', 'user2'];
  
  for (const userId of assignedUserIds) {
    // Fetch user email
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Trigger email notification
    await sendEmailNotification(
      userData.email,
      userData.name,
      'task',
      taskTitle
    );
  }
}
```

## Step 5: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` (full control of private repositories)
   - `public_repo` (access public repositories)
4. Copy the token and store it **securely**
5. In your frontend code, replace `your_github_personal_access_token` with this token

## Important Security Notes

⚠️ **DO NOT expose the GitHub token in client-side code!**

### Secure Implementation Options:

**Option A: Store token in backend environment variable**
- Create a backend API endpoint that triggers the GitHub dispatch
- Store the token as an environment variable
- Frontend calls your backend, backend calls GitHub

**Option B: Use GitHub App with limited permissions**
- Create a GitHub App instead of using a personal access token
- More secure and granular permission control

**Option C: Secure backend proxy (Recommended)**
```javascript
// Example: Node.js backend endpoint
app.post('/api/trigger-email', async (req, res) => {
  const { email, name, type, title } = req.body;
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/YOUR_OWNER/YOUR_REPO/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'send-email',
          client_payload: { email, name, type, title }
        })
      }
    );
    
    res.json({ success: response.ok });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Verify It Works

1. Push a small test commit to GitHub
2. Check **Actions** tab in GitHub
3. You should see the workflow running
4. Check the workflow logs to confirm email sent successfully

## Troubleshooting

**Workflow failed with "Missing fields":**
- Ensure client_payload contains: `email`, `name`, `type`, `title`

**Email not sending:**
- Verify Gmail App Password is correct (check in GitHub Secrets)
- Confirm Gmail account has 2-step verification enabled
- Check GitHub Actions logs for error details

**GitHub API returns 401:**
- Personal access token is expired or invalid
- Create a new token with correct permissions

## Cost

✅ **FREE** - GitHub Actions includes 2,000 free workflow minutes per month for personal accounts
