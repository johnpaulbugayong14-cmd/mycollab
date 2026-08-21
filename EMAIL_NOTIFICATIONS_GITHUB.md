# GitHub Email Notifications Setup Guide

## Overview
The My Thesis Hub application now includes automated email notifications powered by **GitHub Actions**. The system sends emails when:

- ✅ Admin releases a task to members
- ✅ Admin creates an announcement
- ✅ Admin creates a poll
- ✅ Members create a support ticket (notifies admin)
- ✅ Tasks are due soon (1-3 days) - reminder to member
- ✅ Tasks are overdue - warning to member

## Email Mapping

The system maps login emails to official notification emails:

| Login Email | Notification Email |
|---|---|
| johnpaulbugayong@gmail.com | johnpaulbugayong14@gmail.com |
| kingfordnabor@gmail.com | kingfordnabor20@gmail.com |
| allancorral@gmail.com | allancorral084@gmail.com |
| phricksborebor@gmail.com | boreborpj16@gmail.com |
| moezarperez@gmail.com | moezarg19@gmail.com |
| rogelioledda@gmail.com | rogelioledda051506@gmail.com |

## Setup Instructions

### Step 1: Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **task-edd4d**
3. Click the **gear icon** (Settings) at the top
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key** button
6. A JSON file will download with your credentials
7. Save this file securely - you'll need these values

From the downloaded JSON file, you'll need:
- `project_id` → FIREBASE_PROJECT_ID
- `private_key` → FIREBASE_PRIVATE_KEY
- `client_email` → FIREBASE_CLIENT_EMAIL

### Step 2: Create Gmail App Password

GitHub Actions will send emails using a Gmail account. You need to:

