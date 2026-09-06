import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { requireAuth, getStoredUserEmail } from "./auth.js";

const members = [
  { uid: "everyone", name: "Everyone" }
];

const mentionUsers = [];

let selectedChatId = null;
let chatMessagesUnsubscribe = null;
let selectedChatImageData = null;
let selectedChatImageName = null;
let chatMessagesById = {};
let currentUserEmail = null;
let allChatMessages = [];
let currentSearchQuery = '';
let replyToMessage = null;
let chatThemeUnsubscribe = null;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const defaultChatTheme = {
  start: '#0f172a',
  end: '#1e293b',
  direction: '135deg',
  sidebar: '#0f172a',
  header: '#0f172a',
  card: '#1e293b',
  accent: '#3b82f6'
};

function isThemeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

function getReadableChatTextColor(hexColor) {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  return (0.299 * red) + (0.587 * green) + (0.114 * blue) > 160 ? '#111827' : '#f8fafc';
}

function applyChatTheme(theme) {
  if (!theme || typeof theme !== 'object') {
    document.body.classList.remove('chat-theme');
    return;
  }

  const safeTheme = { ...defaultChatTheme, ...theme };
  const start = isThemeColor(safeTheme.start) ? safeTheme.start : defaultChatTheme.start;
  const end = isThemeColor(safeTheme.end) ? safeTheme.end : defaultChatTheme.end;
  const sidebar = isThemeColor(safeTheme.sidebar) ? safeTheme.sidebar : defaultChatTheme.sidebar;
  const header = isThemeColor(safeTheme.header) ? safeTheme.header : defaultChatTheme.header;
  const card = isThemeColor(safeTheme.card) ? safeTheme.card : defaultChatTheme.card;
  const accent = isThemeColor(safeTheme.accent) ? safeTheme.accent : defaultChatTheme.accent;
  const direction = ['45deg', '90deg', '135deg', '180deg'].includes(safeTheme.direction)
    ? safeTheme.direction
    : defaultChatTheme.direction;

  document.body.classList.add('chat-theme');
  document.body.style.setProperty('--chat-interface-gradient', `linear-gradient(${direction}, ${start} 0%, ${end} 100%)`);
  document.body.style.setProperty('--chat-sidebar-color', sidebar);
  document.body.style.setProperty('--chat-header-color', header);
  document.body.style.setProperty('--chat-card-color', card);
  document.body.style.setProperty('--chat-accent-color', accent);
  document.body.style.setProperty('--chat-header-text-color', getReadableChatTextColor(header));
  document.body.style.setProperty('--chat-card-text-color', getReadableChatTextColor(card));

  const interfaceGradient = `linear-gradient(${direction}, ${start} 0%, ${end} 100%)`;
  document.querySelector('.chat-page-card')?.style.setProperty('background', interfaceGradient, 'important');
  document.getElementById('chatMessages')?.style.setProperty('background', card, 'important');
  document.querySelectorAll('.chat-message').forEach((message) => {
    message.style.setProperty('background', card, 'important');
  });
}

function syncChatTheme(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  if (chatThemeUnsubscribe) chatThemeUnsubscribe();
  chatThemeUnsubscribe = onSnapshot(doc(db, 'userRoles', normalizedEmail), (profileSnap) => {
    const theme = profileSnap.exists() ? profileSnap.data()?.interfaceGradient : null;
    applyChatTheme(theme);
  }, (error) => {
    console.warn('Unable to sync chat interface theme:', error);
  });
}

async function loadProfilePictureForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const snap = await getDoc(doc(db, 'userRoles', normalizedEmail));
    if (snap.exists()) {
      return snap.data()?.profilePicture || null;
    }
    return null;
  } catch (error) {
    console.warn('Error loading profile picture for chat user:', error);
    return null;
  }
}

