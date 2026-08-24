import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc, setDoc, deleteField, arrayUnion, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./firebase.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStoredUserEmail, signOutUser, getPasswordChangeRequired, getAccountPasswordHint, updateAccountPassword } from "./auth.js";
import { initializeNotifications, sendNotificationToUsers, showLocalNotification } from "./notifications.js";

window.signOutUser = signOutUser;

let userEmail = null;
let meetingsUnsubscribe = null;
let chatRoomsUnsubscribe = null;
let chatMessagesUnsubscribe = null;
let archivedPollsCollapsed = localStorage.getItem('archivedPollsCollapsed') !== 'false';
let archivedAnnouncementsCollapsed = localStorage.getItem('archivedAnnouncementsCollapsed') !== 'false';
let selectedChatId = null;
let chatRoomsById = {};
let chatMessagesById = {};
let replyToMessage = null;
let selectedChatImageData = null;
let selectedChatImageName = null;
let shownDeadlineTaskIds = new Set();
let shownInAppNotificationIds = new Set();
let dismissedInAppNotificationIds = new Set(getDismissedInAppNotifications());
let inAppNotificationQueue = [];
let inAppNotificationDisplaying = false;
let accessStatusUnsubscribe = null;
let ticketHistoryUnsubscribe = null;
const optimisticTicketHistory = new Map();
let walletUnsubscribe = null;
let walletTransactionsUnsubscribe = null;
let memberGradientUnsubscribe = null;
let surveyGateUnsubscribe = null;
let memberStatusUnsubscribe = null;
let memberRosterUnsubscribe = null;
let memberStatusDocs = {};
let previousTaskMap = new Map();
let previousPollMap = new Map();
let previousAnnouncementMap = new Map();
let previousTicketMap = new Map();
let taskNotificationsInitialized = false;
let pollNotificationsInitialized = false;
let announcementNotificationsInitialized = false;
let ticketNotificationsInitialized = false;
let memberStatusPollTimer = null;
let presenceHeartbeatTimer = null;
let presenceTrackingInitialized = false;
let presenceState = true;
let presenceLastUpdatedAt = 0;
let presenceAuthToken = null;
let presenceAuthTokenLastRefreshed = 0;
let completedTasksCollapsed = localStorage.getItem('completedTasksCollapsed') !== 'false';
let homeFlashcardTimer = null;
let homeFlashcardItems = [];
let homeFlashcardSetContent = null;
let homeChatMessageListeners = [];
let homeChatRoomNames = {};
let homeFlashcardIndex = 0;
let homeFlashcardListeners = [];
const FIREBASE_PROJECT_ID = "mycollab-89c11";
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const container = document.getElementById("tasks");
const completedTasksSection = document.getElementById("completedTasksSection");
const completedTasksToggleBtn = document.getElementById("completedTasksToggleBtn");
const completedTasksList = document.getElementById("completedTasksList");
const emptyState = document.getElementById("emptyState");
const welcomeEl = document.getElementById("welcome");
const datetimeEl = document.getElementById("datetime");
const pollsContainer = document.getElementById("polls");
const pollsEmptyState = document.getElementById("pollsEmptyState");
const announcementsContainer = document.getElementById("announcements");
const announcementsEmptyState = document.getElementById("announcementsEmptyState");
const members = [
  { uid: "everyone", name: "Everyone" }
];

const mentionUsers = [];

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";
const progressStorageKey = "thesisProgressReportBackup";
const memberGradientStorageKey = 'memberInterfaceGradient';
const defaultMemberGradientTheme = {
  start: '#0f172a',
  end: '#1e293b',
  direction: '135deg',
  sidebar: '#0f172a',
  header: '#0f172a',
  card: '#1e293b',
  accent: '#3b82f6'
};
let currentMemberThemeTextColors = {
  body: '#f8fafc',
  sidebar: '#f8fafc',
  header: '#f8fafc',
  card: '#f8fafc',
  input: '#f8fafc'
};

function getMemberGradientStorageKey(email = userEmail) {
  const normalizedEmail = normalizeEmail(email);
  return `${memberGradientStorageKey}:${normalizedEmail || 'anonymous'}`;
}

function getReadableTextColor(hexColor) {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * red) + (0.587 * green) + (0.114 * blue);
  return luminance > 160 ? '#111827' : '#f8fafc';
}

function applyMemberThemeTextColors(colors = currentMemberThemeTextColors) {
  const targets = [
    ['#datetime', colors.header],
    ['#welcome', colors.header],
    ['#home-greeting', colors.card]
  ];

  targets.forEach(([selector, color]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.style.setProperty('color', color, 'important');
      element.style.setProperty('-webkit-text-fill-color', color, 'important');
    });
  });

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.style.setProperty('color', colors.sidebar, 'important');
  });
}

function applyOriginalMemberTheme() {
  document.body.classList.remove('member-theme');
  ['--member-interface-gradient', '--member-sidebar-color', '--member-header-color', '--member-card-color', '--member-accent-color', '--member-body-text-color', '--member-sidebar-text-color', '--member-header-text-color', '--member-card-text-color', '--member-input-text-color'].forEach((property) => {
    document.body.style.removeProperty(property);
  });

  document.querySelectorAll('#datetime, #welcome, #home-greeting, .nav-btn').forEach((element) => {
    element.style.removeProperty('color');
    element.style.removeProperty('-webkit-text-fill-color');
  });

  currentMemberThemeTextColors = {
    body: '#f8fafc',
    sidebar: '#cbd5e1',
    header: '#cbd5e1',
    card: '#f1f5f9',
    input: '#e2e8f0'
  };

  const startInput = document.getElementById('memberGradientStart');
  const endInput = document.getElementById('memberGradientEnd');
  const directionInput = document.getElementById('memberGradientDirection');
  const sidebarInput = document.getElementById('memberSidebarColor');
  const headerInput = document.getElementById('memberHeaderColor');
  const cardInput = document.getElementById('memberCardColor');
  const accentInput = document.getElementById('memberAccentColor');
  const preview = document.getElementById('memberGradientPreview');
  if (startInput) startInput.value = defaultMemberGradientTheme.start;
  if (endInput) endInput.value = defaultMemberGradientTheme.end;
  if (directionInput) directionInput.value = defaultMemberGradientTheme.direction;
  if (sidebarInput) sidebarInput.value = defaultMemberGradientTheme.sidebar;
  if (headerInput) headerInput.value = defaultMemberGradientTheme.header;
  if (cardInput) cardInput.value = defaultMemberGradientTheme.card;
  if (accentInput) accentInput.value = defaultMemberGradientTheme.accent;
  if (preview) preview.style.background = `linear-gradient(${defaultMemberGradientTheme.direction}, ${defaultMemberGradientTheme.start} 0%, ${defaultMemberGradientTheme.end} 100%)`;
}

function applyMemberGradientTheme(theme = defaultMemberGradientTheme) {
  const start = /^#[0-9a-f]{6}$/i.test(theme.start) ? theme.start : defaultMemberGradientTheme.start;
  const end = /^#[0-9a-f]{6}$/i.test(theme.end) ? theme.end : defaultMemberGradientTheme.end;
  const sidebar = /^#[0-9a-f]{6}$/i.test(theme.sidebar) ? theme.sidebar : defaultMemberGradientTheme.sidebar;
  const header = /^#[0-9a-f]{6}$/i.test(theme.header) ? theme.header : defaultMemberGradientTheme.header;
  const card = /^#[0-9a-f]{6}$/i.test(theme.card) ? theme.card : defaultMemberGradientTheme.card;
  const accent = /^#[0-9a-f]{6}$/i.test(theme.accent) ? theme.accent : defaultMemberGradientTheme.accent;
  const direction = ['45deg', '90deg', '135deg', '180deg'].includes(theme.direction) ? theme.direction : defaultMemberGradientTheme.direction;
  const gradient = `linear-gradient(${direction}, ${start} 0%, ${end} 100%)`;
  document.body.classList.add('member-theme');
  document.body.style.setProperty('--member-interface-gradient', gradient);
  document.body.style.setProperty('--member-sidebar-color', sidebar);
  document.body.style.setProperty('--member-header-color', header);
  document.body.style.setProperty('--member-card-color', card);
  document.body.style.setProperty('--member-accent-color', accent);
  document.body.style.setProperty('--member-body-text-color', getReadableTextColor(end));
  document.body.style.setProperty('--member-sidebar-text-color', getReadableTextColor(sidebar));
  document.body.style.setProperty('--member-header-text-color', getReadableTextColor(header));
  document.body.style.setProperty('--member-card-text-color', getReadableTextColor(card));
  const textColors = {
    body: getReadableTextColor(end),
    sidebar: getReadableTextColor(sidebar),
    header: getReadableTextColor(header),
    card: getReadableTextColor(card),
    input: getReadableTextColor(card)
  };
  currentMemberThemeTextColors = textColors;
  document.body.style.setProperty('--member-body-text-color', textColors.body);
  document.body.style.setProperty('--member-sidebar-text-color', textColors.sidebar);
  document.body.style.setProperty('--member-header-text-color', textColors.header);
  document.body.style.setProperty('--member-card-text-color', textColors.card);
  document.body.style.setProperty('--member-input-text-color', textColors.input);
  applyMemberThemeTextColors(textColors);
  window.applyMemberThemeTextColors = () => applyMemberThemeTextColors();

  const startInput = document.getElementById('memberGradientStart');
  const endInput = document.getElementById('memberGradientEnd');
  const directionInput = document.getElementById('memberGradientDirection');
  const sidebarInput = document.getElementById('memberSidebarColor');
  const headerInput = document.getElementById('memberHeaderColor');
  const cardInput = document.getElementById('memberCardColor');
  const accentInput = document.getElementById('memberAccentColor');
  const preview = document.getElementById('memberGradientPreview');
  if (startInput) startInput.value = start;
  if (endInput) endInput.value = end;
  if (directionInput) directionInput.value = direction;
  if (sidebarInput) sidebarInput.value = sidebar;
  if (headerInput) headerInput.value = header;
  if (cardInput) cardInput.value = card;
  if (accentInput) accentInput.value = accent;
  if (preview) preview.style.background = gradient;
}

function saveMemberGradientTheme() {
  const theme = {
    start: document.getElementById('memberGradientStart')?.value || defaultMemberGradientTheme.start,
    end: document.getElementById('memberGradientEnd')?.value || defaultMemberGradientTheme.end,
    direction: document.getElementById('memberGradientDirection')?.value || defaultMemberGradientTheme.direction,
    sidebar: document.getElementById('memberSidebarColor')?.value || defaultMemberGradientTheme.sidebar,
    header: document.getElementById('memberHeaderColor')?.value || defaultMemberGradientTheme.header,
    card: document.getElementById('memberCardColor')?.value || defaultMemberGradientTheme.card,
    accent: document.getElementById('memberAccentColor')?.value || defaultMemberGradientTheme.accent
  };
  localStorage.setItem(getMemberGradientStorageKey(), JSON.stringify(theme));
  applyMemberGradientTheme(theme);

  if (userEmail) {
    void setDoc(doc(db, 'userRoles', normalizeEmail(userEmail)), {
      interfaceGradient: theme,
      updatedAt: new Date()
    }, { merge: true }).catch((error) => {
      console.warn('Unable to save interface gradient to Firestore:', error);
    });
  }
}

window.resetMemberGradientTheme = async function() {
  localStorage.removeItem(getMemberGradientStorageKey());
  applyOriginalMemberTheme();

  if (userEmail) {
    try {
      await setDoc(doc(db, 'userRoles', normalizeEmail(userEmail)), {
        interfaceGradient: deleteField(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.warn('Unable to reset interface gradient in Firestore:', error);
    }
  }
};

function initializeMemberGradientTheme() {
  let theme = defaultMemberGradientTheme;
  try {
    const stored = JSON.parse(localStorage.getItem(getMemberGradientStorageKey()) || 'null');
    if (stored && typeof stored === 'object') theme = { ...defaultMemberGradientTheme, ...stored };
  } catch (error) {
    console.warn('Unable to read saved interface gradient:', error);
  }

  applyMemberGradientTheme(theme);
  ['memberGradientStart', 'memberGradientEnd', 'memberGradientDirection', 'memberSidebarColor', 'memberHeaderColor', 'memberCardColor', 'memberAccentColor'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', saveMemberGradientTheme);
    document.getElementById(id)?.addEventListener('change', saveMemberGradientTheme);
  });
}

initializeMemberGradientTheme();

async function loadMemberGradientTheme(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  let theme = null;
  try {
    const cached = JSON.parse(localStorage.getItem(getMemberGradientStorageKey(normalizedEmail)) || 'null');
    if (cached && typeof cached === 'object') theme = { ...defaultMemberGradientTheme, ...cached };
  } catch (error) {
    console.warn('Unable to read cached member gradient:', error);
  }

  if (theme) {
    applyMemberGradientTheme(theme);
  } else {
    applyOriginalMemberTheme();
  }

  if (memberGradientUnsubscribe) memberGradientUnsubscribe();
  memberGradientUnsubscribe = onSnapshot(doc(db, 'userRoles', normalizedEmail), (profileSnap) => {
    void displayMemberProfilePicture(normalizedEmail);
    const savedTheme = profileSnap.exists() ? profileSnap.data()?.interfaceGradient : null;
    if (!savedTheme || typeof savedTheme !== 'object') {
      applyOriginalMemberTheme();
      return;
    }

    const syncedTheme = { ...defaultMemberGradientTheme, ...savedTheme };
    localStorage.setItem(getMemberGradientStorageKey(normalizedEmail), JSON.stringify(syncedTheme));
    applyMemberGradientTheme(syncedTheme);
  }, (error) => {
    console.warn('Unable to sync member gradient from Firestore:', error);
  });
}

function getProgressBackupSections() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const cached = window.localStorage.getItem(progressStorageKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed?.sections)) return parsed.sections;
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    console.warn("Unable to read cached progress report:", error);
  }
  return null;
}

function saveProgressBackupSections(sections) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(progressStorageKey, JSON.stringify({ sections, updatedAt: new Date().toISOString() }));
    }
  } catch (error) {
    console.warn("Unable to cache progress report locally:", error);
  }
}

async function persistProgressReportSections(sections) {
  try {
    const progressRef = doc(db, progressReportCollection, progressReportDocId);
    await setDoc(progressRef, { sections, updatedAt: new Date().toISOString() }, { merge: true });
    saveProgressBackupSections(sections);
    return true;
  } catch (error) {
    console.warn("Unable to save progress report to Firestore:", error);
    saveProgressBackupSections(sections);
    return false;
  }
}

function normalizeProgressSections(sections, defaultSections = getDefaultProgressStructure()) {
  if (!Array.isArray(sections)) return null;

  const defaultTitles = defaultSections.map(section => section.title);
  const extraSections = sections.filter(section => section && typeof section === 'object' && !defaultTitles.includes(section.title));

  const normalizedDefault = defaultSections.map((defaultSection, sectionIndex) => {
    const savedSection = sections.find(section => section.title === defaultSection.title) || sections[sectionIndex] || {};
    const items = Array.isArray(savedSection.items) ? savedSection.items : [];

    return {
      title: defaultSection.title,
      items: defaultSection.items.map((defaultItem, itemIndex) => {
        const savedItem = items.find(item => item.name === defaultItem.name) || items[itemIndex] || {};
        return {
          name: defaultItem.name,
          status: savedItem.status || defaultItem.status || "Not Started",
          assignedTo: Array.isArray(savedItem.assignedTo) ? savedItem.assignedTo : (savedItem.assignedTo ? [savedItem.assignedTo] : []),
          assignedToName: Array.isArray(savedItem.assignedToName) ? savedItem.assignedToName : (savedItem.assignedToName ? [savedItem.assignedToName] : [])
        };
      })
    };
  });

  return [...normalizedDefault, ...extraSections];
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function ticketMatchesMember(ticket, currentEmail) {
  const memberEmail = normalizeEmail(currentEmail);
  const ownerValues = [ticket.submittedBy, ticket.submittedByEmail, ticket.assignedTo]
    .flatMap(value => Array.isArray(value) ? value : [value]);
  return ownerValues.some(value => normalizeEmail(value) === memberEmail);
}

async function compressImage(file, maxWidth = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to create canvas context for image compression.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Unable to load the selected image.'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

async function saveProfilePictureForEmail(email, imageBase64) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  try {
    if (imageBase64.length > 900000) {
      throw new Error('The profile picture is too large to save. Please choose a smaller image.');
    }

    try {
      localStorage.setItem(`profilePicture:${normalizedEmail}`, imageBase64);
    } catch (cacheError) {
      console.warn('Unable to cache member profile picture locally:', cacheError);
    }

    await setDoc(doc(db, 'userRoles', normalizedEmail), {
      profilePicture: imageBase64,
      profilePictureUpdatedAt: new Date().toISOString()
    }, { merge: true });

    const savedProfile = await getDoc(doc(db, 'userRoles', normalizedEmail));
    if (!savedProfile.exists() || savedProfile.data()?.profilePicture !== imageBase64) {
      throw new Error('The profile picture could not be verified after saving.');
    }
    return true;
  } catch (error) {
    console.error('Error saving profile picture to Firestore:', error);
    return false;
  }
}

async function loadProfilePictureForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const snap = await getDoc(doc(db, 'userRoles', normalizedEmail));
    if (snap.exists()) {
      const profilePicture = snap.data()?.profilePicture || null;
      if (profilePicture) {
        try {
          localStorage.setItem(`profilePicture:${normalizedEmail}`, profilePicture);
        } catch (cacheError) {
          console.warn('Unable to cache member profile picture locally:', cacheError);
        }
        return profilePicture;
      }
    }
  } catch (error) {
    console.warn('Error loading profile picture for member:', error);
  }

  try {
    return localStorage.getItem(`profilePicture:${normalizedEmail}`) || null;
  } catch (cacheError) {
    console.warn('Unable to read cached member profile picture:', cacheError);
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

async function displayMemberProfilePicture(email) {
  const profilePictureDiv = document.getElementById('memberHeaderProfilePicture');
  if (!profilePictureDiv) return;

  const normalizedEmail = normalizeEmail(email);
  const profilePicture = normalizedEmail ? await loadProfilePictureForEmail(normalizedEmail).catch(() => null) : null;

  if (profilePicture) {
    profilePictureDiv.innerHTML = `<img src="${profilePicture}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Profile picture" />`;
    return;
  }

  profilePictureDiv.innerHTML = `<span style="color: #e5e7eb; font-size: 0.9rem; font-weight: 700;">${escapeHtml(getInitialsFromEmail(normalizedEmail || 'Member'))}</span>`;
}

window.handleMemberProfileUpload = async function(event) {
  const file = event?.target?.files?.[0];
  if (!file || !userEmail) {
    return;
  }

  try {
    const compressed = await compressImage(file, 256, 0.55);
    const saved = await saveProfilePictureForEmail(userEmail, compressed);

    if (saved) {
      await displayMemberProfilePicture(userEmail);
      await hydrateProfileAvatars();
      alert('Profile picture updated successfully!');
    } else {
      alert('Profile picture could not be saved. Please try again.');
    }
  } catch (error) {
    console.error('Failed to upload profile picture:', error);
    alert('Failed to upload profile picture. Please try again.');
  } finally {
    if (event?.target) {
      event.target.value = '';
    }
  }
};

function matchesAnnouncementTarget(assignedTo, assignedToNames = [], currentEmail, currentName = '') {
  const values = [
    ...(Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : [])),
    ...(Array.isArray(assignedToNames) ? assignedToNames : (assignedToNames ? [assignedToNames] : []))
  ];

  if (values.length === 0) {
    return true;
  }

  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const normalizedCurrentName = normalizeEmail(currentName);

  return values.some((value) => {
    const normalizedValue = normalizeEmail(value);
    return !normalizedValue
      || normalizedValue === 'everyone'
      || normalizedValue === 'all'
      || normalizedValue === normalizedCurrentEmail
      || normalizedValue === normalizedCurrentName;
  });
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

    if (userEmail) {
      ensureMemberEntry(userEmail, userEmail);
    }

    syncMentionUsers();
  } catch (error) {
    console.warn('Unable to refresh member list:', error);
  }
}

function formatDisplayNameFromEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'Member';
  const localPart = normalized.split('@')[0] || 'Member';
  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getUserName(email) {
  const normalized = normalizeEmail(email);
  const member = members.find(m => normalizeEmail(m.uid) === normalized);
  if (member) return member.name;

  const created = ensureMemberEntry(email, email);
  const fallbackName = created ? created.name : formatDisplayNameFromEmail(email);
  return fallbackName && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fallbackName) ? formatDisplayNameFromEmail(fallbackName) : fallbackName;
}

function getFriendlyName(value) {
  const text = String(value || '').trim();
  if (!text) return 'Unknown';
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? formatDisplayNameFromEmail(text) : text;
}

async function getWelcomeName(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'Member';

  try {
    const storedUserRaw = localStorage.getItem('authUser');
    if (storedUserRaw) {
      const storedUser = JSON.parse(storedUserRaw);
      const storedName = typeof storedUser?.displayName === 'string' && storedUser.displayName.trim()
        ? storedUser.displayName.trim()
        : (typeof storedUser?.name === 'string' && storedUser.name.trim() ? storedUser.name.trim() : '');
      if (storedName && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(storedName)) {
        return storedName;
      }
    }
  } catch (error) {
    console.warn('Unable to read stored display name for welcome text:', error);
  }

  const member = members.find(m => normalizeEmail(m.uid) === normalized);
  if (member?.name && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(member.name)) {
    return member.name;
  }

  try {
    const roleSnap = await getDoc(doc(db, 'userRoles', normalized));
    if (roleSnap.exists()) {
      const data = roleSnap.data() || {};
      const displayName = typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
        : (typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '');
      if (displayName && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(displayName)) {
        return displayName;
      }
    }
  } catch (error) {
    console.warn('Unable to read display name for welcome text:', error);
  }

  const fallbackName = member?.name || getUserName(email);
  if (fallbackName && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fallbackName)) {
    return fallbackName;
  }

  const emailName = formatDisplayNameFromEmail(email);
  return emailName && emailName !== 'Member' ? emailName : 'User';
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return null;
}

function getAnnouncementValidityMs() {
  return Number.MAX_SAFE_INTEGER;
}

function getHomeGreeting(name) {
  const safeName = String(name || 'Member').trim() || 'Member';
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12
    ? 'Good morning'
    : hour >= 12 && hour < 18
      ? 'Good afternoon'
      : 'Good evening';
  return `${greeting}, ${safeName}!`;
}

function getAnnouncementValidityState(announcement) {
  if (!announcement || !announcement.title) {
    return { valid: false, reason: 'missing-title' };
  }

  const createdAtValue = announcement.createdAt || announcement.date || announcement.timestamp || announcement.postedAt;
  if (!createdAtValue) {
    return { valid: true, reason: 'missing-date-assume-fresh', ageMs: 0, createdAt: new Date().toISOString() };
  }

  const createdAt = parseDateValue(createdAtValue);
  if (!createdAt) {
    return { valid: true, reason: 'invalid-date-assume-fresh', ageMs: 0, createdAt: new Date().toISOString() };
  }

  const ageMs = Date.now() - createdAt.getTime();
  return {
    valid: ageMs <= getAnnouncementValidityMs(),
    ageMs,
    createdAt: createdAt.toISOString()
  };
}

function renderHomeFlashcard(items = []) {
  const flashcard = document.getElementById('home-flashcard');
  if (!flashcard) return;

  homeFlashcardItems = items;

  if (homeFlashcardTimer) {
    clearInterval(homeFlashcardTimer);
    homeFlashcardTimer = null;
  }

  flashcard.innerHTML = '';

  const flashHeader = document.createElement('div');
  flashHeader.className = 'flash-header';
  flashcard.appendChild(flashHeader);

  const flashText = document.createElement('div');
  flashText.className = 'flash-text visible';
  flashcard.appendChild(flashText);

  const setFlashContent = (item) => {
    if (!item) {
      flashHeader.textContent = 'Overview';
      flashText.textContent = 'No new updates for today.';
      return;
    }

    flashHeader.textContent = item.title;

    const values = Array.isArray(item.detail) ? item.detail : [item.detail];
    const cleaned = values.filter((entry) => {
      if (entry && typeof entry === 'object') {
        return String(entry.progressName || entry.memberName || entry.resourceTitle || entry.roomName || entry.title || entry.ticketTitle || '').trim() !== '';
      }
      return entry !== null && entry !== undefined && String(entry).trim() !== '';
    });

    if (!cleaned.length) {
      flashText.textContent = 'No new updates for today.';
      return;
    }

    if (item.title === 'Member Status') {
      flashText.innerHTML = cleaned.map((entry) => {
        const member = typeof entry === 'object'
          ? entry
          : { memberName: entry, status: 'OFFLINE', lastSeen: 'Unknown' };
        return `
          <div class="flash-item flash-member-status">
            ${member.memberUid ? renderUserAvatarMarkup(member.memberUid, 32) : ''}
            <div class="flash-member-status-details">
              <div><strong>Member:</strong> ${escapeHtml(member.memberName || 'Unknown')}</div>
              <div><strong>Status:</strong> ${escapeHtml(member.status || 'OFFLINE')}</div>
              <div><strong>Last seen:</strong> ${escapeHtml(member.lastSeen || 'Unknown')}</div>
            </div>
          </div>
        `;
      }).join('');
      void hydrateProfileAvatars();
      return;
    }

    if (item.title === 'Resources') {
      flashText.innerHTML = cleaned.map((entry) => {
        const resource = typeof entry === 'object'
          ? entry
          : { resourceTitle: entry, description: 'No description provided.', link: '' };
        return `
          <div class="flash-item flash-resource">
            <div><strong>Resource:</strong> ${escapeHtml(resource.resourceTitle || 'Untitled resource')}</div>
            <div><strong>Description:</strong> ${escapeHtml(resource.description || 'No description provided.')}</div>
            ${resource.link ? `<div><strong>Link:</strong> ${escapeHtml(resource.link)}</div>` : ''}
          </div>
        `;
      }).join('');
      return;
    }

    if (item.title === 'Chat') {
      flashText.innerHTML = cleaned.map((entry) => {
        const chat = typeof entry === 'object'
          ? entry
          : { roomName: 'Live chat', senderName: 'Member', messageText: entry };
        return `
          <div class="flash-item flash-chat">
            <div><strong>Room:</strong> ${escapeHtml(chat.roomName || 'Live chat')}</div>
            <div><strong>From:</strong> ${escapeHtml(getFriendlyName(chat.senderName || 'Member'))}</div>
            <div><strong>Message:</strong> ${escapeHtml(chat.messageText || '[Image]')}</div>
          </div>
        `;
      }).join('');
      return;
    }

    if (item.title === 'Announcements') {
      flashText.innerHTML = cleaned.map((entry) => {
        const announcement = typeof entry === 'object'
          ? entry
          : { title: 'Announcement', body: entry };
        return `
          <div class="flash-item flash-announcement">
            <div class="flash-announcement-title">${escapeHtml(announcement.title || 'Announcement')}</div>
            <div class="flash-announcement-body">${escapeHtml(announcement.body || announcement.content || announcement.description || 'No details provided.')}</div>
          </div>
        `;
      }).join('');
      return;
    }

    if (item.title === 'Tickets') {
      flashText.innerHTML = cleaned.map((entry) => {
        const ticket = typeof entry === 'object'
          ? entry
          : { title: entry, status: 'open' };
        const status = String(ticket.status || 'open');
        const statusLabel = status === 'pending validation'
          ? 'Pending Validation'
          : status.charAt(0).toUpperCase() + status.slice(1);
        return `
          <div class="flash-item flash-ticket">
            <div><strong>Ticket:</strong> ${escapeHtml(ticket.title || ticket.ticketTitle || 'Support request')}</div>
            <div><strong>Status:</strong> ${escapeHtml(statusLabel)}</div>
          </div>
        `;
      }).join('');
      return;
    }

    if (cleaned.length === 1 && typeof cleaned[0] === 'object') {
      const entry = cleaned[0];
      if (entry.type === 'memberStatus') {
        flashText.innerHTML = `
          <div class="flash-item">
            <div><strong>Member:</strong> ${escapeHtml(entry.memberName)}</div>
            <div><strong>Status:</strong> ${escapeHtml(entry.status)}</div>
            <div><strong>Last seen:</strong> ${escapeHtml(entry.lastSeen)}</div>
          </div>
        `;
        return;
      }

      flashText.innerHTML = `
        <div class="flash-item">
          <div><strong>Progress:</strong> ${escapeHtml(entry.progressName)}</div>
          <div><strong>Assigned:</strong> ${escapeHtml(entry.assigned)}</div>
          <div><strong>Status:</strong> ${escapeHtml(entry.status)}</div>
        </div>
      `;
      return;
    }

    if (cleaned.length === 1) {
      flashText.innerHTML = `<div class="flash-item">${escapeHtml(String(cleaned[0]).trim())}</div>`;
      return;
    }

    flashText.innerHTML = cleaned
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          if (entry.type === 'memberStatus') {
            return `
              <div class="flash-item">
                <div><strong>Member:</strong> ${escapeHtml(entry.memberName)}</div>
                <div><strong>Status:</strong> ${escapeHtml(entry.status)}</div>
                <div><strong>Last seen:</strong> ${escapeHtml(entry.lastSeen)}</div>
              </div>
            `;
          }

          return `
            <div class="flash-item">
              <div><strong>Progress:</strong> ${escapeHtml(entry.progressName)}</div>
              <div><strong>Assigned:</strong> ${escapeHtml(entry.assigned)}</div>
              <div><strong>Status:</strong> ${escapeHtml(entry.status)}</div>
            </div>
          `;
        }
        return `<div class="flash-item">• ${escapeHtml(String(entry).trim())}</div>`;
      })
      .join('');
  };

  homeFlashcardSetContent = setFlashContent;

  if (!items.length) {
    setFlashContent(null);
    return;
  }

  homeFlashcardIndex = 0;
  setFlashContent(items[0]);

  homeFlashcardTimer = setInterval(() => {
    homeFlashcardIndex = (homeFlashcardIndex + 1) % items.length;
    flashText.classList.remove('visible');
    void flashText.offsetWidth;
    setFlashContent(items[homeFlashcardIndex]);
    flashText.classList.add('visible');
  }, 4200);
}


function isTaskDeadlineUrgent(task = {}) {
  const status = String(task.status || '').trim().toLowerCase();
  if (!status || status === 'done' || status === 'completed' || status === 'pending validation') {
    return false;
  }

  const deadline = task.deadline || task.dueDate;
  if (!deadline) return false;

  const date = parseDateValue(deadline);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
}

function getHomeFlashcardKey(sectionKey, item) {
  const documentId = item?.id ?? item?.docId ?? item?.documentId ?? item?.uid;
  const timestampValue = item?.createdAt ?? item?.updatedAt ?? item?.date ?? item?.postedAt ?? item?.deadline ?? item?.startDate ?? item?.endDate ?? item?.time ?? item?.meetingDate ?? item?.meetingTime;
  const timestampMs = parseDateValue(timestampValue)
    ? parseDateValue(timestampValue).getTime()
    : (typeof timestampValue === 'number' ? timestampValue : null);

  const baseKey = documentId
    ?? item?.title
    ?? item?.question
    ?? item?.name
    ?? item?.roomName
    ?? item?.content
    ?? item?.description
    ?? JSON.stringify(item || {});

  const timestampText = Number.isFinite(timestampMs) ? String(timestampMs) : 'no-timestamp';
  return `${sectionKey}:${String(baseKey)}:${timestampText}`;
}

function isSectionItemClosed(sectionKey, item) {
  const statusValue = item?.status || item?.state || item?.currentStatus;
  const normalized = String(statusValue || '').trim().toLowerCase();
  const closedStatuses = ['closed', 'resolved', 'completed', 'done', 'cancelled', 'archived'];

  if (item?.isClosed === true || item?.closed === true) {
    return true;
  }

  if (sectionKey === 'polls' && normalized === 'closed') {
    return true;
  }

  if (sectionKey === 'tickets' && closedStatuses.includes(normalized)) {
    return true;
  }

  return false;
}

function isHomeFlashcardItemFresh(sectionKey, item) {
  if (sectionKey === 'polls' || sectionKey === 'tickets') {
    return !isSectionItemClosed(sectionKey, item);
  }

  if (sectionKey === 'tasks' && isTaskDeadlineUrgent(item)) {
    return true;
  }

  return true;
}

function shouldShowHomeFlashcardItem(sectionKey, item) {
  if (sectionKey === 'polls' || sectionKey === 'tickets') {
    return !isSectionItemClosed(sectionKey, item);
  }

  return isHomeFlashcardItemFresh(sectionKey, item);
}

function markHomeFlashcardItemShown(sectionKey, item) {
  return;
}

function getChatRoomDisplayName(room = {}, roomId = '') {
  const roomName = room.title || room.name || room.roomName || room.chatName || room.chatTitle || room.subject;
  return String(roomName || '').trim() || (roomId ? `Livechat ${roomId.slice(0, 8)}` : 'Live chat');
}

function getMemberStatusFlashcardItems() {
  const adminEmail = 'johnpaulbugayong@gmail.com';
  const adminEntry = { uid: adminEmail, name: 'Admin' };
  const seenStatusMembers = new Set();

  return [...members, adminEntry].reduce((statusItems, member) => {
    if (!member || !member.uid || member.uid === 'everyone') return statusItems;
    const normalizedId = normalizeEmail(member.uid);
    if (!normalizedId || seenStatusMembers.has(normalizedId)) return statusItems;
    seenStatusMembers.add(normalizedId);

    const statusData = memberStatusDocs[normalizedId] || {};
    statusItems.push({
      memberUid: member.uid,
      memberName: normalizedId === normalizeEmail(adminEmail) ? 'Admin' : (member.name || member.uid),
      status: isMemberCurrentlyActive(statusData) ? 'ACTIVE' : 'OFFLINE',
      lastSeen: statusData.lastActive ? getTimeAgo(statusData.lastActive) : 'Unknown'
    });
    return statusItems;
  }, []);
}

function refreshMemberStatusFlashcard() {
  const statusItem = homeFlashcardItems.find((item) => item.title === 'Member Status');
  if (!statusItem) return;

  statusItem.detail = getMemberStatusFlashcardItems();
  if (homeFlashcardItems[homeFlashcardIndex] === statusItem && homeFlashcardSetContent) {
    homeFlashcardSetContent(statusItem);
  }
}

function updateChatUnreadFlashcard(unreadMessages = []) {
  const chatItem = homeFlashcardItems.find((item) => item.title === 'Chat');
  if (!chatItem) return;

  chatItem.detail = unreadMessages.length
    ? unreadMessages.slice(0, 4)
    : ['No unread messages.'];

  if (homeFlashcardItems[homeFlashcardIndex] === chatItem && homeFlashcardSetContent) {
    homeFlashcardSetContent(chatItem);
  }
}

function getUnreadChatMessages(roomId, messages) {
  const lastReadKey = `chatLastRead:${userEmail}:${roomId}`;
  const lastRead = Number(localStorage.getItem(lastReadKey) || 0);
  return messages
    .filter((message) => {
      const parsedCreatedAt = parseDateValue(message.createdAt);
      const createdAt = parsedCreatedAt ? parsedCreatedAt.getTime() : Number(message.createdAt || 0);
      const sender = normalizeEmail(message.senderEmail);
      return !message.deleted && sender !== normalizeEmail(userEmail) && createdAt > lastRead;
    })
    .map((message) => ({
      type: 'chat',
      roomName: homeChatRoomNames[roomId] || getChatRoomDisplayName({}, roomId),
      senderName: normalizeEmail(message.senderEmail) === 'johnpaulbugayong@gmail.com'
        ? 'Admin'
        : getFriendlyName(message.senderName || getUserName(message.senderEmail) || 'Member'),
      messageText: message.text || (message.imageData ? '[Image]' : '[Message]')
    }));
}

function stopHomeChatMessageListeners() {
  homeChatMessageListeners.forEach((unsubscribe) => {
    if (typeof unsubscribe === 'function') unsubscribe();
  });
  homeChatMessageListeners = [];
}

function subscribeHomeChatMessageListeners(rooms = []) {
  stopHomeChatMessageListeners();
  homeChatRoomNames = {};
  const unreadByRoom = {};

  rooms.forEach((room) => {
    if (!room?.id) return;
    homeChatRoomNames[room.id] = getChatRoomDisplayName(room, room.id);
    const messagesRef = collection(db, 'liveChats', room.id, 'messages');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const messages = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      unreadByRoom[room.id] = getUnreadChatMessages(room.id, messages);
      updateChatUnreadFlashcard(Object.values(unreadByRoom).flat());
    }, (error) => console.warn('Home flashcard chat message listener error:', error));
    homeChatMessageListeners.push(unsubscribe);
  });
}

