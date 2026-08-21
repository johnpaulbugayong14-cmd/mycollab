# Jitsi Meet Integration - Quick Testing Guide

## Pre-Testing Checklist

- [ ] Ensure you have internet connection
- [ ] Allow camera/microphone permissions in browser
- [ ] Have at least 2 browser tabs or 2 devices ready (for testing join feature)
- [ ] Firestore is configured in your Firebase project

## Step-by-Step Local Testing

### Step 1: Start Your Local Server
```powershell
# In your project directory
npm install
npm start
# Or if using a simple HTTP server
python -m http.server 8000
# Then visit: http://localhost:8000
```

### Step 2: Test Authentication
1. Go to `http://localhost:8000/login.html`
2. Log in with your Firebase credentials
3. Verify you're redirected to `member.html`

### Step 3: Access Video Conference
1. In the member dashboard, find the **"Video Conference"** button in the sidebar
2. Click it - you should see the setup screen with "Start Video Conference"
3. Verify the UI loads correctly with two options:
   - Create New Room
   - Join Existing Room

### Step 4: Create a New Room
1. Enter your name (e.g., "Test User 1")
2. Click **"Create Room"**
3. Expected behavior:
   - Alert shows "Room created! Starting conference..."
   - Setup screen hides
   - Jitsi iframe appears with your video conference
   - Room ID displays at the top (e.g., `conference-20240423143527-ABC123`)
4. **Verify in Firestore**:
   - Go to Firebase Console → Firestore Database
   - Check `video_sessions` collection
   - You should see a new document with:
     - `roomId`: matches displayed room ID
     - `status`: "active"
     - `creatorName`: "Test User 1"
     - `participants`: array with your entry

### Step 5: Test Room Controls
1. **Copy Room ID Button**: Click the copy icon next to the room ID
   - Should show checkmark briefly
   - Room ID copied to clipboard
2. **Participants Button**: Click it
   - Should show participant count
3. **Leave Conference Button**: Click it
   - Jitsi iframe should disappear
   - Setup screen should reappear
   - Firestore session status should change to "inactive"

### Step 6: Test Join Room Feature
1. **Create a new room** (repeat Step 4)
2. **Copy the room ID** to clipboard
3. **Open a second browser tab** (or use a different device)
4. Go to the same `video-room.html` page
5. In the **"Join Existing Room"** section:
   - Paste the room ID from step 2
   - Enter a different name (e.g., "Test User 2")
   - Click **"Join Room"**
6. Expected behavior:
   - You join the same Jitsi conference
   - Both video feeds should be visible
   - Participant count should update
   - **Verify in Firestore**:
     - Same session document
     - `participants` array now has 2 entries
     - `maxParticipants` should be 2

### Step 7: Test Multiple Participants
1. While both conference windows are open:
   - Enable/disable audio and video on both sides
   - Test that controls work
   - Verify audio/video streams from both participants
2. Try screen sharing (if available)
3. Test chat (if available in Jitsi)

### Step 8: Test Invalid Room ID
1. Open `video-room.html` in a new tab
2. Enter a **fake room ID** (e.g., "invalid-room-12345")
3. Enter a name and click "Join Room"
4. Expected: Error alert saying "Room not found or session is no longer active"
5. **Verify Firestore**: No new session created, error handled gracefully

### Step 9: Test Navigation
1. While in a conference, click **"Back"** button
2. Should prompt: "You are currently in a conference. Do you want to leave?"
3. If you click OK:
   - Conference ends
   - Redirected to `member.html`
   - Firestore session marked as "inactive"

### Step 10: Test Mobile Responsiveness
1. Open `video-room.html` on a mobile device
2. Verify:
   - UI adapts to mobile screen
   - Buttons are accessible
   - Jitsi embed resizes properly
   - Touch controls work

## Expected Firestore Collection Structure

After testing, your `video_sessions` collection should have documents like:

```
Document 1:
├── roomId: "conference-20240423143527-ABC123"
├── creatorEmail: "john@example.com"
├── creatorName: "Test User 1"
├── createdAt: Apr 23, 2024, 2:35:27 PM
├── endedAt: Apr 23, 2024, 2:37:42 PM
├── status: "inactive"
├── participants:
│   ├── [0]: {email: "john@example.com", name: "Test User 1", joinedAt: ...}
│   └── [1]: {email: "jane@example.com", name: "Test User 2", joinedAt: ...}
└── maxParticipants: 2
```

## Browser Console Checks

While testing, open Developer Tools (F12) and check Console tab:

### Expected console logs:
```
✓ Jitsi Meet conference launched in room: conference-20240423143527-ABC123
Participant joined: <participant-id>
Participant left: <participant-id>
✓ Session cleaned up
```

### Things to look for:
- ❌ **No errors** - If you see red errors, note them
- ❌ **No CORS issues** - Should load Jitsi from meet.jit.si
- ✅ **Smooth initialization** - Jitsi loads within 3-5 seconds

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Jitsi iframe not loading | Check browser console for CORS errors, verify internet |
| No audio/video | Grant permissions when browser asks, check mic/camera settings |
| Room ID not in Firestore | Check Firestore security rules allow write access |
| Can't join created room | Verify room ID is exactly correct (case-sensitive) |
| "Not authenticated" error | Make sure you logged in first via login.html |
| Page freezes when creating room | Check internet speed, may take 5-10 seconds first time |
| Room ID won't copy | Try again, ensure browser clipboard API is supported |

## Performance Metrics to Monitor

1. **Room Creation Time**: Should be < 2 seconds
2. **Jitsi Load Time**: Should be 3-5 seconds
3. **Video Feed Delay**: Should be < 1 second
4. **Participant Count Update**: Should be instant
5. **Firestore Write Speed**: Should be < 500ms

## Cleanup After Testing

1. **Delete test sessions** from Firestore (optional):
   - Go to Firebase Console
   - Select `video_sessions` collection
   - Delete documents marked "inactive"

2. **Clear browser storage** (optional):
   - Open DevTools → Application → Local Storage
   - Clear any Jitsi-related entries

## Next Steps After Successful Testing

✅ All tests pass locally? Then:
1. Test on different browsers (Chrome, Firefox, Safari)
2. Test on mobile devices (iOS, Android)
3. Test with multiple participants (3-4 people)
4. Load test with many concurrent sessions
5. Ready for production deployment!

---

**Test Session Date**: ________________
**Tested By**: ________________
**Browser Used**: ________________
**Issues Found**: 
- 
- 

**Status**: ☐ Pass ☐ Fail ☐ Partial
