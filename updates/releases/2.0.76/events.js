import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebase.js';
import { getActiveOrganizationId } from './organizations.js';
import { getStoredUserEmail } from './auth.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let userEvents = [];
let eventsUnsubscribe = null;
let currentUserEmail = '';
let currentRole = 'member';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function getBackendUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return localStorage.getItem('fcm_backend_url') || 'http://localhost:3001';
  }
  return localStorage.getItem('fcm_backend_url') || '/backend';
}

async function sendEventPush(userEmails, title, body, data = {}) {
  const recipients = [...new Set((userEmails || []).map(email => String(email || '').trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return false;
  try {
    const response = await fetch(`${getBackendUrl()}/api/push-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmails: recipients, title, body, type: 'event', data })
    });
    return response.ok;
  } catch (error) {
    console.warn('Could not send event push notification:', error.message);
    return false;
  }
}

async function getOrganizationRecipients(organizationId) {
  const organizationSnapshot = await getDoc(doc(db, 'organizations', organizationId));
  if (!organizationSnapshot.exists()) return [];
  const organization = organizationSnapshot.data() || {};
  return [
    organization.ownerEmail,
    ...(Array.isArray(organization.adminEmails) ? organization.adminEmails : []),
    ...(Array.isArray(organization.memberEmails) ? organization.memberEmails : [])
  ].filter(Boolean);
}

async function checkEventReminders(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const event of events) {
    if (!event.date || event.type === 'holiday') continue;
    const eventDate = new Date(`${event.date}T00:00:00`);
    if (Number.isNaN(eventDate.getTime())) continue;
    eventDate.setHours(0, 0, 0, 0);
    const dayDifference = Math.round((eventDate - today) / 86400000);
    const reminderType = dayDifference === 1 ? 'tomorrow' : dayDifference === 0 ? 'today' : null;
    if (!reminderType) continue;
    const reminderKey = `fcm-event-${event.id}-${reminderType}-${currentUserEmail}`;
    if (localStorage.getItem(reminderKey)) continue;
    const sent = await sendEventPush(
      [currentUserEmail],
      reminderType === 'today' ? 'Event Today' : 'Event Tomorrow',
      `${event.title || 'Your event'} is ${reminderType === 'today' ? 'scheduled for today.' : 'scheduled for tomorrow.'}`,
      { eventId: event.id, reminderType, organizationId: event.organizationId }
    );
    if (sent) localStorage.setItem(reminderKey, new Date().toISOString());
  }
}

function pad(value) { return String(value).padStart(2, '0'); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function easterSunday(year) {
  const a = year % 19; const b = Math.floor(year / 100); const c = year % 100; const d = Math.floor(b / 4); const e = b % 4;
  const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getPhilippineHolidays(year) {
  const holidays = [
    ['New Year\'s Day', `${year}-01-01`], ['Chinese New Year', `${year}-02-17`], ['EDSA People Power Revolution Anniversary', `${year}-02-25`],
    ['Araw ng Kagitingan', `${year}-04-09`], ['Labor Day', `${year}-05-01`], ['Independence Day', `${year}-06-12`],
    ['Ninoy Aquino Day', `${year}-08-21`], ['National Heroes Day', dateKey(new Date(year, 7, 31 - ((new Date(year, 7, 31).getDay() + 6) % 7)))],
    ['Bonifacio Day', `${year}-11-30`], ['Feast of the Immaculate Conception', `${year}-12-08`], ['Christmas Day', `${year}-12-25`], ['Rizal Day', `${year}-12-30`], ['New Year\'s Eve', `${year}-12-31`]
  ];
  const easter = easterSunday(year);
  const maundyThursday = new Date(easter); maundyThursday.setDate(easter.getDate() - 3);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  holidays.push(['Maundy Thursday', dateKey(maundyThursday)], ['Good Friday', dateKey(goodFriday)], ['Black Saturday', dateKey(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 1))]);
  return holidays.map(([title, date]) => ({ id: `holiday-${date}-${title}`, title, date, type: 'holiday' }));
}

function allHolidaysForView() {
  return [...getPhilippineHolidays(currentMonth.getFullYear() - 1), ...getPhilippineHolidays(currentMonth.getFullYear()), ...getPhilippineHolidays(currentMonth.getFullYear() + 1)];
}

function formatEventDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function ensureEventDetailsDialog() {
  if (document.getElementById('eventDetailsDialog')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="eventDetailsDialog" class="event-details-dialog" role="dialog" aria-modal="true" aria-labelledby="eventDetailsTitle" hidden>
      <div class="event-details-panel">
        <button type="button" class="event-details-close" aria-label="Close event details">&times;</button>
        <p class="event-details-label">Event details</p>
        <h2 id="eventDetailsTitle"></h2>
        <p id="eventDetailsDate" class="event-details-date"></p>
        <p id="eventDetailsDescription" class="event-details-description"></p>
      </div>
    </div>
  `);

  const dialog = document.getElementById('eventDetailsDialog');
  const close = () => { dialog.hidden = true; };
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('.event-details-close')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialog.hidden) close();
  });
}

function showEventDetails(item) {
  ensureEventDetailsDialog();
  const dialog = document.getElementById('eventDetailsDialog');
  document.getElementById('eventDetailsTitle').textContent = item.title || 'Untitled event';
  document.getElementById('eventDetailsDate').textContent = item.date ? formatEventDate(item.date) : 'Date not specified';
  document.getElementById('eventDetailsDescription').textContent = item.description || 'No additional details provided.';
  dialog.hidden = false;
  dialog.querySelector('.event-details-close')?.focus();
}

function renderCalendar() {
  const label = document.getElementById('eventsMonthLabel');
  const grid = document.getElementById('eventsGrid');
  if (!label || !grid) return;
  label.textContent = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = new Date(firstDay); start.setDate(1 - firstDay.getDay());
  const holidays = allHolidaysForView();
  const itemsByDate = new Map();
  [...holidays, ...userEvents].forEach((item) => {
    if (!itemsByDate.has(item.date)) itemsByDate.set(item.date, []);
    itemsByDate.get(item.date).push(item);
  });
  let html = '';
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start); day.setDate(start.getDate() + index);
    const key = dateKey(day); const items = itemsByDate.get(key) || [];
    const isMuted = day.getMonth() !== currentMonth.getMonth(); const isToday = key === dateKey(new Date());
    html += `<div class="events-day${isMuted ? ' muted' : ''}${isToday ? ' today' : ''}"><div class="events-day-number">${day.getDate()}</div>${items.map((item) => `<div class="events-item ${item.type === 'holiday' ? 'holiday' : 'user-event'}" title="${escapeHtml(item.description || item.title)}" role="button" tabindex="0" data-event-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}${item.type !== 'holiday' && (currentRole === 'admin' || item.creatorEmail === currentUserEmail) ? `<button type="button" aria-label="Delete event" data-delete-event="${escapeHtml(item.id)}">&times;</button>` : ''}</div>`).join('')}</div>`;
  }
  grid.innerHTML = html;
}

