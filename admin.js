// Push Notifications Manager for cross-platform compatibility
class PushNotificationsManager {
  constructor() {
    this.isCapacitor = false;
    this.pushNotifications = null;
    this.initialized = false;

    // Check for Capacitor more reliably
    this.checkCapacitorAvailability();
  }

  async checkCapacitorAvailability() {
    // Wait a bit for Capacitor to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    this.isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    if (this.isCapacitor) {
      try {
        const module = await import('@capacitor/push-notifications');
        this.pushNotifications = module.PushNotifications;
        console.log('Capacitor PushNotifications loaded successfully');
      } catch (err) {
        console.warn('Capacitor PushNotifications not available:', err);
        this.isCapacitor = false;
      }
    } else {
      console.log('Running in browser, push notifications disabled');
    }

    this.initialized = true;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.checkCapacitorAvailability();
    }
  }

  async requestPermissions() {
    await this.ensureInitialized();

    if (this.isCapacitor && this.pushNotifications) {
      try {
        return await this.pushNotifications.requestPermissions();
      } catch (error) {
        console.error('Error requesting push notification permissions:', error);
        return { granted: false };
      }
    }
    return { granted: false };
  }

  async register() {
    await this.ensureInitialized();

    if (this.isCapacitor && this.pushNotifications) {
      try {
        return await this.pushNotifications.register();
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    }
  }

  addListener(event, callback) {
    if (this.isCapacitor && this.pushNotifications) {
      try {
        return this.pushNotifications.addListener(event, callback);
      } catch (error) {
        console.error('Error adding push notification listener:', error);
      }
    }
  }
}

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  arrayUnion,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { signOutUser, getStoredUserEmail, getStoredUserRole } from "./auth.js";
import { sendNotificationToUsers, showLocalNotification, initializeNotifications } from "./notifications.js";

window.signOutUser = signOutUser;

const pushNotificationsManager = new PushNotificationsManager();

let chart;
let chartUpdateTimeout;
let lastMemberProgress = {};
let lastAnalyticsTasks = [];

function parseDeadline(value) {
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

window.lastMemberProgress = lastMemberProgress;
window.lastAnalyticsTasks = lastAnalyticsTasks;

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";
const progressStatuses = ["Not Started", "Pending", "Completed"];

let members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "test@example.com", name: "Test User" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" },
  { uid: "johnpaulbugayong@gmail.com", name: "Admin" }
];

