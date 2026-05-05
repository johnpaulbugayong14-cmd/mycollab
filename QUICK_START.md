# Quick Start Summary - Email Notifications

## ✅ What Was Created

### GitHub Workflows (5 automated email processors)
```
.github/workflows/
├── send-task-emails.yml              ← Sends emails when admin creates tasks
├── send-announcement-emails.yml      ← Sends emails for announcements
├── send-poll-emails.yml              ← Sends emails for polls
├── send-ticket-emails.yml            ← Sends emails when members create tickets
└── send-task-reminders.yml           ← Daily reminders for due soon/overdue tasks
```

### Configuration Files
```
email-config.js                        ← Email mapping reference
```

### Documentation
```
EMAIL_NOTIFICATIONS_GITHUB.md          ← Complete setup guide
IMPLEMENTATION_GUIDE.md                ← Technical implementation details
QUICK_START.md                         ← This file
```

## 🚀 To Get Started - 5 Steps

### 1️⃣ Get Firebase Credentials
```
Firebase Console → Project Settings → Service Accounts
→ Generate New Private Key → Download JSON file

From the JSON, copy:
- project_id (e.g., task-edd4d)
- private_key (the full key including -----BEGIN/END-----)
- client_email (e.g., firebase-adminsdk-xxxxx@task-edd4d.iam.gserviceaccount.com)
```

### 2️⃣ Create Gmail App Password
```
Gmail Account → Security → 2-Factor Authentication (enable if not done)
→ App passwords → Mail → Generate 16-character password
```

### 3️⃣ Add GitHub Secrets
```
GitHub Repo → Settings → Secrets and variables → Actions
→ Create these 5 secrets:

FIREBASE_PROJECT_ID = task-edd4d
FIREBASE_PRIVATE_KEY = (the full private_key from JSON with \n kept)
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@task-edd4d.iam.gserviceaccount.com
GMAIL_USER = your-email@gmail.com
GMAIL_PASSWORD = your-16-char-app-password
```

### 4️⃣ Enable GitHub Actions
```
GitHub Repo → Settings → Actions
→ Select "Allow all actions and reusable workflows" → Save
```

### 5️⃣ Test the System
```
1. Create a task assigned to a member
2. Wait 5 minutes
3. Check the recipient's notification email inbox
4. Should see "New Task Assigned" email
```

## 📧 Email Recipients Map

| User | Login Email | Receives Emails At |
|------|-------------|-------------------|
| John Paul | johnpaulbugayong@gmail.com | johnpaulbugayong14@gmail.com |
| Kingford | kingfordnabor@gmail.com | kingfordnabor20@gmail.com |
| Allan | allancorral@gmail.com | allancorral084@gmail.com |
| Phricks | phricksborebor@gmail.com | boreborpj16@gmail.com |
| Moezar | moezarperez@gmail.com | moezarg19@gmail.com |
| Rogelio | rogelioledda@gmail.com | rogelioledda051506@gmail.com |

## 🎯 What Emails Will Be Sent

### Task Created (by Admin)
- **To:** Assigned member's notification email
- **Subject:** "New Task Assigned: [Task Title]"
- **When:** Immediately (checked every 5 minutes)

### Announcement Created (by Admin)
- **To:** Selected recipients' notification emails
- **Subject:** "New Announcement: [Title]"
- **When:** Immediately (checked every 5 minutes)

### Poll Created (by Admin)
- **To:** All members' notification emails
- **Subject:** "New Poll: [Question]"
- **When:** Immediately (checked every 5 minutes)

### Support Ticket Submitted (by Member)
- **To:** Admin's notification email (johnpaulbugayong14@gmail.com)
- **Subject:** "New Support Ticket: [Title]"
- **When:** Immediately (checked every 5 minutes)

### Task Due Soon (Automated)
- **To:** Assigned member's notification email
- **Subject:** "Task Due Soon: [Title] (X day(s))"
- **When:** Daily at 9 AM, 2 PM, 8 PM UTC
- **Trigger:** Task deadline is 1-3 days away

### Task Overdue (Automated)
- **To:** Assigned member's notification email
- **Subject:** "⚠️ Task Overdue: [Title]"
- **When:** Daily at 9 AM, 2 PM, 8 PM UTC
- **Trigger:** Task deadline has passed

