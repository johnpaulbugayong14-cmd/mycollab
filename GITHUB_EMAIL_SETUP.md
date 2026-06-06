# GitHub Actions Email Notifications - Setup for Your App

Email notifications have been integrated into your app! Follow these steps to enable them.

## Step 1: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select these scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `public_repo` (Access public repositories)
4. Click **Generate token** and copy it immediately
5. Save it securely — you'll use it in the next step

## Step 2: Configure Your App

### Option A: Environment Variables (Recommended for Production)

Create a `.env` file in your `www/` folder:

```
VITE_GITHUB_TOKEN=your_token_here
VITE_GITHUB_REPO_OWNER=your_github_username
VITE_GITHUB_REPO_NAME=mytaskprofessionalJpteams-main
```

Then update `admin.js` and `member.js`:

Replace this:
```javascript
const GITHUB_EMAIL_CONFIG = {
  enabled: false,
  githubToken: '',
  repoOwner: '',
  repoName: ''
};
```

With this:
```javascript
const GITHUB_EMAIL_CONFIG = {
  enabled: true,
  githubToken: import.meta.env.VITE_GITHUB_TOKEN || '',
  repoOwner: import.meta.env.VITE_GITHUB_REPO_OWNER || '',
  repoName: import.meta.env.VITE_GITHUB_REPO_NAME || ''
};
```

### Option B: Hardcode Token (Development Only - NOT for production)

In `admin.js` and `member.js`, replace:

```javascript
const GITHUB_EMAIL_CONFIG = {
  enabled: false,
  githubToken: '',
  repoOwner: '',
  repoName: ''
};
```

With:

```javascript
const GITHUB_EMAIL_CONFIG = {
  enabled: true,
  githubToken: 'your_github_token_here',
  repoOwner: 'your_github_username',
  repoName: 'mytaskprofessionalJpteams-main'
};
```

**⚠️ NEVER commit the token to GitHub!** Add `.env` to `.gitignore`

## Step 3: Verify Gmail Configuration

Check that these GitHub Secrets are set in your repository:

1. Go to: **Settings** → **Secrets and variables** → **Actions**
2. Verify these exist:
   - `GMAIL_USER`: `mythesishubautonotify@gmail.com`
   - `GMAIL_PASS`: `bkeylfuuwabpezsj`

If not, add them now.

## Step 4: Where Emails Are Triggered

Emails are now sent automatically when:

| Action | Email Sent To | Type |
|--------|--------------|------|
| Create Task | Assigned User | `task` |
| Create Poll | All Members | `poll` |
| Create Announcement | Assigned Users | `announcement` |
| Submit Ticket | Admin | `ticket` |

## Step 5: Test It

1. Enable the feature in admin.js or member.js (set `enabled: true`)
2. Perform an action (create a task, announcement, etc.)
3. Check GitHub **Actions** tab to see the workflow run
4. Check your email inbox (or spam folder)

## What Happens When You Create Something

**Creating a Task:**
```
✅ Notification saved to Firestore
✅ Local notification shown in app
✅ GitHub Actions workflow triggered
✅ Email sent via Gmail SMTP
```

## Email Format

```
From: mythesishubautonotify@gmail.com
Subject: New {type} assigned to you

Body:
Hello {name},

You have a new {type}: {title}

Please log in to your account to review the details.

— MyThesisHub Automated System Notification
```

## Troubleshooting

### Email not being sent?

1. **Check if enabled:** Verify `enabled: true` in admin.js/member.js
2. **Check token:** Ensure token is valid and hasn't expired
3. **Check workflow:** Go to GitHub Actions tab and look for failed runs
4. **Check secrets:** Verify `GMAIL_USER` and `GMAIL_PASS` are set
5. **Check Firestore:** Ensure documents have `title` and `assignedTo` fields

### GitHub API returns 401?

- Token has expired or incorrect permissions
- Create a new personal access token
- Update the token in your app

### Workflow runs but email doesn't send?

- Check workflow logs in GitHub Actions
- Verify Gmail account has 2-step verification enabled
- Check that app password is correct (should be 16 characters, no spaces)
- Verify recipient email exists and is valid

## Important Security Notes

⚠️ **DO NOT:**
- Commit your GitHub token to the repository
- Share your GitHub token with anyone
- Use a production token in development

✅ **DO:**
- Store tokens in `.env` files (add to `.gitignore`)
- Use environment variables in production
- Rotate tokens regularly
- Use GitHub Secrets for CI/CD workflows

## Next Steps

1. Get your GitHub Personal Access Token (instructions above)
2. Set up environment variables or hardcode for development
3. Set `enabled: true` in admin.js and member.js
4. Test by creating a task/announcement
5. Check GitHub Actions to verify workflow runs successfully
6. Check your email to confirm delivery

---

**Questions?** Check the GitHub Actions workflow logs in your repository for detailed error messages.