const mentionUsers = [
  ...members.filter(member => member.uid !== 'everyone'),
  { uid: 'johnpaulbugayong@gmail.com', name: 'Admin' }
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getUserName(email) {
  const normalized = normalizeEmail(email);
  const member = members.find(m => normalizeEmail(m.uid) === normalized);
  return member ? member.name : email;
}

let adminEmail = null;
let adminRole = null;
let liveChatRoomsUnsubscribe = null;
let liveChatMessagesUnsubscribe = null;
let selectedLiveChatId = null;
let liveChatRoomsById = {};
let adminChatMessagesById = {};
let adminReplyToMessage = null;
let selectedAdminChatImageData = null;
let selectedAdminChatImageName = null;

(async () => {
  // Retry getting admin credentials if first attempt fails (to handle timing issues)
  adminEmail = await getStoredUserEmail();
  adminRole = await getStoredUserRole();
  let retries = 0;
  
  while ((!adminEmail || !adminRole) && retries < 5) {
    if (!adminEmail) adminEmail = await getStoredUserEmail();
    if (!adminRole) adminRole = await getStoredUserRole();
    if (!adminEmail || !adminRole) {
      retries++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

function getDefaultProgressStructure() {
  return [
    {
      title: "Front Matter",
      items: [
        { name: "Title Page", status: "Not Started" },
        { name: "Approval Sheet", status: "Not Started" },
        { name: "Abstract", status: "Not Started" },
        { name: "Acknowledgement", status: "Not Started" },
        { name: "Table of Contents", status: "Not Started" },
        { name: "List of Tables (if applicable)", status: "Not Started" },
        { name: "List of Figures (if applicable)", status: "Not Started" }
      ]
    },
    {
    title: "Chapter 1 – Introduction",
      items: [
        { name: "Introduction", status: "Not Started" },
        { name: "Background of the Study", status: "Not Started" },
        { name: "Theoretical Framework", status: "Not Started" },
        { name: "Conceptual Framework", status: "Not Started" },
        { name: "Statement of the Problem", status: "Not Started" },
        { name: "Objectives of the Study", status: "Not Started" },
        { name: "Hypothesis of the Study", status: "Not Started" },  
        { name: "Scope and limitation", status: "Not Started" },
        { name: "Significance of the Study", status: "Not Started" },
        { name: "Definition of Terms", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 2 – Review of Related Literature (RRL)",
      items: [
        { name: "Introduction", status: "Not Started" },
        { name: "Thematic Arrangement of Articles (RRL MINIMUM OF 30 ARTICLES)", status: "Not Started" },
        { name: "Research Gaps", status: "Not Started" },
        { name: "Synthesis", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 3 – Methodology",
      items: [
        { name: "Introduction", status: "Not Started" },
        { name: "Research design", status: "Not Started" },
        { name: "System and Prototype Design", status: "Not Started" },
        { name: "Material and Instrument", status: "Not Started" },
        { name: "Locale and Population of Research", status: "Not Started" },
        { name: "Statistical treatment of Research", status: "Not Started" },
        { name: "Cost Benefit Analysis", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 4 – Results and Discussion",
      items: [
        { name: "Presentation of data", status: "Not Started" },
        { name: "Analysis and interpretation", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 5 – Conclusion and Recommendations",
      items: [
        { name: "Summary of findings", status: "Not Started" },
        { name: "Conclusion", status: "Not Started" },
        { name: "Recommendations", status: "Not Started" }
      ]
    },
    {
      title: "Back Matter",
      items: [
        { name: "References / Bibliography", status: "Not Started" },
        { name: "Appendices (survey forms, codes, drawings, etc.)", status: "Not Started" }
      ]
    }
  ];
}

function renderAdminProgressReport(sections) {
  console.log('=== RENDER ADMIN PROGRESS REPORT CALLED ===');
  console.log('Sections to render:', sections);
  const container = document.getElementById("progressReportPanel");
  console.log('Progress report panel element:', container);

  if (!container) {
    console.error('Progress report panel not found!');
    return;
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    console.log('No sections to render');
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No progress report data yet.</p>';
    return;
  }

  console.log('Rendering', sections.length, 'sections');
  container.innerHTML = sections.map((section, sectionIndex) => `
    <div style="margin-bottom: 1.25rem;">
      <h3 style="margin: 0 0 0.75rem 0; color: #0ea5e9;">${section.title}</h3>
      ${Array.isArray(section.items) ? section.items.map((item, itemIndex) => {
        const assignedToValue = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
        return `
          <div style="display: grid; gap: 0.75rem; margin-bottom: 0.65rem; padding: 0.75rem; background: #111827; border: 1px solid #374151; border-radius: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <span style="color: #d1d5db;">${item.name}</span>
              <select id="progress-${sectionIndex}-${itemIndex}" style="background: #0f172a; color: #f8fafc; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 0.25rem 0.5rem; font-size: 0.875rem;">
                <option value="Not Started" ${item.status === 'Not Started' || !item.status ? 'selected' : ''}>Not Started</option>
                <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Completed" ${item.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
              <label style="color: #cbd5e1; font-size: 0.9rem; min-width: 120px;">Assign to:</label>
              <select id="assignedTo-${sectionIndex}-${itemIndex}" multiple style="background: #0f172a; color: #f8fafc; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 0.45rem 0.6rem; min-width: 180px; min-height: 40px;">
                <option value="" ${Array.isArray(assignedToValue) ? (!assignedToValue.includes('') && assignedToValue.length === 0) : assignedToValue === '' ? 'selected' : ''}>Unassigned</option>
                ${members.filter(member => member.uid !== 'everyone').map(member => `
                  <option value="${member.uid}" ${Array.isArray(assignedToValue) ? (assignedToValue.includes(member.uid) ? 'selected' : '') : (member.uid === assignedToValue ? 'selected' : '')}>${member.name}</option>
                `).join('')}
              </select>
            </div>
          </div>
        `;
      }).join('') : ''}
    </div>
  `).join('');
}

function getProgressFormValues() {
  const defaultSections = getDefaultProgressStructure();
  return defaultSections.map((section, sectionIndex) => ({
    title: section.title,
    items: section.items.map((item, itemIndex) => {
      const statusSelect = document.getElementById(`progress-${sectionIndex}-${itemIndex}`);
      const assignedSelect = document.getElementById(`assignedTo-${sectionIndex}-${itemIndex}`);
      const assignedTo = assignedSelect ? Array.from(assignedSelect.selectedOptions).map(option => option.value).filter(v => v !== '') : (Array.isArray(item.assignedTo) ? item.assignedTo : []);
      const assignedToName = assignedSelect ? Array.from(assignedSelect.selectedOptions).map(option => members.find(m => m.uid === option.value)?.name).filter(Boolean) : (Array.isArray(item.assignedToName) ? item.assignedToName : []);
      return {
        name: item.name,
        status: statusSelect ? statusSelect.value : item.status,
        assignedTo,
        assignedToName
      };
    })
  }));
}

window.saveProgressReport = async function() {
  try {
    const sections = getProgressFormValues();
    await setDoc(doc(db, progressReportCollection, progressReportDocId), { sections }, { merge: true });
    alert("Thesis progress saved successfully!");
  } catch (error) {
    console.error("Error saving progress report:", error);
    alert("Failed to save thesis progress. Please try again.");
  }
};

function loadMembers() {
  const select = document.getElementById("assignedTo");
  select.innerHTML = "";

  members.forEach(m => {
    select.innerHTML += `<option value="${m.uid}">${m.name}</option>`;
  });
}

function loadAnnouncementAssignTo() {
  const container = document.getElementById("announcementAssignTo");
  container.innerHTML = "";

  members.forEach(m => {
    container.innerHTML += `
      <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.9rem;">
        <input type="checkbox" value="${m.uid}" class="announcement-assign-checkbox">
        ${m.name}
      </label>
    `;
  });
}

loadMembers();
loadAnnouncementAssignTo();

// Load live chat room list immediately so refresh always restores the list
loadLiveChatRooms();

  // Initialize notifications
  initializeNotifications();

  // Initialize native push notifications
  pushNotificationsManager.requestPermissions().then(result => {
    if (result.granted) {
      pushNotificationsManager.register();
    } else {
      console.log('Push notification permission denied');
    }
  });

  pushNotificationsManager.addListener('registration', token => {
    console.log('Push registration success, token: ', token.value);
    import('./notifications.js').then(m => {
      m.saveFcmTokenForCurrentUser(token.value);
    });
  });

  pushNotificationsManager.addListener('registrationError', err => {
    console.error('Registration error: ', err.error);
  });

  pushNotificationsManager.addListener('pushNotificationReceived', notification => {
    console.log('Push received: ', notification);
    showLocalNotification(notification.title, notification.body);
  });

  pushNotificationsManager.addListener('pushNotificationActionPerformed', notification => {
    console.log('Push action performed: ', notification);
  });

  // Set up listeners after authentication
  console.log('=== SETTING UP ADMIN LISTENERS ===');
  console.log('Admin authenticated, email:', adminEmail, 'role:', adminRole);

  /* LOAD TICKETS */
  onSnapshot(collection(db, "tickets"), (snap) => {
    console.log('=== ADMIN TICKETS LISTENER TRIGGERED ===');
    console.log('Tickets snapshot received, docs count:', snap.size);
    const container = document.getElementById("ticketsList");
    if (!container) return;
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No support tickets submitted yet.</p>";
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
      const ticket = docSnap.data();
      const createdDate = ticket.createdAt?.toDate?.() ? ticket.createdAt.toDate().toLocaleDateString() : "Unknown date";
      const responses = Array.isArray(ticket.responses) ? ticket.responses : [];
      const status = ticket.status || "open";

      const statusColor = status === "open" ? "#ef4444" : status === "pending validation" ? "#f59e0b" : "#10b981";
      const statusBg = status === "open" ? "rgba(239, 68, 68, 0.1)" : status === "pending validation" ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)";

      const responseHtml = responses.length > 0 ? responses.map(response => `
        <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #4b5563; border-radius: 0.375rem; background: #1f2937;">
          <div style="margin-bottom: 0.5rem;">
            <span style="font-weight: 600; color: #f3f4f6;">${response.author || 'Admin'}</span>
            <span style="font-size: 0.8rem; color: #9ca3af; margin-left: 0.5rem;">${formatCommentDate(response.createdAt)}</span>
          </div>
          <p class="comment-content" style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${response.content}</p>
        </div>
      `).join('') : '';

      const closeButton = status !== 'closed' ? `
              <button onclick="window.changeTicketStatus('${docSnap.id}', 'closed')" style="background: #ef4444; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Close Ticket</button>
      ` : '';
      const reopenButton = status === 'closed' ? `
              <button onclick="window.changeTicketStatus('${docSnap.id}', 'open')" style="background: #10b981; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Reopen Ticket</button>
      ` : '';
      const pendingButton = status === 'open' ? `
              <button onclick="window.changeTicketStatus('${docSnap.id}', 'pending validation')" style="background: #f59e0b; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Mark Pending</button>
      ` : '';

      const statusButtons = [pendingButton, closeButton, reopenButton].filter(Boolean).join('');

      const html = `
        <div style="margin-bottom: 1.5rem; padding: 1.5rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1e293b;">
          <div style="margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${ticket.title}</h4>
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
              <span style="font-size: 0.85rem; color: #9ca3af;">Submitted by: ${ticket.submittedByName || ticket.submittedBy}</span>
              <span style="font-size: 0.85rem; color: #9ca3af;">${createdDate}</span>
              <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: ${statusBg}; color: ${statusColor}; text-transform: uppercase;">${status}</span>
            </div>
          </div>
          
          <p style="margin: 0 0 1rem 0; color: #d1d5db; white-space: pre-wrap;">${ticket.description}</p>
          
          ${responseHtml ? `
            <div style="margin-bottom: 1rem;">
              <h5 style="margin: 0 0 0.75rem 0; color: #f3f4f6;">Responses (${responses.length})</h5>
              ${responseHtml}
            </div>
          ` : ''}
          
          <div style="padding: 1rem; background: #0f172a; border-radius: 0.5rem; border: 1px solid #374151;">
            <textarea id="responseInput-${docSnap.id}" rows="3" placeholder="Type your response..." style="width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #4b5563; background: #111827; color: #f3f4f6; margin-bottom: 0.75rem;"></textarea>
            <div style="display: flex; gap: 0.5rem;">
              <button onclick="window.respondToTicket('${docSnap.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer; flex: 1;">Send Response</button>
              ${statusButtons}
              <button onclick="window.deleteTicket('${docSnap.id}')" class="btn-danger" style="padding: 0.75rem 1rem;">Delete Ticket</button>
            </div>
          </div>
        </div>
      `;
      console.log('Generated ticket HTML:', html.substring(0, 200) + '...');
      container.innerHTML += html;
    });
  });

  /* LOAD RESOURCES */
  onSnapshot(collection(db, "resources"), (snap) => {
    console.log('=== ADMIN RESOURCES LISTENER TRIGGERED ===');
    console.log('Resources snapshot received, docs count:', snap.size);
    const container = document.getElementById("resourcesList");
    if (!container) return;
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No resources created yet.</p>";
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
          <p style="margin: 0.5rem 0; line-height: 1.4; color: #d1d5db;">${resource.description}</p>
          <div style="margin-top: 1rem;">
            <a href="${resource.link}" target="_blank" style="background: #10b981; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; text-decoration: none; display: inline-block;">🔗 Open Resource</a>
            <button onclick="window.deleteResource('${docSnap.id}')" class="btn-danger" style="margin-left: 0.5rem; padding: 0.5rem 1rem;">🗑️ Delete</button>
          </div>
        </div>
      `;
    });
  });

function mergeProgressStructures(defaultSections, savedSections) {
  // Merge saved data with default structure, preserving edits but adding new items
  return defaultSections.map((defaultSection) => {
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
}

function loadProgressReport() {
  console.log('=== LOAD PROGRESS REPORT CALLED ===');
  const container = document.getElementById("progressReportPanel");
  console.log('Progress report container element:', container);

  const progressRef = doc(db, progressReportCollection, progressReportDocId);
  console.log('Progress report reference:', progressRef);

  onSnapshot(progressRef, (snap) => {
    console.log('Progress report snapshot received:', snap.exists());
    const defaultSections = getDefaultProgressStructure();
    let sections = defaultSections;
    
    if (snap.exists()) {
      const data = snap.data();
      console.log('Progress report data:', data);
      if (Array.isArray(data.sections)) {
        // Merge saved data with default structure to include new items
        sections = mergeProgressStructures(defaultSections, data.sections);
      } else {
        setDoc(progressRef, { sections: defaultSections }, { merge: true });
      }
    } else {
      console.log('Progress report document does not exist, creating default');
      setDoc(progressRef, { sections: defaultSections }, { merge: true });
    }
    renderAdminProgressReport(sections);
  });
}

/* CREATE TASK */
window.createTask = async function () {
  const title = document.getElementById("title").value.trim();
  const deadline = document.getElementById("deadline").value;
  const description = document.getElementById("description").value.trim();
  const assignedTo = document.getElementById("assignedTo").value;
  const link = document.getElementById("linkInput").value.trim();

  if (!title || !deadline || !assignedTo) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    const member = members.find(m => m.uid === assignedTo) || members[0];

    const taskData = {
      title,
      description: description || "",
      deadline,
      assignedTo,
      assignedToName: member.name,
      linkURL: link || null,
      status: "pending",
      emailNotificationSent: false,
      createdAt: Date.now()
    };

    await addDoc(collection(db, "tasks"), taskData);

    // Send notification to assigned user
    if (assignedTo !== "everyone") {
      const notificationTitle = "New Task Assigned";
      const notificationBody = `You have been assigned a new task: "${title}"`;
      await sendNotificationToUsers([assignedTo], notificationTitle, notificationBody, 'task');
      showLocalNotification(notificationTitle, notificationBody);
    }

    document.getElementById("title").value = "";
    document.getElementById("deadline").value = "";
    document.getElementById("description").value = "";
    document.getElementById("assignedTo").value = "";
    document.getElementById("linkInput").value = "";

    alert("Task created successfully!");
  } catch (error) {
    console.error("Error creating task:", error);
    alert(`Failed to create task: ${error.message}`);
  }
};

/* DELETE TASK */
window.deleteTask = async function (id) {
  if (confirm("Are you sure you want to delete this task?")) {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
    }
  }
};

/* MARK DONE */
window.markDone = async function (id) {
  try {
    const taskRef = doc(db, "tasks", id);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      alert("Task not found.");
      return;
    }

    const task = taskSnap.data();
    const recipientEmail = task.assignedTo;
    const notificationTitle = "Task Marked Complete";
    const notificationBody = `Your task \"${task.title}\" has been marked as done by Admin.`;

    await updateDoc(taskRef, {
      status: "done",
      statusEmailNotificationSent: false,
      statusNotificationReason: "done",
      statusNotificationTitle: notificationTitle,
      statusNotificationMessage: notificationBody,
      statusNotificationAt: new Date()
    });

    if (recipientEmail) {
      await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'task');
    }
  } catch (error) {
    console.error("Error marking done:", error);
    alert("Failed to mark task done. Please try again.");
  }
};

/* NEED ACTION */
window.needAction = async function (id) {
  if (confirm("Are you sure you want to mark this task as needing action? This will notify the assigned member(s).")) {
    try {
      const taskRef = doc(db, "tasks", id);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) {
        alert("Task not found.");
        return;
      }

      const task = taskSnap.data();
      const recipientEmail = task.assignedTo;
      const notificationTitle = "Task Needs Your Attention";
      const notificationBody = `Your task \"${task.title}\" has been marked as needing action by Admin.`;

      await updateDoc(taskRef, {
        status: "needs action",
        statusEmailNotificationSent: false,
        statusNotificationReason: "needs_action",
        statusNotificationTitle: notificationTitle,
        statusNotificationMessage: notificationBody,
        statusNotificationAt: new Date()
      });

      if (recipientEmail) {
        await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'task');
      }

      alert("Task has been marked as needing action. The member(s) will see the notification in their task list.");
    } catch (error) {
      console.error("Error marking task as needing action:", error);
      alert("Failed to mark task as needing action. Please try again.");
    }
  }
};

/* REALTIME + GRAPH */
onSnapshot(collection(db, "tasks"), (snap) => {
  const now = Date.now();
  const container = document.getElementById("tasks");

  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  docs.sort((a, b) => b.data().createdAt - a.data().createdAt);

  // Track progress by member for analytics
  const memberProgress = {};
  const allTasks = docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  lastAnalyticsTasks = allTasks;
  window.lastAnalyticsTasks = allTasks;

  allTasks.forEach(t => {
    const memberName = t.assignedToName || t.assignedTo || "Unassigned";

    let status = (t.status || "pending").toLowerCase().trim();
    const deadline = parseDeadline(t.deadline);
    if (deadline && deadline.getTime() < now && (status === "pending" || status === "pending validation")) {
      status = "overdue";
    }

    if (!memberProgress[memberName]) {
      memberProgress[memberName] = { done: 0, pending: 0, overdue: 0, needsAction: 0, pendingValidation: 0 };
    }

    if (status === "done") memberProgress[memberName].done++;
    else if (status === "overdue") memberProgress[memberName].overdue++;
    else if (status === "needs action") memberProgress[memberName].needsAction++;
    else if (status === "pending validation") memberProgress[memberName].pendingValidation++;
    else memberProgress[memberName].pending++;
  });

  // Update chart data store
  lastMemberProgress = memberProgress;
  window.lastMemberProgress = memberProgress;

  // Only update chart if analytics is currently active (no constant polling)
  if (document.getElementById('task-analytics')?.classList.contains('active')) {
    clearTimeout(chartUpdateTimeout);
    chartUpdateTimeout = setTimeout(() => {
      updateChart(lastMemberProgress);
    }, 100); // Reduced delay for immediate updates when active
  }

  // Only rebuild task list if we're not on analytics page (to avoid lag)
  if (!document.getElementById('task-analytics')?.classList.contains('active')) {
    let html = "";
    docs.forEach(docSnap => {
      const t = docSnap.data();
      html += `
        <div class="card" style="${t.status === 'pending validation' ? 'border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.1);' : ''}">
          <h3>${t.title}</h3>
          <p>Assigned To: ${t.assignedToName}</p>
          <p>Deadline: ${t.deadline}</p>
          ${t.description ? `<p><strong>Description:</strong> ${t.description}</p>` : ""}  
          ${t.linkURL ? `<a href="${t.linkURL}" target="_blank">🔗 Open Link</a>` : ""}
          <p>Status: <span style="${t.status === 'pending validation' ? 'color: #f59e0b; font-weight: bold;' : ''}">${t.status}</span></p>
          ${t.status === 'pending validation' ? '<p style="color: #f59e0b; font-weight: bold;">⚠️ Member has submitted this task for validation!</p>' : ''}
          <button onclick="markDone('${docSnap.id}')">Mark Done</button>
          ${(t.status === "pending" || t.status === "overdue" || t.status === "pending validation") ? `<button onclick="needAction('${docSnap.id}')" class="btn-warning" style="margin-top: 0.5rem;">Need an Action</button>` : ""}
          <button onclick="deleteTask('${docSnap.id}')" class="btn-danger" style="margin-top: 0.5rem;">Delete</button>
        </div>
      `;
    });
    container.innerHTML = html;
  }
});

// Update chart only when analytics is visible and data changed
function updateChartIfNeeded() {
  // This function is deprecated - chart updates are now handled directly in onSnapshot when analytics is active
  if (document.getElementById('task-analytics')?.classList.contains('active')) {
    updateChart(lastMemberProgress);
  }
}

/* GRAPH */
function updateChart(memberProgress) {
  const container = document.getElementById("taskAnalyticsList");
  if (!container) {
    console.error('Analytics list container not found');
    return;
  }

  container.innerHTML = "";

  if (!memberProgress || Object.keys(memberProgress).length === 0) {
    container.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 2rem;">No task data available. Create a task to see analytics.</p>`;
    return;
  }

  const memberNames = Object.keys(memberProgress).filter(name => name && name !== "").sort();
  if (memberNames.length === 0) {
    container.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 2rem;">No task data available. Create a task to see analytics.</p>`;
    return;
  }

  memberNames.forEach(member => {
    const progress = memberProgress[member] || {};
    const pending = progress.pending || 0;
    const needsAction = progress.needsAction || 0;
    const overdue = progress.overdue || 0;

    const card = document.createElement('div');
    card.style.padding = '1rem';
    card.style.border = '1px solid #334155';
    card.style.borderRadius = '0.75rem';
    card.style.background = '#0f172a';
    card.style.display = 'grid';
    card.style.gap = '0.5rem';

    const title = document.createElement('h3');
    title.textContent = member;
    title.style.margin = '0';
    title.style.fontSize = '1.05rem';
    title.style.color = '#f8fafc';

    card.appendChild(title);

    const statusContainer = document.createElement('div');
    statusContainer.style.display = 'flex';
    statusContainer.style.flexWrap = 'wrap';
    statusContainer.style.gap = '0.75rem';

    const addStatus = (label, value, color, bg) => {
      const status = document.createElement('span');
      status.textContent = `${label}: ${value}`;
      status.style.color = color;
      status.style.background = bg;
      status.style.padding = '0.35rem 0.75rem';
      status.style.borderRadius = '999px';
      status.style.fontSize = '0.92rem';
      status.style.fontWeight = '600';
      status.style.minWidth = 'max-content';
      statusContainer.appendChild(status);
    };

    if (pending > 0) addStatus('Pending', pending, '#1d4ed8', 'rgba(59,130,246,0.12)');
    if (needsAction > 0) addStatus('Needs Action', needsAction, '#b45309', 'rgba(245,158,11,0.15)');
    if (overdue > 0) addStatus('Overdue', overdue, '#dc2626', 'rgba(239,68,68,0.15)');

    if (pending === 0 && needsAction === 0 && overdue === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No pending, needs action, or overdue tasks.';
      empty.style.margin = '0';
      empty.style.color = '#94a3b8';
      card.appendChild(empty);
    } else {
      card.appendChild(statusContainer);

      const detailsButton = document.createElement('button');
      detailsButton.textContent = 'View Tasks';
      detailsButton.style.marginTop = '0.75rem';
      detailsButton.style.padding = '0.65rem 0.95rem';
      detailsButton.style.border = 'none';
      detailsButton.style.borderRadius = '0.75rem';
      detailsButton.style.background = '#2563eb';
      detailsButton.style.color = '#ffffff';
      detailsButton.style.cursor = 'pointer';
      detailsButton.style.fontWeight = '600';
      detailsButton.onclick = () => showMemberTaskDetails(member);
      card.appendChild(detailsButton);
    }

    container.appendChild(card);
  });
}

function showMemberTaskDetails(memberName) {
  const modalOverlay = document.getElementById('taskAnalyticsModalOverlay');
  const detailMessage = document.getElementById('taskAnalyticsDetailsMessage');
  const detailList = document.getElementById('taskAnalyticsDetailsList');

  if (!modalOverlay || !detailMessage || !detailList) {
    console.error('Analytics detail modal elements not found');
    return;
  }

  const tasks = window.lastAnalyticsTasks || [];
  const now = Date.now();

  const filtered = tasks.map(task => {
    const status = (task.status || 'pending').toLowerCase().trim();
    const deadline = parseDeadline(task.deadline);
    const isOverdue = deadline && deadline.getTime() < now && (status === 'pending' || status === 'pending validation');
    return {
      ...task,
      displayStatus: isOverdue ? 'overdue' : status,
    };
  }).filter(task => {
    const name = task.assignedToName || task.assignedTo || 'Unassigned';
    return name === memberName && ['pending', 'needs action', 'overdue'].includes(task.displayStatus);
  });

  detailList.innerHTML = '';
  modalOverlay.style.display = 'flex';
  modalOverlay.classList.add('show');
  modalOverlay.style.visibility = 'visible';
  modalOverlay.style.opacity = '1';
  detailMessage.textContent = `Showing overdue, needs action, and pending tasks for ${memberName}.`;
  document.body.style.overflow = 'hidden';

  if (filtered.length === 0) {
    detailList.innerHTML = `<p style="margin:0; color:#94a3b8;">No overdue, needs action, or pending tasks found for this member.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(task => {
    const item = document.createElement('div');
    item.style.padding = '0.85rem';
    item.style.border = '1px solid rgba(148, 163, 184, 0.2)';
    item.style.borderRadius = '0.75rem';
    item.style.background = '#111827';

    const title = document.createElement('p');
    title.textContent = task.title || 'Untitled Task';
    title.style.margin = '0 0 0.5rem 0';
    title.style.fontWeight = '700';
    title.style.color = '#f8fafc';

    const status = document.createElement('span');
    status.textContent = task.displayStatus === 'needs action' ? 'Needs Action' : task.displayStatus.charAt(0).toUpperCase() + task.displayStatus.slice(1);
    status.style.display = 'inline-block';
    status.style.padding = '0.25rem 0.65rem';
    status.style.borderRadius = '999px';
    status.style.fontSize = '0.82rem';
    status.style.fontWeight = '600';
    status.style.marginBottom = '0.5rem';
    status.style.color = '#ffffff';
    status.style.background = task.displayStatus === 'overdue' ? '#dc2626' : task.displayStatus === 'needs action' ? '#d97706' : '#2563eb';

    const deadline = document.createElement('p');
    const deadlineDate = parseDeadline(task.deadline);
    deadline.textContent = `Deadline: ${deadlineDate ? deadlineDate.toLocaleDateString() : 'Not set'}`;
    deadline.style.margin = '0 0 0.35rem 0';
    deadline.style.color = '#cbd5e1';
    deadline.style.fontSize = '0.92rem';

    const description = document.createElement('p');
    description.textContent = task.description || (task.title ? '' : 'No additional details available.');
    description.style.margin = '0';
    description.style.color = '#94a3b8';
    description.style.fontSize = '0.92rem';

    item.appendChild(title);
    item.appendChild(status);
    item.appendChild(deadline);
    if (description.textContent) item.appendChild(description);
    fragment.appendChild(item);
  });

  detailList.appendChild(fragment);
}

function hideMemberTaskDetails() {
  const modalOverlay = document.getElementById('taskAnalyticsModalOverlay');
  if (!modalOverlay) {
    return;
  }
  modalOverlay.classList.remove('show');
  modalOverlay.style.visibility = 'hidden';
  modalOverlay.style.opacity = '0';
  modalOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

window.showMemberTaskDetails = showMemberTaskDetails;
window.hideMemberTaskDetails = hideMemberTaskDetails;
window.updateChart = updateChart;
window.updateChartIfNeeded = function() {
  if (window.lastMemberProgress) {
    updateChart(window.lastMemberProgress);
  }
};

/* CREATE POLL */
window.createPoll = async function () {
  const question = document.getElementById("pollQuestion").value.trim();
  const optionInputs = document.querySelectorAll(".poll-option-input");
  const options = Array.from(optionInputs).map(input => input.value.trim()).filter(option => option !== "");

  if (!question || options.length < 2) {
    alert("Please enter a question and at least 2 options.");
    return;
  }

  try {
    const pollData = {
      question,
      options,
      votes: {},
      emailNotificationSent: false,
      createdAt: new Date()
    };

    await addDoc(collection(db, "polls"), pollData);

    // Send notification to all members
    const notificationTitle = "New Poll Created";
    const notificationBody = `A new poll has been created: "${question}"`;
    const allMemberEmails = members.map(m => m.uid).filter(email => email !== "everyone");
    await sendNotificationToUsers(allMemberEmails, notificationTitle, notificationBody, 'poll');
    showLocalNotification(notificationTitle, notificationBody);

    document.getElementById("pollQuestion").value = "";
    optionInputs.forEach(input => input.value = "");
    
    // Reset to 2 options
    const pollOptionsDiv = document.getElementById("pollOptions");
    pollOptionsDiv.innerHTML = `
      <div class="form-group">
        <label>Option 1</label>
        <input type="text" class="poll-option-input" placeholder="Enter option" required>
      </div>
      <div class="form-group">
        <label>Option 2</label>
        <input type="text" class="poll-option-input" placeholder="Enter option" required>
      </div>
    `;

    alert("Poll created successfully!");
  } catch (error) {
    console.error("Error creating poll:", error);
    alert(`Failed to create poll: ${error.message}`);
  }
};

/* ADD POLL OPTION */
window.addPollOption = function () {
  const pollOptionsDiv = document.getElementById("pollOptions");
  const optionCount = pollOptionsDiv.querySelectorAll(".poll-option-input").length + 1;
  
  const newOptionDiv = document.createElement("div");
  newOptionDiv.className = "form-group";
  newOptionDiv.innerHTML = `
    <label>Option ${optionCount}</label>
    <input type="text" class="poll-option-input" placeholder="Enter option" required>
  `;
  
  pollOptionsDiv.appendChild(newOptionDiv);
};

function getSafePollOptions(poll) {
  return Array.isArray(poll.options) ? poll.options : [];
}

function getPollCreatedDate(createdAt) {
  if (!createdAt) return "Unknown date";
  if (createdAt.toDate) return createdAt.toDate().toLocaleDateString();
  if (createdAt instanceof Date) return createdAt.toLocaleDateString();
  return String(createdAt);
}

function formatCommentDate(dateValue) {
  if (!dateValue) return "Unknown date";
  if (dateValue.toDate) return dateValue.toDate().toLocaleString();
  if (dateValue instanceof Date) return dateValue.toLocaleString();
  return new Date(dateValue).toLocaleString();
}

window.deleteAnnouncementComment = async function(announcementId, commentIndex) {
  try {
    const announcementRef = doc(db, "announcements", announcementId);
    const announcementSnap = await getDoc(announcementRef);
    if (!announcementSnap.exists()) return;

    const announcement = announcementSnap.data();
    const comments = Array.isArray(announcement.comments) ? [...announcement.comments] : [];
    if (commentIndex < 0 || commentIndex >= comments.length) return;

    comments.splice(commentIndex, 1);
    await updateDoc(announcementRef, { comments });
    alert("Comment deleted successfully.");
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("Failed to delete comment. Please try again.");
  }
};

window.toggleAnnouncementComments = async function(announcementId, currentState) {
  try {
    await updateDoc(doc(db, "announcements", announcementId), {
      commentsEnabled: !currentState
    });
    alert(`Comments have been ${currentState ? 'disabled' : 'enabled'} for this announcement.`);
  } catch (error) {
    console.error("Error toggling comment status:", error);
    alert("Failed to update comment status. Please try again.");
  }
};

window.addAnnouncementComment = async function(announcementId) {
  const input = document.getElementById(`adminCommentInput-${announcementId}`);
  if (!input) return;

  const commentText = input.value.trim();
  if (!commentText) {
    alert("Please enter a comment.");
    return;
  }

  try {
    await updateDoc(doc(db, "announcements", announcementId), {
      comments: arrayUnion({
        author: "Admin",
        email: adminEmail,
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

/* CREATE ANNOUNCEMENT */
window.createAnnouncement = async function () {
  const title = document.getElementById("announcementTitle").value.trim();
  const content = document.getElementById("announcementContent").value.trim();
  const checkboxes = document.querySelectorAll(".announcement-assign-checkbox:checked");
  const assignedTo = Array.from(checkboxes).map(cb => cb.value);

  if (!title || !content) {
    alert("Please fill all fields.");
    return;
  }

  if (assignedTo.length === 0) {
    alert("Please select at least one recipient.");
    return;
  }

  try {
    const assignedToNames = assignedTo.map(uid => {
      const member = members.find(m => m.uid === uid);
      return member ? member.name : uid;
    });

    const announcementData = {
      title,
      content,
      assignedTo,
      assignedToNames,
      createdAt: new Date(),
      commentsEnabled: true,
      emailNotificationSent: false
    };

    await addDoc(collection(db, "announcements"), announcementData);

    // Send notifications to assigned users
    const notificationTitle = "New Announcement";
    const notificationBody = `New announcement: "${title}"`;
    await sendNotificationToUsers(assignedTo, notificationTitle, notificationBody, 'announcement');
    showLocalNotification(notificationTitle, notificationBody);

    document.getElementById("announcementTitle").value = "";
    document.getElementById("announcementContent").value = "";
    document.querySelectorAll(".announcement-assign-checkbox").forEach(cb => cb.checked = false);

    alert("Announcement created successfully!");
  } catch (error) {
    console.error("Error creating announcement:", error);
    alert(`Failed to create announcement: ${error.message}`);
  }
};

/* CREATE RESOURCE */
window.createResource = async function () {
  console.log('createResource called');
  const title = document.getElementById("resourceTitle").value.trim();
  const description = document.getElementById("resourceDescription").value.trim();
  const link = document.getElementById("resourceLink").value.trim();

  console.log('Resource data:', { title, description, link });

  if (!title || !description || !link) {
    alert("Please fill all fields.");
    return;
  }

  try {
    const resourceData = {
      title,
      description,
      link,
      createdAt: new Date()
    };

    console.log('Adding resource to Firestore...');
    await addDoc(collection(db, "resources"), resourceData);
    console.log('Resource added successfully');

    // Send notification to all members (non-blocking)
    try {
      const notificationTitle = "New Resource Added";
      const notificationBody = `New resource: "${title}"`;
      const allMemberEmails = members.map(m => m.uid).filter(email => email !== "everyone");
      console.log('Sending notification to members:', allMemberEmails);
      await sendNotificationToUsers(allMemberEmails, notificationTitle, notificationBody, 'resource');
      showLocalNotification(notificationTitle, notificationBody);
      console.log('Notification sent successfully');
    } catch (notificationError) {
      console.warn("Notification failed, but resource was created successfully:", notificationError);
    }

    document.getElementById("resourceTitle").value = "";
    document.getElementById("resourceDescription").value = "";
    document.getElementById("resourceLink").value = "";

    alert("Resource created successfully!");
  } catch (error) {
    console.error("Error creating resource:", error);
    alert(`Failed to create resource: ${error.message}`);
  }
};

/* DELETE POLL */
window.deletePoll = async function (id) {
  if (confirm("Are you sure you want to delete this poll? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "polls", id));
      alert("Poll deleted successfully!");
    } catch (error) {
      console.error("Error deleting poll:", error);
      alert("Failed to delete poll. Please try again.");
    }
  }
};

/* DELETE ANNOUNCEMENT */
window.deleteAnnouncement = async function (id) {
  if (confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "announcements", id));
      alert("Announcement deleted successfully!");
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert("Failed to delete announcement. Please try again.");
    }
  }
};

/* LOAD POLLS */
onSnapshot(collection(db, "polls"), (snap) => {
  const container = document.getElementById("pollsList");
  if (!container) return;
  container.innerHTML = "";

  if (snap.empty) {
    container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No polls created yet.</p>";
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
    const poll = docSnap.data() || {};
    const createdDate = getPollCreatedDate(poll.createdAt);
    const options = getSafePollOptions(poll);
    const votes = poll.votes || {};

    container.innerHTML += `
      <div class="card" style="margin-bottom: 1rem;">
        <h4 class="poll-question">${poll.question || "Untitled Poll"}</h4>
        <p class="poll-created-date">Created: ${createdDate}</p>
        <div style="margin: 0.5rem 0;">
          ${options.map((option, index) => `
            <div class="poll-option-row" style="display: flex; justify-content: space-between; padding: 0.25rem; background: #f8fafc; border-radius: 0.25rem; margin-bottom: 0.25rem;">
              <span class="poll-option-text" style="color: #334155;">${option}</span>
              <span class="poll-option-votes" style="color: #475569;">${Array.isArray(votes[index]) ? votes[index].length : 0} votes</span>
            </div>
          `).join('')}
        </div>
        <button onclick="deletePoll('${docSnap.id}')" class="btn-danger" style="margin-top: 0.5rem;">🗑️ Delete Poll</button>
      </div>
    `;
  });
});

/* LOAD ANNOUNCEMENTS */
onSnapshot(collection(db, "announcements"), (snap) => {
  const container = document.getElementById("announcementsList");
  container.innerHTML = "";

  if (snap.empty) {
    container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No announcements created yet.</p>";
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
    const announcement = docSnap.data();
    const createdDate = announcement.createdAt?.toDate?.() ? announcement.createdAt.toDate().toLocaleDateString() : "Unknown date";
    const commentsEnabled = announcement.commentsEnabled !== false;
    const comments = Array.isArray(announcement.comments) ? announcement.comments : [];
    const assignedToNames = Array.isArray(announcement.assignedToNames) ? announcement.assignedToNames : [];
    const assignedToText = assignedToNames.length > 0 ? `Assigned to: ${assignedToNames.join(", ")}` : "Assigned to: Everyone";
      const commentHtml = comments.length > 0 ? comments.map((comment, index) => `
          <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; background: #111827;">
            <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; align-items: center;">
              <div>
                <span style="font-weight: 600; color: #f3f4f6;">${comment.author || comment.email || 'Member'}</span>
                <div style="font-size: 0.8rem; color: #9ca3af;">${formatCommentDate(comment.createdAt)}</div>
              </div>
              <button onclick="deleteAnnouncementComment('${docSnap.id}', ${index})" style="background: #ef4444 !important; color: white !important; border: none !important; padding: 0.15rem 0.35rem !important; border-radius: 0.25rem !important; cursor: pointer !important; font-size: 0.65rem !important; line-height: 1 !important; width: auto !important; min-width: 0 !important; margin-top: 0 !important; box-shadow: none !important;">Delete</button>
            </div>
            <p class="comment-content" style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${comment.content}</p>
          </div>
        `).join('') : `<p style='color: #9ca3af; margin: 0;'>No comments yet.</p>`;

    container.innerHTML += `
      <div class="card" style="margin-bottom: 1rem;">
        <h4>${announcement.title}</h4>
        <p style="color: #94a3b8; font-size: 0.8rem;">Created: ${createdDate}</p>
        <p style="color: #60a5fa; font-size: 0.85rem; margin: 0.25rem 0;">${assignedToText}</p>
        <p style="margin: 0.5rem 0; line-height: 1.4;">${announcement.content}</p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <button onclick="toggleAnnouncementComments('${docSnap.id}', ${commentsEnabled})" class="btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; min-width: auto;">${commentsEnabled ? 'Disable Comments' : 'Enable Comments'}</button>
          <span style="align-self: center; color: ${commentsEnabled ? '#10b981' : '#f59e0b'}; font-size: 0.85rem;">Comments ${commentsEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div style="margin-top: 1rem; padding: 0.75rem; background: #111827; border-radius: 0.5rem; border: 1px solid #374151;">
          <h5 style="margin: 0 0 0.75rem 0; color: #f3f4f6;">Comments (${comments.length})</h5>
          ${commentHtml}
          <div style="margin-top: 1rem;">
            <textarea id="adminCommentInput-${docSnap.id}" rows="3" placeholder="Add a comment as Admin..." style="width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #4b5563; background: #0f172a; color: #f3f4f6; margin-bottom: 0.75rem;"></textarea>
            <button onclick="addAnnouncementComment('${docSnap.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Post Comment as Admin</button>
          </div>
        </div>
        <button onclick="deleteAnnouncement('${docSnap.id}')" class="btn-danger" style="margin-top: 0.75rem;">🗑️ Delete Announcement</button>
      </div>
    `;
  });
});

loadProgressReport();

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
  const title = await getNextLiveChatTitle();

  try {
    await addDoc(collection(db, 'liveChats'), {
      title,
      createdByEmail: adminEmail,
      createdByName: getUserName(adminEmail),
      status: 'Active',
      createdAt: Date.now()
    });
    loadLiveChatRooms();
  } catch (error) {
    console.error('Failed to create live chat room:', error);
    alert('Unable to create chat room. Please try again.');
  }
}

function renderAdminChatRooms(rooms) {
  const container = document.getElementById('adminChatRoomsContainer');
  if (!container) return;
  if (!rooms.length) {
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No live chat rooms yet.</p>';
    return;
  }

  rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  liveChatRoomsById = {};
  container.innerHTML = '';

  rooms.forEach((room) => {
    liveChatRoomsById[room.id] = room;
    const statusColor = room.status === 'Closed' ? '#ef4444' : '#10b981';
    const createdBy = room.createdByName || getUserName(room.createdByEmail) || 'Unknown';
    const isActive = room.status === 'Active';
    const canDelete = true;

    const roomDiv = document.createElement('div');
    roomDiv.style.cssText = 'border: 1px solid #374151; background: #1e293b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;';
    roomDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
        <div style="min-width: 0;">
          <h4 style="margin: 0; color: #f8fafc;">${room.title}</h4>
          <p style="margin: 0.5rem 0 0; color: #94a3b8; font-size: 0.9rem;">Created by ${createdBy}</p>
          <p style="margin: 0.25rem 0 0; color: #94a3b8; font-size: 0.8rem;">${new Date(room.createdAt).toLocaleString()}</p>
        </div>
        <span style="background: ${statusColor}; color: white; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem;">${room.status}</span>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <button onclick="openAdminChatRoom('${room.id}')" style="background: ${isActive ? '#10b981' : '#6b7280'}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">${isActive ? 'Open Chat' : 'View Chat'}</button>
        ${canDelete ? `<button onclick="deleteLiveChatRoom('${room.id}')" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">Delete</button>` : ''}
      </div>
    `;
    container.appendChild(roomDiv);
  });
}

function openAdminChatRoom(chatId) {
  const room = liveChatRoomsById[chatId];
  if (!room) return;

  selectedLiveChatId = chatId;
  const panel = document.getElementById('adminChatRoomPanel');
  const titleEl = document.getElementById('adminActiveChatTitle');
  const metaEl = document.getElementById('adminActiveChatMeta');
  const messageInput = document.getElementById('adminChatMessageInput');
  const messageForm = document.getElementById('adminChatMessageForm');

  if (panel) panel.style.display = 'block';
  if (titleEl) titleEl.textContent = room.title;
  if (metaEl) metaEl.textContent = `Created by ${room.createdByName || getUserName(room.createdByEmail)} • Status: ${room.status}`;
  if (messageInput) messageInput.disabled = room.status !== 'Active';
  if (messageForm) messageForm.style.opacity = room.status !== 'Active' ? '0.7' : '1';

  clearAdminReplyToMessage();
  subscribeAdminChatMessages(chatId);
}

function closeAdminChatPanel() {
  const panel = document.getElementById('adminChatRoomPanel');
  if (panel) panel.style.display = 'none';

  if (liveChatMessagesUnsubscribe) {
    liveChatMessagesUnsubscribe();
    liveChatMessagesUnsubscribe = null;
  }

  selectedLiveChatId = null;
  clearAdminReplyToMessage();
}

function clearAdminReplyToMessage() {
  adminReplyToMessage = null;
  updateAdminReplyPreview();
}

function updateAdminReplyPreview() {
  const preview = document.getElementById('adminChatReplyPreview');
  const input = document.getElementById('adminChatMessageInput');
  if (!preview || !input) return;

  if (!adminReplyToMessage) {
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }

  const sender = escapeHtml(adminReplyToMessage.senderName || getUserName(adminReplyToMessage.senderEmail) || 'Unknown');
  const text = escapeHtml(adminReplyToMessage.text || 'This message was unsent.');
  preview.style.display = 'flex';
  preview.style.justifyContent = 'space-between';
  preview.style.alignItems = 'center';
  preview.style.gap = '1rem';
  const cancelButtonStyle = 'display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;';
  preview.innerHTML = `
    <div style="min-width: 0;">
      <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Replying to ${sender}</div>
      <div style="font-size: 0.9rem; color: #e5e7eb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${text}</div>
    </div>
    <button type="button" onclick="clearAdminReplyToMessage()" style="${cancelButtonStyle}">Cancel</button>
  `;
}

function updateAdminChatImagePreview() {
  const preview = document.getElementById('adminChatImagePreview');
  if (!preview) return;

  if (!selectedAdminChatImageData) {
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
        <img src="${selectedAdminChatImageData}" alt="Selected image" style="max-width: 72px; max-height: 72px; border-radius: 12px; object-fit: cover;" />
        <div style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(selectedAdminChatImageName || 'Selected image')}</div>
      </div>
      <button type="button" onclick="clearAdminChatImageSelection()" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">Remove</button>
    </div>
  `;
}

function clearAdminChatImageSelection() {
  selectedAdminChatImageData = null;
  selectedAdminChatImageName = null;
  const input = document.getElementById('adminChatImageInput');
  if (input) input.value = '';
  updateAdminChatImagePreview();
}

function triggerAdminChatImageInput() {
  const input = document.getElementById('adminChatImageInput');
  if (input) input.click();
}

function handleAdminChatImageInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    clearAdminChatImageSelection();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedAdminChatImageData = reader.result;
    selectedAdminChatImageName = file.name;
    updateAdminChatImagePreview();
  };
  reader.readAsDataURL(file);
}

function setAdminReplyToMessage(messageId) {
  if (!messageId) return;
  const msg = adminChatMessagesById[messageId];
  if (!msg) return;
  adminReplyToMessage = msg;
  updateAdminReplyPreview();
}

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
    dropdown.innerHTML = '<div class="mention-item">No matching users</div>';
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

function renderAdminChatMessages(messages) {
  const container = document.getElementById('adminChatMessages');
  if (!container) return;

  adminChatMessagesById = {};

  if (!messages.length) {
    container.innerHTML = '<p style="color: #94a3b8; text-align: center; margin: 1rem 0;">No messages in this chat yet.</p>';
    return;
  }

  container.innerHTML = '';
  messages.forEach((msg) => {
    adminChatMessagesById[msg.id] = msg;
    const isOwn = msg.senderEmail === adminEmail;
    const messageText = msg.deleted ? 'This message was unsent.' : msg.text;
    const safeText = escapeHtml(messageText);
    const renderedText = msg.deleted ? safeText : formatMessageWithMentions(safeText);
    const imageMarkup = !msg.deleted && msg.imageData ? `<div style="margin-bottom: 0.75rem;"><img class="admin-chat-image" src="${msg.imageData}" alt="Sent image" style="width: auto; max-width: 100%; max-height: 280px; border-radius: 14px; object-fit: cover; display: block; cursor: pointer;"/></div>` : '';
    const replyPreview = msg.replyToId ? `
      <div style="padding: 0.75rem 1rem; margin-bottom: 0.75rem; border-radius: 12px; background: #0f172a; border: 1px solid #374151;">
        <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Replying to ${escapeHtml(msg.replyToSenderName || 'Unknown')}</div>
        <div style="font-size: 0.9rem; color: #e5e7eb; line-height: 1.4;">${escapeHtml(msg.replyToText || '')}</div>
      </div>
    ` : '';
    const buttonBaseStyle = 'display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(96, 165, 250, 0.12); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;';
    const replyButton = !msg.deleted ? `<button type="button" onclick="setAdminReplyToMessage('${msg.id}')" style="${buttonBaseStyle}">Reply</button>` : '';
    const unsendButton = isOwn && !msg.deleted ? `<button type="button" onclick="unsendAdminChatMessage('${selectedLiveChatId}', '${msg.id}')" style="${buttonBaseStyle}">Unsend</button>` : '';
    const actionButtons = [replyButton, unsendButton].filter(Boolean).join('<span style="margin: 0 0.35rem; color: #374151;">|</span>');

    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'padding: 0.85rem 1rem; margin-bottom: 0.75rem; border-radius: 10px; background: #111827;';
    messageDiv.innerHTML = `
      ${replyPreview}
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem; opacity: ${msg.deleted ? 0.7 : 1};">
        <div style="font-size: 0.85rem; color: #94a3b8;">${escapeHtml(msg.senderName || getUserName(msg.senderEmail) || 'Guest')}</div>
        <div style="font-size: 0.75rem; color: #6b7280;">${msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
      </div>
      <div style="color: ${msg.deleted ? '#9ca3af' : '#e5e7eb'}; line-height: 1.6; margin-bottom: 0.5rem;">${imageMarkup}${renderedText}</div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap; margin-bottom: ${msg.reactions && Object.keys(msg.reactions).length > 0 ? '0.5rem' : '0'};">
        ${actionButtons ? `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${actionButtons}</div>` : ''}
        <button type="button" class="admin-react-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">😊 React</button>
      </div>
      ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #374151;">
          ${Object.entries(msg.reactions).map(([emoji, users]) => `
            <div class="admin-reaction-badge" data-message-id="${msg.id}" data-emoji="${emoji}" data-users='${JSON.stringify(users)}' style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 9999px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s;">
              <span>${emoji}</span>
              <span style="color: #94a3b8;">${users.length}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    container.appendChild(messageDiv);
  });
  container.scrollTop = container.scrollHeight;

  // Attach click listeners to chat images
  const chatImages = container.querySelectorAll('.admin-chat-image');
  chatImages.forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      openAdminChatImageFullscreen(this.src);
    });
  });

  // Attach click listeners to reaction buttons
  const reactBtns = container.querySelectorAll('.admin-react-btn');
  reactBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      showAdminReactionMenu(messageId, e);
    });
  });

  // Attach click listeners to reaction badges to view details
  const reactionBadges = container.querySelectorAll('.admin-reaction-badge');
  reactionBadges.forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      const emoji = this.dataset.emoji;
      const users = JSON.parse(this.dataset.users);
      showAdminReactionDetails(emoji, users);
    });
    badge.addEventListener('mouseover', function() {
      this.style.background = 'rgba(96, 165, 250, 0.2)';
    });
    badge.addEventListener('mouseout', function() {
      this.style.background = 'rgba(96, 165, 250, 0.1)';
    });
  });
}

