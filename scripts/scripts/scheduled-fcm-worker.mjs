import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!serviceAccount.project_id || !serviceAccount.private_key) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured.');
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);
const messaging = getMessaging(app);
const now = new Date();
const today = startOfDay(now);
const tomorrow = addDays(today, 1);

function startOfDay(value) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value, days) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return null;
}

function normalizeEmails(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map(value => String(value || '').trim().toLowerCase())
    .filter(value => value && value !== 'everyone' && value !== 'all'))];
}

function dateFromMeeting(meeting) {
  if (!meeting.date || !meeting.time) return null;
  return new Date(`${meeting.date}T${meeting.time}`);
}

function dateFromEvent(event) {
  return event.date ? new Date(`${event.date}T00:00:00`) : null;
}

async function organizationMembers(organizationId) {
  if (!organizationId) return [];
  const snapshot = await db.collection('organizations').doc(organizationId).get();
  if (!snapshot.exists) return [];
  const organization = snapshot.data() || {};
  return normalizeEmails([
    organization.ownerEmail,
    ...(organization.adminEmails || []),
    ...(organization.memberEmails || [])
  ]);
}

async function claimDispatch(key, details) {
  const reference = db.collection('fcmDispatches').doc(key);
  return db.runTransaction(async transaction => {
    const existing = await transaction.get(reference);
    if (existing.exists) return false;
    transaction.set(reference, {
      ...details,
      createdAt: FieldValue.serverTimestamp()
    });
    return true;
  });
}

async function sendPush({ emails, title, body, type, data, key, details }) {
  const recipients = normalizeEmails(emails);
  if (!recipients.length) return;
  const shouldSend = await claimDispatch(key, details);
  if (!shouldSend) return;

  const tokenSnapshot = await db.collection('fcmTokens').get();
  const recipientSet = new Set(recipients);
  const tokens = tokenSnapshot.docs
    .map(document => document.data())
    .filter(token => recipientSet.has(String(token.email || '').trim().toLowerCase()) && token.token)
    .map(token => token.token);
  if (!tokens.length) return;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries({ type, ...data }).map(([name, value]) => [name, String(value ?? '')])),
    android: { priority: 'high', notification: { sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } }
  });
  console.log(`${type}: ${title} sent ${response.successCount}/${tokens.length}`);
}

async function processTasks() {
  const snapshot = await db.collection('tasks').get();
  for (const document of snapshot.docs) {
    const task = document.data();
    const recipients = normalizeEmails(task.assignedTo);
    const deadline = asDate(task.deadline);
    const created = asDate(task.createdAt);
    if (created && created >= addMinutes(now, -20)) {
      await sendPush({
        emails: recipients,
        title: 'New Task Assigned',
        body: `You have been assigned a new task: "${task.title || 'Untitled task'}"`,
        type: 'task',
        data: { taskId: document.id },
        key: `task-${document.id}-created`,
        details: { resource: 'tasks', resourceId: document.id, reminder: 'created' }
      });
    }
    if (deadline) {
      const day = startOfDay(deadline);
      const reminder = day.getTime() === tomorrow.getTime() ? 'tomorrow' : day.getTime() === today.getTime() ? 'today' : null;
      if (reminder) {
        await sendPush({
          emails: recipients,
          title: reminder === 'today' ? 'Task Due Today' : 'Task Due Tomorrow',
          body: `${task.title || 'Your task'} is due ${reminder}.`,
          type: 'task_deadline',
          data: { taskId: document.id, reminder },
          key: `task-${document.id}-${reminder}`,
          details: { resource: 'tasks', resourceId: document.id, reminder }
        });
      }
    }
  }
}

async function processMeetings() {
  const snapshot = await db.collection('meetings').get();
  for (const document of snapshot.docs) {
    const meeting = document.data();
    if (String(meeting.status || '').toLowerCase() === 'cancelled') continue;
    const recipients = meeting.assignedTo && meeting.assignedTo !== 'everyone'
      ? normalizeEmails(meeting.assignedTo)
      : await organizationMembers(meeting.organizationId);
    const meetingDate = dateFromMeeting(meeting);
    if (!meetingDate || Number.isNaN(meetingDate.getTime())) continue;
    const created = asDate(meeting.createdAt);
    if (created && created >= addMinutes(now, -20)) {
      await sendPush({
        emails: recipients,
        title: 'New Video Conference',
        body: `${meeting.title || 'A video conference'} has been scheduled.`,
        type: 'meeting',
        data: { meetingId: document.id, reminder: 'created' },
        key: `meeting-${document.id}-created`,
        details: { resource: 'meetings', resourceId: document.id, reminder: 'created' }
      });
    }
    const day = startOfDay(meetingDate);
    const reminder = day.getTime() === tomorrow.getTime() ? 'tomorrow' : day.getTime() === today.getTime() && now >= meetingDate ? 'ongoing' : null;
    if (reminder) {
      await sendPush({
        emails: recipients,
        title: reminder === 'ongoing' ? 'Video Conference Started' : 'Video Conference Tomorrow',
        body: reminder === 'ongoing' ? `${meeting.title || 'Your meeting'} is starting now.` : `${meeting.title || 'Your meeting'} is scheduled for tomorrow.`,
        type: 'meeting',
        data: { meetingId: document.id, reminder },
        key: `meeting-${document.id}-${reminder}`,
        details: { resource: 'meetings', resourceId: document.id, reminder }
      });
    }
  }
}

async function processEvents() {
  const snapshot = await db.collection('events').get();
  for (const document of snapshot.docs) {
    const event = document.data();
    const eventDate = dateFromEvent(event);
    if (!eventDate || Number.isNaN(eventDate.getTime())) continue;
    const recipients = await organizationMembers(event.organizationId);
    const created = asDate(event.createdAt);
    if (created && created >= addMinutes(now, -20)) {
      await sendPush({
        emails: recipients,
        title: 'New Organization Event',
        body: `${event.title || 'A new event'} has been scheduled.`,
        type: 'event',
        data: { eventId: document.id, reminder: 'created' },
        key: `event-${document.id}-created`,
        details: { resource: 'events', resourceId: document.id, reminder: 'created' }
      });
    }
    const day = startOfDay(eventDate);
    const reminder = day.getTime() === tomorrow.getTime() ? 'tomorrow' : day.getTime() === today.getTime() ? 'today' : null;
    if (reminder) {
      await sendPush({
        emails: recipients,
        title: reminder === 'today' ? 'Event Today' : 'Event Tomorrow',
        body: `${event.title || 'Your event'} is scheduled for ${reminder}.`,
        type: 'event',
        data: { eventId: document.id, reminder },
        key: `event-${document.id}-${reminder}`,
        details: { resource: 'events', resourceId: document.id, reminder }
      });
    }
  }
}

function addMinutes(value, minutes) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

await processTasks();
await processMeetings();
await processEvents();
console.log('Scheduled FCM worker completed.');