function getLatestHomeDashboardItems(taskItems, announcementItems, pollItems, ticketItems, resourceItems, progressItems, chatItems, meetingItems, memberStatusItems) {
  const formatList = (items, mapper, emptyMessage) => {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const mapped = safeItems.slice(0, 4).map(mapper).filter((value) => value && String(value).trim());
    return mapped.length ? mapped : [emptyMessage];
  };

  const items = [
    {
      title: 'My Tasks',
      detail: formatList(taskItems, (task) => `${task.title || task.name || 'Untitled task'}`, 'No pending tasks for today.')
    },
    {
      title: 'Announcements',
      detail: formatList(announcementItems, (item) => {
        return {
          type: 'announcement',
          title: item.title || 'Announcement',
          body: item.content || item.description || 'No details provided.'
        };
      }, 'No new announcements.')
    },
    {
      title: 'Polls',
      detail: formatList(pollItems, (poll) => poll.question || poll.title || 'Open poll', 'No open polls right now.')
    },
    {
      title: 'Tickets',
      detail: formatList(ticketItems, (ticket) => ({
        type: 'ticket',
        title: ticket.title || ticket.name || 'Support request',
        status: ticket.status || 'open'
      }), 'No active tickets awaiting review.')
    },
    {
      title: 'Resources',
      detail: formatList(resourceItems, (resource) => ({
        type: 'resource',
        resourceTitle: resource.title || resource.name || 'Untitled resource',
        description: resource.description || 'No description provided.',
        link: resource.link || ''
      }), 'No new resources available.')
    },
    {
      title: 'Progress',
      detail: formatList(progressItems, (progressItem) => {
        const progressName = progressItem.name || progressItem.title || 'Untitled progress report';
        const assignedNames = Array.isArray(progressItem.assignedToName)
          ? progressItem.assignedToName.filter(Boolean)
          : (progressItem.assignedToName ? [progressItem.assignedToName] : []);
        const assignedValues = Array.isArray(progressItem.assignedTo)
          ? progressItem.assignedTo.filter(Boolean)
          : (progressItem.assignedTo ? [progressItem.assignedTo] : []);
        const assigned = assignedNames.length
          ? assignedNames.join(', ')
          : (assignedValues.length ? assignedValues.join(', ') : 'None');
        const status = progressItem.status || progressItem.state || progressItem.currentStatus || 'Not Started';

        return {
          type: 'progress',
          progressName,
          assigned,
          status
        };
      }, 'No active progress updates.')
    },
    {
      title: 'Chat',
      detail: formatList(chatItems, (chatItem) => ({
        type: 'chat',
        roomName: getChatRoomDisplayName(chatItem, chatItem.id),
        senderName: chatItem.senderName || 'Member',
        messageText: chatItem.messageText || '[Image]'
      }), 'No unread messages.')
    },
    {
      title: 'Video Conference',
      detail: formatList(meetingItems, (meeting) => {
        const meetingDate = meeting.date;
        const meetingTime = meeting.time;
        const meetingDateTime = meetingDate && meetingTime ? new Date(`${meetingDate}T${meetingTime}`) : null;
        const now = new Date();
        const isOngoing = meetingDateTime && !isNaN(meetingDateTime.getTime())
          && meetingDateTime.toDateString() === now.toDateString()
          && now.getTime() >= meetingDateTime.getTime()
          && now.getTime() <= meetingDateTime.getTime() + (2 * 60 * 60 * 1000);
        const isUpcoming = meetingDateTime && !isNaN(meetingDateTime.getTime()) && meetingDateTime.getTime() > now.getTime();

        if (isOngoing) {
          return `Ongoing: ${meeting.title || 'Team meeting'} is in progress now.`;
        }

        if (isUpcoming) {
          return `Upcoming: ${meeting.title || 'Team meeting'} is scheduled for ${meetingDateTime.toLocaleDateString()} at ${meetingDateTime.toLocaleTimeString()}.`;
        }

        return `${meeting.title || 'Team meeting'} is planned for ${meetingDateTime ? meetingDateTime.toLocaleDateString() + ' at ' + meetingDateTime.toLocaleTimeString() : 'a future time'}.`;
      }, 'No upcoming video conference for now.')
    },
    {
      title: 'Member Status',
      detail: formatList(memberStatusItems, (memberStatus) => ({
        type: 'memberStatus',
        memberUid: memberStatus.memberUid,
        memberName: memberStatus.memberName,
        status: memberStatus.status,
        lastSeen: memberStatus.lastSeen
      }), 'No member status data available.')
    }
  ];

  return items;
}

async function refreshHomeDashboard() {
  const homeGreeting = document.getElementById('home-greeting');
  const currentName = userEmail ? await getWelcomeName(userEmail) : 'User';
  if (homeGreeting) {
    homeGreeting.textContent = getHomeGreeting(currentName);
  }

  const taskRefs = [];
  const announcementRefs = [];
  const pollRefs = [];
  const ticketRefs = [];
  const resourceRefs = [];
  const progressRefs = [];
  const chatRefs = [];
  const meetingRefs = [];
  const memberStatusRefs = [];

  const eligibleTaskRefs = [];
  const eligibleAnnouncementRefs = [];
  const eligiblePollRefs = [];
  const eligibleTicketRefs = [];
  const eligibleResourceRefs = [];
  const eligibleProgressRefs = [];
  const eligibleChatRefs = [];
  const eligibleMeetingRefs = [];

  try {
    const taskSnap = await getDocs(query(collection(db, 'tasks'), where('assignedTo', 'in', [userEmail, 'everyone'])));
    taskSnap.forEach(docSnap => {
      const task = { id: docSnap.id, ...docSnap.data() };
      const status = String(task.status || '').trim().toLowerCase();
      if (status !== 'done' && status !== 'completed') {
        taskRefs.push(task);
      }
    });
  } catch (error) {
    console.warn('Unable to load tasks for home dashboard:', error);
  }

  try {
    const announcementSnap = await getDocs(collection(db, 'announcements'));
    const memberName = (await getWelcomeName(userEmail)) || '';

    for (const docSnap of announcementSnap.docs) {
      const announcement = { id: docSnap.id, ...docSnap.data() };
      if (announcement.archived === true) continue;

      const assignedTo = Array.isArray(announcement.assignedTo)
        ? announcement.assignedTo
        : (announcement.assignedTo ? [announcement.assignedTo] : ['everyone']);
      const assignedToNames = Array.isArray(announcement.assignedToNames)
        ? announcement.assignedToNames
        : (announcement.assignedToNames ? [announcement.assignedToNames] : []);

      if (!matchesAnnouncementTarget(assignedTo, assignedToNames, userEmail, memberName)) {
        continue;
      }

      const validity = getAnnouncementValidityState(announcement);
      if (validity.valid && announcement.title) {
        announcementRefs.push(announcement);
      }
    }
  } catch (error) {
    console.warn('Unable to load announcements for home dashboard:', error);
  }

  try {
    const pollsSnap = await getDocs(collection(db, 'polls'));
    pollsSnap.forEach(docSnap => {
      const poll = { id: docSnap.id, ...docSnap.data() };
      const status = String(poll.status || '').trim().toLowerCase();
      if (poll.question && status !== 'closed' && status !== 'resolved' && status !== 'completed' && status !== 'done') {
        pollRefs.push(poll);
      }
    });
  } catch (error) {
    console.warn('Unable to load polls for home dashboard:', error);
  }

  try {
    const ticketQuery = query(collection(db, 'tickets'), where('assignedTo', '==', userEmail));
    const ticketsSnap = await getDocs(ticketQuery);
    ticketsSnap.forEach((docSnap) => {
      const ticket = { id: docSnap.id, ...docSnap.data() };
      const status = String(ticket.status || 'open').trim().toLowerCase();
      if (status !== 'closed' && status !== 'resolved' && status !== 'completed' && status !== 'done') {
        ticketRefs.push(ticket);
      }
    });
  } catch (error) {
    console.warn('Unable to load tickets for home dashboard:', error);
  }

  try {
    const resourcesSnap = await getDocs(collection(db, 'resources'));
    resourcesSnap.forEach(docSnap => {
      const resource = { id: docSnap.id, ...docSnap.data() };
      if (resource.title || resource.name) {
        resourceRefs.push(resource);
      }
    });
  } catch (error) {
    console.warn('Unable to load resources for home dashboard:', error);
  }

  try {
    const progressDoc = await getDoc(doc(db, 'progressReports', 'thesisProgress'));
    if (progressDoc.exists()) {
      const sections = Array.isArray(progressDoc.data()?.sections) ? progressDoc.data().sections : [];
      sections.forEach((section) => {
        const items = Array.isArray(section?.items) ? section.items : [];
        items.forEach((item, index) => {
          if (!item || typeof item !== 'object') return;
          const itemStatus = String(item.status || '').trim().toLowerCase();
          if (itemStatus === 'completed' || itemStatus === 'complete' || itemStatus === 'done') return;

          const assigned = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
          const assignedNames = Array.isArray(item.assignedToName) ? item.assignedToName : [];
          const isForCurrentUser = assigned.some(value => normalizeEmail(value) === normalizeEmail(userEmail))
            || assignedNames.some(value => normalizeEmail(value) === normalizeEmail(userEmail));
          if (!assigned.length || isForCurrentUser || assigned.includes('everyone')) {
            progressRefs.push({ ...item, id: item.id || `${section.title || 'progress'}-${index}` });
          }
        });
      });
    }
  } catch (error) {
    console.warn('Unable to load progress reports for home dashboard:', error);
  }

  try {
    const chatRoomsSnap = await getDocs(collection(db, 'liveChats'));
    for (const docSnap of chatRoomsSnap.docs) {
      const room = { id: docSnap.id, ...docSnap.data() };
      const messagesSnap = await getDocs(collection(db, 'liveChats', docSnap.id, 'messages'));
      const lastReadKey = `chatLastRead:${userEmail}:${docSnap.id}`;
      const lastRead = Number(localStorage.getItem(lastReadKey) || 0);
      const unreadMessages = messagesSnap.docs
        .map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }))
        .filter((message) => {
          const parsedCreatedAt = parseDateValue(message.createdAt);
          const createdAt = parsedCreatedAt ? parsedCreatedAt.getTime() : Number(message.createdAt || 0);
          const sender = normalizeEmail(message.senderEmail);
          return !message.deleted && sender !== normalizeEmail(userEmail) && createdAt > lastRead;
        })
        .slice(0, 4);

      unreadMessages.forEach((message) => {
        chatRefs.push({
          roomName: getChatRoomDisplayName(room, room.id),
          senderName: message.senderName || getUserName(message.senderEmail) || 'Member',
          messageText: message.text || (message.imageData ? '[Image]' : '[Message]')
        });
      });
    }
  } catch (error) {
    console.warn('Unable to load chat rooms for home dashboard:', error);
  }

  try {
    const meetingsSnap = await getDocs(collection(db, 'meetings'));
    meetingsSnap.forEach(docSnap => {
      const meeting = { id: docSnap.id, ...docSnap.data() };
      const status = String(meeting.status || 'Active').trim().toLowerCase();
      const assignedTo = Array.isArray(meeting.assignedTo)
        ? meeting.assignedTo
        : (meeting.assignedTo ? [meeting.assignedTo] : []);
      const isVisibleToMember = assignedTo.length === 0
        || assignedTo.some(value => normalizeEmail(value) === normalizeEmail(userEmail) || normalizeEmail(value) === 'everyone' || normalizeEmail(value) === 'all');

      const meetingDate = meeting.date;
      const meetingTime = meeting.time;
      const parsedMeetingDate = meetingDate && meetingTime ? new Date(`${meetingDate}T${meetingTime}`) : null;
      const now = new Date();
      const isFinished = parsedMeetingDate && !isNaN(parsedMeetingDate.getTime())
        ? now.getTime() > parsedMeetingDate.getTime() + (2 * 60 * 60 * 1000)
        : false;
      const isOngoing = parsedMeetingDate && !isNaN(parsedMeetingDate.getTime())
        ? now.getTime() >= parsedMeetingDate.getTime() && now.getTime() <= parsedMeetingDate.getTime() + (2 * 60 * 60 * 1000)
        : false;
      const isUpcoming = parsedMeetingDate && !isNaN(parsedMeetingDate.getTime())
        ? now.getTime() < parsedMeetingDate.getTime()
        : false;

      if (isVisibleToMember && status !== 'completed' && status !== 'cancelled' && status !== 'finished' && !isFinished && (isUpcoming || isOngoing)) {
        meetingRefs.push(meeting);
      }
    });
  } catch (error) {
    console.warn('Unable to load meetings for home dashboard:', error);
  }

  memberStatusRefs.push(...getMemberStatusFlashcardItems());

  const sectionBuckets = [
    { key: 'tasks', items: taskRefs, eligible: eligibleTaskRefs },
    { key: 'announcements', items: announcementRefs, eligible: eligibleAnnouncementRefs },
    { key: 'polls', items: pollRefs, eligible: eligiblePollRefs },
    { key: 'tickets', items: ticketRefs, eligible: eligibleTicketRefs },
    { key: 'resources', items: resourceRefs, eligible: eligibleResourceRefs },
    { key: 'progress', items: progressRefs, eligible: eligibleProgressRefs },
    { key: 'chat', items: chatRefs, eligible: eligibleChatRefs },
    { key: 'meetings', items: meetingRefs, eligible: eligibleMeetingRefs }
  ];

  sectionBuckets.forEach(({ key, items, eligible }) => {
    items.forEach((item) => {
      if (!item) {
        return;
      }

      if (shouldShowHomeFlashcardItem(key, item)) {
        eligible.push(item);
      }
    });
  });

  const bodyItems = getLatestHomeDashboardItems(
    eligibleTaskRefs,
    eligibleAnnouncementRefs,
    eligiblePollRefs,
    eligibleTicketRefs,
    eligibleResourceRefs,
    eligibleProgressRefs,
    eligibleChatRefs,
    eligibleMeetingRefs,
    memberStatusRefs
  );
  renderHomeFlashcard(bodyItems);
}

function stopHomeFlashcardListeners() {
  stopHomeChatMessageListeners();
  homeFlashcardListeners.forEach((unsubscribe) => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });
  homeFlashcardListeners = [];
}

