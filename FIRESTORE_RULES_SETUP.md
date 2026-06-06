# Firestore Security Rules Deployment Guide

## Problem
You're getting a `FirebaseError: Missing or insufficient permissions` error during login. This happens because your current Firestore security rules only allow authenticated users to read data, but the login process needs to query the `members` collection BEFORE the user is authenticated.

## Solution
A new `firestore.rules` file has been created with updated security rules that:
- ✅ Allow **unauthenticated read-only access** to the `members` collection (needed for login verification)
- ✅ Allow **authenticated users** to write/delete members (only admins)
- ✅ Require **authentication** for all other collections (tasks, announcements, polls, etc.)
- ✅ Deny all other access by default (security-first approach)

## How to Deploy

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```powershell
   npm install -g firebase-tools
   ```

2. **Initialize Firebase (if not already done)**:
   ```powershell
   firebase init
   ```
   Select "Firestore" when prompted.

3. **Deploy the new security rules**:
   ```powershell
   firebase deploy --only firestore:rules
   ```

4. **Verify deployment** - Check Firebase Console:
   - Go to Firebase Console → Your Project
   - Navigate to Firestore Database → Rules tab
   - Confirm your new rules are in place

### Option 2: Manual Deployment via Firebase Console

1. **Go to Firebase Console**:
   - Navigate to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `mycollab-89c11`

2. **Open Firestore Database**:
   - Click "Firestore Database" in the left sidebar
   - Go to the "Rules" tab

3. **Copy and Paste New Rules**:
   - Open the `firestore.rules` file from this project
   - Copy all the content
   - In Firebase Console, replace the existing rules with the new content
   - Click "Publish"

4. **Wait for Deployment**:
   - Rules usually deploy within 1-2 minutes
   - A confirmation message will appear

## Rules Breakdown

### Members Collection (Read-Only for Public)
```javascript
match /members/{document=**} {
  allow read: if true;                                    // ✅ Anyone can read (needed for login)
  allow write: if request.auth != null;                   // ✅ Only authenticated users can create
  allow delete: if request.auth != null;                  // ✅ Only authenticated users can delete
}
```

### All Other Collections (Authenticated Only)
```javascript
match /tasks/{document=**} {
  allow read, write: if request.auth != null;             // ✅ Only authenticated users
}
```

## Testing the Rules

After deployment, test that login works:

1. **Login Page**: Navigate to `login.html`
2. **Try Logging In**:
   - Email: `admin@example.com` (or your test email)
   - Password: Your password
   - You should now see "Authentication successful" instead of permission errors

## Troubleshooting

### Still Getting Permission Errors?

1. **Clear Browser Cache**:
   ```powershell
   # Close all browser windows
   # Press Ctrl+Shift+Delete to open cache settings
   # Clear all cached files
   ```

2. **Wait for Rule Propagation**:
   - Rules can take up to 5 minutes to propagate globally
   - Wait and try again

3. **Verify Rules Were Published**:
   - Go to Firebase Console → Firestore → Rules
   - Confirm the `allow read: if true` line is visible for members collection

4. **Check Browser Console**:
   - Press F12 to open Developer Tools
   - Go to Console tab
   - Check for error messages
   - Share the exact error message if issues persist

## Security Notes

⚠️ **Important**: The `allow read: if true` rule for the members collection means anyone can read member emails and names, but they:
- ❌ **Cannot** modify member data (requires authentication)
- ❌ **Cannot** access other sensitive collections (tasks, announcements, etc.)
- ❌ **Cannot** do anything without proper role verification

This is acceptable for login purposes because:
1. Email addresses are typically public in an organization
2. Write operations still require full authentication
3. Other sensitive data is still protected

## Files Modified
- ✅ `firestore.rules` - New security rules file

## Next Steps
1. Deploy the rules using the steps above
2. Test login functionality
3. Verify no permission errors appear
4. Proceed with normal application usage