function openAdminChatImageFullscreen(imageSrc) {
  let overlay = document.getElementById('adminChatImageFullscreenOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'adminChatImageFullscreenOverlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.96); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 1rem; box-sizing: border-box;';
    overlay.onclick = (event) => { if (event.target === overlay) closeAdminChatImageFullscreen(); };
    const img = document.createElement('img');
    img.id = 'adminChatImageFullscreenOverlayImg';
    img.style.cssText = 'max-width: 100%; max-height: 100%; border-radius: 16px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);';
    const close = document.createElement('button');
    close.type = 'button';
    close.innerText = '×';
    close.style.cssText = 'position: absolute; top: 1rem; right: 1rem; background: rgba(0, 0, 0, 0.55); color: #f8fafc; border: none; border-radius: 9999px; width: 2.5rem; height: 2.5rem; font-size: 1.25rem; cursor: pointer;';
    close.onclick = (event) => { event.stopPropagation(); closeAdminChatImageFullscreen(); };
    overlay.appendChild(img);
    overlay.appendChild(close);
    document.body.appendChild(overlay);
  }
  const img = document.getElementById('adminChatImageFullscreenOverlayImg');
  if (img) img.src = imageSrc;
  overlay.style.display = 'flex';
}

function closeAdminChatImageFullscreen() {
  const overlay = document.getElementById('adminChatImageFullscreenOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function subscribeAdminChatMessages(chatId) {
  if (liveChatMessagesUnsubscribe) {
    liveChatMessagesUnsubscribe();
  }

  const messageQuery = query(collection(db, 'liveChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  liveChatMessagesUnsubscribe = onSnapshot(messageQuery, (snapshot) => {
    const messages = [];
    snapshot.forEach((docSnap) => messages.push({ id: docSnap.id, ...docSnap.data() }));
    renderAdminChatMessages(messages);
  }, (error) => {
    console.error('Admin live chat messages listener error:', error);
  });
}

async function sendAdminChatMessage(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!selectedLiveChatId) return;

  const messageInput = document.getElementById('adminChatMessageInput');
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message && !selectedAdminChatImageData) return;

  const newMessage = {
    senderEmail: adminEmail,
    senderName: getUserName(adminEmail),
    text: message || '',
    createdAt: Date.now(),
    deleted: false
  };

  if (selectedAdminChatImageData) {
    newMessage.imageData = selectedAdminChatImageData;
    if (selectedAdminChatImageName) {
      newMessage.imageName = selectedAdminChatImageName;
    }
  }

  if (adminReplyToMessage) {
    newMessage.replyToId = adminReplyToMessage.id;
    newMessage.replyToSenderName = adminReplyToMessage.senderName || getUserName(adminReplyToMessage.senderEmail);
    newMessage.replyToText = adminReplyToMessage.text || 'This message was unsent.';
    newMessage.replyToCreatedAt = adminReplyToMessage.createdAt || null;
  }

  try {
    await addDoc(collection(db, 'liveChats', selectedLiveChatId, 'messages'), newMessage);
    messageInput.value = '';
    clearAdminChatImageSelection();
    clearAdminReplyToMessage();
  } catch (error) {
    console.error('Failed to send admin chat message:', error);
    alert('Unable to send message. Please try again.');
  }
}