function renderEventsMessage(text, color = '#cbd5e1') {
  const message = document.getElementById('eventsMessage');
  if (message) { message.textContent = text; message.style.color = color; }
}

async function createEvent(event) {
  event.preventDefault();
  const organizationId = getActiveOrganizationId();
  const title = document.getElementById('eventTitle')?.value.trim();
  const date = document.getElementById('eventDate')?.value;
  const description = document.getElementById('eventDescription')?.value.trim() || '';
  if (!organizationId || !title || !date) return renderEventsMessage('Title and date are required.', '#fca5a5');
  try {
    const eventRef = await addDoc(collection(db, 'events'), { organizationId, title, date, description, creatorEmail: currentUserEmail, createdAt: serverTimestamp() });
    const recipients = await getOrganizationRecipients(organizationId);
    void sendEventPush(recipients, 'New Organization Event', `${title} is scheduled for ${formatEventDate(date)}.`, { eventId: eventRef.id, organizationId, date });
    document.getElementById('eventsForm')?.reset();
    renderEventsMessage('Event added for this organization.', '#86efac');
  } catch (error) { console.error('Unable to create event:', error); renderEventsMessage('Unable to add event. Please try again.', '#fca5a5'); }
}

async function deleteEvent(eventId) {
  if (!eventId || !confirm('Delete this event?')) return;
  try { await deleteDoc(doc(db, 'events', eventId)); renderEventsMessage('Event deleted.', '#86efac'); }
  catch (error) { console.error('Unable to delete event:', error); renderEventsMessage('Unable to delete event.', '#fca5a5'); }
}

async function initEventsCalendar(role = 'member') {
  const root = document.getElementById('eventsSection');
  if (!root) return;
  currentRole = role;
  currentUserEmail = String(await getStoredUserEmail() || '').trim().toLowerCase();
  document.getElementById('eventsForm')?.addEventListener('submit', createEvent);
  document.getElementById('eventsPrevious')?.addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() - 1); renderCalendar(); });
  document.getElementById('eventsNext')?.addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() + 1); renderCalendar(); });
  document.getElementById('eventsToday')?.addEventListener('click', () => { currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); });
  document.getElementById('eventsGrid')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-event]');
    if (button) {
      event.stopPropagation();
      void deleteEvent(button.dataset.deleteEvent);
      return;
    }
    const eventItem = event.target.closest('[data-event-id]');
    if (!eventItem) return;
    const selectedEvent = [...getPhilippineHolidays(currentMonth.getFullYear() - 1), ...getPhilippineHolidays(currentMonth.getFullYear()), ...getPhilippineHolidays(currentMonth.getFullYear() + 1), ...userEvents]
      .find((item) => item.id === eventItem.dataset.eventId);
    if (selectedEvent) showEventDetails(selectedEvent);
  });
  document.getElementById('eventsGrid')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const eventItem = event.target.closest('[data-event-id]');
    if (!eventItem) return;
    event.preventDefault();
    eventItem.click();
  });
  renderCalendar();
  eventsUnsubscribe?.();
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return;
  eventsUnsubscribe = onSnapshot(query(collection(db, 'events'), where('organizationId', '==', organizationId)), (snapshot) => {
    userEvents = snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...(eventDoc.data() || {}), type: 'event' }));
    renderCalendar();
    void checkEventReminders(userEvents);
  }, (error) => { console.error('Unable to load organization events:', error); renderEventsMessage('Unable to load events.', '#fca5a5'); });
}

window.initEventsCalendar = initEventsCalendar;
