# Jitsi Meet Integration - Video Conference Feature

## Overview

This Jitsi Meet integration adds embedded video conferencing capabilities to your Firebase web app. Users can create new conference rooms or join existing ones with unique room IDs, all without leaving the application interface.

## Features

✅ **Embedded Video Calls** - Jitsi Meet conferences run inside the app UI (no external redirects)
✅ **Unique Room IDs** - Automatically generated using timestamp and random strings (format: `conference-YYYYMMDDHHMMSS-XXXXXX`)
✅ **Room Creation** - Users can create new conference rooms instantly
✅ **Join Existing Rooms** - Share room IDs to allow others to join
✅ **Firestore Session Tracking** - Optional database logging for room history and analytics
✅ **Participant Management** - Track and display participant count
✅ **Copy Room ID** - Easy sharing of room IDs via clipboard
✅ **Authentication Required** - Integrated with Firebase Auth
✅ **Mobile Responsive** - Works on desktop, tablet, and mobile devices

## File Structure

```
video-room.html          - Main video conference UI
jitsi-meet.js           - JavaScript logic and Firestore integration
```

## How It Works

### 1. **Accessing Video Conference**
- Click the **"Video Conference"** button in the member dashboard sidebar
- Or navigate directly to `/video-room.html`

### 2. **Creating a New Room**
```
1. Click "Video Conference" in sidebar
2. Enter your name in "Create New Room" section
3. Click "Create Room"
4. A unique room ID is generated (e.g., conference-20240423143527-ABC123)
5. Conference starts immediately
6. Room is tracked in Firestore `video_sessions` collection
```

### 3. **Joining an Existing Room**
```
1. Click "Video Conference" in sidebar
2. Enter the room ID you want to join
3. Enter your name
4. Click "Join Room"
5. You join the existing conference
6. Firestore session is updated with your participation
```

### 4. **During Conference**
- **Leave Conference** - Exit the video call and return to setup screen
- **Participants** - View participant count (if supported by Jitsi API)
- **Copy Room ID** - Share the room ID with others
- **Back** - Navigate back to member dashboard (will prompt if in active conference)

## Firestore Database Schema

The integration uses a `video_sessions` collection with the following structure:

```javascript
{
  roomId: "conference-20240423143527-ABC123",
  creatorEmail: "user@example.com",
  creatorName: "John Doe",
  createdAt: Timestamp,
  endedAt: Timestamp (added when conference ends),
  status: "active" | "inactive",
  participants: [
    {
      email: "participant@example.com",
      name: "Jane Doe",
      joinedAt: Timestamp
    },
    // ... more participants
  ],
  maxParticipants: 3  // Max participants during session
}
```

## Local Testing

To test locally:

1. **Ensure Firebase is configured** in `firebase.js` with your project credentials
2. **Set up Firestore security rules** (see rules below)
3. **Open `video-room.html`** in your browser
4. **Must be authenticated** - Log in first via `login.html`
5. **Test room creation** - Create a new room with your name
6. **Test room joining** - Open another browser tab, join the same room with a different name
7. **Check Firestore** - Go to Firebase Console → Firestore Database to see session records

### Firestore Security Rules

Add these rules to your Firestore to allow authenticated users to manage video sessions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write video_sessions
    match /video_sessions/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Configuration

### Jitsi Meet Server
Currently configured to use the public Jitsi Meet server: `meet.jit.si`

To use a **custom Jitsi server**, modify in `jitsi-meet.js`:
```javascript
const options = {
  roomName: roomId,
  // ... other options
};

// Change 'meet.jit.si' to your custom server
jitsiApi = new window.JitsiMeetExternalAPI('your-custom-server.com', options);
```

### Custom Configuration

In `jitsi-meet.js`, the `configOverwrite` object controls Jitsi behavior:

```javascript
configOverwrite: {
  startWithAudioMuted: false,      // Users start with mic on
  startWithVideoMuted: false,      // Users start with camera on
  disableSimulcast: false,         // Enable adaptive bitrate
  p2p: {
    enabled: true                  // Enable peer-to-peer mode
  },
  prejoinPageEnabled: false,       // Skip pre-join screen
  defaultLanguage: 'en'            // Default UI language
}
```

## Room ID Generation

Room IDs are generated using the function `generateRoomId()`:

```javascript
function generateRoomId() {
  const now = new Date();
  const dateStr = now.toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, '')
    .replace('T', '');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `conference-${dateStr}-${randomStr}`;
}
```