async function unsendAdminChatMessage(chatId, messageId) {
  if (!chatId || !messageId) return;

  const messageRef = doc(db, 'liveChats', chatId, 'messages', messageId);
  try {
    await updateDoc(messageRef, {
      deleted: true,
      text: 'This message was unsent.',
      unsentAt: Date.now()
    });
  } catch (error) {
    console.error('Failed to unsend admin chat message:', error);
  }
}

function showAdminReactionDetails(emoji, users) {
  let modal = document.getElementById('adminReactionDetailsModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'adminReactionDetailsModal';
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
    <button type="button" onclick="document.getElementById('adminReactionDetailsModal').remove();" style="width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">Close</button>
  `;

  modal.appendChild(content);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
}

function showAdminReactionMenu(messageId, event) {
  const emojis = [
    { emoji: '😂', name: 'laughing' },
    { emoji: '😠', name: 'mad' },
    { emoji: '😢', name: 'sad' },
    { emoji: '❤️', name: 'love' }
  ];

  let menu = document.getElementById('adminReactionMenu');
  if (menu) menu.remove();

  menu = document.createElement('div');
  menu.id = 'adminReactionMenu';
  menu.style.cssText = 'position: fixed; background: #111827; border: 1px solid #374151; border-radius: 9999px; display: flex; gap: 0.5rem; padding: 0.5rem; z-index: 50000; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);';

  emojis.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.emoji;
    btn.style.cssText = 'background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); color: #e5e7eb; padding: 0.5rem 0.75rem; border-radius: 9999px; cursor: pointer; font-size: 1.2rem; transition: all 0.15s;';
    btn.onmouseover = () => btn.style.background = 'rgba(96, 165, 250, 0.2)';
    btn.onmouseout = () => btn.style.background = 'rgba(96, 165, 250, 0.1)';
    btn.onclick = () => {
      toggleAdminMessageReaction(messageId, item.emoji);
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

async function toggleAdminMessageReaction(messageId, emoji) {
  if (!selectedLiveChatId || !messageId) return;

  const messageRef = doc(db, 'liveChats', selectedLiveChatId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);
  if (!messageSnap.exists()) return;

  const reactions = messageSnap.data().reactions || {};
  const currentUserEmail = adminEmail;

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


async function deleteLiveChatRoom(chatId) {
  if (!chatId) return;
  if (!confirm('Delete this live chat room? This will remove the room from the list.')) return;

  try {
    await deleteDoc(doc(db, 'liveChats', chatId));
    closeAdminChatPanel();
    loadLiveChatRooms();
  } catch (error) {
    console.error('Failed to delete live chat room:', error);
    alert('Unable to delete chat room. Please try again.');
  }
}

function loadLiveChatRooms() {
  if (liveChatRoomsUnsubscribe) {
    liveChatRoomsUnsubscribe();
  }

  liveChatRoomsUnsubscribe = onSnapshot(collection(db, 'liveChats'), (snapshot) => {
    const rooms = [];
    snapshot.forEach((docSnap) => rooms.push({ id: docSnap.id, ...docSnap.data() }));
    renderAdminChatRooms(rooms);
  }, (error) => {
    console.error('Admin live chat rooms listener error:', error);
  });
}

window.createLiveChatRoom = createLiveChatRoom;
window.loadLiveChatRooms = loadLiveChatRooms;
window.openAdminChatRoom = openAdminChatRoom;
window.closeAdminChatPanel = closeAdminChatPanel;
window.setAdminReplyToMessage = setAdminReplyToMessage;
window.unsendAdminChatMessage = unsendAdminChatMessage;
window.sendAdminChatMessage = sendAdminChatMessage;
window.triggerAdminChatImageInput = triggerAdminChatImageInput;
window.handleAdminChatImageInputChange = handleAdminChatImageInputChange;
window.clearAdminChatImageSelection = clearAdminChatImageSelection;
window.deleteLiveChatRoom = deleteLiveChatRoom;

const adminCreateChatForm = document.getElementById('adminCreateChatForm');
if (adminCreateChatForm) {
  adminCreateChatForm.addEventListener('submit', createLiveChatRoom);
}
const adminChatMessageForm = document.getElementById('adminChatMessageForm');
if (adminChatMessageForm) {
  adminChatMessageForm.addEventListener('submit', sendAdminChatMessage);
}

setupMentionAutocomplete('adminChatMessageInput', 'adminMentionDropdown');

/* TICKET MANAGEMENT FUNCTIONS */
window.respondToTicket = async function(ticketId) {
  console.log('=== RESPOND TO TICKET CALLED ===');
  console.log('ticketId:', ticketId, 'type:', typeof ticketId);
  console.log('window.respondToTicket is defined:', typeof window.respondToTicket);
  const responseText = document.getElementById(`responseInput-${ticketId}`).value.trim();
  if (!responseText) {
    alert("Please enter a response.");
    return;
  }

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      alert("Ticket not found.");
      return;
    }

    const ticket = ticketSnap.data();
    const recipientEmail = ticket.assignedTo || ticket.submittedBy;
    const notificationTitle = "Admin Replied to Your Ticket";
    const notificationBody = `Your ticket \"${ticket.title}\" has a new response from Admin.`;

    await updateDoc(ticketRef, {
      responses: arrayUnion({
        author: "Admin",
        email: adminEmail,
        content: responseText,
        createdAt: new Date()
      }),
      memberEmailNotificationSent: false,
      memberNotificationReason: "admin_response",
      memberNotificationTitle: notificationTitle,
      memberNotificationMessage: responseText,
      memberNotificationAt: new Date()
    });

    if (recipientEmail) {
      await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'ticket');
    }

    document.getElementById(`responseInput-${ticketId}`).value = "";
    alert("Response sent successfully and notification queued.");
  } catch (error) {
    console.error("Error responding to ticket:", error);
    alert("Failed to send response. Please try again.");
  }
};

