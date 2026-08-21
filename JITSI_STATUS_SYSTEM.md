# Jitsi Meet - Conference Status System

## Overview

Members can now see the **real-time status** of each conference before joining:

- 🟢 **ONGOING** - Conference is active with participants
- ⏳ **PENDING** - Conference is waiting for participants (host only)
- ✕ **ENDED** - Conference has finished

## Status Definitions

### 1. PENDING ⏳
- **When**: Room just created by admin, no members have joined yet
- **Color**: Orange/Yellow background
- **Participants**: Only the host (creator)
- **Can Join**: ✅ Yes - Members can click Join to start the meeting
- **Action on Join**: Status automatically changes to "ONGOING"

### 2. ONGOING 🟢
- **When**: At least one member has joined the conference
- **Color**: Green background
- **Participants**: Host + 1 or more members
- **Can Join**: ✅ Yes - New members can still join ongoing conference
- **Real-time Updates**: Participant count updates as people join/leave

### 3. ENDED ✕
- **When**: Admin has left the conference
- **Color**: Red/Grey background
- **Participants**: None (all disconnected)
- **Can Join**: ❌ No - Join button is disabled
- **Visibility**: Room still visible in list for 5-10 minutes, then disappears on refresh

## Member Experience

### Step 1: View Available Rooms
Members open "Join Video Conference" and see a list of all available rooms:

```
┌─────────────────────────────────────────────────────┐
│ 🟢 ONGOING                                          │
│ 🚪 conference-20240423143527-ABC123                │
│ Hosted by: John (Admin)                             │
│ Started: 2:35:27 PM | Participants: 3              │
│                                          [Join]     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ⏳ PENDING                                          │
│ 🚪 conference-20240423144101-XYZ789                │
│ Hosted by: Jane (Admin)                             │
│ Started: 2:41:01 PM | Participants: 1              │
│                                          [Join]     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ✕ ENDED                                            │
│ 🚪 conference-20240423142015-DEF456                │
│ Hosted by: Mark (Admin)                             │
│ Started: 2:20:15 PM | Participants: 5              │
│                                       [Disabled]    │
└─────────────────────────────────────────────────────┘
```

### Step 2: Status-Based Decision Making
Members see:
- **Participant Count**: How many are already in the meeting
- **Start Time**: When the conference began
- **Host Name**: Who's hosting it
- **Status Badge**: Instant visual indicator

### Step 3: Join Only Active/Pending Rooms
- Click Join on any PENDING or ONGOING room
- Cannot join ENDED rooms (button disabled)

### Step 4: Status Changes in Real-Time
- When first member joins a PENDING room → Status changes to ONGOING (green)
- When all members leave → Status changes to ENDED (red/grey)
- Member list refreshes automatically to show new status

## Behind the Scenes - Firestore Structure

Each conference document now tracks:

```javascript
{
  // Identifiers
  roomId: "conference-20240423143527-ABC123",
  creatorEmail: "admin@example.com",
  creatorName: "John (Admin)",
  
  // Status Tracking
  status: "pending" | "ongoing" | "ended",
  
  // Timestamps
  createdAt: Timestamp,     // When room was created
  startedAt: Timestamp,     // When first member joined (null if pending)
  endedAt: Timestamp,       // When conference ended (null if ongoing)
  
  // Participants
  participants: [
    { email: "admin@example.com", name: "John", joinedAt: Timestamp },
    { email: "member1@example.com", name: "Alice", joinedAt: Timestamp },
    { email: "member2@example.com", name: "Bob", joinedAt: Timestamp }
  ],
  
  maxParticipants: 3  // Peak participant count
}
```

## Status Transitions

```
┌─────────────┐
│  PENDING    │  (Room created by admin)
│  ⏳         │
└──────┬──────┘
       │
       │ Member clicks Join
       ▼
┌─────────────┐
│  ONGOING    │  (First member joins, startedAt is set)
│  🟢         │
└──────┬──────┘
       │
       │ Admin leaves (all participants exit)
       ▼
┌─────────────┐
│   ENDED     │  (Conference finished, endedAt is set)
│   ✕         │
└─────────────┘
```

## API/Database Queries

### Query for Available Rooms (Members)
```javascript
const roomsQuery = query(
  collection(db, 'video_sessions'),
  where('status', 'in', ['pending', 'ongoing'])
);
```

Members only see rooms that are either PENDING or ONGOING, not ENDED.

### Query for All Rooms (Including History)
```javascript
const allRoomsQuery = query(
  collection(db, 'video_sessions')
  // No filter - gets pending, ongoing, and ended
);
```

### Check if Room is Still Active
```javascript
const sessionQuery = query(
  collection(db, 'video_sessions'),
  where('roomId', '==', roomId),
  where('status', 'in', ['pending', 'ongoing'])
);
```

## Status Update Rules

| Event | Trigger | Status Change | Details |
|-------|---------|---|---|
| Create Room | Admin clicks "Create" | `null` → `pending` | Room created, only host present |
| First Member Joins | Member clicks "Join" | `pending` → `ongoing` | startedAt timestamp set |
| New Member Joins | Member clicks "Join" | Stays `ongoing` | Participant count increased |
| Admin Leaves | Admin clicks "Leave" | `ongoing` → `ended` | endedAt timestamp set |
| Member Leaves | Member leaves Jitsi | Stays same | Participant count decreased |
| All Leave | Everyone exits | `ongoing` → `ended` | endedAt timestamp set |