function subscribeToHomeFlashcardUpdates() {
  stopHomeFlashcardListeners();

  const taskQuery = query(collection(db, 'tasks'), where('assignedTo', 'in', [userEmail, 'everyone']));
  homeFlashcardListeners.push(
    onSnapshot(taskQuery, () => refreshHomeDashboard(), (error) => console.warn('Home flashcard task listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(collection(db, 'announcements'), () => refreshHomeDashboard(), (error) => console.warn('Home flashcard announcement listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(collection(db, 'resources'), () => refreshHomeDashboard(), (error) => console.warn('Home flashcard resource listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(doc(db, 'progressReports', 'thesisProgress'), () => refreshHomeDashboard(), (error) => console.warn('Home flashcard progress listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(collection(db, 'liveChats'), (snapshot) => {
      const rooms = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      subscribeHomeChatMessageListeners(rooms);
      void refreshHomeDashboard();
    }, (error) => console.warn('Home flashcard chat listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(collection(db, 'meetings'), () => refreshHomeDashboard(), (error) => console.warn('Home flashcard meeting listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(collection(db, 'polls'), () => refreshHomeDashboard(), (error) => console.warn('Home flashcard poll listener error:', error))
  );

  homeFlashcardListeners.push(
    onSnapshot(query(collection(db, 'tickets'), where('assignedTo', '==', userEmail)), () => refreshHomeDashboard(), (error) => console.warn('Home flashcard ticket listener error:', error))
  );
}

function loadHomeDashboard() {
  subscribeToHomeFlashcardUpdates();
  refreshHomeDashboard();
}

function formatDateTime(value) {
  const date = parseDateValue(value);
  if (!date) return 'Unknown';
  return date.toLocaleString();
}

function getTimeAgo(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours >= 1) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes >= 1) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return 'just now';
}

function isMemberCurrentlyActive(statusData) {
  if (!statusData || !statusData.lastActive) return false;
  if (statusData.isOnline === false) return false;
  const lastActiveDate = parseDateValue(statusData.lastActive);
  if (!lastActiveDate) return false;
  return (Date.now() - lastActiveDate.getTime()) / 1000 < 120;
}

function renderMemberStatusPanel() {
  const panel = document.getElementById('memberStatusPanel');
  if (!panel) return;

  const adminEmail = 'johnpaulbugayong@gmail.com';
  const adminEntry = { uid: adminEmail, name: 'Admin' };
  const seen = new Set();
  const statusEntries = [...members, adminEntry].filter((member) => {
    if (!member || !member.uid || member.uid === 'everyone') return false;
    const normalizedUid = normalizeEmail(member.uid);
    if (!normalizedUid || seen.has(normalizedUid)) return false;
    seen.add(normalizedUid);
    return true;
  });

  const rows = statusEntries.map((member) => {
    const normalizedId = normalizeEmail(member.uid);
    const statusData = memberStatusDocs[normalizedId] || {};
    const active = isMemberCurrentlyActive(statusData);
    const restricted = statusData.accessAllowed === false;
    const badgeColor = active ? '#10b981' : '#6b7280';
    const badgeText = active ? 'ACTIVE' : 'OFFLINE';
    const lastSeenActiveLabel = statusData.lastActive ? formatDateTime(statusData.lastActive) : 'Unknown';
    const lastSeenLabel = statusData.lastActive ? getTimeAgo(statusData.lastActive) : 'Unknown';
    const statusNote = active ? `Last active ${lastSeenLabel}` : `Last seen active ${lastSeenLabel}`;
    const restrictedNote = restricted ? '<p style="margin: 0.5rem 0 0 0; color: #fca5a5; font-size: 0.9rem; font-weight: 600;">Restricted access</p>' : '';
    const displayName = normalizedId === normalizeEmail(adminEmail) ? 'Admin' : (member.name || member.uid);

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 1rem; border: 1px solid #374151; border-radius: 0.75rem; margin-bottom: 0.75rem; background: rgba(17, 24, 39, 0.88);">
        <div style="display: flex; align-items: center; gap: 0.85rem; min-width: 0; flex: 1;">
          ${renderUserAvatarMarkup(member.uid, 36)}
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.2rem;">
              <span style="font-weight: 700; color: #f8fafc; font-size: 0.96rem;">${displayName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; color: #cbd5e1; font-size: 0.85rem;">
              <span>${statusNote}</span>
              ${restrictedNote ? `<span style="color: #fca5a5; font-weight: 600;">• Restricted</span>` : ''}
            </div>
            <div style="margin-top: 0.2rem; color: #9ca3af; font-size: 0.8rem;">Last seen active: ${lastSeenActiveLabel}</div>
          </div>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
          <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 92px; padding: 0.35rem 0.8rem; border-radius: 999px; background: ${badgeColor}; color: white; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;">${badgeText}</span>
        </div>
      </div>
    `;
  });

  panel.innerHTML = rows.join('') || '<p style="color: #94a3b8; text-align: center;">No member status data available.</p>';
  void hydrateProfileAvatars();
}

function subscribeToMemberRoster() {
  if (memberRosterUnsubscribe) {
    memberRosterUnsubscribe();
    memberRosterUnsubscribe = null;
  }

  memberRosterUnsubscribe = onSnapshot(collection(db, 'userRoles'), (snapshot) => {
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

    if (userEmail) {
      ensureMemberEntry(userEmail, userEmail);
    }

    syncMentionUsers();
    renderMemberStatusPanel();
  }, (error) => {
    console.warn('Unable to subscribe to member roster:', error);
  });
}

function subscribeToMemberStatuses() {
  if (memberStatusUnsubscribe) {
    memberStatusUnsubscribe();
    memberStatusUnsubscribe = null;
  }

  memberStatusUnsubscribe = onSnapshot(collection(db, 'userRoles'), (snapshot) => {
    memberStatusDocs = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data() || {};
      const normalizedId = normalizeEmail(docSnap.id);
      memberStatusDocs[normalizedId] = {
        lastActive: data.lastActive || memberStatusDocs[normalizedId]?.lastActive,
        isOnline: typeof data.isOnline !== 'undefined' ? data.isOnline : memberStatusDocs[normalizedId]?.isOnline,
        accessAllowed: typeof data.accessAllowed === 'boolean' ? data.accessAllowed : memberStatusDocs[normalizedId]?.accessAllowed
      };
    });
    renderMemberStatusPanel();
    refreshMemberStatusFlashcard();
  }, (error) => {
    console.warn('Unable to subscribe to member statuses:', error);
  });
}

async function pollMemberStatuses() {
  try {
    const snap = await getDocs(collection(db, 'userRoles'));
    const newDocs = {};
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const normalizedId = normalizeEmail(docSnap.id);
      newDocs[normalizedId] = {
        lastActive: data.lastActive || memberStatusDocs[normalizedId]?.lastActive,
        isOnline: typeof data.isOnline !== 'undefined' ? data.isOnline : memberStatusDocs[normalizedId]?.isOnline,
        accessAllowed: typeof data.accessAllowed === 'boolean' ? data.accessAllowed : memberStatusDocs[normalizedId]?.accessAllowed
      };
    });
    memberStatusDocs = newDocs;
    if (typeof renderMemberStatusPanel === 'function') renderMemberStatusPanel();
    refreshMemberStatusFlashcard();
  } catch (error) {
    console.warn('Error polling member statuses:', error);
  }
}

function startMemberStatusPolling(intervalMs = 120000) {
  // immediate poll
  void pollMemberStatuses();
  if (memberStatusPollTimer) clearInterval(memberStatusPollTimer);
  memberStatusPollTimer = setInterval(() => {
    void pollMemberStatuses();
  }, intervalMs);
}

function stopMemberStatusPolling() {
  if (memberStatusPollTimer) {
    clearInterval(memberStatusPollTimer);
    memberStatusPollTimer = null;
  }
}

function getDefaultProgressStructure() {
  return [];
}

function getDeadlineWarning(deadlineStr, status) {
  if (status === "done" || status === "pending validation") return { class: "", message: "" };
  
  const deadline = new Date(deadlineStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { class: "warning-overdue", message: "⚠️ Overdue!" };
  } else if (diffDays <= 3) {
    return { class: "warning-near", message: "⚠️ Due soon!" };
  }
  return { class: "", message: "" };
}

function showTaskDeadlineModal(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return;
  }

  const existingModal = document.getElementById('deadlineNotificationModal');
  if (existingModal) {
    existingModal.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'deadlineNotificationModal';
  overlay.className = 'deadline-notification-overlay';

  const modal = document.createElement('div');
  modal.className = 'deadline-notification-modal';

  const title = document.createElement('h2');
  title.className = 'deadline-notification-title';
  title.textContent = warnings.some(w => w.status.includes('Overdue')) ? 'Overdue task alert' : 'Due soon task alert';

  const description = document.createElement('p');
  description.className = 'deadline-notification-description';
  description.textContent = 'The following task(s) need your attention:';

  const list = document.createElement('ul');
  list.className = 'deadline-notification-list';
  warnings.forEach((warning) => {
    const item = document.createElement('li');
    item.className = `deadline-notification-list-item ${warning.status.includes('Overdue') ? 'overdue' : 'due-soon'}`;
    item.innerHTML = `<strong>${warning.title}</strong><br><span>${warning.status}</span><br><span>Deadline: ${warning.deadline || 'Not set'}</span>`;
    list.appendChild(item);
  });

  const button = document.createElement('button');
  button.className = 'deadline-notification-close';
  button.textContent = 'Dismiss';
  button.onclick = () => overlay.remove();

  modal.appendChild(title);
  modal.appendChild(description);
  modal.appendChild(list);
  modal.appendChild(button);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

function getSafePollOptions(poll) {
  return Array.isArray(poll.options) ? poll.options : [];
}

function getDismissedInAppNotifications() {
  // Dismissals are tracked strictly in Firestore via `shownTo` on notifications.
  // Keep dismissed IDs only in-memory for the current session.
  return [];
}

function persistDismissedInAppNotifications() {
  // No-op: do not persist dismissals to local storage. Use Firestore `shownTo` instead.
}

function displayNotificationBanner({ title, message, type = 'info', duration = 9000 }) {
  const bannerContainer = document.getElementById('notificationBanner');
  if (!bannerContainer) return;

  const notificationId = `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item = document.createElement('div');
  item.className = 'notification-item';
  item.id = notificationId;
  item.style.position = 'relative';

  const titleEl = document.createElement('strong');
  titleEl.textContent = title || 'Notification';

  const messageEl = document.createElement('div');
  messageEl.style.marginBottom = '0.5rem';
  messageEl.style.whiteSpace = 'pre-wrap';
  messageEl.style.wordBreak = 'break-word';
  messageEl.textContent = message || '';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => item.remove();

  item.appendChild(titleEl);
  item.appendChild(messageEl);
  item.appendChild(closeBtn);
  bannerContainer.style.display = 'flex';
  bannerContainer.appendChild(item);

  setTimeout(() => {
    if (item.parentElement) {
      item.remove();
    }
  }, duration);
}

function showAdminUpdateNotification(title, message) {
  showLocalNotification(title, message);
  displayNotificationBanner({ title, message });
}

async function showInAppNotificationOverlay(notification) {
  if (!notification || !notification.id) return;

  const notificationId = notification.id;
  if (shownInAppNotificationIds.has(notificationId) || dismissedInAppNotificationIds.has(notificationId)) {
    return;
  }

  if (inAppNotificationDisplaying) {
    inAppNotificationQueue.push(notification);
    return;
  }

  inAppNotificationDisplaying = true;
  shownInAppNotificationIds.add(notificationId);

  const overlay = document.createElement("div");
  overlay.id = "inAppNotificationOverlay";
  overlay.className = "deadline-notification-overlay";

  const modal = document.createElement("div");
  modal.className = "deadline-notification-modal";

  const title = document.createElement("h2");
  title.className = "deadline-notification-title";
  title.textContent = notification.title || "New update";

  const message = document.createElement("p");
  message.className = "deadline-notification-description";
  message.style.whiteSpace = "pre-wrap";
  message.style.wordBreak = "break-word";
  message.textContent = notification.message || "You have a new update from the admin.";

  const button = document.createElement("button");
  button.className = "deadline-notification-close";
  button.textContent = "Dismiss";
  button.onclick = async () => {
    dismissedInAppNotificationIds.add(notificationId);
    persistDismissedInAppNotifications();

    // If displayMode is 'once', record that this user has seen it in Firestore
    try {
      const currentEmail = userEmail || await getStoredUserEmail();
      if (notification.displayMode === 'once' && currentEmail) {
        const notifRef = doc(db, 'inAppNotifications', notificationId);
        await updateDoc(notifRef, { shownTo: arrayUnion(currentEmail) });
      }
    } catch (err) {
      console.warn('Failed to persist shownTo for in-app notification:', err);
    }

    closeInAppNotificationOverlay();
  };

  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(button);
  overlay.appendChild(modal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      dismissedInAppNotificationIds.add(notificationId);
      persistDismissedInAppNotifications();
      closeInAppNotificationOverlay();
    }
  });

  document.body.appendChild(overlay);
}

function closeInAppNotificationOverlay() {
  const overlay = document.getElementById("inAppNotificationOverlay");
  if (overlay) overlay.remove();
  inAppNotificationDisplaying = false;
  const nextNotification = inAppNotificationQueue.shift();
  if (nextNotification) {
    showInAppNotificationOverlay(nextNotification);
  }
}

// Maintenance overlay: when admin enables maintenance, show notice and allow only tickets
function getCurrentStoredUserRole() {
  try {
    const raw = localStorage.getItem('authUser');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role || null;
  } catch (error) {
    return null;
  }
}

function applyRestrictedMemberView(accessAllowed = true, accessReason = '') {
  const restrictedNotice = document.getElementById('restrictedAccessNotice');
  const reasonEl = document.getElementById('restrictedAccessReason');
  if (restrictedNotice) {
    restrictedNotice.style.display = accessAllowed === false ? 'block' : 'none';
  }
  if (reasonEl) {
    reasonEl.textContent = accessAllowed === false ? (accessReason || 'Please contact the administrator for more information.') : '';
  }

  const allowedSections = new Set(['submit-ticket', 'ticket-history']);

  document.querySelectorAll('.nav-list .nav-btn').forEach(btn => {
    try {
      const onclick = btn.getAttribute('onclick') || '';
      const matches = onclick.match(/showSection\('\s*([^']+)\s*'\)/);
      const sectionId = matches ? matches[1] : null;
      if (accessAllowed === false) {
        btn.style.display = allowedSections.has(sectionId) ? '' : 'none';
      } else {
        btn.style.display = '';
      }
    } catch (e) {
      // ignore
    }
  });

  document.querySelectorAll('.content-section').forEach(sec => {
    if (accessAllowed === false) {
      if (!allowedSections.has(sec.id)) {
        sec.style.display = 'none';
      } else {
        sec.style.display = '';
      }
    } else {
      sec.style.display = '';
    }
  });

  const activeSection = document.querySelector('.content-section.active');
  if (accessAllowed === false && (!activeSection || !allowedSections.has(activeSection.id))) {
    if (typeof window.showSection === 'function') {
      window.showSection('submit-ticket');
    }
  }

  if (accessAllowed === false) {
    const restrictedSections = document.querySelectorAll('.content-section');
    restrictedSections.forEach(sec => {
      if (!allowedSections.has(sec.id)) {
        sec.classList.remove('active');
      }
    });
  }
}

function persistMemberAccessState(accessAllowed, accessReason) {
  try {
    const raw = localStorage.getItem('authUser');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const updatedUser = {
      ...parsed,
      accessAllowed: accessAllowed,
      accessReason: accessReason || ''
    };
    localStorage.setItem('authUser', JSON.stringify(updatedUser));
  } catch (error) {
    console.warn('Unable to persist updated member access info:', error);
  }
}

function syncMemberAccessState(accessAllowed, accessReason) {
  persistMemberAccessState(accessAllowed, accessReason);
  applyRestrictedMemberView(accessAllowed, accessReason);
  window.__restrictedMemberMode = accessAllowed === false;

  if (typeof renderMemberStatusPanel === 'function') {
    renderMemberStatusPanel();
  }

  if (typeof window.renderMemberNavigation === 'function') {
    window.renderMemberNavigation(accessAllowed === false);
  }

  if (accessAllowed === false && typeof window.showSection === 'function') {
    const activeSection = document.querySelector('.content-section.active');
    if (!activeSection || !['submit-ticket', 'ticket-history'].includes(activeSection.id)) {
      window.showSection('submit-ticket');
    }
  }
}

function watchMemberAccessState() {
  if (!userEmail) return;

  if (accessStatusUnsubscribe) {
    accessStatusUnsubscribe();
    accessStatusUnsubscribe = null;
  }

  const normalizedEmail = normalizeEmail(userEmail);
  const accessRef = doc(db, 'userRoles', normalizedEmail);
  accessStatusUnsubscribe = onSnapshot(accessRef, (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const accessAllowed = typeof data.accessAllowed === 'boolean' ? data.accessAllowed : true;
    const accessReason = typeof data.accessReason === 'string' ? data.accessReason : '';
    syncMemberAccessState(accessAllowed, accessReason);
  }, (error) => {
    console.warn('Unable to watch member access state:', error);
  });
}

function formatWalletDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

function renderWalletHistory(transactions) {
  const history = document.getElementById('memberWalletHistory');
  if (!history) return;
  if (!transactions.length) {
    history.innerHTML = '<p style="color: #94a3b8; text-align: center;">No transactions yet.</p>';
    return;
  }
  history.innerHTML = transactions.map((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const isCredit = transaction.type === 'credit';
    return `<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; padding:0.85rem 0; border-bottom:1px solid #374151;">
      <div><strong style="color:#f8fafc;">${escapeHtml(transaction.description || (isCredit ? 'Balance credited' : 'Balance deducted'))}</strong><div style="color:#94a3b8; font-size:0.85rem; margin-top:0.25rem;">${formatWalletDate(transaction.createdAt)}</div></div>
      <strong style="color:${isCredit ? '#4ade80' : '#f87171'}; white-space:nowrap;">${isCredit ? '+' : '-'}${amount.toFixed(2)}</strong>
    </div>`;
  }).join('');
}

function watchMemberWallet() {
  if (!userEmail) return;
  walletUnsubscribe?.();
  walletTransactionsUnsubscribe?.();
  const normalizedEmail = normalizeEmail(userEmail);
  walletUnsubscribe = onSnapshot(doc(db, 'userRoles', normalizedEmail), (snapshot) => {
    const balance = Number(snapshot.data()?.walletBalance) || 0;
    const balanceEl = document.getElementById('memberWalletBalance');
    if (balanceEl) {
      balanceEl.textContent = balance.toFixed(2);
      const balanceColor = balance < 0 ? '#f87171' : '#fff';
      balanceEl.classList.toggle('negative-wallet-balance', balance < 0);
      balanceEl.style.setProperty('color', balanceColor, 'important');
      balanceEl.style.setProperty('-webkit-text-fill-color', balanceColor, 'important');
    }
  }, (error) => console.warn('Unable to watch wallet balance:', error));
  const transactionsQuery = query(collection(db, 'userRoles', normalizedEmail, 'walletTransactions'), orderBy('createdAt', 'desc'));
  walletTransactionsUnsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
    renderWalletHistory(snapshot.docs.map(transactionDoc => ({ id: transactionDoc.id, ...transactionDoc.data() })));
  }, (error) => {
    console.warn('Unable to watch wallet history:', error);
    const history = document.getElementById('memberWalletHistory');
    if (history) history.innerHTML = '<p style="color:#f87171; text-align:center;">Unable to load transaction history.</p>';
  });
}

async function updateMemberPresence(isOnline = true, options = {}) {
  if (!userEmail) return;

  const { force = false } = options;
  const now = Date.now();
  const shouldSkip = !force && isOnline === presenceState && now - presenceLastUpdatedAt < 10000;

  if (shouldSkip) return;

  const normalizedEmail = normalizeEmail(userEmail);

  try {
    await setDoc(doc(db, 'userRoles', normalizedEmail), {
      email: normalizedEmail,
      lastActive: new Date(),
      isOnline,
      updatedAt: new Date()
    }, { merge: true });

    presenceState = isOnline;
    presenceLastUpdatedAt = now;

    memberStatusDocs[normalizedEmail] = memberStatusDocs[normalizedEmail] || {};
    memberStatusDocs[normalizedEmail].lastActive = new Date().toISOString();
    memberStatusDocs[normalizedEmail].isOnline = isOnline;
    if (typeof renderMemberStatusPanel === 'function') {
      renderMemberStatusPanel();
    }
  } catch (error) {
    console.error('Unable to update member presence on server:', error);
    throw error;
  }
}

function startMemberPresenceHeartbeat() {
  if (presenceTrackingInitialized) return;
  presenceTrackingInitialized = true;

  const syncPresence = (isOnline, options = {}) => {
    void updateMemberPresence(isOnline, options);
  };

  syncPresence(true, { force: true });

  if (presenceHeartbeatTimer) {
    clearInterval(presenceHeartbeatTimer);
  }

  presenceHeartbeatTimer = window.setInterval(() => {
    syncPresence(true, { force: true });
  }, 20000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      syncPresence(false, { force: true });
    } else {
      syncPresence(true, { force: true });
    }
  });

  window.addEventListener('pagehide', () => {
    syncPresence(false, { force: true, keepalive: true });
  });

  window.addEventListener('beforeunload', () => {
    syncPresence(false, { force: true, keepalive: true });
  });

  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('pause', () => {
        syncPresence(false, { force: true, keepalive: true });
      });
      App.addListener('resume', () => {
        syncPresence(true, { force: true });
      });
    }).catch((error) => {
      console.warn('Unable to initialize Capacitor app lifecycle presence listeners:', error);
    });
  }

  window.addEventListener('focus', () => {
    syncPresence(true, { force: true });
  });

  window.addEventListener('blur', () => {
    syncPresence(false, { force: true });
  });

  window.addEventListener('online', () => {
    syncPresence(true, { force: true });
  });

  window.addEventListener('offline', () => {
    syncPresence(false, { force: true });
  });

  window.addEventListener('pageshow', () => {
    syncPresence(true, { force: true });
  });
}