**Format**: `conference-YYYYMMDDHHMMSS-XXXXXX`
- **YYYYMMDDHHMMSS** - Timestamp when room was created
- **XXXXXX** - 6-character random string for uniqueness

## Integration with Member Dashboard

The Video Conference button is integrated into `member.html`:

```html
<li><button class="nav-btn" onclick="showSection('video-conference')">
  <i class="fas fa-video"></i> Video Conference
</button></li>
```

Users can switch between sections using the sidebar navigation.

## Browser Compatibility

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements**: WebRTC support, Microphone & Camera permissions

## Troubleshooting

### "Not authenticated" error
- Make sure you're logged in first
- Go to `login.html` and authenticate before accessing video conference

### Jitsi iframe not loading
- Check browser console for errors
- Verify internet connection
- Ensure Jitsi Meet server is accessible
- Check firewall/proxy settings

### No audio/video
- Grant microphone and camera permissions when prompted
- Check browser permissions settings
- Verify webcam/microphone are working and not in use by other apps

### Room not appearing in Firestore
- Check Firestore security rules are configured
- Verify `video_sessions` collection is created
- Ensure user has write permissions to Firestore

### Can't join room
- Verify the room ID is correct (case-sensitive)
- Check that room creator hasn't left yet
- Firestore may not have the session active - try creating a new room

## Optional Enhancements

### 1. Add Recording Feature
```javascript
// Add recording option in Jitsi config
configOverwrite: {
  fileRecordingsEnabled: true,
  dropbox: {
    appKey: 'YOUR_DROPBOX_APP_KEY'  // For cloud recording
  }
}
```

### 2. Add Screen Sharing Restrictions
```javascript
interfaceConfigOverwrite: {
  DISABLE_DESKTOP_SHARING: false,  // Allow screen sharing
  DESKTOP_SHARING_FRAME_RATE: {
    min: 5,
    max: 5
  }
}
```

### 3. Add Chat Feature
- Jitsi includes built-in chat - enable via `DISABLE_CHAT: false` in config

### 4. Custom Branding
```javascript
interfaceConfigOverwrite: {
  APP_NAME: 'My Thesis Hub',
  NATIVE_APP_NAME: 'My Thesis Hub',
  LOGO_WATERMARK: {
    src: '/path/to/logo.png'
  }
}
```

### 5. Meeting Duration Limits
```javascript
// Add session timeout tracking
setTimeout(() => {
  alert('Conference session ending in 1 minute');
}, 55 * 60 * 1000);  // 55 minutes
```

## API Reference

### Global Functions (window scope)

```javascript
// Create a new room
createNewRoom()

// Join existing room
joinExistingRoom()

// Leave current conference
leaveRoom()

// Toggle participants list
toggleParticipants()

// Copy room ID to clipboard
copyRoomId()

// Navigate back to member dashboard
goBack()
```

### Internal Functions

```javascript
// Generate unique room ID
generateRoomId() → string

// Launch Jitsi Meet conference
launchJitsiMeet(roomId, displayName) → void

// Update participant count
updateParticipantCount() → void

// Cleanup session in Firestore
cleanupSession() → Promise

// Show alert messages
showAlert(message, type) → void
```

## Security Considerations

1. **Authentication** - All users must be authenticated via Firebase Auth
2. **Room ID Sharing** - Room IDs are semi-private; anyone with the ID can join
3. **Data Privacy** - Firestore rules restrict access to authenticated users only
4. **Firewall** - Ensure WebRTC ports are open for peer-to-peer connections
5. **CORS** - Jitsi iframe is loaded from `meet.jit.si` - ensure it's not blocked

### To Add JWT Authentication (Advanced)
```javascript
// In jitsi-meet.js, modify:
jwt: generateJWT(),  // Add JWT token generation function

function generateJWT() {
  // Implement JWT generation with your backend
  // This provides additional security for Jitsi meetings
}
```

## Performance Tips

1. **Use Firefox or Chrome** - Best WebRTC support
2. **Close unnecessary tabs** - Free up browser resources
3. **Reduce participant count** - More participants = more bandwidth
4. **Disable video if audio only** - Saves bandwidth
5. **Use wired connection** - Better stability than WiFi

## Storage Considerations

- Each session record in Firestore is ~500 bytes
- Store historical sessions separately after 30 days for cost optimization
- Consider archiving old sessions to a Cloud Storage backup

## Support & Documentation

- **Jitsi Meet API Docs**: https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe
- **Firebase Firestore**: https://firebase.google.com/docs/firestore
- **WebRTC**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

---

**Created**: April 2024
**Last Updated**: April 2024
**Status**: Production Ready
