import { collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebase.js';
import { getStoredUserEmail, requireAuth, signOutUser } from './auth.js';
import { getOrganizationsForEmail, subscribeToOrganizations, setActiveOrganizationId } from './organizations.js';

const state = { email: '', organizations: [], docs: { tasks: [], events: [], meetings: [], resources: [], announcements: [], messages: [], activity: [] }, unsubscribers: [], organizationUnsubscribe: null };

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const normalize = (value) => String(value || '').trim().toLowerCase();
const dateValue = (value) => value?.toDate ? value.toDate() : new Date(value);
const validDate = (value) => { const date = dateValue(value); return Number.isNaN(date.getTime()) ? null : date; };
const formatDate = (value) => { const date = validDate(value); return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'; };
const formatTime = (value) => { const date = validDate(value); return date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''; };
const relativeTime = (value) => { const date = validDate(value); if (!date) return 'Recently'; const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`; };
const isComplete = (task) => ['done', 'completed', 'complete', 'finished'].includes(normalize(task.status));
const assignedToUser = (task) => { const values = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo]; return values.filter(Boolean).some((value) => normalize(value) === normalize(state.email) || normalize(value) === 'everyone'); };
const orgName = (organizationId) => state.organizations.find((organization) => organization.id === organizationId)?.name || 'Organization';

function setSpaceGlobalLoading(isLoading) { document.getElementById('spaceGlobalLoading')?.classList.toggle('hidden', !isLoading); }

function setText(id, text) { const element = document.getElementById(id); if (element) element.textContent = text; }
function setContent(id, html) { const element = document.getElementById(id); if (element) element.innerHTML = html; }
function emptyState(icon, title, detail, action = '') { return `<div class="space-empty"><i class="fas ${icon}" aria-hidden="true"></i><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>${action}</div>`; }

function renderProfile(profile = {}) {
  const name = profile.displayName || profile.name || state.email.split('@')[0] || 'Student';
  setText('spaceUserName', name);
  setText('spaceUserMeta', profile.program || profile.role || profile.description || 'My personal workspace');
  const avatar = document.getElementById('spaceAvatar');
  if (avatar && profile.profilePicture) avatar.innerHTML = `<img src="${escapeHtml(profile.profilePicture)}" alt="Profile picture">`;
  else if (avatar) avatar.textContent = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function renderTasks() {
  const tasks = state.docs.tasks.filter(assignedToUser).filter((task) => !isComplete(task)).map((task) => {
    const deadline = validDate(task.deadline || task.dueDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const deadlineDay = deadline ? new Date(deadline) : null; deadlineDay?.setHours(0, 0, 0, 0);
    const category = !deadline ? 'upcoming' : deadlineDay < today ? 'overdue' : deadlineDay.getTime() === today.getTime() ? 'today' : 'upcoming';
    return { ...task, deadline, category };
  }).sort((a, b) => ({ overdue: 0, today: 1, upcoming: 2 }[a.category] - ({ overdue: 0, today: 1, upcoming: 2 }[b.category]) || (a.deadline?.getTime() || Infinity) - (b.deadline?.getTime() || Infinity))).slice(0, 6);
  if (!tasks.length) { setContent('spaceTasks', emptyState('fa-check-circle', 'You are all caught up', 'No active tasks are assigned to you.')); return; }
  setContent('spaceTasks', tasks.map((task) => `<button class="space-task-card" type="button" data-task-link="member.html#my-tasks"><span class="space-card-title"><i class="fas fa-clipboard-check"></i>${escapeHtml(task.title || task.name || 'Untitled task')}</span><span class="space-status ${task.category}">${task.category === 'overdue' ? 'Overdue' : task.category === 'today' ? 'Due today' : 'Upcoming'}${task.deadline ? ` · ${formatDate(task.deadline)}` : ''}</span><span class="space-card-meta"><i class="fas fa-building"></i>${escapeHtml(orgName(task.organizationId))}</span>${task.priority ? `<span class="space-card-meta"><i class="fas fa-flag"></i>${escapeHtml(task.priority)} priority</span>` : ''}</button>`).join('') + '<a class="space-link" href="member.html#my-tasks">View all tasks <i class="fas fa-arrow-right"></i></a>');
  setText('taskSummary', `${tasks.length} active task${tasks.length === 1 ? '' : 's'}`);
}

function renderSchedule() {
  const now = new Date();
  const meetings = state.docs.meetings.filter((meeting) => {
    const assigned = Array.isArray(meeting.assignedTo) ? meeting.assignedTo : (meeting.assignedTo ? [meeting.assignedTo] : []);
    return !assigned.length || assigned.some((value) => normalize(value) === normalize(state.email) || normalize(value) === 'everyone');
  }).map((meeting) => {
    const meetingDate = validDate(meeting.startAt || (meeting.date && meeting.time ? `${meeting.date}T${meeting.time}` : meeting.date));
    const status = normalize(meeting.status || 'active');
    const isOngoing = meetingDate && Date.now() >= meetingDate.getTime() && Date.now() <= meetingDate.getTime() + (2 * 60 * 60 * 1000);
    const isUpcoming = meetingDate && meetingDate.getTime() > Date.now();
    return { ...meeting, scheduleType: 'meeting', scheduleDate: meetingDate, meetingStatus: isOngoing ? 'Ongoing' : isUpcoming ? 'Upcoming' : 'Ended', isMeetingVisible: !['completed', 'cancelled', 'finished', 'ended'].includes(status) && Boolean(isOngoing || isUpcoming) };
  }).filter((meeting) => meeting.isMeetingVisible);
  const events = [...state.docs.events.map((event) => ({ ...event, scheduleType: 'event' })), ...meetings].filter((item) => validDate(item.date || item.startAt || item.createdAt)).map((item) => ({ ...item, scheduleDate: validDate(item.startAt || (item.date && item.time ? `${item.date}T${item.time}` : item.date)) })).filter((item) => item.scheduleDate && item.scheduleDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())).sort((a, b) => a.scheduleDate - b.scheduleDate).slice(0, 5);
  if (!events.length) { setContent('spaceSchedule', emptyState('fa-calendar-day', 'No upcoming events', 'Your schedule is clear.', '<a class="space-link" href="member.html#eventsSection">Open calendar <i class="fas fa-arrow-right"></i></a>')); return; }
  setContent('spaceSchedule', events.map((item) => `<button class="space-schedule-item" type="button" data-organization-id="${escapeHtml(item.organizationId || '')}" data-schedule-link="member.html#${item.scheduleType === 'meeting' ? 'video-conference' : 'eventsSection'}"><time>${formatDate(item.scheduleDate)}<small>${formatTime(item.scheduleDate)}</small></time><span><strong>${escapeHtml(item.title || 'Scheduled item')}</strong><small>${item.scheduleType === 'meeting' ? `${item.meetingStatus} · Video conference` : 'Calendar event'} · ${escapeHtml(orgName(item.organizationId))}</small></span></button>`).join('') + '<a class="space-link" href="member.html#eventsSection">View calendar <i class="fas fa-arrow-right"></i></a>');
}

function renderProjects() {
  if (!state.organizations.length) { setContent('spaceProjects', emptyState('fa-building', 'No organizations yet', 'Join an organization to get started.')); return; }
  const cards = state.organizations.map((organization) => { const tasks = state.docs.tasks.filter((task) => task.organizationId === organization.id); return `<article class="space-project-card"><div class="space-card-title"><i class="fas fa-building"></i>${escapeHtml(organization.name || 'Organization')}</div><p>${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${organization.memberEmails?.length || 0} members</p></article>`; }).join('');
  setContent('spaceProjects', cards);
}

function renderMessages() {
  const messages = [...state.docs.messages].sort((a, b) => (validDate(b.createdAt)?.getTime() || 0) - (validDate(a.createdAt)?.getTime() || 0)).slice(0, 5);
  if (!messages.length) { setContent('spaceMessages', emptyState('fa-comments', 'No recent messages', 'Your conversations will appear here.', '<a class="space-link" href="member.html#live-chat">Open messages <i class="fas fa-arrow-right"></i></a>')); return; }
  setContent('spaceMessages', messages.map((message) => `<button class="space-message-item" type="button" data-message-link="chat.html?chatId=${encodeURIComponent(message.roomId || '')}&from=myspace"><span class="space-message-avatar">${escapeHtml((message.senderName || message.senderEmail || 'M').slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(message.senderName || message.senderEmail || 'Member')}</strong><small>${escapeHtml(message.text || message.message || '[Message]')}</small></span><time>${relativeTime(message.createdAt)}</time></button>`).join(''));
}

function renderProductivity() { const tasks = state.docs.tasks.filter(assignedToUser); const completed = tasks.filter(isComplete).length; const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0; setContent('spaceProductivity', `<div class="space-metric"><strong>${completed} / ${tasks.length}</strong><span>tasks completed</span></div><div class="space-progress space-progress-large"><i style="width:${percent}%"></i></div><strong class="space-percent">${percent}%</strong>`); }
function renderFiles() { const files = state.docs.resources.slice().sort((a, b) => (validDate(b.updatedAt || b.createdAt)?.getTime() || 0) - (validDate(a.updatedAt || a.createdAt)?.getTime() || 0)).slice(0, 4); if (!files.length) { setContent('spaceFiles', emptyState('fa-folder-open', 'No recent files', 'Shared resources will appear here.')); return; } setContent('spaceFiles', files.map((file) => `<a class="space-file-item" href="${escapeHtml(file.link || file.url || '#')}" target="_blank" rel="noopener"><i class="fas fa-file-lines"></i><span><strong>${escapeHtml(file.title || file.name || 'Untitled file')}</strong><small>${escapeHtml(orgName(file.organizationId))} · ${relativeTime(file.updatedAt || file.createdAt)}</small></span></a>`).join('')); }
function renderActivity() { const items = [...state.docs.activity].sort((a, b) => (validDate(b.createdAt)?.getTime() || 0) - (validDate(a.createdAt)?.getTime() || 0)).slice(0, 5); if (!items.length) { setContent('spaceActivity', emptyState('fa-bell', 'No recent activity', 'New updates will appear here.')); return; } setContent('spaceActivity', items.map((item) => `<div class="space-activity-item"><i class="fas fa-circle-check"></i><span>${escapeHtml(item.title || item.message || 'New update')}<small>${relativeTime(item.createdAt)}</small></span></div>`).join('')); }

function renderAll() { renderTasks(); renderSchedule(); renderProjects(); renderMessages(); renderProductivity(); renderFiles(); renderActivity(); }

async function loadData() {
  const ids = state.organizations.map((organization) => organization.id);
  if (!ids.length) {
    state.docs = { tasks: [], events: [], meetings: [], resources: [], announcements: [], messages: [], activity: [] };
    renderAll();
    setSpaceGlobalLoading(false);
    return;
  }
  const readCollection = async (name) => { const results = await Promise.all(ids.map(async (organizationId) => { const snapshot = await getDocs(query(collection(db, name), where('organizationId', '==', organizationId))); return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); })); return results.flat(); };
  const [tasks, events, meetings, resources, notifications] = await Promise.all([readCollection('tasks'), readCollection('events'), readCollection('meetings'), readCollection('resources'), readCollection('inAppNotifications')]);
  state.docs = { tasks, events, meetings, resources, announcements: [], messages: [], activity: notifications.filter((item) => !item.targetType || item.targetType === 'everyone' || (Array.isArray(item.assignedTo) && item.assignedTo.map(normalize).includes(normalize(state.email)))) };
  renderAll();

  const messagesByOrganization = await Promise.all(ids.map(async (organizationId) => {
    const rooms = await getDocs(query(collection(db, 'liveChats'), where('organizationId', '==', organizationId)));
    return Promise.all(rooms.docs.map(async (room) => {
      const roomMessages = await getDocs(query(collection(db, 'liveChats', room.id, 'messages'), orderBy('createdAt', 'desc'), limit(5)));
      return roomMessages.docs.map((message) => ({ id: message.id, roomId: room.id, roomName: room.data()?.name || room.data()?.title || 'Live chat', ...message.data() }));
    }));
  }));
  const messages = messagesByOrganization.flat(2);
  state.docs.messages = messages;
  renderMessages();
  setSpaceGlobalLoading(false);
}

let liveRefreshTimer;
function scheduleLiveRefresh() {
  clearTimeout(liveRefreshTimer);
  liveRefreshTimer = setTimeout(() => {
    void loadData().catch((error) => setText('spaceError', error.message));
  }, 150);
}

async function subscribeLiveChatMessages(organizationIds) {
  await Promise.all(organizationIds.map(async (organizationId) => {
    try {
      const rooms = await getDocs(query(collection(db, 'liveChats'), where('organizationId', '==', organizationId)));
      rooms.docs.forEach((room) => {
        let initialSnapshot = true;
        const unsubscribe = onSnapshot(
          query(collection(db, 'liveChats', room.id, 'messages'), orderBy('createdAt', 'desc'), limit(5)),
          () => {
            if (initialSnapshot) {
              initialSnapshot = false;
              return;
            }
            scheduleLiveRefresh();
          },
          (error) => setText('spaceError', error.message)
        );
        state.unsubscribers.push(unsubscribe);
      });
    } catch (error) {
      setText('spaceError', error.message);
    }
  }));
}

function subscribeLive() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
  const ids = state.organizations.map((organization) => organization.id);

  ['tasks', 'events', 'meetings', 'resources', 'inAppNotifications', 'liveChats'].forEach((name) => {
    ids.forEach((organizationId) => {
      let initialSnapshot = true;
      state.unsubscribers.push(onSnapshot(
        query(collection(db, name), where('organizationId', '==', organizationId)),
        () => {
          if (initialSnapshot) {
            initialSnapshot = false;
            return;
          }
          if (name === 'liveChats') {
            clearTimeout(liveRefreshTimer);
            liveRefreshTimer = setTimeout(() => {
              void loadData().then(() => subscribeLive()).catch((error) => setText('spaceError', error.message));
            }, 150);
            return;
          }
          scheduleLiveRefresh();
        },
        (error) => setText('spaceError', error.message)
      ));
    });
  });

  void subscribeLiveChatMessages(ids);
}

async function initialize() { try { await requireAuth(['member', 'limited-admin']); state.email = await getStoredUserEmail(); const profile = await getDoc(doc(db, 'userRoles', normalize(state.email))); renderProfile(profile.exists() ? profile.data() : {}); state.organizations = await getOrganizationsForEmail(state.email); await loadData(); subscribeLive(); state.organizationUnsubscribe = subscribeToOrganizations(state.email, (organizations) => { state.organizations = organizations; void loadData().then(() => subscribeLive()).catch((error) => { setSpaceGlobalLoading(false); setText('spaceError', error.message); }); }, (error) => { setSpaceGlobalLoading(false); setText('spaceError', error.message); }); } catch (error) { setSpaceGlobalLoading(false); setText('spaceError', 'Unable to load your workspace. Please try again.'); console.error('My Space initialization failed:', error); } }

document.getElementById('logoutButton')?.addEventListener('click', signOutUser);
document.addEventListener('click', (event) => { const link = event.target.closest('[data-task-link], [data-schedule-link], [data-message-link]'); if (link) { if (link.dataset.organizationId) setActiveOrganizationId(link.dataset.organizationId); window.location.href = link.dataset.taskLink || link.dataset.scheduleLink || link.dataset.messageLink; } });
window.addEventListener('beforeunload', () => { state.unsubscribers.forEach((unsubscribe) => unsubscribe()); state.organizationUnsubscribe?.(); });
void initialize();