function getInitialsFromEmail(email) {
  const source = String(email || '').trim();
  if (!source) return '?';

  const cleaned = source.includes('@') ? source.split('@')[0] : source;
  const parts = cleaned.split(/[._\s-]+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map(part => part.charAt(0).toUpperCase()).join('').slice(0, 2);
}

function renderUserAvatarMarkup(email, size = 28) {
  const normalized = normalizeEmail(email);
  const initials = getInitialsFromEmail(email || 'Member');
  const safeSize = Math.max(20, Number(size) || 28);
  return `
    <div data-profile-email="${escapeHtml(normalized || '')}" style="width:${safeSize}px; height:${safeSize}px; border-radius:50%; background:#1f2937; border:1px solid #4b5563; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 0 0 1px rgba(148,163,184,0.15);">
      <span style="color:#e5e7eb; font-size:${Math.max(9, safeSize * 0.38)}px; font-weight:700; letter-spacing:0.04em;">${escapeHtml(initials)}</span>
    </div>
  `;
}

async function hydrateProfileAvatars() {
  const avatarNodes = [...document.querySelectorAll('[data-profile-email]')];
  if (!avatarNodes.length) return;

  const uniqueEmails = [...new Set(avatarNodes.map(node => normalizeEmail(node.getAttribute('data-profile-email'))).filter(Boolean))];
  if (!uniqueEmails.length) return;

  const results = await Promise.all(uniqueEmails.map(async (email) => {
    const memberPicture = await loadProfilePictureForEmail(email).catch(() => null);
    return memberPicture ? { email, picture: memberPicture } : { email, picture: null };
  }));

  const byEmail = new Map(results.filter(item => item && item.email).map(item => [item.email, item.picture]));

  avatarNodes.forEach((node) => {
    const email = normalizeEmail(node.getAttribute('data-profile-email'));
    const picture = byEmail.get(email);
    if (!picture) return;
    node.innerHTML = `<img src="${picture}" alt="Profile" style="width:100%; height:100%; object-fit:cover; display:block;" />`;
  });
}

function formatDisplayNameFromEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'Member';
  const localPart = normalized.split('@')[0] || 'Member';
  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function isHiddenMember(memberOrEmail) {
  const normalized = normalizeEmail(memberOrEmail?.uid || memberOrEmail);
  return normalized === 'everyone';
}

function ensureMemberEntry(email, fallbackName = null) {
  const normalized = normalizeEmail(email);
  if (!normalized || isHiddenMember(normalized)) return null;

  let member = members.find(m => normalizeEmail(m.uid) === normalized);
  if (!member) {
    member = { uid: normalized, name: fallbackName || normalized.split('@')[0] || normalized };
    members.push(member);
  }

  if (!mentionUsers.find(user => normalizeEmail(user.uid) === normalized)) {
    mentionUsers.push(member);
  }

  return member;
}

function syncMentionUsers() {
  mentionUsers.splice(0, mentionUsers.length, ...members.filter(member => !isHiddenMember(member)));
}

function resetMemberCatalog() {
  members.splice(0, members.length, { uid: 'everyone', name: 'Everyone' });
  mentionUsers.splice(0, mentionUsers.length);
}

function isTrackedAuthMember(data = {}) {
  return data.hasAuthAccount === true || data.authAccount === true || data.authProvider === 'password' || data.authProvider === 'firebase' || data.createdByAdmin === true || data.createdViaAuth === true || data.authTracked === true;
}

async function refreshMentionMembers() {
  try {
    const snapshot = await getDocs(collection(db, 'userRoles'));
    resetMemberCatalog();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (!isTrackedAuthMember(data)) return;

      const docId = normalizeEmail(docSnap.id);
      if (!docId) return;
      const displayName = typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
        : (typeof data.name === 'string' && data.name.trim() ? data.name.trim() : (typeof data.email === 'string' && data.email.trim() ? data.email.trim() : docId));
      ensureMemberEntry(docId, displayName);
    });

    if (currentUserEmail) {
      ensureMemberEntry(currentUserEmail, currentUserEmail);
    }

    syncMentionUsers();
  } catch (error) {
    console.warn('Unable to refresh mention members:', error);
  }
}

function getUserName(email) {
  const normalized = normalizeEmail(email);
  const member = members.find(m => normalizeEmail(m.uid) === normalized);
  if (member) return member.name;

  const created = ensureMemberEntry(email, formatDisplayNameFromEmail(email));
  const fallbackName = created ? created.name : formatDisplayNameFromEmail(email);
  return fallbackName;
}

function getChatSenderName(message = {}) {
  if (normalizeEmail(message.senderEmail) === 'johnpaulbugayong@gmail.com') return 'Admin';
  return message.senderName || getUserName(message.senderEmail) || 'Unknown';
}

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function showError(message) {
  const errorEl = document.getElementById('chatError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function formatMessageWithMentions(text) {
  return text.replace(/@\[([^\]]+)\]/g, '<span class="mention">@$1</span>');
}

function getMentionContext(input) {
  const cursor = input.selectionStart;
  const value = input.value;
  const before = value.slice(0, cursor);
  const atIndex = before.lastIndexOf('@');
  if (atIndex === -1) return null;

  const prefix = before.slice(atIndex + 1);
  if (/\s/.test(prefix)) return null;
  if (atIndex > 0 && /[^\s]/.test(before[atIndex - 1])) return null;

  return {
    start: atIndex,
    query: prefix.toLowerCase()
  };
}