function checkMaintenance() {
  try {
    const maintenanceRef = doc(db, 'appSettings', 'maintenance');
    onSnapshot(maintenanceRef, (snap) => {
      const data = snap.exists() ? snap.data() : { enabled: false };
      const enabled = !!data.enabled;
      const message = data.message || 'The site is currently under maintenance. You may submit a support ticket or view ticket status.';

      // Sections and nav allowed during maintenance
      const allowedSections = new Set(['submit-ticket', 'ticket-history']);

      // Hide/show nav items
      document.querySelectorAll('.nav-list .nav-btn').forEach(btn => {
        try {
          const onclick = btn.getAttribute('onclick') || '';
          const matches = onclick.match(/showSection\('\s*([^']+)\s*'\)/);
          const sectionId = matches ? matches[1] : null;
          if (enabled) {
            if (!allowedSections.has(sectionId)) {
              btn.style.display = 'none';
            } else {
              btn.style.display = '';
            }
          } else {
            btn.style.display = '';
          }
        } catch (e) {
          // ignore
        }
      });

      // Show/hide sections
      document.querySelectorAll('.content-section').forEach(sec => {
        if (enabled) {
          if (!allowedSections.has(sec.id)) {
            sec.dataset.hiddenByMaintenance = 'true';
            sec.style.display = 'none';
          } else {
            sec.style.display = '';
            delete sec.dataset.hiddenByMaintenance;
          }
        } else {
          sec.style.display = '';
          delete sec.dataset.hiddenByMaintenance;
        }
      });

      // Ensure current section is allowed
      // Render maintenance banner into a section card (e.g. submit-ticket, ticket-history)
      function renderMaintenanceBannerInSection(sectionSelector, msg) {
        const sectionCard = document.querySelector(sectionSelector);
        if (!sectionCard) return;
        let banner = sectionCard.querySelector('.maintenance-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'maintenance-banner';
          banner.style.marginTop = '1rem';
          banner.style.padding = '1rem';
          banner.style.background = 'linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.95))';
          banner.style.border = '1px solid rgba(59, 130, 246, 0.25)';
          banner.style.borderRadius = '1rem';
          banner.style.display = 'flex';
          banner.style.alignItems = 'center';
          banner.style.gap = '1rem';
          banner.style.flexWrap = 'wrap';
          banner.style.whiteSpace = 'pre-wrap';
          banner.style.wordBreak = 'break-word';
          banner.innerHTML = `
            <div class="maintenance-icon"><i class="fas fa-user-cog"></i></div>
            <div class="maintenance-text">
              <div class="maintenance-banner-message"></div>
            </div>
          `;
          const h2 = sectionCard.querySelector('h2');
          if (h2 && h2.parentNode === sectionCard) {
            h2.insertAdjacentElement('afterend', banner);
          } else {
            sectionCard.insertBefore(banner, sectionCard.firstChild);
          }
        }
        const messageEl = banner.querySelector('.maintenance-banner-message');
        if (messageEl) {
          messageEl.textContent = msg || '';
        }
        banner.style.display = msg ? '' : 'none';
      }

      function removeMaintenanceBannerFromSection(sectionSelector) {
        const sectionCard = document.querySelector(sectionSelector);
        if (!sectionCard) return;
        const banner = sectionCard.querySelector('.maintenance-banner');
        if (banner) banner.remove();
      }

      // Header banner under page title
      function renderHeaderMaintenanceBanner(msg) {
        const header = document.querySelector('.content-header');
        if (!header) return;
        let banner = header.querySelector('.maintenance-header-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'maintenance-header-banner';
          banner.style.marginTop = '0.5rem';
          banner.style.color = '#fee2e2';
          banner.style.padding = '0.75rem 1rem';
          banner.style.background = 'linear-gradient(135deg, rgba(185, 28, 43, 0.95), rgba(125, 29, 29, 0.9))';
          banner.style.borderRadius = '0.5rem';
          banner.style.fontWeight = '700';
          banner.style.display = 'flex';
          banner.style.alignItems = 'center';
          banner.style.gap = '0.75rem';
          banner.style.whiteSpace = 'pre-wrap';
          banner.style.wordBreak = 'break-word';
          banner.innerHTML = `
            <div class="maintenance-icon"><i class="fas fa-triangle-exclamation"></i></div>
            <div class="maintenance-text">
              <strong>${msg || 'Maintenance mode is enabled.'}</strong>
            </div>
          `;
          header.appendChild(banner);
        } else {
          const textEl = banner.querySelector('.maintenance-text strong');
          if (textEl) textEl.textContent = msg || 'Maintenance mode is enabled.';
        }
        banner.style.display = msg ? '' : 'none';
      }

      function removeHeaderMaintenanceBanner() {
        document.querySelectorAll('.maintenance-header-banner').forEach(el => el.remove());
      }

      function renderMaintenanceOverlay(msg) {
        const overlay = document.getElementById('maintenanceOverlay');
        const adminMessage = document.getElementById('maintenanceOverlayAdminMessage');
        if (adminMessage) {
          adminMessage.textContent = msg || '';
          adminMessage.style.display = msg ? 'block' : 'none';
        }
        if (overlay) {
          overlay.style.display = 'flex';
        }
      }

      function removeMaintenanceOverlay() {
        const overlay = document.getElementById('maintenanceOverlay');
        if (overlay) {
          overlay.style.display = 'none';
        }
      }

      if (enabled) {
        // Render in submit-ticket and ticket-history, plus header banner
        renderMaintenanceBannerInSection('#submit-ticket .card', message);
        renderMaintenanceBannerInSection('#ticket-history .card', message);
        renderHeaderMaintenanceBanner('DOWNTIME ALERT');
        renderMaintenanceOverlay(message);

        // Monkeypatch showSection to enforce maintenance
        if (!window._originalShowSection) {
          window._originalShowSection = window.showSection.bind(window);
          window.showSection = function(sectionId) {
            if (!allowedSections.has(sectionId)) {
              window._originalShowSection('submit-ticket');
              const submitCard = document.querySelector('#submit-ticket .card');
              if (submitCard) {
                let msgEl = submitCard.querySelector('.maintenance-message');
                if (!msgEl) {
                  msgEl = document.createElement('div');
                  msgEl.className = 'maintenance-message';
                  msgEl.style.marginTop = '1rem';
                  msgEl.style.color = '#94a3b8';
                  msgEl.style.padding = '0.75rem';
                  msgEl.style.background = '#0f172a';
                  msgEl.style.border = '1px solid #374151';
                  msgEl.style.borderRadius = '0.5rem';
                  submitCard.insertBefore(msgEl, submitCard.firstChild.nextSibling);
                }
                msgEl.textContent = message;
              }
              return;
            }
            window._originalShowSection(sectionId);
          };
        } else {
          const submitCard = document.querySelector('#submit-ticket .card');
          if (submitCard) {
            let msgEl = submitCard.querySelector('.maintenance-message');
            if (msgEl) msgEl.textContent = message;
          }
        }

        const active = document.querySelector('.content-section.active');
        if (!active || !allowedSections.has(active.id)) {
          window._originalShowSection('submit-ticket');
        }
        window.maintenanceEnforced = true;
      } else {
        removeMaintenanceOverlay();
        // restore original showSection if present
        if (window._originalShowSection) {
          window.showSection = window._originalShowSection;
          window._originalShowSection = null;
        }
        window.maintenanceEnforced = false;
        // remove any maintenance message elements and banners
        document.querySelectorAll('.maintenance-message').forEach(el => el.remove());
        removeMaintenanceBannerFromSection('#submit-ticket .card');
        removeMaintenanceBannerFromSection('#ticket-history .card');
        removeHeaderMaintenanceBanner();
      }
    }, (error) => {
      console.error('Maintenance onSnapshot error:', error);
    });
  } catch (error) {
    console.error('Failed to initialize maintenance listener:', error);
  }
}

async function loadInAppNotifications() {
  const currentEmail = userEmail || await getStoredUserEmail();
  onSnapshot(collection(db, "inAppNotifications"), (snap) => {
    const docs = [];
    snap.forEach(docSnap => docs.push({ id: docSnap.id, ...docSnap.data() }));
    docs.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    docs.forEach((notification) => {
      if (notification.active === false) return;

      // Skip if 'until' mode expired
      if (notification.displayMode === 'until' && notification.until) {
        const untilDate = parseDateValue(notification.until);
        if (untilDate && Date.now() > untilDate.getTime()) return;
      }

      // Skip if 'once' and this user already seen it
      if (notification.displayMode === 'once') {
        const alreadyShownArray = Array.isArray(notification.shownTo) ? notification.shownTo : [];
        if (currentEmail && alreadyShownArray.includes(currentEmail)) return;
        // If no currentEmail (shouldn't happen when signed-in), we cannot enforce 'once' strictly.
        // In strict Firestore mode we skip showing when we can't determine user identity.
        if (!currentEmail) return;
      }

      const targetType = notification.targetType || "everyone";
      const assignedTo = Array.isArray(notification.assignedTo) ? notification.assignedTo : [];
      const shouldShow = targetType === "everyone" || assignedTo.includes("everyone") || (currentEmail && assignedTo.includes(currentEmail));
      if (shouldShow) {
        showInAppNotificationOverlay(notification);
      }
    });
  }, (error) => {
    console.error("In-app notifications listener error:", error);
  });
}

function getSafePollVotes(poll) {
  const votes = poll.votes || {};
  return typeof votes === 'object' && votes !== null ? votes : {};
}

function renderMemberProgressReport(sections) {
  const container = document.getElementById("progressReport");
  const emptyState = document.getElementById("progressEmptyState");

  if (!container) return;
  if (!Array.isArray(sections) || sections.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = sections.map(section => `
    <div style="margin-bottom: 1.25rem;">
      <h3 style="margin: 0 0 0.75rem 0; color: #3b82f6;">${section.title}</h3>
      ${Array.isArray(section.items) ? section.items.map(item => {
        const assignedToName = Array.isArray(item.assignedToName) ? item.assignedToName.join(', ') : (item.assignedToName || (item.assignedTo ? getUserName(item.assignedTo) : 'Unassigned'));
        const itemName = item.name === 'New Item' ? '' : (item.name || '');
        return `
          <div style="padding: 0.75rem; background: #111827; border: 1px solid #374151; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <span style="color: #d1d5db;">${itemName}</span>
              <span style="color: ${item.status === 'Completed' ? '#22c55e' : item.status === 'Pending' ? '#f59e0b' : '#94a3b8'}; font-weight: 600;">${item.status || 'Not Started'}</span>
            </div>
            <p style="margin: 0.5rem 0 0 0; color: #60a5fa; font-size: 0.85rem;">Assigned to: ${assignedToName}</p>
          </div>
        `;
      }).join('') : ''}
    </div>
  `).join('');
}

function mergeProgressStructures(defaultSections, savedSections) {
  // Merge saved data with default structure, preserving edits but adding new items and preserving extra sections.
  const mergedSections = defaultSections.map((defaultSection) => {
    const savedSection = savedSections.find(s => s.title === defaultSection.title);

    if (!savedSection) {
      // Section doesn't exist in saved data, use default
      return defaultSection;
    }

    // Merge items within the section
    const mergedItems = defaultSection.items.map((defaultItem) => {
      const savedItem = savedSection.items?.find(i => i.name === defaultItem.name);

      if (!savedItem) {
        // Item doesn't exist in saved data, use default
        return defaultItem;
      }

      // Item exists in saved data, preserve status and assignments
      return {
        name: defaultItem.name,
        status: savedItem.status || defaultItem.status,
        assignedTo: Array.isArray(savedItem.assignedTo) ? savedItem.assignedTo : (savedItem.assignedTo ? [savedItem.assignedTo] : []),
        assignedToName: Array.isArray(savedItem.assignedToName) ? savedItem.assignedToName : (savedItem.assignedToName ? [savedItem.assignedToName] : [])
      };
    });

    return {
      title: defaultSection.title,
      items: mergedItems
    };
  });

  const defaultTitles = defaultSections.map(section => section.title);
  const extraSections = savedSections.filter(section => section && typeof section === 'object' && !defaultTitles.includes(section.title));

  return [...mergedSections, ...extraSections];
}

function loadProgressReport() {
  const progressRef = doc(db, progressReportCollection, progressReportDocId);

  onSnapshot(progressRef, async (snap) => {
    if (snap.exists()) {
      const data = snap.data() || {};
      const sections = Array.isArray(data.sections) ? data.sections : [];
      if (sections.length === 0) {
        const backupSections = getProgressBackupSections() || [];
        if (backupSections.length > 0) {
          renderMemberProgressReport(backupSections);
          return;
        }
      }
      saveProgressBackupSections(sections);
      renderMemberProgressReport(sections);
      return;
    }

    const backupSections = getProgressBackupSections() || [];
    if (backupSections.length > 0) {
      renderMemberProgressReport(backupSections);
      return;
    }

    renderMemberProgressReport([]);
  }, (error) => {
    console.error('Progress report onSnapshot error:', error);
    const backupSections = getProgressBackupSections() || [];
    renderMemberProgressReport(backupSections);
  });
}

window.markDone = async function (id) {
  try {
    await updateDoc(doc(db, "tasks", id), {
      status: "pending validation"
    });
    alert("Task marked as submitted for validation!");
  } catch (error) {
    console.error("Error marking submitted:", error);
    alert("Failed to mark task as submitted. Please try again.");
  }
};

window.submitTicket = async function () {
  console.log('submitTicket called, userEmail:', userEmail);
  if (!userEmail) {
    alert("Please wait for the page to load completely.");
    return;
  }

  // Prevent multiple submissions
  if (window.isSubmittingTicket) {
    console.log('Ticket submission already in progress, ignoring...');
    return;
  }
  window.isSubmittingTicket = true;

  const titleElement = document.getElementById("maintenanceTicketTitle") || document.getElementById("ticketTitle");
  const descriptionElement = document.getElementById("maintenanceTicketDescription") || document.getElementById("ticketDescription");
  const title = titleElement ? titleElement.value.trim() : "";
  const description = descriptionElement ? descriptionElement.value.trim() : "";
  console.log('Ticket data - title:', title, 'description:', description);

  if (!title || !description) {
    alert("Please fill in both title and description.");
    window.isSubmittingTicket = false;
    return;
  }

  try {
    console.log('Adding ticket to Firestore...');
    console.log('Submitting ticket with userEmail:', userEmail);
    const createdTicketRef = await addDoc(collection(db, "tickets"), {
      title: title,
      description: description,
      submittedBy: userEmail,
      submittedByName: getUserName(userEmail),
      assignedTo: userEmail, // Add assignedTo field
      status: "open",
      adminEmailNotificationSent: false,
      createdAt: new Date(),
      responses: []
    });
    console.log('Ticket added successfully with submittedBy:', userEmail);

    // Clear form
    if (titleElement) titleElement.value = "";
    if (descriptionElement) descriptionElement.value = "";

    renderSubmittedTicketImmediately(createdTicketRef.id, {
      title,
      description,
      submittedBy: userEmail,
      assignedTo: userEmail,
      status: 'open',
      createdAt: new Date(),
      responses: []
    });
    loadTicketHistory('ticketHistory', 'ticketHistoryEmptyState', true);
    const form = titleElement?.closest('form');
    let submissionMessage = document.getElementById('ticketSubmissionMessage');
    if (!submissionMessage && form) {
      submissionMessage = document.createElement('p');
      submissionMessage.id = 'ticketSubmissionMessage';
      submissionMessage.style.cssText = 'margin:0.75rem 0 0; color:#86efac;';
      form.appendChild(submissionMessage);
    }
    if (submissionMessage) {
      submissionMessage.textContent = 'Ticket submitted successfully. It now appears in Ticket History.';
    }

    // Notification delivery must not delay the member's ticket history update.
    const adminEmail = "johnpaulbugayong@gmail.com";
    const notificationTitle = "New Support Ticket Submitted";
    const notificationBody = `New ticket: "${title}" submitted by ${getUserName(userEmail)}`;
    void sendNotificationToUsers([adminEmail], notificationTitle, notificationBody, 'ticket')
      .then(() => console.log('Notification process completed'))
      .catch((notificationError) => console.warn("Notification process failed:", notificationError));
  } catch (error) {
    console.error("Error submitting ticket:", error);
    alert("Failed to submit ticket. Please try again.");
  } finally {
    window.isSubmittingTicket = false;
  }
};

function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  datetimeEl.textContent = now.toLocaleDateString('en-US', options);
}

window.votePoll = async function(pollId, optionIndex) {
  if (!userEmail) {
    alert("Please wait for the page to load completely.");
    return;
  }
  
  try {
    const pollRef = doc(db, "polls", pollId);
    const pollDoc = await getDoc(pollRef);
    
    if (pollDoc.exists()) {
      const pollData = pollDoc.data();
      
      // Check if poll is closed
      if (pollData.status === 'closed') {
        alert("This poll is closed and no longer accepts votes.");
        return;
      }
      
      const votes = pollData.votes || {};
      
      // Remove previous vote if exists
      for (const [key, voters] of Object.entries(votes)) {
        if (voters.includes(userEmail)) {
          votes[key] = voters.filter(email => email !== userEmail);
        }
      }
      
      // Add new vote
      if (!votes[optionIndex]) {
        votes[optionIndex] = [];
      }
      votes[optionIndex].push(userEmail);
      
      await updateDoc(pollRef, { votes });
      alert("Vote submitted successfully!");
    }
  } catch (error) {
    console.error("Error voting:", error);
    alert("Failed to submit vote. Please try again.");
  }
};

function loadPolls() {
  onSnapshot(collection(db, "polls"), (snap) => {
    pollsContainer.innerHTML = "";
    let activePollCount = 0;
    let closedPollCount = 0;

    const docs = [];
    snap.forEach(doc => docs.push(doc));
    docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

    // Notify on newly created polls after the first snapshot
    docs.forEach(doc => {
      const poll = doc.data() || {};
      const previous = previousPollMap.get(doc.id);
      if (pollNotificationsInitialized && !previous && poll.question) {
        showAdminUpdateNotification('New Poll Created', `A new poll has been created: "${poll.question}"`);
      }
      previousPollMap.set(doc.id, poll);
    });
    pollNotificationsInitialized = true;

    // Separate active and closed polls
    const activePolls = docs.filter(doc => (doc.data().status || 'active') === 'active');
    const closedPolls = docs.filter(doc => (doc.data().status || 'active') === 'closed');

    // Render active polls
    if (activePolls.length > 0) {
      pollsContainer.innerHTML += `<h3 style="color: #e2e8f0; margin-bottom: 1rem; margin-top: 0;">Active Polls</h3>`;
      activePolls.forEach(doc => {
        const poll = doc.data() || {};
        activePollCount++;
        
        const votes = getSafePollVotes(poll);
        const options = getSafePollOptions(poll);
        const totalVotes = Object.values(votes).reduce((sum, voters) => sum + (Array.isArray(voters) ? voters.length : 0), 0);
        const userVoted = Object.values(votes).some(voters => Array.isArray(voters) && voters.includes(userEmail));
        
        let optionsHtml = "";
        options.forEach((option, index) => {
          const optionVotes = Array.isArray(votes[index]) ? votes[index].length : 0;
          const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isUserVote = Array.isArray(votes[index]) && votes[index].includes(userEmail);
          
          optionsHtml += `
            <div class="poll-option ${isUserVote ? 'user-vote' : ''}" style="margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #374151; border-radius: 0.375rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${option}</span>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span>${optionVotes} votes (${percentage}%)</span>
                  ${!userVoted ? `<button onclick="votePoll('${doc.id}', ${index})" style="background: #3b82f6; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 0.25rem; cursor: pointer;">Vote</button>` : ''}
                </div>
              </div>
              <div style="width: 100%; height: 8px; background: #374151; border-radius: 4px; margin-top: 0.25rem;">
                <div style="width: ${percentage}%; height: 100%; background: ${isUserVote ? '#10b981' : '#3b82f6'}; border-radius: 4px;"></div>
              </div>
            </div>
          `;
        });
        
        pollsContainer.innerHTML += `
          <div class="poll-item" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #374151; border-left: 4px solid #3b82f6; border-radius: 0.5rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${poll.question || "Untitled Poll"}</h4>
            <p style="color: #9ca3af; margin: 0 0 1rem 0; font-size: 0.875rem;">Total votes: ${totalVotes}</p>
            ${optionsHtml}
          </div>
        `;
      });
    }

    // Render closed/archived polls
    if (closedPolls.length > 0) {
      const archiveContentId = 'archivedPollsContent';
      const archiveHtml = closedPolls.map(doc => {
        const poll = doc.data() || {};
        closedPollCount++;
        
        const votes = getSafePollVotes(poll);
        const options = getSafePollOptions(poll);
        const totalVotes = Object.values(votes).reduce((sum, voters) => sum + (Array.isArray(voters) ? voters.length : 0), 0);
        const userVoted = Object.values(votes).some(voters => Array.isArray(voters) && voters.includes(userEmail));
        
        let optionsHtml = "";
        options.forEach((option, index) => {
          const optionVotes = Array.isArray(votes[index]) ? votes[index].length : 0;
          const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isUserVote = Array.isArray(votes[index]) && votes[index].includes(userEmail);
          
          optionsHtml += `
            <div class="poll-option ${isUserVote ? 'user-vote' : ''}" style="margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #6b7280; border-radius: 0.375rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #d1d5db;">${option}</span>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="color: #cbd5e1;">${optionVotes} votes (${percentage}%)</span>
                </div>
              </div>
              <div style="width: 100%; height: 8px; background: #374151; border-radius: 4px; margin-top: 0.25rem;">
                <div style="width: ${percentage}%; height: 100%; background: #9ca3af; border-radius: 4px;"></div>
              </div>
            </div>
          `;
        });
        
        return `
          <div class="poll-item" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #6b7280; border-left: 4px solid #9ca3af; border-radius: 0.5rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${poll.question || "Untitled Poll"}</h4>
            <p style="color: #cbd5e1; margin: 0 0 1rem 0; font-size: 0.875rem;">Total votes: ${totalVotes} · CLOSED</p>
            ${optionsHtml}
          </div>
        `;
      }).join('');

      pollsContainer.innerHTML += `
        <div style="margin-top: 2rem;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; margin-bottom: 1rem;">
            <button onclick="toggleArchivedPolls()" style="padding: 0.4rem 0.75rem; background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
              ${archivedPollsCollapsed ? 'Show Archived Polls' : 'Hide Archived Polls'}
            </button>
          </div>
          <div id="${archiveContentId}" style="display: ${archivedPollsCollapsed ? 'none' : 'block'};">${archiveHtml}</div>
        </div>
      `;
    }

    pollsEmptyState.style.display = activePollCount === 0 ? "block" : "none";
  }, (error) => {
    console.error('Polls onSnapshot error:', error);
  });
}