1. Enable 2-Factor Authentication on your Gmail account
2. Go to [Google Account Security](https://myaccount.google.com/security)
3. Click **App passwords** (appears only if 2FA is enabled)
4. Select **Mail** and **Windows Computer** (or your device)
5. Google will generate a 16-character password
6. Save this password - you'll only see it once

**Important:** This is an **App Password**, NOT your regular Gmail password. It's specific to the application.

### Step 3: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** (top right)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret** for each:

#### Required Secrets:

**1. FIREBASE_PROJECT_ID**
- Value: Your Firebase project ID (from Step 1)
- Example: `task-edd4d`

**2. FIREBASE_PRIVATE_KEY**
- Value: The `private_key` field from your service account JSON
- **Important:** The key contains `\n` characters - keep them as-is
- Example: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBA....\n-----END PRIVATE KEY-----\n`

**3. FIREBASE_CLIENT_EMAIL**
- Value: The `client_email` from your service account JSON
- Example: `firebase-adminsdk-xxxxx@task-edd4d.iam.gserviceaccount.com`

**4. GMAIL_USER**
- Value: Your Gmail address (the one that will send emails)
- Example: `your-email@gmail.com`

**5. GMAIL_PASSWORD**
- Value: The 16-character App Password from Step 2
- Example: `abcd efgh ijkl mnop` (spaces are part of it)

### Step 4: Verify GitHub Actions Enabled

1. Go to **Settings** → **Actions** (left sidebar)
2. Under "Actions permissions", select:
   - ✅ **Allow all actions and reusable workflows**
3. Click **Save**

## How It Works

### Automated Workflows

The system includes **5 GitHub Actions workflows**:

#### 1. **send-task-emails.yml**
- **Trigger:** Every 5 minutes
- **Function:** Checks for new tasks, sends emails to assigned members
- **Marks as sent:** After sending, tasks are marked so no duplicates

#### 2. **send-announcement-emails.yml**
- **Trigger:** Every 5 minutes
- **Function:** Checks for new announcements, sends to all recipients
- **Marks as sent:** Announcements marked after notification sent

#### 3. **send-poll-emails.yml**
- **Trigger:** Every 5 minutes
- **Function:** Checks for new polls, sends to all members
- **Marks as sent:** Polls marked after notification sent

#### 4. **send-ticket-emails.yml**
- **Trigger:** Every 5 minutes
- **Function:** Checks for new support tickets, notifies admin
- **Marks as sent:** Tickets marked after admin notification sent

#### 5. **send-task-reminders.yml**
- **Trigger:** 3 times daily (9 AM, 2 PM, 8 PM UTC)
- **Function:** 
  - Tasks due in 1-3 days → sends "Due Soon" reminder
  - Tasks overdue → sends "Overdue" warning
  - Sends maximum once per day per task (avoids spam)

### Client-Side Integration

The front-end application tracks notifications in Firestore using these fields:

```javascript
// Tasks
{
  emailNotificationSent: true,
  emailNotificationSentAt: Timestamp,
  lastDueSoonNotificationDate: Timestamp,  // For reminders
  lastOverdueNotificationDate: Timestamp   // For overdue warnings
}

// Announcements
{
  emailNotificationSent: true,
  emailNotificationSentAt: Timestamp
}

// Polls
{
  emailNotificationSent: true,
  emailNotificationSentAt: Timestamp
}

// Tickets
{
  adminEmailNotificationSent: true,
  adminEmailNotificationSentAt: Timestamp
}
```

## Monitoring & Troubleshooting

### Check Workflow Status

1. Go to your GitHub repository
2. Click **Actions** tab
3. See the list of recent workflow runs
4. Click on a workflow to see detailed logs

### Common Issues

#### "FIREBASE_PRIVATE_KEY not found"
- ❌ Secret not added to GitHub
- ✅ Add the secret in Settings → Secrets and variables

#### "Invalid Gmail credentials"
- ❌ Using regular Gmail password instead of App Password
- ❌ App Password not entered correctly (includes spaces)
- ✅ Verify you created a Gmail App Password (not regular password)
- ✅ Ensure 2FA is enabled on the Gmail account

#### "VAPID key not configured" or similar Firebase errors
- ❌ Firebase credentials incomplete
- ✅ Verify all 3 Firebase secrets are added correctly
- ✅ Ensure private_key still has `\n` characters

#### Emails not being sent
- Check if workflow ran successfully (Actions tab)
- Verify the task/announcement/poll was created AFTER secrets were added
- Check Gmail's spam folder
- Verify recipient email address in email mapping

### Manual Workflow Trigger

To test a workflow manually:

1. Go to **Actions** tab
2. Click the workflow name (e.g., "Send Task Email Notifications")
3. Click **Run workflow** button
4. Select **Main** branch
5. Click **Run workflow**
6. Check logs for results

## File Structure

```
.github/
  workflows/
    send-task-emails.yml              # Task notifications
    send-announcement-emails.yml      # Announcement notifications
    send-poll-emails.yml              # Poll notifications
    send-ticket-emails.yml            # Ticket notifications (to admin)
    send-task-reminders.yml           # Due soon & overdue reminders

email-config.js                       # Email mapping configuration
```

## Email Template Examples

All emails include:
- Professional HTML formatting
- Relevant task/announcement/poll details
- Direct link to the application
- Clear call-to-action button
- "Do not reply" footer

## Security Notes

✅ **What's secure:**
- App Passwords are specific to GitHub Actions (not your main Gmail password)
- GitHub secrets are encrypted
- Firebase service account is read-only in these workflows
- Email addresses are never exposed in public logs

⚠️ **Best practices:**
- Use a dedicated email account for sending notifications (not your personal Gmail)
- Rotate Gmail App Passwords periodically
- Don't share your Firebase service account JSON
- Review GitHub Actions logs regularly

## Testing the System

### Test Task Notification
1. Log in as admin
2. Create a new task
3. Check the recipient's email in ~5 minutes

### Test Announcement Notification
1. Log in as admin
2. Create a new announcement
3. Emails sent to selected recipients in ~5 minutes

### Test Poll Notification
1. Log in as admin
2. Create a new poll
3. Emails sent to all members in ~5 minutes

### Test Ticket Notification
1. Log in as member
2. Submit a support ticket
3. Admin receives email in ~5 minutes

### Test Task Reminders
1. Create a task with deadline 2 days from now
2. Wait for the scheduled reminder time (9 AM, 2 PM, or 8 PM UTC)
3. Member receives "Due Soon" email

## Disabling Workflows

If you need to temporarily disable email notifications:

1. Go to **Actions** tab
2. Click on the workflow
3. Click the three dots (⋯) menu
4. Click **Disable workflow**
5. Re-enable anytime by clicking the same menu

## Additional Configuration

### Change Email Send Times (Reminders)

Edit `.github/workflows/send-task-reminders.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 * * *'   # Change these times
    - cron: '0 14 * * *'  # Cron format: minute hour * * dayOfWeek
    - cron: '0 20 * * *'
```

Reference: [Cron syntax guide](https://crontab.guru/)

### Change Polling Interval

Edit workflow files to change how often they check (currently every 5 minutes):

```yaml
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes - change the 5 to any number
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review GitHub Actions logs for specific error messages
3. Verify all GitHub secrets are correctly added
4. Test with the manual workflow trigger

---

**Last Updated:** April 2026
**System:** My Thesis Hub Email Notifications v1.0
