# GitHub Secrets Setup Guide - Ready to Configure

## 📋 Your Credentials Extracted

Here are the exact values to add to GitHub Secrets:

### Secret 1: FIREBASE_PROJECT_ID
```
Value: task-edd4d
```

### Secret 2: FIREBASE_CLIENT_EMAIL
```
Value: firebase-adminsdk-fbsvc@task-edd4d.iam.gserviceaccount.com
```

### Secret 3: FIREBASE_PRIVATE_KEY
```
IMPORTANT: Copy the ENTIRE private_key value including the BEGIN and END lines.
The value already contains \n characters - paste it exactly as-is.

Value:
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDPb/0mMilxTIfJ
S8blQu+vnihmG8HIai+w76yQ8PeLfYl63KnpKtLXINU+EbvfWJJQHhN1tMWq1RLt
6hBNnzJG3WTsF7LQjqM7jNlA5fkuJg47LVlyLfJm5ahzK/Fphag6v4sfL473mRqN
46oEFiL8pskZzxdBU+RAEcLMTU1r4OF2LjlHQ/HUQTJUFSnmRxP3jPmzuae9CWV0
j5BhWaFVvJDfnVD8VhloquqivpQjGWTb/5mv4FCE2c1vuzHGwVNfsnALykdVWco2
trBZ35xrfDyZx/oVfD3QX156BVO2vyGW38yrCch89dMgdAzAMV+yXjH5gsJYf37M
M8lGasvfAgMBAAECggEATPlyh7zvcfKDJKgw2xwWkyVuOk2sf/EfV1nowDQat7FS
1buSdUqFyHyPhKPSAlP8nyw57mCxRO4iQxSrDhK39mHrNEyq9wcm/U8LwzBTYdOP
TlhKq7rvC03HT02MHKsTPRGcz2q3c5tlpidIDJImU3iUgTY+m+hEd53fmi5JP3Ec
3ga7KIYVU2ABpoaMsUG8SNAlqworGkT3Nxuq9P24zukw5+lCrgoVjv9qUEF6TMdh
MAxW90mExE0PFbiWaRZG/3o/ETKEf6wnZaLQfwOIsdKKPGCBhh8DeFN9Xk5jkJ5W
cyi6SuBUmvdQfiXyV4dc/X0cP2fwl6JWTppNmwxReQKBgQD34BXjQV0fBq09+8Va
g3zdjkfrHaMBmAfdcQCg5XLhOX5ch6q7z2w2c4oSKSO76oRGCyCGC8On3mC26lra
RPvpzvvfo6gRPBQdnKh+OBAGA4I5MErozV8IGOPdY4Ai5uF7D6tOWTJlvNVCzSrO
rpi28JIsEbq4xy8X36xXbFHg8wKBgQDWPJcg9y7GfhDgCIRTZLOFjlnXnRcpzvsN
YGJqzEQVK5n9NsFHnHfSq/prcUJknRL/5PNsvk7UJhHOVLQ/yHYn1AzYmuXivvTR
SiptW3yTn5OQ/2nIloBKuXuiP9cfKJYWxQba8C2a8x6fPKNw5bwGC++Qa+Pev9Jt
1zS731HEZQKBgQDFS7OgQzKfs2zJXVDkjqwgnVNZLSnF5wC7nWpmprsd0elmNQYM
nzj+zlAjzGMI+811Av5MM6j0QOiyLy9JdIcevwV0KItpzGwmdb8XWABJCRnp8yps
yqrNgyI74SronOT0UrCDmDOpDvigRzW/dPFRC4MNWL9KvCAb3IkMvMcfSQKBgF4H
Id2aH7GGyylJE6r2W8SWgeAcVnpHGfD5CLkPBiK0jFWSnqorhnu0d6iIgTdfqWMe
vahQrpB2VQJWMvZ7qUA51ZmMArHOVe01vAFbUgYI19+f+nHLfGtPlW/UzTojuhws
RaH6IEoNwrbpCmMWsbuFqZOdhtnRHy6OcdqzXVPxAoGARCm2HIdM++V1vrAeJRkn
aQWaiRy60A/7BPJVpOqTPYhGHfP0IpeSguB1J3zgCODA8udaU7gC8PQMSFRcAAtb
fCAAE0c2+ra5Sw1qFSWH3DPUfAbaOmFyLqO7/w72ZtZ3dm5ZPoE2buc452xteMGY
ruinmOlLRev1i9FUttOZROM=
-----END PRIVATE KEY-----
```

### Secret 4: GMAIL_USER
```
Value: mythesishubautonotify@gmail.com
```

### Secret 5: GMAIL_PASSWORD
```
Value: gwlz dcot gkgt zhvv
(Copy exactly with spaces)
```

---

## 🔐 Step-by-Step: Add Secrets to GitHub

### Step 1: Go to Your Repository Settings
1. Open your GitHub repository in browser
2. Click **Settings** (top menu)
3. Click **Secrets and variables** (left sidebar)
4. Click **Actions**

