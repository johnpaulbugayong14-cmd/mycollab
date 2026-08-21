# Push Notifications Setup Guide

## Overview
The My Thesis Hub now includes a comprehensive notification system that alerts users on their devices when new tasks, announcements, or polls are created.

## Features
- **Push Notifications**: Browser-based push notifications with vibration and sound
- **Local Fallback**: Local notifications when push notifications aren't available
- **Smart Targeting**: Notifications sent only to relevant users
- **Offline Support**: Service worker handles notifications even when app is closed

## Current Implementation
- ✅ Notification permission requests
- ✅ Push notification subscription
- ✅ Local notification fallbacks
- ✅ Notification queuing in Firestore
- ✅ Service worker push handling
- ⚠️ **Server-side push delivery** (requires additional setup)

## Setup Instructions

### 1. Configure VAPID Keys (Required for Push Notifications)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`task-edd4d`)
3. Go to **Project Settings** > **Cloud Messaging**
4. Scroll to **Web Push certificates**
5. Click **Generate key pair**
6. Copy the **public key**
7. Open `notifications.js`
8. Replace `'YOUR_VAPID_PUBLIC_KEY_HERE'` with your actual public key

### 2. Server-Side Push Delivery (Optional but Recommended)
To send actual push notifications, you need a server component. Here are your options:

#### Option A: Firebase Cloud Functions (Recommended)
```javascript
// Example Cloud Function
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();

    // Get user subscriptions from Firestore
    // Send push notifications using web-push library
    // Mark notification as sent
  });
```

#### Option B: Custom Server
Set up a Node.js server using the `web-push` library to handle notification delivery.

### 3. Test the System
1. Open the app in a browser that supports notifications
2. Grant notification permission when prompted
3. Create a task/announcement/poll as admin
4. Check if notifications appear

## Notification Types

### Tasks
- **Target**: Specific assigned user (or everyone)
- **Title**: "New Task Assigned"
- **Body**: "You have been assigned a new task: [task title]"

### Announcements
- **Target**: Selected recipients
- **Title**: "New Announcement"
- **Body**: "New announcement: [announcement title]"

### Polls
- **Target**: All members
- **Title**: "New Poll Created"
- **Body**: "A new poll has been created: [poll question]"

## Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited support (iOS 16.4+)
- Mobile browsers: Generally good support

## Troubleshooting

### Notifications not appearing
1. Check browser notification permissions
2. Verify VAPID key is configured
3. Check browser console for errors
4. Ensure service worker is registered

### Push notifications not working
1. VAPID key must be configured
2. Server-side component required for actual push delivery
3. HTTPS required for push notifications in production

## Security Notes
- VAPID keys are public and can be safely stored in client code
- User subscriptions are stored securely
- Notifications are sent only to authorized recipients