# Jitsi Meet - Role-Based Access Control

## Overview

The Jitsi Meet integration now includes **role-based access control**:

- **ADMIN**: Can only **create/host** video conferences
- **MEMBERS**: Can only **join** existing conferences hosted by admins

This ensures better control over who can start meetings while allowing team members to easily join.

## How It Works

### For Admins

1. Click **"Video Conference"** button (in admin dashboard sidebar)
2. See the **"Host Video Conference"** screen
3. Enter your name
4. Click **"Create Conference Room"**
5. A unique room ID is generated and Jitsi Meet launches
6. The room is listed in Firestore as "active"
7. Room details are shared with members who can see it in their list
8. When admin leaves, room is marked as "inactive"

**Admin Flow:**
```
Admin Dashboard → Video Conference → Create Room → Jitsi Launched
```

### For Members

1. Click **"Video Conference"** button (in member dashboard sidebar)
2. See the **"Join Video Conference"** screen with a list of active rooms
3. The list shows:
   - Room ID
   - Who's hosting it (host name)
   - When it started
   - Current participant count
4. Click **"Join"** button next to the room they want to join
5. Jitsi Meet launches - they automatically join that room
6. Their name is automatically captured from their profile

**Member Flow:**
```
Member Dashboard → Video Conference → See Available Rooms → Click Join → Jitsi Launched
```

## Database Structure

The system tracks all sessions in the `video_sessions` Firestore collection:

```javascript
{
  roomId: "conference-20240423143527-ABC123",
  creatorEmail: "johnpaulbugayong@gmail.com",
  creatorName: "John Paul Bugayong",
  createdAt: Timestamp,
  status: "active" | "inactive",
  participants: [
    {
      email: "member@example.com",
      name: "Member Name",
      joinedAt: Timestamp
    }
  ],
  maxParticipants: 3
}
```

## UI Differences

### Admin Screen
- **Title**: "Host Video Conference"
- **Description**: Create a new conference room for your team members to join
- **Input**: Name field
- **Button**: Create Conference Room
- **Action**: Creates new room immediately

### Member Screen
- **Title**: "Join Video Conference"
- **Description**: Select an active conference to join
- **Content**: Live list of active rooms
- **List Shows**:
  - Room ID (clickable)
  - Host name
  - Start time
  - Participant count
- **Refresh Button**: To reload list of available rooms
- **Join Action**: Click Join button on any room to join instantly

## Key Features

✅ **Role-Based UI** - Different interface based on user role
✅ **Live Room List** - Members see real-time list of active rooms
✅ **Auto Participant Tracking** - Members are automatically added to room's participant list
✅ **One-Click Join** - No need to copy/paste room IDs
✅ **Automatic Naming** - Members' display names captured from profile
✅ **Session Tracking** - All sessions logged in Firestore
✅ **Status Management** - Rooms marked active/inactive automatically

## Technical Implementation

### Role Detection

The system uses `getStoredUserRole()` from `auth.js` to determine the user's role:

```javascript
userRole = await getStoredUserRole();
// Returns: 'admin' or 'member'
```

### Role-Based Initialization

On page load, the UI is initialized based on role:

```javascript
async function initializeUIForRole(role) {
  if (role === 'admin') {
    // Show create room form
    createRoomSection.style.display = 'block';
    memberSection.style.display = 'none';
  } else {
    // Show available rooms list
    createRoomSection.style.display = 'none';
    memberSection.style.display = 'block';
    await loadAvailableRooms();
  }
}
```

### Available Rooms Query

Members see all rooms with `status: 'active'`:

```javascript
const activeRoomsQuery = query(
  collection(db, 'video_sessions'),
  where('status', '==', 'active')
);
```

### Join Validation

Before joining, the system validates:
1. Room still exists
2. Room status is "active"
3. User not already in participant list
4. Updates participant list with new member

## File Modifications

### Updated Files:
- **jitsi-meet.js** - Added role checking and room listing
- **video-room.html** - Added role-based UI sections
- **admin.html** - Video Conference already added (uses same integration)
- **member.html** - Video Conference already added (uses same integration)

### Key Functions Added:
- `initializeUIForRole(role)` - Initialize UI based on role
- `loadAvailableRooms()` - Load list of active rooms for members
- `joinRoomAsGuest(roomId)` - Member join a room from list

## User Scenarios

### Scenario 1: Admin Hosts a Meeting
```
1. Admin logs in
2. Opens Video Conference
3. Enters name "John (Admin)"
4. Clicks "Create Conference Room"
5. Room ID: conference-20240423143527-ABC123 is created
6. Jitsi launches with admin
7. Members can now see this room in their list
```

### Scenario 2: Multiple Members Join
```
1. Member 1 logs in
2. Opens Video Conference
3. Sees room hosted by "John (Admin)" 
4. Clicks "Join"
5. Jitsi launches with Member 1's video feed
6. Member 2 does the same
7. Both are now in the same Jitsi conference with admin
8. Firestore shows 3 participants
```

### Scenario 3: Admin Leaves and Room Closes
```
1. Admin is the host and decides to leave
2. Clicks "Leave Conference"
3. Jitsi ends for all participants
4. Room status changed to "inactive" in Firestore
5. Members no longer see it in their list
6. Refresh attempt shows "No active conferences"
```

## Security Notes

- Only authenticated users can access video conference pages
- Admin role determined by pre-registered email in `auth.js`
- Firestore rules ensure only authenticated users can read/write sessions
- Room IDs auto-generated with timestamp + random string (impossible to guess)
- Members cannot manually create rooms (UI doesn't allow it, code checks role)

## Testing the Role-Based System

### Test with Admin Account:
```
Email: johnpaulbugayong@gmail.com
Password: johnpaul001
```
Should see "Host Video Conference" form

### Test with Member Account:
```
Email: kingfordnabor@gmail.com
Password: kingford002
```
Should see list of active conferences

### Test Flow:
1. Log in as Admin
2. Create a room
3. In another browser/tab, log in as Member
4. Member sees the room in their list
5. Member clicks Join
6. Both are in the same Jitsi conference
7. Check Firestore to see session with 2 participants

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Member sees "No active conferences" | Check that admin has created a room, room status is "active" in Firestore |
| Member clicks Join but nothing happens | Check browser console for errors, verify Firestore rules |
| Admin doesn't see create room form | Verify logged-in user has admin role in `auth.js` |
| Room keeps appearing in member list | Room status might not be changing to "inactive", check leaveRoom() function |

## Future Enhancements

- [ ] Allow members to manually enter room ID as fallback
- [ ] Show conference duration timer for members
- [ ] Allow members to invite other members via email
- [ ] Add conference history/recordings management for admins
- [ ] Implement conference scheduling (scheduled meetings)
- [ ] Add participant limit enforcement
- [ ] Send notifications when admin starts a conference

---

**Implementation Date**: April 23, 2024
**Status**: Production Ready
**Version**: 1.0