### Step 2: Create First Secret (FIREBASE_PROJECT_ID)
1. Click **New repository secret** button
2. **Name:** `FIREBASE_PROJECT_ID`
3. **Secret:** `task-edd4d`
4. Click **Add secret**

### Step 3: Create Second Secret (FIREBASE_CLIENT_EMAIL)
1. Click **New repository secret** button
2. **Name:** `FIREBASE_CLIENT_EMAIL`
3. **Secret:** `firebase-adminsdk-fbsvc@task-edd4d.iam.gserviceaccount.com`
4. Click **Add secret**

### Step 4: Create Third Secret (FIREBASE_PRIVATE_KEY)
1. Click **New repository secret** button
2. **Name:** `FIREBASE_PRIVATE_KEY`
3. **Secret:** Paste the ENTIRE private key (including -----BEGIN and -----END lines)
   - ⚠️ IMPORTANT: The value should contain `\n` characters - keep them!
   - Copy from "-----BEGIN PRIVATE KEY-----" to "-----END PRIVATE KEY-----"
4. Click **Add secret**

### Step 5: Create Fourth Secret (GMAIL_USER)
1. Click **New repository secret** button
2. **Name:** `GMAIL_USER`
3. **Secret:** `mythesishubautonotify@gmail.com`
4. Click **Add secret**

### Step 6: Create Fifth Secret (GMAIL_PASSWORD)
1. Click **New repository secret** button
2. **Name:** `GMAIL_PASSWORD`
3. **Secret:** `gwlz dcot gkgt zhvv`
   - ⚠️ IMPORTANT: Include the spaces exactly as provided
4. Click **Add secret**

---

## ✅ Verify All Secrets Are Added

After adding all 5 secrets, your Secrets page should show:

```
✓ FIREBASE_PROJECT_ID
✓ FIREBASE_CLIENT_EMAIL
✓ FIREBASE_PRIVATE_KEY
✓ GMAIL_USER
✓ GMAIL_PASSWORD
```

Each secret will show "Updated X seconds ago" confirming they were saved.

---

## 🚀 Next Step: Enable GitHub Actions

After adding secrets:

1. Go to **Settings** → **Actions** (left sidebar)
2. Under "Actions permissions", select:
   - ✅ **Allow all actions and reusable workflows**
3. Click **Save**

---

## 🧪 Test the System

Once secrets are added and GitHub Actions is enabled:

1. Go to your GitHub repository
2. Click **Actions** tab
3. You should see all 5 workflows listed:
   - send-task-emails
   - send-announcement-emails
   - send-poll-emails
   - send-ticket-emails
   - send-task-reminders

4. To test manually:
   - Click on a workflow (e.g., "Send Task Email Notifications")
   - Click **Run workflow** button
   - Select **Main** branch
   - Click **Run workflow**
   - Watch the logs to see if it runs successfully

---

## ⚠️ Important Notes

### About the Private Key
- ✅ Paste the ENTIRE key including "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----"
- ✅ The `\n` characters in the key are normal - they represent line breaks
- ❌ Don't remove or modify the `\n` characters
- ❌ Don't add extra quotes or escaping

### About the Gmail Password
- ✅ This is the 16-character **App Password**, not your regular Gmail password
- ✅ The spaces are part of the password - copy them exactly: `gwlz dcot gkgt zhvv`
- ❌ Don't remove the spaces
- ✅ If you ever lose this, you can generate a new one in Google Account settings

### Credential Security
- ✅ GitHub Secrets are encrypted
- ✅ Secrets are NOT shown in workflow logs
- ✅ Only workflows can access them
- ❌ Never commit credentials to the repository

---

## 📞 Troubleshooting

### "Secret not found" error in workflow logs
- Verify all 5 secrets are added
- Check spelling of secret names (case-sensitive)
- Make sure values are pasted correctly

### Gmail authentication fails
- Verify 2-Factor Authentication is enabled on Gmail
- Verify the App Password is correct: `gwlz dcot gkgt zhvv`
- Check if you're using App Password (not regular password)
- Spaces in app password are important: `gwlz dcot gkgt zhvv` (not `gwlzdoctgktzhvv`)

### Firebase errors
- Verify the private key includes "-----BEGIN PRIVATE KEY-----" at start
- Verify the private key includes "-----END PRIVATE KEY-----" at end
- Verify `\n` characters are preserved (don't replace them with actual newlines)

---

## ✨ After Setup Complete

Once all 5 secrets are added:
1. ✅ GitHub Actions can access Firebase
2. ✅ GitHub Actions can send emails via Gmail
3. ✅ Workflows will run on schedule automatically
4. ✅ Email notifications will be sent for tasks, announcements, polls, tickets, and reminders

---

**Status:** Ready to configure!  
**Next:** Add these 5 secrets to GitHub following the steps above.

Your credentials are secure and will only be used by GitHub Actions workflows running in your repository.