## 🔍 How to Monitor

### View Workflow Status
```
GitHub Repo → Actions tab
→ See all 5 workflows with their status
→ Click a workflow to see execution history
→ Click a specific run to see detailed logs
```

### Example Success Log
```
✅ Email sent to kingfordnabor20@gmail.com for task: Finish Chapter 3
✅ Email sent to allancorral084@gmail.com for announcement: Monthly Meeting
✅ Email sent to johnpaulbugayong14@gmail.com for ticket: Software Issue
```

## ⚠️ Troubleshooting

### Emails not being sent?

**Check 1: Are workflows running?**
- Go to Actions tab
- Should see recent workflow runs
- If red X: click to see error logs

**Check 2: Are GitHub Secrets correct?**
- Settings → Secrets → verify all 5 exist
- FIREBASE_PRIVATE_KEY should still have `\n` characters
- GMAIL_PASSWORD should be app password (16 chars with spaces)

**Check 3: Is Gmail authentication working?**
- Verify 2-Factor Authentication enabled on Gmail
- Verify using App Password (not regular password)
- Check Gmail spam folder

**Check 4: Did the record get created after secrets were added?**
- Workflows only process records created AFTER they started running
- Try creating a new task/announcement/poll/ticket

### Manual Test
```
Actions tab → click "Send Task Email Notifications" workflow
→ Click "Run workflow" button
→ Select "Main" branch
→ Click "Run workflow"
→ Watch the logs in real-time
```

## 📋 No Changes Needed to Frontend

The **existing admin.js and member.js code works as-is**!

- When admin creates task → stored in Firestore
- GitHub Action picks it up → sends email
- When member creates ticket → stored in Firestore
- GitHub Action picks it up → sends email to admin

No code modifications required! ✅

## 🎓 Email Workflow Details

### 1. Admin Creates Task
```
admin.js → User clicks "Create Task"
         ↓
        Creates task in Firestore (NO emailNotificationSent field yet)
         ↓
        GitHub Action runs every 5 minutes
         ↓
        Detects task with missing emailNotificationSent field
         ↓
        Sends email to member's notification email
         ↓
        Updates Firestore: emailNotificationSent = true
         ↓
        ✅ Done! Next time workflow runs, ignores this task
```

### 2. GitHub Action Sends Reminder
```
send-task-reminders.yml runs 3x daily (9 AM, 2 PM, 8 PM UTC)
         ↓
        Gets all pending tasks with status = "pending"
         ↓
        For each task, calculates days until deadline
         ↓
        If 1-3 days away:
          └─ Check if already sent reminder today
          └─ If not, send "Due Soon" email
          └─ Update: lastDueSoonNotificationDate = today
         ↓
        If overdue:
          └─ Check if already sent overdue warning today
          └─ If not, send "Overdue" warning email
          └─ Update: lastOverdueNotificationDate = today
```

## 💡 Pro Tips

✅ **Test each workflow individually**
- Go to Actions → click specific workflow → Run workflow

✅ **Check logs for detailed info**
- Click on a workflow run to see what emails were sent
- Timestamps show exactly when each email was sent

✅ **View recent workflow activity**
- Actions tab shows all runs (green = success, red = failed)

✅ **Email delays are normal**
- Up to 5 minutes for new task/announcement/poll/ticket emails
- Gmail delivery is usually immediate but can take 1-2 minutes

## 📚 More Information

- **Full Setup Guide:** See [EMAIL_NOTIFICATIONS_GITHUB.md](EMAIL_NOTIFICATIONS_GITHUB.md)
- **Technical Details:** See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- **Email Mapping:** See [email-config.js](email-config.js)

---

## ✨ System is Ready!

Once you complete the 5 setup steps above:
1. ✅ Tasks, announcements, and polls will automatically send emails
2. ✅ Members will receive reminders for upcoming deadlines
3. ✅ Admins will be notified of support tickets
4. ✅ All emails go to the official notification email addresses
5. ✅ GitHub Actions handles everything automatically 24/7

**No additional code needed!** 🎉

---

**Last Updated:** April 2026  
**Version:** 1.0  
**Status:** Ready to Deploy