function formatAnnouncementDate(dateValue) {
  if (!dateValue) return "Unknown date";
  if (dateValue.toDate) return dateValue.toDate().toLocaleString();
  if (dateValue instanceof Date) return dateValue.toLocaleString();
  return new Date(dateValue).toLocaleString();
}

window.addAnnouncementComment = async function(announcementId) {
  if (!userEmail) {
    alert("Please wait for the page to load completely.");
    return;
  }
  
  const input = document.getElementById(`commentInput-${announcementId}`);
  if (!input) return;

  const commentText = input.value.trim();
  if (!commentText) {
    alert("Please enter a comment.");
    return;
  }

  try {
    await updateDoc(doc(db, "announcements", announcementId), {
      comments: arrayUnion({
        author: getUserName(userEmail),
        email: userEmail,
        content: commentText,
        createdAt: new Date()
      })
    });

    input.value = "";
    alert("Comment posted successfully!");
  } catch (error) {
    console.error("Error posting comment:", error);
    alert("Failed to post comment. Please try again.");
  }
};

window.deleteAnnouncementComment = async function(announcementId, commentIndex) {
  try {
    const announcementRef = doc(db, "announcements", announcementId);
    const announcementSnap = await getDoc(announcementRef);
    if (!announcementSnap.exists()) return;

    const announcement = announcementSnap.data();
    const comments = Array.isArray(announcement.comments) ? [...announcement.comments] : [];
    if (commentIndex < 0 || commentIndex >= comments.length) return;

    const comment = comments[commentIndex];
    if (!comment || comment.email !== userEmail) {
      alert("You can only delete your own comments.");
      return;
    }

    comments.splice(commentIndex, 1);
    await updateDoc(announcementRef, { comments });
    alert("Comment deleted successfully.");
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("Failed to delete comment. Please try again.");
  }
};

function renderAnnouncementComments(announcementId, comments) {
  const safeComments = Array.isArray(comments) ? comments : [];
  if (safeComments.length === 0) {
    return `<p style="color: #9ca3af; margin: 0 0 0.75rem 0;">No comments yet. Be the first to respond.</p>`;
  }

  return safeComments.map((comment, index) => `
    <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #4b5563; border-radius: 0.375rem; background: #111827;">
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
          ${renderUserAvatarMarkup(comment.email || comment.author || 'Member', 26)}
          <div>
            <span style="font-weight: 600; color: #f3f4f6;">${comment.author || comment.email || 'Member'}</span>
            <div style="font-size: 0.8rem; color: #9ca3af;">${formatAnnouncementDate(comment.createdAt)}</div>
          </div>
        </div>
        ${comment.email === userEmail ? `<button onclick="deleteAnnouncementComment('${announcementId}', ${index})" style="background: #ef4444 !important; color: white !important; border: none !important; padding: 0.15rem 0.35rem !important; border-radius: 0.25rem !important; cursor: pointer !important; font-size: 0.65rem !important; line-height: 1 !important; width: auto !important; min-width: 0 !important; margin-top: 0 !important; box-shadow: none !important;">Delete</button>` : ''}
      </div>
      <p class="comment-content" style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${comment.content}</p>
    </div>
  `).join('');
}

function loadAnnouncements() {
  onSnapshot(collection(db, "announcements"), (snap) => {
    announcementsContainer.innerHTML = "";
    let announcementCount = 0;
    const archivedAnnouncements = [];

    const docs = [];
    snap.forEach(doc => docs.push(doc));
    docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

    docs.forEach(doc => {
      const announcement = doc.data() || {};
      const previous = previousAnnouncementMap.get(doc.id);
      const assignedTo = Array.isArray(announcement.assignedTo) ? announcement.assignedTo : ["everyone"];

      if (announcementNotificationsInitialized && !previous && announcement.archived !== true && announcement.title) {
        const shouldNotify = matchesAnnouncementTarget(assignedTo, userEmail);
        if (shouldNotify) {
          showAdminUpdateNotification('New Announcement', `New announcement: "${announcement.title}"`);
        }
      }
      previousAnnouncementMap.set(doc.id, announcement);

      if (!matchesAnnouncementTarget(assignedTo, userEmail)) return;

      if (announcement.archived === true) {
        archivedAnnouncements.push({ id: doc.id, ...announcement });
        return;
      }

      const announcementDate = formatAnnouncementDate(announcement.createdAt);
      const commentsEnabled = announcement.commentsEnabled !== false;
      const commentHtml = renderAnnouncementComments(doc.id, announcement.comments);
      const assignedToNames = Array.isArray(announcement.assignedToNames) ? announcement.assignedToNames : ["Everyone"];
      const assignedToText = assignedToNames.length > 1 ? `Assigned to: ${assignedToNames.join(", ")}` : `Assigned to: ${assignedToNames[0]}`;
      announcementCount++;

      announcementsContainer.innerHTML += `
        <div class="announcement-item" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1f2937;">
          <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${announcement.title}</h4>
          <p style="color: #9ca3af; margin: 0 0 0.5rem 0; font-size: 0.875rem;">Posted on ${announcementDate}</p>
          <p style="color: #60a5fa; margin: 0 0 0.5rem 0; font-size: 0.85rem;">${assignedToText}</p>
          <p style="color: #d1d5db; margin: 0 0 1rem 0; white-space: pre-wrap;">${announcement.content}</p>
          <div style="margin-top: 1rem;">
            <h5 style="margin: 0 0 0.75rem 0; color: #f3f4f6;">Comments</h5>
            ${commentHtml}
            ${commentsEnabled ? `
              <textarea id="commentInput-${doc.id}" rows="3" placeholder="Write a comment..." style="width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #4b5563; background: #111827; color: #f3f4f6; margin-bottom: 0.75rem;"></textarea>
              <button onclick="addAnnouncementComment('${doc.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Post Comment</button>
            ` : `<p style="color: #f59e0b; margin-top: 0.5rem;">Comments are disabled for this announcement.</p>`}
          </div>
        </div>
      `;
    });

    if (archivedAnnouncements.length > 0) {
      announcementsContainer.innerHTML += `
        <div style="margin-top: 2rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem;">
            <h3 style="color: #e2e8f0; margin: 0;">Archived Announcements</h3>
            <button onclick="toggleArchivedAnnouncements()" style="padding: 0.4rem 0.75rem; background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
              ${archivedAnnouncementsCollapsed ? 'Show' : 'Hide'} (${archivedAnnouncements.length})
            </button>
          </div>
          <div id="archivedAnnouncementsContent" style="display: ${archivedAnnouncementsCollapsed ? 'none' : 'block'};">
            ${archivedAnnouncements.map(announcement => `
              <div class="announcement-item" style="margin-bottom: 0.75rem; padding: 0.85rem 1rem; border: 1px solid #4b5563; border-left: 4px solid #94a3b8; border-radius: 0.5rem; background: #1f2937; opacity: 0.8;">
                <h4 style="margin: 0 0 0.35rem 0; color: #cbd5e1;">${announcement.title || 'Untitled announcement'}</h4>
                <p style="color: #9ca3af; margin: 0 0 0.5rem 0; font-size: 0.8rem;">Archived · Posted on ${formatAnnouncementDate(announcement.createdAt)}</p>
                <p style="color: #d1d5db; margin: 0; white-space: pre-wrap;">${announcement.content || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    announcementNotificationsInitialized = true;
    announcementsEmptyState.style.display = announcementCount === 0 ? "block" : "none";
    void hydrateProfileAvatars();
    refreshHomeDashboard();
  }, (error) => {
    console.error('Announcements onSnapshot error:', error);
  });
}

function loadResources() {
  const container = document.getElementById("resources");
  if (!container) {
    console.log('=== RESOURCES CONTAINER NOT FOUND ===');
    return;
  }

  console.log('=== MEMBER RESOURCES LISTENER SETUP ===');
  onSnapshot(collection(db, "resources"), (snap) => {
    console.log('=== MEMBER RESOURCES LISTENER TRIGGERED ===');
    console.log('Resources snapshot received, docs count:', snap.size);
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">No resources found</p>';
      return;
    }

    const docs = [];
    snap.forEach(docSnap => docs.push(docSnap));
    docs.sort((a, b) => {
      const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
      const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
      return timeB - timeA;
    });

    docs.forEach(docSnap => {
      const resource = docSnap.data();
      const createdDate = resource.createdAt?.toDate?.() ? resource.createdAt.toDate().toLocaleDateString() : "Unknown date";

      container.innerHTML += `
        <div class="card" style="margin-bottom: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">${resource.title}</h4>
          <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.75rem;">Posted: ${createdDate}</p>
          <p style="margin: 0.5rem 0; line-height: 1.4; color: #d1d5db; white-space: pre-wrap; word-break: break-word;">${resource.description}</p>
          <div style="margin-top: 1rem;">
            <a href="${resource.link}" target="_blank" style="background: #10b981; color: white; padding: 0.75rem 1.25rem; border-radius: 0.375rem; text-decoration: none; display: inline-block; font-weight: 500;">🔗 Open Resource</a>
          </div>
        </div>
      `;
    });
  }, (error) => {
    console.error('Resources onSnapshot error:', error);
  });
}



/* MEETING SCHEDULE VIEW ONLY */

function loadMeetings() {
  if (!userEmail) return;
  
  if (meetingsUnsubscribe) {
    meetingsUnsubscribe();
  }

  const meetingsQuery = query(collection(db, 'meetings'), where('assignedTo', 'in', [userEmail, 'everyone']));
  meetingsUnsubscribe = onSnapshot(meetingsQuery, (snapshot) => {
    const meetings = [];
    snapshot.forEach(docSnap => {
      meetings.push({ id: docSnap.id, ...docSnap.data() });
    });

    meetings.sort((a, b) => {
      const aDate = new Date(`${a.date}T${a.time}`);
      const bDate = new Date(`${b.date}T${b.time}`);
      return aDate - bDate;
    });

    renderMeetings(meetings);
  }, (error) => {
    console.error('Meetings listener error:', error);
  });
}

window.loadMeetings = loadMeetings;

function renderMeetings(meetings) {
  const container = document.getElementById('meetingsContainer');
  if (!container) return;

  const activeMeetings = meetings.filter(meeting => {
    const status = (meeting.status || 'Active').toLowerCase();
    const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
    const now = new Date();
    const isFinished = now - meetingDateTime > (2 * 60 * 60 * 1000);
    return status !== 'completed' && status !== 'cancelled' && !isFinished;
  });

  if (activeMeetings.length === 0) {
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No meetings scheduled yet.</p>';
    return;
  }

  container.innerHTML = '';

  activeMeetings.forEach((meeting) => {
    const meetingDiv = document.createElement('div');
    meetingDiv.style.cssText = `
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      background: #1e293b;
    `;

    const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
    const now = new Date();
    const isUpcoming = meetingDateTime > now;
    const isToday = meetingDateTime.toDateString() === now.toDateString();
    const isOngoing = isToday && meetingDateTime <= now && (now - meetingDateTime) < (2 * 60 * 60 * 1000);
    const isFinished = !isUpcoming && !isOngoing;
    const canJoin = !isUpcoming;

    let status = 'Upcoming';
    let statusColor = '#3b82f6';

    if (isOngoing) {
      status = 'Ongoing';
      statusColor = '#10b981';
    } else if (isFinished) {
      status = 'Finished';
      statusColor = '#6b7280';
    }

    meetingDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
        <h4 style="margin: 0; color: #f8fafc;">${meeting.title}</h4>
        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">
          ${status}
        </span>
      </div>
      <div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem;">
        <i class="fas fa-calendar"></i> ${meetingDateTime.toLocaleDateString()} at ${meetingDateTime.toLocaleTimeString()}
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button ${canJoin ? '' : 'disabled'} onclick="joinScheduledMeeting('${meeting.roomName}')" style="background: ${canJoin ? '#10b981' : '#6b7280'}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: ${canJoin ? 'pointer' : 'not-allowed'}; font-size: 0.85rem;">
          <i class="fas fa-sign-in-alt"></i> ${canJoin ? 'Join Meeting' : 'Not Started'}
        </button>
      </div>
    `;

    container.appendChild(meetingDiv);
  });
}

window.joinScheduledMeeting = function(roomName) {
  const container = document.getElementById('jaas-container');
  const meetingsList = document.getElementById('meetings-list');

  if (container) container.style.display = 'block';
  if (meetingsList) meetingsList.style.display = 'none';

  initializeJitsiConference(roomName);
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const newValue = value.slice(0, atIndex) + token + value.slice(cursor);
  input.value = newValue;
  const newCursor = atIndex + token.length;
  input.setSelectionRange(newCursor, newCursor);
  input.focus();
  dropdown.style.display = 'none';
}

async function findPendingSurvey(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    try {
      const snapshot = await getDocs(collection(db, 'surveys'));
      const surveys = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(survey => {
          if (survey.active === false) return false;
          const targets = Array.isArray(survey.targetEmails) ? survey.targetEmails.map(normalizeEmail) : [];
          return targets.includes(normalizedEmail) || targets.includes('everyone') || targets.includes('all');
        })
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return timeA - timeB;
        });

      for (const survey of surveys) {
        const responseSnap = await getDoc(doc(db, 'surveys', survey.id, 'responses', normalizedEmail));
        if (!responseSnap.exists()) return survey;
      }
    } catch (error) {
      console.warn('Unable to check required surveys:', error);
    }

    return null;
}

function watchRequiredSurveys(email) {
  if (surveyGateUnsubscribe) surveyGateUnsubscribe();
  surveyGateUnsubscribe = onSnapshot(collection(db, 'surveys'), () => {
    void findPendingSurvey(email).then((pendingSurvey) => {
      if (!pendingSurvey || window.location.pathname.endsWith('survey.html')) return;
      window.location.replace(`survey.html?surveyId=${encodeURIComponent(pendingSurvey.id)}`);
    });
  }, (error) => {
    console.warn('Unable to watch required surveys:', error);
  });
}

function setupMentionAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  input.addEventListener('input', () => updateMentionDropdown(input, dropdown));

  dropdown.addEventListener('click', (event) => {
    const item = event.target.closest('.mention-item');
    if (!item) return;
    const name = item.dataset.name;
    insertMentionAtCursor(input, dropdown, name);
  });

  document.addEventListener('click', (event) => {
    if (!input.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  });
}

async function getNextLiveChatTitle() {
  const snapshot = await getDocs(collection(db, 'liveChats'));
  let maxIndex = 0;
  snapshot.forEach((docSnap) => {
    const title = String(docSnap.data().title || '').trim();
    const match = title.match(/^live\s*chat\s*(\d+)$/i);
    if (match) {
      maxIndex = Math.max(maxIndex, Number(match[1]));
    }
  });
  return `Livechat ${maxIndex + 1}`;
}

async function createLiveChatRoom(event) {
  if (event && event.preventDefault) event.preventDefault();
  let title = await getNextLiveChatTitle();

  const currentEmail = userEmail || await getStoredUserEmail();
  const chatRoom = {
    title,
    createdByEmail: currentEmail,
    createdByName: await getWelcomeName(currentEmail),
    status: 'Active',
    createdAt: Date.now()
  };

  try {
    await addDoc(collection(db, 'liveChats'), chatRoom);
    loadChatRooms();
  } catch (error) {
    console.error('Failed to create live chat room:', error);
    alert('Unable to create chat room. Please try again.');
  }
}

function renderChatRooms(chatRooms) {
  const container = document.getElementById('chatRoomsContainer');
  if (!container) return;

  if (!chatRooms || chatRooms.length === 0) {
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No chat as of the moment.</p>';
    return;
  }

  chatRooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  chatRoomsById = {};
  container.innerHTML = '';

  chatRooms.forEach((room) => {
    chatRoomsById[room.id] = room;
    const roomDiv = document.createElement('div');
    roomDiv.style.cssText = 'border: 1px solid #374151; background: #1e293b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;';
    const createdBy = normalizeEmail(room.createdByEmail) === 'johnpaulbugayong@gmail.com'
      ? 'Admin'
      : (room.createdByName
        ? getFriendlyName(room.createdByName)
        : (getUserName(room.createdByEmail) || 'Unknown'));
    const statusColor = room.status === 'Closed' ? '#ef4444' : '#10b981';
    const isActive = room.status === 'Active';

    roomDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
        <div style="min-width: 0;">
          <h4 style="margin: 0; color: #f8fafc;">${room.title}</h4>
          <p style="margin: 0.5rem 0 0; color: #94a3b8; font-size: 0.9rem;">Created by ${createdBy}</p>
        </div>
        <span style="background: ${statusColor}; color: white; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem;">${room.status || 'Active'}</span>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <button onclick="window.location.href='chat.html?chatId=${room.id}&from=member'" style="background: ${isActive ? '#10b981' : '#6b7280'}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">${isActive ? 'Open Chat' : 'View Chat'}</button>
      </div>
    `;

    container.appendChild(roomDiv);
  });
}

function renderChatMessages(messages) {
  const chatMessagesEl = document.getElementById('chatMessages');
  if (!chatMessagesEl) return;

  if (!messages || messages.length === 0) {
    chatMessagesEl.innerHTML = '<p style="color: #94a3b8; text-align: center; margin: 1rem 0;">No messages yet. Start the conversation!</p>';
    return;
  }

  chatMessagesEl.innerHTML = '';
  messages.forEach((msg) => {
    chatMessagesById[msg.id] = msg;
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'padding: 0.85rem 1rem; border-radius: 10px; margin-bottom: 0.75rem; background: #111827;';
    const sender = msg.senderName || getUserName(msg.senderEmail) || 'Unknown';
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const messageText = msg.deleted ? 'This message was unsent.' : msg.text;
    const safeText = escapeHtml(messageText);
    const renderedText = msg.deleted ? safeText : formatMessageWithMentions(safeText);
    const imageMarkup = !msg.deleted && msg.imageData ? `<div style="margin-bottom: 0.75rem;"><img class="chat-image" src="${msg.imageData}" alt="Sent image" style="width: auto; max-width: 100%; max-height: 280px; border-radius: 14px; object-fit: cover; display: block; cursor: pointer;"/></div>` : '';
    const opacity = msg.deleted ? '0.7' : '1';
    const isOwnMessage = msg.senderEmail === userEmail;
    const replyPreview = msg.replyToId ? `
      <div style="padding: 0.75rem 1rem; margin-bottom: 0.75rem; border-radius: 12px; background: #0f172a; border: 1px solid #374151;">
        <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Replying to ${escapeHtml(msg.replyToSenderName || 'Unknown')}</div>
        <div style="font-size: 0.9rem; color: #e5e7eb; line-height: 1.4; white-space: pre-wrap; word-break: break-word;">${escapeHtml(msg.replyToText || '')}</div>
      </div>
    ` : '';
    const buttonBaseStyle = 'display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(96, 165, 250, 0.12); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;';
    const replyButton = !msg.deleted ? `<button type="button" onclick="setReplyToMessage('${msg.id}')" style="${buttonBaseStyle}">Reply</button>` : '';
    const unsendButton = isOwnMessage && !msg.deleted ? `<button type="button" onclick="unsendChatMessage('${selectedChatId}', '${msg.id}')" style="${buttonBaseStyle}">Unsend</button>` : '';
    const pinButton = !msg.deleted ? `<button type="button" onclick="toggleChatMessagePin('${selectedChatId}', '${msg.id}')" style="${buttonBaseStyle}">${msg.pinned ? 'Unpin' : 'Pin'}</button>` : '';
    const actionButtons = [replyButton, unsendButton, pinButton].filter(Boolean).join('<span style="margin: 0 0.35rem; color: #374151;">|</span>');

    msgDiv.innerHTML = `
      ${replyPreview}
      ${msg.pinned ? '<div style="color: #facc15; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.35rem;">Pinned message</div>' : ''}
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem; opacity: ${opacity};">
        <div style="font-size: 0.85rem; color: #94a3b8;">${escapeHtml(sender)}</div>
        <div style="font-size: 0.75rem; color: #6b7280;">${timestamp}</div>
      </div>
      <div style="color: ${msg.deleted ? '#9ca3af' : '#e5e7eb'}; line-height: 1.6; margin-bottom: 0.5rem; white-space: pre-wrap; word-break: break-word;">${imageMarkup}${renderedText}</div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap; margin-bottom: ${msg.reactions && Object.keys(msg.reactions).length > 0 ? '0.5rem' : '0'};">
        ${actionButtons ? `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${actionButtons}</div>` : ''}
        <button type="button" class="chat-react-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">😊 React</button>
      </div>
      ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #374151;">
          ${Object.entries(msg.reactions).map(([emoji, users]) => `
            <div class="chat-reaction-badge" data-message-id="${msg.id}" data-emoji="${emoji}" data-users='${JSON.stringify(users)}' style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 9999px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s;">
              <span>${emoji}</span>
              <span style="color: #94a3b8;">${users.length}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    chatMessagesEl.appendChild(msgDiv);
  });
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  // Attach click listeners to chat images
  const chatImages = chatMessagesEl.querySelectorAll('.chat-image');
  chatImages.forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      openChatImageFullscreen(this.src);
    });
  });

  // Attach click listeners to reaction buttons
  const reactBtns = chatMessagesEl.querySelectorAll('.chat-react-btn');
  reactBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      showReactionMenu(messageId, e);
    });
  });

  // Attach click listeners to reaction badges to view details
  const reactionBadges = chatMessagesEl.querySelectorAll('.chat-reaction-badge');
  reactionBadges.forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
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
}