## UI Indicators

### PENDING Badge (Orange ⏳)
```html
<span style="background: #f59e0b; color: white; ...">
  ⏳ PENDING
</span>
```
- Shown when status is "pending" OR only host (1 participant)
- Join button: **ENABLED** (green/blue)
- Use case: "Join to help start the meeting!"

### ONGOING Badge (Green 🟢)
```html
<span style="background: #22c55e; color: white; ...">
  🟢 ONGOING
</span>
```
- Shown when status is "ongoing" AND has 2+ participants
- Join button: **ENABLED** (blue)
- Use case: "Meeting in progress, join now!"

### ENDED Badge (Red ✕)
```html
<span style="background: #ef4444; color: white; ...">
  ✕ ENDED
</span>
```
- Shown when status is "ended"
- Join button: **DISABLED** (grey)
- Use case: "This meeting has finished"

## Member Scenarios

### Scenario 1: Join Pending Room (Earliest Bird)
```
1. Admin creates room at 2:35 PM
2. Member sees room with ⏳ PENDING badge
3. Member is first to click Join
4. Status automatically changes to 🟢 ONGOING
5. Member now in Jitsi with admin
```

### Scenario 2: Join Ongoing Room (Later Participant)
```
1. Room was started 5 minutes ago (🟢 ONGOING)
2. Member sees room with 3 participants already
3. Member clicks Join
4. Member is added to Jitsi, now 4 participants
5. Can see all other video feeds
```

### Scenario 3: Try to Join Ended Room
```
1. Admin left the meeting at 3:10 PM
2. Room status changed to ✕ ENDED
3. Member tries to join
4. Join button is DISABLED (grey)
5. Shows message: "Room no longer available"
```

### Scenario 4: See Real-Time Updates
```
1. Member opens room list at 2:35 PM
2. Sees ⏳ PENDING with 1 participant
3. Refreshes list at 2:36 PM
4. Now shows 🟢 ONGOING with 3 participants
5. Someone joined while viewing
```

## Technical Implementation

### Status Check Function
```javascript
// In loadAvailableRooms():
if (session.status === 'ongoing' && participantCount > 0) {
  // Show ONGOING badge (green)
} else if (session.status === 'pending' || participantCount <= 1) {
  // Show PENDING badge (orange)
} else {
  // Show ENDED badge (red)
}
```

### Auto Status Update on Join
```javascript
// In joinRoomAsGuest():
if (sessionData.status === 'pending' && participants.length > 1) {
  updateData.status = 'ongoing';
  updateData.startedAt = serverTimestamp();
}
```

### Disable Join for Ended Rooms
```javascript
const canJoin = ['pending', 'ongoing'].includes(session.status);
```

## Testing the Status System

### Test Case 1: Status Progression
```
1. Log in as Admin
2. Create a room (see ⏳ PENDING)
3. In another browser, log in as Member
4. Member refreshes room list (see ⏳ PENDING)
5. Member clicks Join
6. Member refreshes list (see 🟢 ONGOING)
7. Admin leaves conference
8. Member refreshes (see ✕ ENDED)
```

### Test Case 2: Multiple Members Join
```
1. Admin creates room (1 participant = ⏳ PENDING)
2. Member 1 joins (2 participants = 🟢 ONGOING)
3. Member 2 joins (3 participants = 🟢 ONGOING)
4. Check Firestore - participant count = 3
```

### Test Case 3: Disabled Join Button
```
1. Create room, let members join
2. Admin leaves
3. Room status = ✕ ENDED
4. Try to join as new member
5. Join button is DISABLED
6. Click shows error: "Room no longer available"
```

## Firestore Indexes

Ensure Firestore has an index for efficient queries:

```
Collection: video_sessions
Indexes:
  - status (Ascending)
  - createdAt (Descending)
```

Add this to your Firestore security rules:
```javascript
match /video_sessions/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && (
    resource == null ||  // Creating new document
    resource.data.creatorEmail == request.auth.token.email  // Only creator can update
  );
}
```

## UI/UX Best Practices

1. **Color Coding**: Easy visual recognition
   - Orange = Action needed (join to start)
   - Green = Active meeting in progress
   - Red = Meeting over

2. **Participant Count**: Shows meeting popularity
   - 1 = Just host (need participants)
   - 2-5 = Good team meeting
   - 5+ = Large group

3. **Refresh Button**: Let members refresh list frequently

4. **Timestamps**: Help decide timing
   - "Started 5 min ago" = Active
   - "Started 30 min ago" = Well underway
   - "Started 2 hours ago" = Probably ending soon

## Performance Notes

- Status queries use `where('status', 'in', ['pending', 'ongoing'])` for efficiency
- Firestore index on `status` field helps queries scale
- Participant count updates in real-time as Firestore documents change
- Room list can be refreshed manually or on intervals

---

**Feature Release**: April 23, 2024
**Status**: Production Ready
**Version**: 2.0 (with Status System)