window.changeTicketStatus = async function(ticketId, newStatus) {
  console.log('=== CHANGE TICKET STATUS CALLED ===');
  console.log('ticketId:', ticketId, 'newStatus:', newStatus);

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      alert("Ticket not found.");
      return;
    }

    const ticket = ticketSnap.data();
    const recipientEmail = ticket.assignedTo || ticket.submittedBy;
    const notificationTitle = "Ticket Status Updated";
    const notificationBody = `Your ticket \"${ticket.title}\" status has been changed to ${newStatus}.`;

    await updateDoc(ticketRef, {
      status: newStatus,
      memberEmailNotificationSent: false,
      memberNotificationReason: "status_changed",
      memberNotificationTitle: notificationTitle,
      memberNotificationMessage: notificationBody,
      memberNotificationAt: new Date()
    });

    if (recipientEmail) {
      await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'ticket');
    }

    alert(`Ticket status changed to ${newStatus}! Notification queued.`);
  } catch (error) {
    console.error("Error changing ticket status:", error);
    alert("Failed to change ticket status. Please try again.");
  }
};

window.deleteTicket = async function(ticketId) {
  console.log('deleteTicket called with ticketId:', ticketId);
  if (confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      alert("Ticket deleted successfully!");
    } catch (error) {
      console.error("Error deleting ticket:", error);
      alert("Failed to delete ticket. Please try again.");
    }
  }
};

/* DELETE RESOURCE */
/* DELETE RESOURCE */
window.deleteResource = async function (id) {
  console.log('deleteResource called with id:', id);
  if (confirm("Are you sure you want to delete this resource? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "resources", id));
      alert("Resource deleted successfully!");
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource. Please try again.");
    }
  }
};

console.log('=== ADMIN.JS FUNCTIONS LOADED ===');
console.log('window.respondToTicket:', typeof window.respondToTicket);
console.log('window.changeTicketStatus:', typeof window.changeTicketStatus);
console.log('window.deleteTicket:', typeof window.deleteTicket);
console.log('window.deleteResource:', typeof window.deleteResource);

})();