function openChatRoom(chatId) {
  window.location.href = `chat.html?chatId=${chatId}&from=member`;
}

function closeChatRoomPanel() {
  const panel = document.getElementById('chatRoomPanel');
  if (panel) {
    panel.style.display = 'none';
    panel.classList.remove('open');
  }

  if (chatMessagesUnsubscribe) {
    chatMessagesUnsubscribe();
    chatMessagesUnsubscribe = null;
  }

  selectedChatId = null;
  clearReplyToMessage();
}

function clearReplyToMessage() {
  replyToMessage = null;
  updateReplyPreview();
}

async function toggleChatMessagePin(chatId, messageId) {
  if (!chatId || !messageId) return;

  const message = chatMessagesById[messageId];
  if (!message) return;

  try {
    await updateDoc(doc(db, 'liveChats', chatId, 'messages', messageId), {
      pinned: !message.pinned,
      pinnedAt: !message.pinned ? Date.now() : null,
      pinnedBy: !message.pinned ? userEmail : null
    });
  } catch (error) {
    console.error('Failed to update chat message pin:', error);
  }
}

function updateReplyPreview() {
  const preview = document.getElementById('chatReplyPreview');
  const input = document.getElementById('chatMessageInput');
  if (!preview || !input) return;

  if (!replyToMessage) {
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }

  const sender = escapeHtml(replyToMessage.senderName || getUserName(replyToMessage.senderEmail) || 'Unknown');
  const text = escapeHtml(replyToMessage.text || 'This message was unsent.');
  preview.style.display = 'flex';
  preview.style.justifyContent = 'space-between';
  preview.style.alignItems = 'center';
  preview.style.gap = '1rem';
  preview.innerHTML = `
    <div style="min-width: 0;">
      <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Replying to ${sender}</div>
      <div style="font-size: 0.9rem; color: #e5e7eb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${text}</div>
    </div>
    <button type="button" onclick="clearReplyToMessage()" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">Cancel</button>
  `;
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
  preview.style.padding = '0.75rem 0.85rem';
  preview.style.borderRadius = '12px';
  preview.style.border = '1px solid #374151';
  preview.style.background = '#0f172a';
  preview.style.color = '#e5e7eb';
  preview.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0; overflow: hidden;">
        <img src="${selectedChatImageData}" alt="Selected image" style="max-width: 72px; max-height: 72px; border-radius: 12px; object-fit: cover;" />
        <div style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(selectedChatImageName || 'Selected image')}</div>
      </div>
      <button type="button" onclick="clearChatImageSelection()" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">Remove</button>
    </div>
  `;
}

function openChatImageFullscreen(imageSrc) {
  let overlay = document.getElementById('chatImageFullscreenOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'chatImageFullscreenOverlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.96); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 1rem; box-sizing: border-box;';
    overlay.onclick = (event) => { if (event.target === overlay) closeChatImageFullscreen(); };
    const img = document.createElement('img');
    img.id = 'chatImageFullscreenOverlayImg';
    img.style.cssText = 'max-width: 100%; max-height: 100%; border-radius: 16px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);';
    const close = document.createElement('button');
    close.type = 'button';
    close.innerText = '×';
    close.style.cssText = 'position: absolute; top: 1rem; right: 1rem; background: rgba(0, 0, 0, 0.55); color: #f8fafc; border: none; border-radius: 9999px; width: 2.5rem; height: 2.5rem; font-size: 1.25rem; cursor: pointer;';
    close.onclick = (event) => { event.stopPropagation(); closeChatImageFullscreen(); };
    overlay.appendChild(img);
    overlay.appendChild(close);
    document.body.appendChild(overlay);
  }
  const img = document.getElementById('chatImageFullscreenOverlayImg');
  if (img) img.src = imageSrc;
  overlay.style.display = 'flex';
}

function closeChatImageFullscreen() {
  const overlay = document.getElementById('chatImageFullscreenOverlay');
  if (overlay) overlay.style.display = 'none';
}

function clearChatImageSelection() {
  selectedChatImageData = null;
  selectedChatImageName = null;
  const input = document.getElementById('chatImageInput');
  if (input) input.value = '';
  updateChatImagePreview();
}

function triggerChatImageInput() {
  const input = document.getElementById('chatImageInput');
  if (input) input.click();
}

function handleChatImageInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    clearChatImageSelection();
    return;
  }

  const fileName = file.name.toLowerCase();
  const isImageByMime = typeof file.type === 'string' && file.type.toLowerCase().startsWith('image/');
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tif', '.tiff', '.heic', '.heif', '.avif', '.jfif'];
  const isImageByExtension = imageExtensions.some(ext => fileName.endsWith(ext));

  if (!isImageByMime && !isImageByExtension) {
    clearChatImageSelection();
    alert('Please select a valid image file.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    clearChatImageSelection();
    alert('Image file is too large. Please select an image smaller than 10 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedChatImageData = reader.result;
    selectedChatImageName = file.name;
    updateChatImagePreview();
  };
  reader.onerror = () => {
    clearChatImageSelection();
    alert('Failed to read the image file.');
  };
  reader.readAsDataURL(file);
}

function setReplyToMessage(messageId) {
  if (!messageId) return;
  const msg = chatMessagesById[messageId];
  if (!msg) return;
  replyToMessage = msg;
  updateReplyPreview();
}

async function subscribeChatMessages(chatId) {
  if (chatMessagesUnsubscribe) {
    chatMessagesUnsubscribe();
  }

  const messagesQuery = query(collection(db, 'liveChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  chatMessagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    const messages = [];
    snapshot.forEach((docSnap) => {
      messages.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderChatMessages(messages);
  }, (error) => {
    console.error('Chat messages listener error:', error);
  });
}

async function sendChatMessage(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!selectedChatId) return;

  const messageInput = document.getElementById('chatMessageInput');
  if (!messageInput) return;
  const message = messageInput.value.trim();
  if (!message && !selectedChatImageData) return;

  const currentEmail = userEmail || await getStoredUserEmail();
  const messageData = {
    senderEmail: currentEmail,
    senderName: await getWelcomeName(currentEmail),
    text: message || '',
    createdAt: Date.now(),
    deleted: false
  };

  if (selectedChatImageData) {
    messageData.imageData = selectedChatImageData;
    if (selectedChatImageName) {
      messageData.imageName = selectedChatImageName;
    }
  }

  if (replyToMessage) {
    messageData.replyToId = replyToMessage.id;
    messageData.replyToSenderName = replyToMessage.senderName || getUserName(replyToMessage.senderEmail);
    messageData.replyToText = replyToMessage.text || 'This message was unsent.';
    messageData.replyToCreatedAt = replyToMessage.createdAt || null;
  }

  try {
    await addDoc(collection(db, 'liveChats', selectedChatId, 'messages'), messageData);
    messageInput.value = '';
    clearChatImageSelection();
    clearReplyToMessage();
  } catch (error) {
    console.error('Failed to send chat message:', error);
    alert('Unable to send message. Please try again.');
  }
}

async function unsendChatMessage(chatId, messageId) {
  if (!chatId || !messageId || !userEmail) return;

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

function showReactionDetails(emoji, users) {
  let modal = document.getElementById('reactionDetailsModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'reactionDetailsModal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 1rem; box-sizing: border-box;';

  const content = document.createElement('div');
  content.style.cssText = 'background: #111827; border: 1px solid #374151; border-radius: 16px; padding: 2rem; max-width: 400px; width: 100%; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);';

  content.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem; text-align: center;">${emoji}</div>
      <div style="text-align: center; color: #94a3b8; font-size: 0.9rem;">${users.length} ${users.length === 1 ? 'person reacted' : 'people reacted'}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; max-height: 300px; overflow-y: auto;">
      ${users.map(email => `
        <div style="padding: 0.75rem; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 8px; color: #e5e7eb; font-size: 0.9rem;">
          ${escapeHtml(getUserName(email) || email)}
        </div>
      `).join('')}
    </div>
    <button type="button" onclick="document.getElementById('reactionDetailsModal').remove();" style="width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">Close</button>
  `;

  modal.appendChild(content);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
}

function showReactionMenu(messageId, event) {
  const emojis = [
    { emoji: '😂', name: 'laughing' },
    { emoji: '😠', name: 'mad' },
    { emoji: '😢', name: 'sad' },
    { emoji: '❤️', name: 'love' }
  ];

  let menu = document.getElementById('reactionMenu');
  if (menu) menu.remove();

  menu = document.createElement('div');
  menu.id = 'reactionMenu';
  menu.style.cssText = 'position: fixed; background: #111827; border: 1px solid #374151; border-radius: 9999px; display: flex; gap: 0.5rem; padding: 0.5rem; z-index: 50000; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);';

  emojis.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.emoji;
    btn.style.cssText = 'background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); color: #e5e7eb; padding: 0.5rem 0.75rem; border-radius: 9999px; cursor: pointer; font-size: 1.2rem; transition: all 0.15s;';
    btn.onmouseover = () => btn.style.background = 'rgba(96, 165, 250, 0.2)';
    btn.onmouseout = () => btn.style.background = 'rgba(96, 165, 250, 0.1)';
    btn.onclick = () => {
      toggleMessageReaction(messageId, item.emoji);
      menu.remove();
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const rect = event.target.getBoundingClientRect();
  menu.style.left = (rect.left + rect.width / 2 - menu.offsetWidth / 2) + 'px';
  menu.style.top = (rect.top - menu.offsetHeight - 10) + 'px';

  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target) && e.target !== event.target) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  });
}

async function toggleMessageReaction(messageId, emoji) {
  if (!selectedChatId || !messageId || !userEmail) return;

  const messageRef = doc(db, 'liveChats', selectedChatId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);
  if (!messageSnap.exists()) return;

  const reactions = messageSnap.data().reactions || {};
  const currentUserEmail = userEmail;

  if (!reactions[emoji]) {
    reactions[emoji] = [];
  }

  const userIndex = reactions[emoji].indexOf(currentUserEmail);
  if (userIndex > -1) {
    reactions[emoji].splice(userIndex, 1);
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
  } else {
    reactions[emoji].push(currentUserEmail);
  }

  try {
    await updateDoc(messageRef, { reactions });
  } catch (error) {
    console.error('Failed to update reaction:', error);
  }
}

