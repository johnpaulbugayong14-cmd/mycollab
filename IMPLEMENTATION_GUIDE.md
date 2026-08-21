# Email Notifications Implementation Guide

## 📧 System Overview

The email notification system is now fully integrated with GitHub Actions. When admins or members perform key actions, automated emails are sent to the appropriate recipients.

## 🔄 How It Works

### Architecture

```
User Action (Create Task/Announcement/Poll/Ticket)
          ↓
Stored in Firestore
          ↓
GitHub Actions (Runs every 5 minutes)
          ↓
Checks for unsent notifications
          ↓
Sends email via Gmail SMTP
          ↓
Marks record as notified in Firestore
```

## 📋 Notification Types

### 1. Task Assigned (Admin → Member)
- **Trigger:** Admin creates a new task
- **Recipient:** Assigned member (uses notification email)
- **Frequency:** Sent once immediately
- **Database Field:** `emailNotificationSent`

### 2. Announcement Created (Admin → Members)
- **Trigger:** Admin creates announcement
- **Recipient:** Selected members (uses notification emails)
- **Frequency:** Sent once immediately
- **Database Field:** `emailNotificationSent`

### 3. Poll Created (Admin → All Members)
- **Trigger:** Admin creates a poll
- **Recipient:** All members (uses notification emails)
- **Frequency:** Sent once immediately
- **Database Field:** `emailNotificationSent`

### 4. Support Ticket Submitted (Member → Admin)
- **Trigger:** Member submits a support ticket
- **Recipient:** Admin only (uses notification email)
- **Frequency:** Sent once per ticket
- **Database Field:** `adminEmailNotificationSent`

### 5. Task Due Soon Reminder (System → Member)
- **Trigger:** Task deadline is 1-3 days away
- **Recipient:** Assigned member
- **Frequency:** Once per day per task
- **Database Field:** `lastDueSoonNotificationDate`

### 6. Task Overdue Warning (System → Member)
- **Trigger:** Task deadline has passed
- **Recipient:** Assigned member
- **Frequency:** Once per day per task
- **Database Field:** `lastOverdueNotificationDate`

## 🛠️ Installation & Setup

### Prerequisites
- GitHub repository access
- Firebase project (task-edd4d)
- Gmail account with 2-Factor Authentication enabled

### Step-by-Step Setup

1. **Get Firebase Credentials**
   - Firebase Console → Project Settings → Service Accounts
   - Generate private key (JSON file)
   - Extract: `project_id`, `private_key`, `client_email`

2. **Create Gmail App Password**
   - Google Account → Security
   - Enable 2-Factor Authentication
   - App passwords → Select Mail
   - Generate 16-character app password

3. **Add GitHub Secrets**
   - Repository → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_PRIVATE_KEY`
     - `FIREBASE_CLIENT_EMAIL`
     - `GMAIL_USER`
     - `GMAIL_PASSWORD`

4. **Enable GitHub Actions**
   - Settings → Actions → Allow all actions and reusable workflows

5. **Verify Installation**
   - Actions tab → See all 5 workflows enabled
   - Workflows should show green checkmarks

## 📁 Project Files

### New Files Created

```
.github/workflows/
├── send-task-emails.yml              # Task notifications (5-min interval)
├── send-announcement-emails.yml      # Announcement notifications (5-min interval)
├── send-poll-emails.yml              # Poll notifications (5-min interval)
├── send-ticket-emails.yml            # Ticket notifications (5-min interval)
└── send-task-reminders.yml           # Due soon & overdue reminders (3x daily)