function updateMentionDropdown(input, dropdown) {
  const context = getMentionContext(input);
  if (!context) {
    dropdown.style.display = 'none';
    return;
  }

  const filtered = mentionUsers.filter((user) => {
    const search = `${user.name} ${user.uid}`.toLowerCase();
    return search.includes(context.query);
  });

  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="mention-item">No matching members found</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtered.map((user) => `
    <div class="mention-item" data-name="${escapeHtml(user.name)}">
      <strong>${escapeHtml(user.name)}</strong>
      <span class="mention-email">${escapeHtml(user.uid)}</span>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function insertMentionAtCursor(input, dropdown, name) {
  const cursor = input.selectionStart;
  const value = input.value;
  const before = value.slice(0, cursor);
  const atIndex = before.lastIndexOf('@');
  if (atIndex === -1) return;

  const token = `@[${name}] `;
  input.value = value.slice(0, atIndex) + token + value.slice(cursor);
  const newCursor = atIndex + token.length;
  input.setSelectionRange(newCursor, newCursor);
  input.focus();
  dropdown.style.display = 'none';
}

function setupMentionAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  input.addEventListener('input', () => updateMentionDropdown(input, dropdown));

  dropdown.addEventListener('click', (event) => {
    const item = event.target.closest('.mention-item');
    if (!item) return;
    insertMentionAtCursor(input, dropdown, item.dataset.name);
  });

  document.addEventListener('click', (event) => {
    if (!input.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function clearError() {
  const errorEl = document.getElementById('chatError');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.style.display = 'none';
}

function updateReplyPreview() {
  const previewEl = document.getElementById('replyPreview');
  const previewTextEl = document.getElementById('replyPreviewText');
  if (!previewEl || !previewTextEl) return;

  if (!replyToMessage) {
    previewEl.style.display = 'none';
    previewTextEl.innerHTML = '';
    return;
  }

  const sender = getChatSenderName(replyToMessage);
  const text = replyToMessage.deleted
    ? 'This message was unsent.'
    : (replyToMessage.text || (replyToMessage.imageData ? '[image]' : ''));
  const previewText = String(text || '').length > 140 ? `${String(text).slice(0, 140)}...` : text;

  previewTextEl.innerHTML = `<strong>${escapeHtml(sender)}</strong> ${escapeHtml(previewText)}`;
  previewEl.style.display = 'block';
}

function cancelReply() {
  replyToMessage = null;
  updateReplyPreview();
}

function setReplyTarget(message) {
  replyToMessage = message;
  updateReplyPreview();
  const input = document.getElementById('chatMessageInput');
  if (input) input.focus();
}

function highlightSearchTerms(text, query) {
  if (!query) return escapeHtml(text);
  
  const regex = new RegExp(`(${query.split(/\s+/).filter(Boolean).join('|')})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="search-highlight">$1</span>');
}

function filterMessagesForSearch(messages, query) {
  if (!query || query.trim() === '') {
    return messages;
  }

  const normalizedQuery = query.toLowerCase();
  return messages.filter(msg => {
    if (msg.deleted) return false;
    const messageText = (msg.text || '').toLowerCase();
    const senderName = (msg.senderName || '').toLowerCase();
    return messageText.includes(normalizedQuery) || senderName.includes(normalizedQuery);
  });
}

function updateSearchResults() {
  const searchInput = document.getElementById('chatSearchInput');
  const clearButton = document.getElementById('chatClearSearchButton');
  const resultsCount = document.getElementById('chatSearchResultsCount');
  
  if (!searchInput) return;

  currentSearchQuery = searchInput.value.trim();
  
  if (currentSearchQuery === '') {
    clearButton.style.display = 'none';
    resultsCount.textContent = '';
    renderChatMessages(allChatMessages);
    return;
  }

  clearButton.style.display = 'inline-block';
  
  const filteredMessages = filterMessagesForSearch(allChatMessages, currentSearchQuery);
  const count = filteredMessages.length;
  
  if (count === 0) {
    resultsCount.textContent = 'No matches';
    resultsCount.style.color = '#f87171';
  } else {
    resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''}`;
    resultsCount.style.color = '#86efac';
  }

  renderChatMessagesWithSearch(filteredMessages, currentSearchQuery);
}

function clearSearch() {
  const searchInput = document.getElementById('chatSearchInput');
  if (searchInput) {
    searchInput.value = '';
    updateSearchResults();
    searchInput.focus();
  }
}

function getAllChatImages() {
  return allChatMessages
    .filter(msg => msg.imageData && !msg.deleted)
    .map(msg => ({
      id: msg.id,
      imageData: msg.imageData,
      senderName: msg.senderName || getUserName(msg.senderEmail) || 'Unknown',
      timestamp: msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''
    }));
}

function renderPinnedMessages(messages) {
  const section = document.getElementById('pinnedMessagesSection');
  const list = document.getElementById('pinnedMessagesList');
  const count = document.getElementById('pinnedMessagesCount');
  if (!section || !list || !count) return;

  const pinnedMessages = (messages || []).filter(message => message.pinned && !message.deleted);
  count.textContent = pinnedMessages.length;

  if (pinnedMessages.length === 0) {
    list.innerHTML = '<div class="pinned-messages-empty">No pinned messages yet.</div>';
    return;
  }

  list.innerHTML = pinnedMessages.map((message) => {
    const sender = getChatSenderName(message);
    const text = message.text || (message.imageData ? '[Image]' : 'Pinned message');
    const preview = text.length > 120 ? `${text.slice(0, 120)}...` : text;
    return `
      <button type="button" class="pinned-message-item" data-pinned-message-id="${escapeHtml(message.id)}">
        <i class="fas fa-thumbtack" style="color: #facc15; margin-top: 0.15rem;" aria-hidden="true"></i>
        <span class="pinned-message-content">
          <span class="pinned-message-sender">${escapeHtml(sender)}</span>
          <span class="pinned-message-preview">${escapeHtml(preview)}</span>
        </span>
      </button>
    `;
  }).join('');
}

function scrollToPinnedMessage(messageId) {
  if (!messageId) return;
  if (currentSearchQuery) clearSearch();

  const messageElement = [...document.querySelectorAll('#chatMessages .chat-message')]
    .find(element => element.dataset.messageId === messageId);
  if (!messageElement) return;

  messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  messageElement.style.outline = '2px solid #facc15';
  setTimeout(() => { messageElement.style.outline = ''; }, 1600);
}

function updateChatAlbumGrid() {
  const grid = document.getElementById('chatAlbumGrid');
  if (!grid) return;

  const images = getAllChatImages();

  if (images.length === 0) {
    grid.innerHTML = '<div class="chat-album-empty">No images in this chat yet.</div>';
  } else {
    grid.innerHTML = images.map(img => `
      <div class="chat-album-thumbnail" title="${escapeHtml(img.senderName)} - ${img.timestamp}" onclick="showFullscreenImagePreview('${img.imageData.replace(/'/g, "\\'")}');">
        <img src="${escapeHtml(img.imageData)}" alt="Album image" loading="lazy" />
      </div>
    `).join('');
  }
}

function displayChatAlbum() {
  const modal = document.getElementById('chatAlbumModal');
  if (!modal) return;
  updateChatAlbumGrid();
  modal.style.display = 'flex';
}

function closeChatAlbum() {
  const modal = document.getElementById('chatAlbumModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Make functions globally accessible for onclick handlers
window.closeChatAlbum = closeChatAlbum;
window.displayChatAlbum = displayChatAlbum;
window.showFullscreenImagePreview = showFullscreenImagePreview;

function sortMessagesByDateTime(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });
}

function renderChatMessages(messages) {
  const chatMessagesEl = document.getElementById('chatMessages');
  if (!chatMessagesEl) return;

  // Sort messages by date and time (oldest to newest)
  const sortedMessages = sortMessagesByDateTime(messages);
  allChatMessages = sortedMessages;

  if (!messages || messages.length === 0) {
    chatMessagesEl.innerHTML = '<p style="color: #94a3b8; text-align: center; margin: 1rem 0;">No messages yet. Start the conversation!</p>';
    return;
  }

  chatMessagesEl.innerHTML = '';
  chatMessagesById = {};

  let lastDate = null;

  sortedMessages.forEach((msg) => {
    // Add date separator if date changed
    if (msg.createdAt) {
      const currentDate = new Date(msg.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });
      if (lastDate !== currentDate) {
        const dateSeparator = document.createElement('div');
        dateSeparator.style.cssText = 'display: flex; align-items: center; justify-content: center; margin: 1.5rem 0 1rem 0; gap: 0.75rem;';
        dateSeparator.innerHTML = `
          <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.3), transparent);"></div>
          <div class="chat-date-separator" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #cbd5e1; font-weight: 600; white-space: nowrap; letter-spacing: 0.02em;">${currentDate}</div>
          <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.3), transparent);"></div>
        `;
        chatMessagesEl.appendChild(dateSeparator);
        lastDate = currentDate;
      }
    }

    chatMessagesById[msg.id] = msg;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    msgDiv.dataset.messageId = msg.id;
    msgDiv.style.opacity = msg.deleted ? '0.75' : '1';

    const sender = getChatSenderName(msg);
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const messageText = msg.deleted ? 'This message was unsent.' : msg.text || '';
    const safeText = escapeHtml(messageText);
    const renderedText = msg.deleted ? safeText : formatMessageWithMentions(safeText);
    const imageMarkup = !msg.deleted && msg.imageData ? `<div style="margin: 0.35rem 0;"><img class="chat-image" src="${escapeHtml(msg.imageData)}" alt="Chat image" loading="lazy" /></div>` : '';
    const replyQuote = msg.replyTo ? `
      <div class="chat-reply-quote">
        <div class="chat-reply-quote-label">Replying to ${escapeHtml(msg.replyTo.senderName || 'Unknown')}</div>
        <div class="chat-reply-quote-text">${escapeHtml(msg.replyTo.text || (msg.replyTo.imageData ? '[image]' : ''))}</div>
      </div>
    ` : '';
    const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail || '');
    const isOwnMessage = normalizedCurrentUserEmail && normalizeEmail(msg.senderEmail) === normalizedCurrentUserEmail;
    const unsendButton = isOwnMessage && !msg.deleted ? `<button type="button" class="chat-unsend-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(248, 113, 113, 0.12); color: #f97316; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">Unsend</button>` : '';
    const pinButton = !msg.deleted ? `<button type="button" class="chat-pin-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: ${msg.pinned ? 'rgba(250, 204, 21, 0.2)' : 'rgba(148, 163, 184, 0.12)'}; color: ${msg.pinned ? '#facc15' : '#cbd5e1'}; border: 1px solid ${msg.pinned ? 'rgba(250, 204, 21, 0.45)' : 'rgba(148, 163, 184, 0.35)'}; border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">${msg.pinned ? 'Unpin' : 'Pin'}</button>` : '';
    const replyButton = !msg.deleted ? `<button type="button" class="chat-reply-btn" data-message-id="${msg.id}">↩ Reply</button>` : '';
    const actionButtons = [replyButton, unsendButton, pinButton].filter(Boolean).join('<span style="margin: 0 0.35rem; color: #374151;">|</span>');

    msgDiv.innerHTML = `
      ${msg.pinned ? '<div style="color: #facc15; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.35rem;">Pinned message</div>' : ''}
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
          ${renderUserAvatarMarkup(msg.senderEmail || sender, 26)}
          <div style="font-size: 0.9rem; color: #94a3b8;">${escapeHtml(sender)}</div>
        </div>
        <div class="chat-message-time" style="font-size: 0.8rem; color: #6b7280;">${timestamp}</div>
      </div>
      <div class="chat-message-text" style="color: ${msg.deleted ? '#9ca3af' : '#e5e7eb'}; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${replyQuote}${imageMarkup}${renderedText}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; margin-bottom: ${msg.reactions && Object.keys(msg.reactions).length > 0 ? '0.5rem' : '0'};">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${actionButtons}</div>
        ${!msg.deleted ? `<button type="button" class="chat-react-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">😊 React</button>` : ''}
      </div>
      ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #374151;">
          ${Object.entries(msg.reactions).map(([emoji, users]) => `
            <div class="chat-reaction-badge" data-message-id="${msg.id}" data-emoji="${emoji}" data-users='${JSON.stringify(users)}' style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 9999px; font-size: 0.8rem; cursor: pointer;">
              <span>${emoji}</span>
              <span style="color: #94a3b8;">${users.length}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    chatMessagesEl.appendChild(msgDiv);
  });

  void hydrateProfileAvatars();
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  const albumModal = document.getElementById('chatAlbumModal');
  if (albumModal && albumModal.style.display === 'flex') {
    updateChatAlbumGrid();
  }

  const reactBtns = chatMessagesEl.querySelectorAll('.chat-react-btn');
  reactBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      showReactionMenu(messageId, e);
    });
  });

  const unsendBtns = chatMessagesEl.querySelectorAll('.chat-unsend-btn');
  unsendBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      unsendChatMessage(selectedChatId, messageId);
    });
  });

  const pinBtns = chatMessagesEl.querySelectorAll('.chat-pin-btn');
  pinBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleChatMessagePin(selectedChatId, this.dataset.messageId);
    });
  });

  const reactionBadges = chatMessagesEl.querySelectorAll('.chat-reaction-badge');
  reactionBadges.forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const emoji = this.dataset.emoji;
      const users = JSON.parse(this.dataset.users);
      showReactionDetails(emoji, users);
    });
    badge.addEventListener('mouseover', function() {
      this.style.background = 'rgba(96, 165, 250, 0.2)';
    });
    badge.addEventListener('mouseout', function() {
      this.style.background = 'rgba(96, 165, 250, 0.1)';
    });
  });

  const chatImages = chatMessagesEl.querySelectorAll('.chat-image');
  chatImages.forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      showFullscreenImagePreview(this.src);
    });
    img.style.cursor = 'pointer';
  });
}

function renderChatMessagesWithSearch(messages, searchQuery) {
  const chatMessagesEl = document.getElementById('chatMessages');
  if (!chatMessagesEl) return;

  // Sort messages by date and time (oldest to newest)
  const sortedMessages = sortMessagesByDateTime(messages);

  if (!sortedMessages || sortedMessages.length === 0) {
    chatMessagesEl.innerHTML = '<p style="color: #94a3b8; text-align: center; margin: 1rem 0;">No messages match your search.</p>';
    return;
  }

  chatMessagesEl.innerHTML = '';

  let lastDate = null;

  sortedMessages.forEach((msg) => {
    // Add date separator if date changed
    if (msg.createdAt) {
      const currentDate = new Date(msg.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });
      if (lastDate !== currentDate) {
        const dateSeparator = document.createElement('div');
        dateSeparator.style.cssText = 'display: flex; align-items: center; justify-content: center; margin: 1.5rem 0 1rem 0; gap: 0.75rem;';
        dateSeparator.innerHTML = `
          <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.3), transparent);"></div>
          <div class="chat-date-separator" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #cbd5e1; font-weight: 600; white-space: nowrap; letter-spacing: 0.02em;">${currentDate}</div>
          <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.3), transparent);"></div>
        `;
        chatMessagesEl.appendChild(dateSeparator);
        lastDate = currentDate;
      }
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message search-match';
    msgDiv.dataset.messageId = msg.id;
    msgDiv.style.opacity = msg.deleted ? '0.75' : '1';

    const sender = getChatSenderName(msg);
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const messageText = msg.deleted ? 'This message was unsent.' : msg.text || '';
    const highlightedText = msg.deleted ? messageText : highlightSearchTerms(messageText, searchQuery);
    const renderedText = msg.deleted ? messageText : formatMessageWithMentions(highlightedText);
    const imageMarkup = !msg.deleted && msg.imageData ? `<div style="margin: 0.35rem 0;"><img class="chat-image" src="${escapeHtml(msg.imageData)}" alt="Chat image" loading="lazy" /></div>` : '';
    const replyQuote = msg.replyTo ? `
      <div class="chat-reply-quote">
        <div class="chat-reply-quote-label">Replying to ${escapeHtml(msg.replyTo.senderName || 'Unknown')}</div>
        <div class="chat-reply-quote-text">${escapeHtml(msg.replyTo.text || (msg.replyTo.imageData ? '[image]' : ''))}</div>
      </div>
    ` : '';
    const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail || '');
    const isOwnMessage = normalizedCurrentUserEmail && normalizeEmail(msg.senderEmail) === normalizedCurrentUserEmail;
    const unsendButton = isOwnMessage && !msg.deleted ? `<button type="button" class="chat-unsend-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(248, 113, 113, 0.12); color: #f97316; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">Unsend</button>` : '';
    const pinButton = !msg.deleted ? `<button type="button" class="chat-pin-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: ${msg.pinned ? 'rgba(250, 204, 21, 0.2)' : 'rgba(148, 163, 184, 0.12)'}; color: ${msg.pinned ? '#facc15' : '#cbd5e1'}; border: 1px solid ${msg.pinned ? 'rgba(250, 204, 21, 0.45)' : 'rgba(148, 163, 184, 0.35)'}; border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">${msg.pinned ? 'Unpin' : 'Pin'}</button>` : '';
    const replyButton = !msg.deleted ? `<button type="button" class="chat-reply-btn" data-message-id="${msg.id}">↩ Reply</button>` : '';
    const actionButtons = [replyButton, unsendButton, pinButton].filter(Boolean).join('<span style="margin: 0 0.35rem; color: #374151;">|</span>');

    msgDiv.innerHTML = `
      ${msg.pinned ? '<div style="color: #facc15; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.35rem;">Pinned message</div>' : ''}
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
          ${renderUserAvatarMarkup(msg.senderEmail || sender, 26)}
          <div style="font-size: 0.9rem; color: #94a3b8;">${escapeHtml(sender)}</div>
        </div>
        <div class="chat-message-time" style="font-size: 0.8rem; color: #6b7280;">${timestamp}</div>
      </div>
      <div style="color: ${msg.deleted ? '#9ca3af' : '#e5e7eb'}; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${replyQuote}${imageMarkup}${renderedText}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; margin-bottom: ${msg.reactions && Object.keys(msg.reactions).length > 0 ? '0.5rem' : '0'};">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${actionButtons}</div>
        ${!msg.deleted ? `<button type="button" class="chat-react-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">😊 React</button>` : ''}
      </div>
      ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #374151;">
          ${Object.entries(msg.reactions).map(([emoji, users]) => `
            <div class="chat-reaction-badge" data-message-id="${msg.id}" data-emoji="${emoji}" data-users='${JSON.stringify(users)}' style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 9999px; font-size: 0.8rem; cursor: pointer;">
              <span>${emoji}</span>
              <span style="color: #94a3b8;">${users.length}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    chatMessagesEl.appendChild(msgDiv);
  });

  void hydrateProfileAvatars();
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  const albumModal = document.getElementById('chatAlbumModal');
  if (albumModal && albumModal.style.display === 'flex') {
    updateChatAlbumGrid();
  }

  const reactBtns = chatMessagesEl.querySelectorAll('.chat-react-btn');
  reactBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      showReactionMenu(messageId, e);
    });
  });

  const unsendBtns = chatMessagesEl.querySelectorAll('.chat-unsend-btn');
  unsendBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      unsendChatMessage(selectedChatId, messageId);
    });
  });

  const pinBtns = chatMessagesEl.querySelectorAll('.chat-pin-btn');
  pinBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleChatMessagePin(selectedChatId, this.dataset.messageId);
    });
  });

  const reactionBadges = chatMessagesEl.querySelectorAll('.chat-reaction-badge');
  reactionBadges.forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const emoji = this.dataset.emoji;
      const users = JSON.parse(this.dataset.users);
      showReactionDetails(emoji, users);
    });
    badge.addEventListener('mouseover', function() {
      this.style.background = 'rgba(96, 165, 250, 0.2)';
    });
    badge.addEventListener('mouseout', function() {
      this.style.background = 'rgba(96, 165, 250, 0.1)';
    });
  });

  const chatImages = chatMessagesEl.querySelectorAll('.chat-image');
  chatImages.forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      showFullscreenImagePreview(this.src);
    });
    img.style.cursor = 'pointer';
  });
}

function showFullscreenImagePreview(imageSrc) {
  let modal = document.getElementById('chatFullscreenImageModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'chatFullscreenImageModal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.95);
    z-index: 100001;
    padding: 1rem;
  `;

  const imgContainer = document.createElement('div');
  imgContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 90vw;
    max-height: 90vh;
  `;

  const img = document.createElement('img');
  img.src = imageSrc;
  img.alt = 'Full screen preview';
  img.style.cssText = `
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 0.5rem;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = `
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: rgba(248, 113, 113, 0.15);
    color: #f97316;
    border: 1px solid rgba(248, 113, 113, 0.35);
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 600;
  `;
  closeBtn.addEventListener('click', () => modal.remove());

  imgContainer.appendChild(img);
  imgContainer.appendChild(closeBtn);
  modal.appendChild(imgContainer);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}


function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showReactionDetails(emoji, users) {
  let modal = document.getElementById('chatReactionDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'chatReactionDetailsModal';
    modal.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(15, 23, 42, 0.9); z-index: 100000;';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
    const content = document.createElement('div');
    content.style.cssText = 'width: min(420px, 100%); background: #0f172a; border: 1px solid #374151; border-radius: 1rem; padding: 1.25rem; color: #e5e7eb;';
    content.id = 'chatReactionDetailsContent';
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  const content = document.getElementById('chatReactionDetailsContent');
  if (!content) return;

  content.innerHTML = `
    <div style="font-size: 2.5rem; text-align: center; margin-bottom: 0.75rem;">${escapeHtml(emoji)}</div>
    <div style="text-align: center; color: #94a3b8; margin-bottom: 1rem;">${users.length} ${users.length === 1 ? 'person reacted' : 'people reacted'}</div>
    <div style="display: grid; gap: 0.5rem; max-height: 280px; overflow-y: auto; margin-bottom: 1rem;">
      ${users.map(user => `<div style="padding: 0.75rem 0.85rem; border-radius: 0.75rem; background: #111827; color: #e5e7eb;">${escapeHtml(user)}</div>`).join('')}
    </div>
    <button type="button" onclick="document.getElementById('chatReactionDetailsModal')?.remove();" style="width: 100%; padding: 0.85rem 1rem; border: none; border-radius: 0.75rem; background: #3b82f6; color: white; cursor: pointer;">Close</button>
  `;
}

function showReactionMenu(messageId, event) {
  let menu = document.getElementById('chatReactionMenu');
  if (menu) menu.remove();

  const emojis = ['😀', '😂', '😢', '😠', '❤️', '👍', '🎉'];
  menu = document.createElement('div');
  menu.id = 'chatReactionMenu';
  menu.style.cssText = 'position: fixed; z-index: 100000; display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0.75rem; background: #0f172a; border: 1px solid #374151; border-radius: 1rem; box-shadow: 0 10px 40px rgba(0,0,0,0.25);';

  emojis.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emoji;
    btn.style.cssText = 'width: 2.5rem; height: 2.5rem; font-size: 1.2rem; border: none; border-radius: 0.75rem; background: #111827; color: #f8fafc; cursor: pointer;';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMessageReaction(messageId, emoji);
      menu.remove();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 16);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 16);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const removeMenu = () => menu?.remove();
  setTimeout(() => {
    window.addEventListener('click', removeMenu, { once: true });
  }, 0);
}