function loadChatRooms() {
  if (chatRoomsUnsubscribe) {
    chatRoomsUnsubscribe();
  }

  chatRoomsUnsubscribe = onSnapshot(collection(db, 'liveChats'), (snapshot) => {
    const rooms = [];
    snapshot.forEach((docSnap) => {
      rooms.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderChatRooms(rooms);
  }, (error) => {
    console.error('Live chat rooms listener error:', error);
  });
}

window.createLiveChatRoom = createLiveChatRoom;
window.loadChatRooms = loadChatRooms;
window.openChatRoom = openChatRoom;
window.closeChatRoomPanel = closeChatRoomPanel;
window.setReplyToMessage = setReplyToMessage;
window.unsendChatMessage = unsendChatMessage;
window.toggleChatMessagePin = toggleChatMessagePin;
window.sendChatMessage = sendChatMessage;
window.triggerChatImageInput = triggerChatImageInput;
window.handleChatImageInputChange = handleChatImageInputChange;
window.clearChatImageSelection = clearChatImageSelection;

async function enforcePasswordChangeIfNeeded() {
  if (!userEmail) return false;

  try {
    const requiresChange = await getPasswordChangeRequired(userEmail);
    if (!requiresChange) return false;

    const currentPassword = await getAccountPasswordHint(userEmail);
    const message = currentPassword
      ? `For your security, please change your password before continuing. Your current password is: ${currentPassword}`
      : 'For your security, please change your password before continuing.';

    const newPassword = window.prompt(`${message}\n\nEnter a new password (at least 6 characters):`);
    if (!newPassword) {
      window.alert('A new password is required before continuing.');
      return true;
    }

    const confirmPassword = window.prompt('Please confirm your new password:');
    if (!confirmPassword) {
      window.alert('Password confirmation is required.');
      return true;
    }

    if (newPassword !== confirmPassword) {
      window.alert('The new passwords do not match.');
      return true;
    }

    await updateAccountPassword(userEmail, newPassword);
    const storedUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    storedUser.passwordChangeRequired = false;
    localStorage.setItem('authUser', JSON.stringify(storedUser));
    window.alert('Password updated successfully.');
    return false;
  } catch (error) {
    console.error('Unable to enforce password change:', error);
    window.alert('Unable to update your password right now. Please try again.');
    return true;
  }
}

// Attach the chat form handler after DOM is ready
const createChatFormElement = document.getElementById('createChatForm');
if (createChatFormElement) {
  createChatFormElement.addEventListener('submit', createLiveChatRoom);
}
const chatMessageFormElement = document.getElementById('chatMessageForm');
if (chatMessageFormElement) {
  chatMessageFormElement.addEventListener('submit', sendChatMessage);
}

setupMentionAutocomplete('chatMessageInput', 'memberMentionDropdown');

// No scheduling controls on member page


(async () => {
  console.log('=== MEMBER.JS INITIALIZATION STARTED ===');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }
  
  // Retry getting userEmail if first attempt fails (to handle timing issues)
  let retries = 0;
  console.log('Starting to retrieve userEmail...');
  while (!userEmail && retries < 10) {
    console.log(`Attempt ${retries + 1} to get userEmail`);
    userEmail = await getStoredUserEmail();
    console.log(`Attempt ${retries + 1} result: userEmail =`, userEmail);
    if (!userEmail) {
      retries++;
      if (retries < 10) {
        console.log(`Retrying in 500ms (retry ${retries}/10)...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  console.log('=== FINAL USER EMAIL ===', userEmail);

  if (!userEmail) {
    console.log('No userEmail found after retries, showing login message');
    container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">Please log in to view your tasks.</p>';
    if (emptyState) emptyState.style.display = "none";
    if (welcomeEl) welcomeEl.style.display = "none";
  } else {
    await loadMemberGradientTheme(userEmail);
    watchRequiredSurveys(userEmail);
    const pendingSurvey = await findPendingSurvey(userEmail);
    if (pendingSurvey) {
      const surveyUrl = `survey.html?surveyId=${encodeURIComponent(pendingSurvey.id)}`;
      window.location.replace(surveyUrl);
      return;
    }

    const requiresPasswordChange = await enforcePasswordChangeIfNeeded();
    if (requiresPasswordChange) {
      console.log('Password change required; stopping member dashboard initialization.');
      return;
    }
    console.log('User authenticated, setting up dashboard for:', userEmail);
    if (!auth.currentUser) {
      console.log('Auth not ready, signing in anonymously...');
      await signInAnonymously(auth);
      console.log('Auth ready');
    }
    if (welcomeEl) {
      const welcomeName = await getWelcomeName(userEmail);
      welcomeEl.textContent = `Welcome, ${welcomeName}`;
    }
    await displayMemberProfilePicture(userEmail);
    console.log('User logged in as:', userEmail);
    console.log('Starting to load data from Firestore...');
    
    // Initialize notifications
    initializeNotifications();

    watchMemberAccessState();
    watchMemberWallet();
    loadTicketHistory();
    startMemberPresenceHeartbeat();
    void refreshMentionMembers();
    subscribeToMemberRoster();
    subscribeToMemberStatuses();
    // Start periodic polling of userRoles from Firestore every 2 minutes
    startMemberStatusPolling(120000);

    const storedUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    applyRestrictedMemberView(storedUser.accessAllowed !== false, storedUser.accessReason || '');

    if (window.__restrictedMemberMode) {
      if (typeof window.showSection === 'function') {
        window.showSection('submit-ticket');
      }
    }
    
    // Update date and time every second
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Load meetings
    loadMeetings();
    
    // Load tasks
    console.log('Setting up tasks listener...');
    onSnapshot(collection(db, "tasks"), (snap) => {
      console.log('Tasks snapshot received, docs count:', snap.size);
      container.innerHTML = "";
      let taskCount = 0;
      let hiddenDoneCount = 0;
      const deadlineWarnings = [];

      const docs = [];
      snap.forEach(doc => docs.push(doc));
      // Sort tasks: high-priority statuses (pending, overdue, needs action, pending validation) first,
      // then others, with 'done'/'completed' at the bottom. Within same priority, newest first.
      function statusPriority(status) {
        const s = String(status || '').toLowerCase().trim();
        if (s === 'done' || s === 'completed') return 2;
        if (s === 'pending' || s === 'overdue' || s === 'needs action' || s === 'needs_action' || s === 'pending validation' || s === 'pending_validation') return 0;
        return 1;
      }
      function createdAtMillis(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (val && typeof val.toMillis === 'function') return val.toMillis();
        const parsed = Date.parse(String(val));
        return isNaN(parsed) ? 0 : parsed;
      }

      docs.sort((a, b) => {
        const ta = a.data();
        const tb = b.data();
        const pa = statusPriority(ta.status);
        const pb = statusPriority(tb.status);
        if (pa !== pb) return pa - pb;
        const ca = createdAtMillis(ta.createdAt);
        const cb = createdAtMillis(tb.createdAt);
        return cb - ca;
      });

      const activeTasks = [];
      const completedTasks = [];

      docs.forEach(doc => {
        const t = doc.data();
        console.log('Processing task:', t.title, 'assigned to:', t.assignedTo, 'current user:', userEmail);
        if (t.assignedTo !== "everyone" && t.assignedTo !== userEmail) return;

        const status = String(t.status || '').toLowerCase().trim();
        const isDoneStatus = status === 'done' || status === 'completed';

        const previousTask = previousTaskMap.get(doc.id);
        const taskUpdated = previousTask && previousTask.status !== t.status;
        const feedbackUpdated = previousTask && Array.isArray(t.feedbacks) && Array.isArray(previousTask.feedbacks) && t.feedbacks.length > previousTask.feedbacks.length;
        const taskCreated = !previousTask;

        if (taskNotificationsInitialized && taskCreated) {
          showAdminUpdateNotification('New Task Assigned', `A new task has been assigned: "${t.title}"`);
        }

        if (taskNotificationsInitialized && taskUpdated) {
          showAdminUpdateNotification('Task Status Updated', `Task "${t.title}" status changed to ${t.status}.`);
        }

        if (taskNotificationsInitialized && feedbackUpdated) {
          showAdminUpdateNotification('New Task Feedback', `New feedback was added for task: "${t.title}"`);
        }

        previousTaskMap.set(doc.id, t);

        const warning = getDeadlineWarning(t.deadline, t.status);
        const taskHtml = `
          <div class="task-item ${warning.class} ${t.status === "needs action" ? "task-needs-action" : ""}">
            <div class="task-header">
              <h3 class="task-title">${t.title}</h3>
              <span class="task-status ${t.status === "done" ? "status-completed" : t.status === "pending validation" ? "status-validation" : t.status === "needs action" ? "status-needs-action" : "status-pending"}">${t.status === "needs action" ? "Needs Action" : t.status}</span>
              ${warning.message ? `<span class="task-warning">${warning.message}</span>` : ""}
            </div>
            ${t.description ? `<p style="color: #cbd5e1; margin: 0.75rem 0; white-space: pre-wrap; word-break: break-word;">${t.description}</p>` : ""}
            ${t.status === "needs action" ? `<p style="color: #f59e0b; margin: 0.5rem 0; font-weight: bold;">⚠️ This task needs your immediate action from the admin.</p>` : ""}
            <div class="task-meta">
              <span>📅 ${t.deadline}</span>
            </div>
            ${t.linkURL ? `<a href="${t.linkURL}" target="_blank" style="display: inline-block; margin-top: 0.5rem;">🔗 Open Link</a>` : ""}
            ${t.status === "pending" || t.status === "needs action" ? `<button onclick="markDone('${doc.id}')" class="btn-submit">Already Submitted</button>` : ""}
            <div style="margin-top:0.75rem;">
              <h4 style="margin:0 0 0.5rem 0; color:#f3f4f6;">Feedback</h4>
              <div id="member-feedback-list-${doc.id}">
                ${Array.isArray(t.feedbacks) && t.feedbacks.length > 0 ? t.feedbacks.map(f => {
                  const time = f.createdAt && f.createdAt.toDate ? f.createdAt.toDate().toLocaleString() : (f.createdAt ? new Date(f.createdAt).toLocaleString() : '');
                  const authorName = getUserName(f.author) || 'Admin';
                  return `<div style="padding:0.5rem; border:1px solid #334155; border-radius:6px; margin-bottom:0.5rem; background:#041024;"><div style="font-weight:600; color:#f3f4f6;">${authorName} <span style="font-weight:400; color:#94a3b8; font-size:0.85rem; margin-left:0.5rem;">${time}</span></div><div style="color:#cbd5e1; margin-top:0.25rem; white-space: pre-wrap; word-break: break-word;">${f.message}</div></div>`;
                }).join('') : '<p style="color:#94a3b8;">No feedback yet.</p>'}
              </div>
            </div>
          </div>
        `;

        if (isDoneStatus) {
          hiddenDoneCount++;
          completedTasks.push(taskHtml);
        } else {
          activeTasks.push(taskHtml);
          taskCount++;
          if (warning.message) {
            deadlineWarnings.push({
              id: doc.id,
              title: t.title,
              deadline: t.deadline,
              status: warning.message
            });
          }
        }
      });

      if (deadlineWarnings.length > 0) {
        const newDeadlineWarnings = deadlineWarnings.filter(warning => !shownDeadlineTaskIds.has(warning.id));
        if (newDeadlineWarnings.length > 0) {
          showTaskDeadlineModal(newDeadlineWarnings);
          newDeadlineWarnings.forEach(warning => shownDeadlineTaskIds.add(warning.id));
        }
      }

      if (completedTasks.length > 0) {
        if (completedTasksSection) {
          completedTasksSection.style.display = '';
        }
        if (completedTasksToggleBtn) {
          completedTasksToggleBtn.textContent = completedTasksCollapsed
            ? `Show completed tasks (${completedTasks.length})`
            : `Hide completed tasks (${completedTasks.length})`;
        }
        if (completedTasksList) {
          completedTasksList.innerHTML = completedTasks.join('');
          completedTasksList.style.display = completedTasksCollapsed ? 'none' : 'block';
        }
      } else {
        if (completedTasksSection) {
          completedTasksSection.style.display = 'none';
        }
      }

      container.innerHTML = activeTasks.join('');
      if (emptyState) {
        emptyState.style.display = taskCount === 0 ? "block" : "none";
      }

      if (taskCount === 0 && !emptyState) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">No tasks assigned yet. Check back soon!</p>';
      }

      refreshHomeDashboard();
    }, (error) => {
      console.error('Tasks onSnapshot error:', error);
    });
    
    // Load polls, announcements, and in-app notifications
    loadPolls();
    loadAnnouncements();
    loadHomeDashboard();
    loadInAppNotifications();
    checkMaintenance();
    loadProgressReport();
    loadResources();

    // Always ensure chat room list stays synced after refresh
    loadChatRooms();
  }
  
  // Ensure the ticket history section exists in the DOM
  ensureTicketHistorySection();

  // Always load ticket history (it handles authentication internally)
  loadTicketHistory();
})();

console.log('=== MEMBER.JS FILE LOADED - CHECKING TICKET HISTORY ===');
console.log('userEmail at module level:', userEmail);
console.log('DOM ready state:', document.readyState);

function ensureTicketHistorySection() {
  if (document.getElementById("ticketHistory")) return;

  const pageContainer = document.querySelector(".container");
  if (!pageContainer) return;

  const ticketCard = document.createElement("div");
  ticketCard.className = "card";
  ticketCard.style.marginTop = "2rem";
  ticketCard.innerHTML = `
    <h2 style="margin-bottom: 1rem;">🎟️ Ticket History</h2>
    <div style="margin-bottom: 1rem;">
      <button onclick="loadTicketHistory()" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">Refresh Tickets</button>
    </div>
    <div id="ticketHistory"></div>
    <p id="ticketHistoryEmptyState" style="text-align: center; color: #94a3b8; padding: 2rem;">
      No ticket history yet. Submit a ticket above and check back for updates.
    </p>
  `;

  const submitCard = document.getElementById("ticketTitle")?.closest(".card");
  if (submitCard && submitCard.parentNode) {
    submitCard.parentNode.insertBefore(ticketCard, submitCard);
  } else {
    pageContainer.appendChild(ticketCard);
  }
}

function renderSubmittedTicketImmediately(ticketId, ticket) {
  const container = document.getElementById('ticketHistory');
  const emptyState = document.getElementById('ticketHistoryEmptyState');
  if (!container) return;
  optimisticTicketHistory.set(ticketId, ticket);

  const ticketElement = document.createElement('div');
  ticketElement.dataset.ticketId = ticketId;
  ticketElement.style.cssText = 'margin-bottom:1rem; padding:1rem; border:1px solid #374151; border-radius:0.5rem; background:#1e293b;';
  ticketElement.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <h4 style="margin:0; color:#f3f4f6;">${escapeHtml(ticket.title)}</h4>
      <span style="padding:0.25rem 0.5rem; border-radius:0.25rem; font-size:0.8rem; font-weight:600; background:#ef4444; color:white;">Open</span>
    </div>
    <p style="margin:0 0 0.5rem; color:#94a3b8; font-size:0.8rem;">Assigned: ${new Date().toLocaleDateString()}</p>
    <p style="margin:0 0 0.5rem; color:#d1d5db; white-space:pre-wrap; word-break:break-word;">${escapeHtml(ticket.description)}</p>
    <div style="padding:0.5rem; background:#0f172a; border-radius:0.25rem;">
      <h5 style="margin:0 0 0.5rem; color:#f3f4f6; font-size:0.9rem;">Admin Feedback</h5>
      <p style="color:#9ca3af; margin:0;">No admin feedback yet.</p>
    </div>`;
  container.prepend(ticketElement);
  if (emptyState) emptyState.style.display = 'none';
}

function loadTicketHistory(containerId = "ticketHistory", emptyStateId = "ticketHistoryEmptyState", forceRefresh = false) {
  console.log('=== loadTicketHistory CALLED - STARTING ===', containerId, emptyStateId);

  const container = document.getElementById(containerId);
  const emptyState = document.getElementById(emptyStateId);
  const ticketCard = container?.closest('.card');

  if (!container) {
    console.log('=== TICKET HISTORY CONTAINER NOT FOUND ===');
    return;
  }

  if (ticketCard) {
    ticketCard.style.display = "block";
  }

  console.log('Container found, userEmail:', userEmail);

  if (!userEmail) {
    if (emptyState) emptyState.style.display = "block";
    container.innerHTML = '<p style="color:#94a3b8; text-align:center;">Loading your ticket history...</p>';
    return;
  }

  if (forceRefresh && ticketHistoryUnsubscribe) {
    ticketHistoryUnsubscribe();
    ticketHistoryUnsubscribe = null;
  }
  if (ticketHistoryUnsubscribe) return;

  if (emptyState) emptyState.style.display = "none";
  ticketHistoryUnsubscribe = onSnapshot(collection(db, "tickets"), (snapshot) => {
        console.log('=== TICKETS SNAPSHOT RECEIVED ===');
        console.log('Found', snapshot.size, 'tickets');
      let ticketHtml = '';
      let ticketCount = 0;

      // Collect all tickets first
      const docs = [];
      snapshot.forEach(doc => docs.push(doc));
      const snapshotIds = new Set(docs.map(ticketDoc => ticketDoc.id));
      optimisticTicketHistory.forEach((ticket, ticketId) => {
        if (snapshotIds.has(ticketId)) {
          optimisticTicketHistory.delete(ticketId);
          return;
        }
        docs.push({ id: ticketId, data: () => ticket });
      });
      
      // Sort by createdAt descending (newest first)
      docs.sort((a, b) => {
        const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
        const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
        return timeB - timeA;
      });

      docs.forEach(doc => {
        const ticket = doc.data();
        console.log('Processing ticket:', ticket);

        const currentEmail = normalizeEmail(userEmail);
        if (!ticketMatchesMember(ticket, currentEmail)) {
          console.log('Skipping ticket - not submitted by or assigned to current user');
          return;
        }

        const previousTicket = previousTicketMap.get(doc.id);
        ticketCount++;

        if (ticketNotificationsInitialized && !previousTicket) {
          const recipientEmail = ticket.assignedTo || ticket.submittedBy;
          const shouldNotify = normalizeEmail(recipientEmail) === normalizeEmail(userEmail);
          if (shouldNotify) {
            showAdminUpdateNotification('Ticket Created', `A new ticket has been created: "${ticket.title}"`);
          }
        }
        previousTicketMap.set(doc.id, ticket);

        const createdDate = ticket.createdAt?.toDate?.() ? ticket.createdAt.toDate().toLocaleDateString() : "Unknown date";
        const status = ticket.status || "open";
        const statusLabel = status === "pending validation" ? "Pending Validation" : status.charAt(0).toUpperCase() + status.slice(1);

        const responses = Array.isArray(ticket.responses) ? ticket.responses : [];
        const responseHtml = responses.length > 0 ?
          responses.map(response => `
            <div style="margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid #4b5563; border-radius: 0.25rem; background: #1f2937;">
              <strong>${response.author || 'Admin'}:</strong> <span style="white-space: pre-wrap; word-break: break-word;">${response.content}</span>
            </div>
          `).join('') : '<p style="color: #9ca3af; margin: 0;">No admin feedback yet.</p>';

        ticketHtml += `
          <div style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1e293b;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; color: #f3f4f6;">${ticket.title}</h4>
              <span style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; font-weight: 600; background: ${status === 'open' ? '#ef4444' : status === 'pending validation' ? '#f59e0b' : '#10b981'}; color: white;">${statusLabel}</span>
            </div>
            <p style="margin: 0 0 0.5rem 0; color: #94a3b8; font-size: 0.8rem;">Assigned: ${createdDate}</p>
            <p style="margin: 0 0 0.5rem 0; color: #d1d5db; white-space: pre-wrap; word-break: break-word;">${ticket.description}</p>
            <div style="padding: 0.5rem; background: #0f172a; border-radius: 0.25rem;">
              <h5 style="margin: 0 0 0.5rem 0; color: #f3f4f6; font-size: 0.9rem;">Admin Feedback</h5>
              ${responseHtml}
            </div>
          </div>
        `;
      });

      if (ticketCount > 0) {
        container.innerHTML = ticketHtml;
      } else {
        // Keep the static message if no tickets
        container.innerHTML = '<div style="padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1e293b; margin-bottom: 1rem;"><h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">Ticket History Section</h4><p style="margin: 0; color: #d1d5db;">No tickets found.</p></div>';
      }
      if (emptyState) emptyState.style.display = ticketCount > 0 ? "none" : "block";
      ticketNotificationsInitialized = true;
    }, (error) => {
      console.error('Error loading tickets:', error);
      if (emptyState) emptyState.style.display = "block";
      container.innerHTML = '<p style="color:#f87171; text-align:center;">Unable to load ticket history right now. Please try again.</p>';
    });
}

window.toggleCompletedTasks = function() {
  completedTasksCollapsed = !completedTasksCollapsed;
  if (!completedTasksToggleBtn || !completedTasksList) return;

  const completedCount = completedTasksList.children.length;
  completedTasksToggleBtn.textContent = completedTasksCollapsed
    ? `Show completed tasks (${completedCount})`
    : `Hide completed tasks (${completedCount})`;
  completedTasksList.style.display = completedTasksCollapsed ? 'none' : 'block';
  localStorage.setItem('completedTasksCollapsed', completedTasksCollapsed ? 'true' : 'false');
};

window.toggleArchivedPolls = function() {
  archivedPollsCollapsed = !archivedPollsCollapsed;
  const archiveContent = document.getElementById('archivedPollsContent');
  const archiveButtons = document.querySelectorAll('button[onclick="toggleArchivedPolls()"]');

  if (archiveContent) {
    archiveContent.style.display = archivedPollsCollapsed ? 'none' : 'block';
  }

  archiveButtons.forEach(button => {
    button.textContent = `${archivedPollsCollapsed ? 'Show Archived Polls' : 'Hide Archived Polls'}`;
  });

  localStorage.setItem('archivedPollsCollapsed', archivedPollsCollapsed ? 'true' : 'false');
};

window.toggleArchivedAnnouncements = function() {
  archivedAnnouncementsCollapsed = !archivedAnnouncementsCollapsed;
  const archiveContent = document.getElementById('archivedAnnouncementsContent');
  const archiveButtons = document.querySelectorAll('button[onclick="toggleArchivedAnnouncements()"]');

  if (archiveContent) archiveContent.style.display = archivedAnnouncementsCollapsed ? 'none' : 'block';
  archiveButtons.forEach(button => {
    const count = button.textContent.match(/\((\d+)\)/)?.[1] || '0';
    button.textContent = `${archivedAnnouncementsCollapsed ? 'Show' : 'Hide'} (${count})`;
  });
  localStorage.setItem('archivedAnnouncementsCollapsed', archivedAnnouncementsCollapsed ? 'true' : 'false');
};

// Make loadTicketHistory available globally
window.loadTicketHistory = loadTicketHistory;


