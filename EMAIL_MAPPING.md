# Email Mapping Reference

User Email Mapping (Login Email → Notification Recipient Email)

| Member Name | Login Email | Sends Email To |
|---|---|---|
| Kingford Nabor | kingfordnabor@gmail.com | kingfordnabor20@gmail.com |
| Allan Corral | allancorral@gmail.com | allancorral084@gmail.com |
| Phricks Borebor | phricksborebor@gmail.com | boreborpj16@gmail.com |
| Moezar Perez | moezarperez@gmail.com | moezarg19@gmail.com |
| Rogelio Ledda | rogelioledda@gmail.com | rogelioledda051506@gmail.com |

## When Emails Are Sent

### Create Task
- **Assigned To:** Single user (from dropdown)
- **Email Sent To:** That user's mapped email address

**Example:**
- Admin creates task assigned to "Kingford Nabor"
- System uses login email: `kingfordnabor@gmail.com`
- Gmail sends to: `kingfordnabor20@gmail.com`

### Create Poll
- **Assigned To:** All members automatically
- **Email Sent To:** All 5 members' mapped email addresses

**Example:**
- Admin creates poll
- Emails sent to:
  - kingfordnabor20@gmail.com
  - allancorral084@gmail.com
  - boreborpj16@gmail.com
  - moezarg19@gmail.com
  - rogelioledda051506@gmail.com

### Create Announcement
- **Assigned To:** Selected members (via checkboxes)
- **Email Sent To:** Those members' mapped email addresses

**Example:**
- Admin selects Kingford + Allan
- Emails sent to:
  - kingfordnabor20@gmail.com
  - allancorral084@gmail.com

### Submit Support Ticket
- **Assigned To:** Admin (hardcoded)
- **Email Sent To:** johnpaulbugayong14@gmail.com

**Example:**
- Member submits ticket
- Email sent to admin: `johnpaulbugayong14@gmail.com`

## How It Works (Technical)

The system uses a `USER_EMAIL_MAP` object in both `admin.js` and `member.js`:

```javascript
const USER_EMAIL_MAP = {
  'kingfordnabor@gmail.com': 'kingfordnabor20@gmail.com',
  'allancorral@gmail.com': 'allancorral084@gmail.com',
  'phricksborebor@gmail.com': 'boreborpj16@gmail.com',
  'moezarperez@gmail.com': 'moezarg19@gmail.com',
  'rogelioledda@gmail.com': 'rogelioledda051506@gmail.com'
};

function getRecipientEmail(userId) {
  return USER_EMAIL_MAP[userId] || userId;
}
```

Whenever an email needs to be sent:

1. System receives the login email (from `assignedTo` array)
2. Calls `getRecipientEmail(loginEmail)`
3. Looks up the actual recipient email in the mapping
4. Sends email to the mapped address

## If Someone Sends to "Everyone"

When a task is created and "Everyone" is selected (if applicable), or a poll is created:

- System iterates through all members
- Looks up each member's mapped email
- Sends email to each mapped address

## Adding New Members

To add a new member, update the `USER_EMAIL_MAP` in both files:

```javascript
const USER_EMAIL_MAP = {
  'kingfordnabor@gmail.com': 'kingfordnabor20@gmail.com',
  'allancorral@gmail.com': 'allancorral084@gmail.com',
  'phricksborebor@gmail.com': 'boreborpj16@gmail.com',
  'moezarperez@gmail.com': 'moezarg19@gmail.com',
  'rogelioledda@gmail.com': 'rogelioledda051506@gmail.com',
  'newuser@gmail.com': 'newuser_actual@gmail.com'  // ← Add here
};
```

Also add to the `members` array in both files:

```javascript
const members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" },
  { uid: "newuser@gmail.com", name: "New User" }  // ← Add here
];
```

## Next Steps

1. ✅ Email mapping has been configured
2. Get GitHub Personal Access Token
3. Configure `GITHUB_EMAIL_CONFIG` in admin.js and member.js
4. Set `enabled: true` to activate email notifications
5. Test by creating a task/announcement