async function toggleMessageReaction(messageId, emoji) {
  if (!selectedChatId || !messageId || !currentUserEmail) return;

  const messageRef = doc(db, 'liveChats', selectedChatId, 'messages', messageId);
  try {
    const messageSnap = await getDoc(messageRef);
    if (!messageSnap.exists()) return;

    const messageData = messageSnap.data();
    const reactions = messageData.reactions || {};
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const normalizedUsers = reactions[emoji].map(normalizeEmail);
    const current = normalizeEmail(currentUserEmail);
    const userIndex = normalizedUsers.indexOf(current);
    if (userIndex >= 0) {
      reactions[emoji] = reactions[emoji].filter(u => normalizeEmail(u) !== current);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(currentUserEmail);
    }

    await updateDoc(messageRef, { reactions });
  } catch (error) {
    console.error('Failed to update reaction:', error);
  }
}

async function unsendChatMessage(chatId, messageId) {
  if (!chatId || !messageId || !currentUserEmail) return;

  const messageRef = doc(db, 'liveChats', chatId, 'messages', messageId);
  try {
    await updateDoc(messageRef, {
      deleted: true,
      text: 'This message was unsent.',
      unsentAt: Date.now()
    });
  } catch (error) {
    console.error('Failed to unsend chat message:', error);
  }
}

async function toggleChatMessagePin(chatId, messageId) {
  if (!chatId || !messageId) return;

  const message = chatMessagesById[messageId];
  if (!message) return;

  try {
    await updateDoc(doc(db, 'liveChats', chatId, 'messages', messageId), {
      pinned: !message.pinned,
      pinnedAt: !message.pinned ? Date.now() : null,
      pinnedBy: !message.pinned ? currentUserEmail : null
    });
  } catch (error) {
    console.error('Failed to update chat message pin:', error);
  }
}

function updateChatImagePreview() {
  const preview = document.getElementById('chatImagePreview');
  if (!preview) return;

  if (!selectedChatImageData) {
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }

  preview.style.display = 'block';
  preview.innerHTML = `
    <img src="${escapeHtml(selectedChatImageData)}" alt="Selected image preview" />
    <button id="clearImageSelection" type="button" style="background: rgba(248, 113, 113, 0.15); color: #f97316; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 9999px; padding: 0.6rem 1rem; cursor: pointer;">Remove</button>
  `;

  const clearButton = document.getElementById('clearImageSelection');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      selectedChatImageData = null;
      selectedChatImageName = null;
      const input = document.getElementById('chatImageInput');
      if (input) input.value = '';
      updateChatImagePreview();
    });
  }
}

function triggerChatImageInput() {
  const input = document.getElementById('chatImageInput');
  if (input) input.click();
}

function compressImage(dataUrl, maxSizeKB = 500) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      
      // Start with original dimensions
      let width = img.width;
      let height = img.height;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0);
      
      // Compress by reducing quality iteratively
      let quality = 0.9;
      let compressed = canvas.toDataURL('image/jpeg', quality);
      
      // Reduce quality until size is acceptable
      while (compressed.length > maxSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }
      
      // If still too large, reduce dimensions
      let scaleFactor = 0.9;
      while (compressed.length > maxSizeKB * 1024 && scaleFactor > 0.3) {
        scaleFactor -= 0.1;
        width = Math.round(img.width * scaleFactor);
        height = Math.round(img.height * scaleFactor);
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        quality = 0.9;
        compressed = canvas.toDataURL('image/jpeg', quality);
        
        while (compressed.length > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
      }
      
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

function handleChatImageInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    selectedChatImageData = null;
    selectedChatImageName = null;
    updateChatImagePreview();
    return;
  }

  const fileName = file.name.toLowerCase();
  const isImageByMime = typeof file.type === 'string' && file.type.toLowerCase().startsWith('image/');
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tif', '.tiff', '.heic', '.heif', '.avif', '.jfif'];
  const isImageByExtension = imageExtensions.some(ext => fileName.endsWith(ext));

  if (!isImageByMime && !isImageByExtension) {
    showError('Please select a valid image file.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError('Image file is too large. Please select an image smaller than 10 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const compressedData = await compressImage(reader.result, 500);
      selectedChatImageData = compressedData;
      selectedChatImageName = file.name;
      updateChatImagePreview();
      clearError();
    } catch (error) {
      console.error('Failed to compress image:', error);
      showError('Failed to process image. Please try another file.');
    }
  };
  reader.onerror = () => {
    showError('Failed to read the image file.');
  };
  reader.readAsDataURL(file);
}

async function subscribeChatMessages(chatId) {
  if (chatMessagesUnsubscribe) {
    chatMessagesUnsubscribe();
  }

  const messagesQuery = query(collection(db, 'liveChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  chatMessagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    const messages = [];
    snapshot.forEach((docSnap) => messages.push({ id: docSnap.id, ...docSnap.data() }));
    renderPinnedMessages(messages);
    renderChatMessages(messages);
  }, (error) => {
    console.error('Chat messages listener error:', error);
    showError('Unable to load chat messages right now.');
  });
}

async function sendChatMessage(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!selectedChatId) return;

  const messageInput = document.getElementById('chatMessageInput');
  if (!messageInput) return;

  const message = messageInput.value;
  if (!message.trim() && !selectedChatImageData) return;

  // Store image data before clearing preview
  const imageDataToSend = selectedChatImageData;
  const imageNameToSend = selectedChatImageName;

  // Clear preview immediately for better UX
  messageInput.value = '';
  selectedChatImageData = null;
  selectedChatImageName = null;
  updateChatImagePreview();

  const currentEmail = currentUserEmail || await getStoredUserEmail();
  const cleanedMessage = message.split('\n').map(line => line.trim()).join('\n').trim().normalize('NFC');
  const messageData = {
    senderEmail: currentEmail,
    senderName: normalizeEmail(currentEmail) === 'johnpaulbugayong@gmail.com' ? 'Admin' : getUserName(currentEmail),
    text: cleanedMessage || '',
    createdAt: Date.now(),
    deleted: false
  };

  if (replyToMessage) {
    messageData.replyTo = {
      id: replyToMessage.id,
      senderEmail: replyToMessage.senderEmail,
      senderName: replyToMessage.senderName || getUserName(replyToMessage.senderEmail),
      text: replyToMessage.deleted
        ? 'This message was unsent.'
        : (replyToMessage.text || (replyToMessage.imageData ? '[image]' : ''))
    };
  }

  if (imageDataToSend) {
    // Check final size before sending
    const estimatedSize = messageData.text.length + imageDataToSend.length + 500;
    if (estimatedSize > 1000000) {
      showError('Message with image is too large. Please try a smaller image.');
      return;
    }
    messageData.imageData = imageDataToSend;
    if (imageNameToSend) messageData.imageName = imageNameToSend;
  }

  try {
    await addDoc(collection(db, 'liveChats', selectedChatId, 'messages'), messageData);
    cancelReply();
    clearError();
  } catch (error) {
    console.error('Failed to send chat message:', error);
    if (error.message && error.message.includes('imageData')) {
      showError('Image is too large. Please select a smaller image.');
    } else {
      showError('Unable to send message. Please try again.');
    }
  }
}

async function loadChatRoomInfo(chatId) {
  cancelReply();

  const chatDoc = await getDoc(doc(db, 'liveChats', chatId));
  if (!chatDoc.exists()) {
    showError('Chat room not found.');
    return;
  }

  const data = chatDoc.data();
  if (currentUserEmail && chatId) {
    localStorage.setItem(`chatLastRead:${currentUserEmail}:${chatId}`, String(Date.now()));
  }
  const titleEl = document.getElementById('chatTitle');
  const metaEl = document.getElementById('chatMeta');
  const statusEl = document.getElementById('chatStatus');

  if (titleEl) titleEl.textContent = data.title || 'Live Chat';
  if (metaEl) {
    const createdBy = normalizeEmail(data.createdByEmail) === 'johnpaulbugayong@gmail.com'
      ? 'Admin'
      : (data.createdByName && !/^[^@\s]+@[^\s]+\.[^@\s]+$/.test(data.createdByName)
        ? data.createdByName
        : getUserName(data.createdByEmail));
    metaEl.textContent = `Created by ${createdBy} • ${new Date(data.createdAt).toLocaleString()}`;
  }
  if (statusEl) {
    statusEl.textContent = `Status: ${data.status || 'Active'}`;
    statusEl.style.background = data.status === 'Closed' ? '#7f1d1d' : '#1f2937';
  }

  clearError();
  subscribeChatMessages(chatId);
}

function setupBackButton(from) {
  const backButton = document.getElementById('backButton');
  if (!backButton) return;
  if (from === 'admin') {
    backButton.addEventListener('click', () => { window.location.href = 'admin.html'; });
  } else {
    backButton.addEventListener('click', () => { window.location.href = 'member.html'; });
  }
}

async function init() {
  await requireAuth(['member', 'admin']);
  currentUserEmail = await getStoredUserEmail();
  syncChatTheme(currentUserEmail);
  await refreshMentionMembers();

  selectedChatId = getQueryParam('chatId');
  const from = getQueryParam('from') || 'member';

  if (!selectedChatId) {
    showError('Chat room ID is missing.');
    return;
  }

  setupBackButton(from);
  document.getElementById('attachImageButton')?.addEventListener('click', triggerChatImageInput);
  document.getElementById('chatImageInput')?.addEventListener('change', handleChatImageInputChange);
  document.getElementById('chatMessageForm')?.addEventListener('submit', sendChatMessage);
  document.getElementById('cancelReplyButton')?.addEventListener('click', cancelReply);
  setupMentionAutocomplete('chatMessageInput', 'chatMentionDropdown');

  const searchInput = document.getElementById('chatSearchInput');
  const clearSearchButton = document.getElementById('chatClearSearchButton');
  
  if (searchInput) {
    searchInput.addEventListener('input', updateSearchResults);
  }
  
  if (clearSearchButton) {
    clearSearchButton.addEventListener('click', clearSearch);
  }

  const albumButton = document.getElementById('chatAlbumButton');
  const albumModal = document.getElementById('chatAlbumModal');
  
  if (albumButton) {
    albumButton.addEventListener('click', displayChatAlbum);
  }
  
  if (albumModal) {
    albumModal.addEventListener('click', (event) => {
      if (event.target === albumModal) {
        closeChatAlbum();
      }
    });
  }

  const pinnedMessagesToggle = document.getElementById('pinnedMessagesToggle');
  const pinnedMessagesList = document.getElementById('pinnedMessagesList');
  const pinnedMessagesChevron = document.getElementById('pinnedMessagesChevron');
  if (pinnedMessagesToggle && pinnedMessagesList) {
    pinnedMessagesToggle.addEventListener('click', () => {
      const isExpanded = pinnedMessagesToggle.getAttribute('aria-expanded') === 'true';
      pinnedMessagesToggle.setAttribute('aria-expanded', String(!isExpanded));
      pinnedMessagesList.style.display = isExpanded ? 'none' : 'flex';
      if (pinnedMessagesChevron) {
        pinnedMessagesChevron.className = isExpanded ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      }
    });

    pinnedMessagesList.addEventListener('click', (event) => {
      const item = event.target.closest('.pinned-message-item');
      if (item) scrollToPinnedMessage(item.dataset.pinnedMessageId);
    });
  }

  const messagesContainer = document.getElementById('chatMessages');
  if (messagesContainer) {
    messagesContainer.addEventListener('click', (event) => {
      const replyButton = event.target.closest('.chat-reply-btn');
      if (!replyButton) return;

      const messageId = replyButton.dataset.messageId;
      const message = chatMessagesById[messageId] || allChatMessages.find(msg => msg.id === messageId);
      if (message) {
        setReplyTarget(message);
      }
    });
  }

  await loadChatRoomInfo(selectedChatId);
}

init().catch((error) => {
  console.error('Chat page initialization failed:', error);
  showError('Unable to initialize chat page. Please try again.');
});