root/
├── email-config.js                   # Email mapping reference
├── EMAIL_NOTIFICATIONS_GITHUB.md     # Setup guide
└── IMPLEMENTATION_GUIDE.md           # This file
```

## 🔐 Email Mapping (for reference)

Defined in all GitHub workflow files:

```javascript
const emailMapping = {
  'johnpaulbugayong@gmail.com': 'johnpaulbugayong14@gmail.com',
  'kingfordnabor@gmail.com': 'kingfordnabor20@gmail.com',
  'allancorral@gmail.com': 'allancorral084@gmail.com',
  'phricksborebor@gmail.com': 'boreborpj16@gmail.com',
  'moezarperez@gmail.com': 'moezarg19@gmail.com',
  'rogelioledda@gmail.com': 'rogelioledda051506@gmail.com'
};
```

## 🚀 Testing

### Test Task Email
```
1. Login as: johnpaulbugayong@gmail.com
2. Create task assigned to: kingfordnabor@gmail.com
3. Wait 5 minutes
4. Check: kingfordnabor20@gmail.com inbox
```

### Test Announcement Email
```
1. Login as admin
2. Create announcement, select recipients
3. Wait 5 minutes
4. Check recipients' emails
```

### Test Poll Email
```
1. Login as admin
2. Create a new poll
3. Wait 5 minutes
4. All members receive email
```

### Test Ticket Email
```
1. Login as: kingfordnabor@gmail.com
2. Submit support ticket
3. Wait 5 minutes
4. Check: johnpaulbugayong14@gmail.com inbox
```

### Test Task Reminders
```
1. Create task with deadline 2 days from now
2. Wait for 9 AM, 2 PM, or 8 PM UTC
3. Member receives "Due Soon" email
4. Task overdue → member receives "Overdue" warning
```

## 📊 Monitoring

### GitHub Actions Dashboard
1. Repository → Actions tab
2. View workflow runs and logs
3. Check execution time and results

### Common Patterns in Logs

**✅ Successful execution:**
```
Found X new tasks to notify
✅ Email sent to recipient@email.com for task: Task Title
```

**❌ Error examples:**
```
FIREBASE_PRIVATE_KEY not found
Invalid Gmail credentials
Failed to send email
```

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflows not running | Enable GitHub Actions in Settings |
| "Secrets not found" errors | Verify all 5 secrets added correctly |
| Gmail authentication fails | Use App Password (not regular password), enable 2FA |
| Firebase errors | Check service account JSON is valid, private_key has `\n` |
| Emails going to spam | Check spam folder, Gmail filtering rules |
| Duplicate emails | Check if `emailNotificationSent` field is being updated |

## 💡 How the Frontend Works

**No changes needed in admin.js or member.js!**

The system automatically sends emails when:

1. **Task created** → GitHub Action detects `emailNotificationSent: false` → sends email
2. **Announcement created** → GitHub Action detects → sends emails
3. **Poll created** → GitHub Action detects → sends emails
4. **Ticket submitted** → GitHub Action detects → sends email to admin
5. **Daily reminders** → GitHub Action checks deadline dates → sends reminders

### Database Fields Automatically Added/Updated

**Tasks:**
```javascript
{
  // Existing fields...
  title: "Task Title",
  deadline: "2024-05-01",
  
  // New fields (added by GitHub Actions):
  emailNotificationSent: true,
  emailNotificationSentAt: Timestamp,
  lastDueSoonNotificationDate: Timestamp,
  lastOverdueNotificationDate: Timestamp
}
```

**Announcements:**
```javascript
{
  // Existing fields...
  title: "Announcement",
  
  // New fields (added by GitHub Actions):
  emailNotificationSent: true,
  emailNotificationSentAt: Timestamp
}
```

## 🔄 Workflow Execution Schedule

| Workflow | Trigger | Frequency |
|----------|---------|-----------|
| send-task-emails.yml | Schedule | Every 5 minutes (24/7) |
| send-announcement-emails.yml | Schedule | Every 5 minutes (24/7) |
| send-poll-emails.yml | Schedule | Every 5 minutes (24/7) |
| send-ticket-emails.yml | Schedule | Every 5 minutes (24/7) |
| send-task-reminders.yml | Schedule | 3 times daily (9 AM, 2 PM, 8 PM UTC) |

All workflows can also be manually triggered from Actions tab.

## 🎯 Key Features

✅ **Fully Automated** - No manual email configuration needed  
✅ **Duplicate Prevention** - Tracks sent notifications  
✅ **Spam Prevention** - Reminders sent max once per day per task  
✅ **User-Friendly** - Professional HTML email templates  
✅ **Scalable** - Works with any number of users  
✅ **Secure** - Uses Gmail App Passwords, GitHub Secrets  
✅ **Reliable** - GitHub Actions infrastructure  
✅ **Monitored** - Easily check logs and execution history  

## 📝 Email Template Examples

All emails include:
- Project branding (My Thesis Hub)
- Relevant details (task title, deadline, etc.)
- Direct action link to the application
- Professional formatting
- "Do not reply" footer

## 🔒 Security Considerations

✅ **What's Protected:**
- Gmail App Passwords are NOT your regular password
- GitHub Secrets are encrypted
- Firebase credentials are server-side only
- Emails never expose sensitive information

⚠️ **Best Practices:**
- Use a dedicated Gmail for notifications (not personal)
- Rotate passwords periodically
- Review workflow logs for suspicious activity
- Don't share Firebase service account JSON

## 📞 Support & Maintenance

### Common Maintenance Tasks

**Update email mapping:**
- Edit email mapping in all 5 workflow files
- No code deployment needed

**Change reminder times:**
- Edit `send-task-reminders.yml` cron schedule
- Commit and push changes

**Disable notifications temporarily:**
- GitHub Actions → workflow → Disable workflow
- Can re-enable anytime

**View execution logs:**
- Actions tab → click workflow run → see detailed logs

## 🚀 Future Enhancements

Possible additions:
- SMS notifications
- In-app notification center
- User notification preferences
- Email digest (weekly summary)
- Custom email templates
- Notification history

---

**For detailed setup instructions, see:** [EMAIL_NOTIFICATIONS_GITHUB.md](EMAIL_NOTIFICATIONS_GITHUB.md)

**Last Updated:** April 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready
