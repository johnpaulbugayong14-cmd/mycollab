import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc, setDoc, arrayUnion, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./firebase.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStoredUserEmail, signOutUser } from "./auth.js";
import { initializeNotifications, sendNotificationToUsers, showLocalNotification } from "./notifications.js";

window.signOutUser = signOutUser;

let userEmail = null;
let meetingsUnsubscribe = null;
let chatRoomsUnsubscribe = null;
let chatMessagesUnsubscribe = null;
let selectedChatId = null;
let chatRoomsById = {};
let chatMessagesById = {};
let replyToMessage = null;
let selectedChatImageData = null;
let selectedChatImageName = null;
const container = document.getElementById("tasks");
const emptyState = document.getElementById("emptyState");
const welcomeEl = document.getElementById("welcome");
const datetimeEl = document.getElementById("datetime");
const pollsContainer = document.getElementById("polls");
const pollsEmptyState = document.getElementById("pollsEmptyState");
const announcementsContainer = document.getElementById("announcements");
const announcementsEmptyState = document.getElementById("announcementsEmptyState");

const members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" },
  { uid: "johnpaulbugayong@gmail.com", name: "Admin" }
];

const mentionUsers = [
  ...members.filter(member => member.uid !== 'everyone'),
  { uid: 'johnpaulbugayong@gmail.com', name: 'Admin' }
];

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getUserName(email) {
  const normalized = normalizeEmail(email);
  const member = members.find(m => normalizeEmail(m.uid) === normalized);
  return member ? member.name : email;
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

function getSafePollOptions(poll) {
  return Array.isArray(poll.options) ? poll.options : [];
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
        return `
          <div style="padding: 0.75rem; background: #111827; border: 1px solid #374151; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <span style="color: #d1d5db;">${item.name}</span>
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
  const progressRef = doc(db, progressReportCollection, progressReportDocId);
  onSnapshot(progressRef, (snap) => {
    const defaultSections = getDefaultProgressStructure();
    let sections = defaultSections;
    
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.sections)) {
        // Merge saved data with default structure to include new items
        sections = mergeProgressStructures(defaultSections, data.sections);
      } else {
        setDoc(progressRef, { sections: defaultSections }, { merge: true });
      }
    } else {
      setDoc(progressRef, { sections: defaultSections }, { merge: true });
    }
    renderMemberProgressReport(sections);
  }, (error) => {
    console.error('Progress report onSnapshot error:', error);
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

  const title = document.getElementById("ticketTitle").value.trim();
  const description = document.getElementById("ticketDescription").value.trim();
  console.log('Ticket data - title:', title, 'description:', description);

  if (!title || !description) {
    alert("Please fill in both title and description.");
    window.isSubmittingTicket = false;
    return;
  }

  try {
    console.log('Adding ticket to Firestore...');
    console.log('Submitting ticket with userEmail:', userEmail);
    await addDoc(collection(db, "tickets"), {
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

    // Send notification to admin (non-blocking)
    try {
      const adminEmail = "johnpaulbugayong@gmail.com"; // Admin email
      const notificationTitle = "New Support Ticket Submitted";
      const notificationBody = `New ticket: "${title}" submitted by ${getUserName(userEmail)}`;
      console.log('Sending notification...');
      await sendNotificationToUsers([adminEmail], notificationTitle, notificationBody, 'ticket');
      console.log('Notification process completed');
    } catch (notificationError) {
      console.warn("Notification process failed:", notificationError);
    }

    // Clear form
    document.getElementById("ticketTitle").value = "";
    document.getElementById("ticketDescription").value = "";

    alert("✅ Ticket submitted successfully! The admin will review it soon." + 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 
           "\n\n📱 Note: Push notifications are disabled in local development." : ""));
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
    let pollCount = 0;

    const docs = [];
    snap.forEach(doc => docs.push(doc));
    docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

    docs.forEach(doc => {
      const poll = doc.data() || {};
      pollCount++;
      
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
        <div class="poll-item" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${poll.question || "Untitled Poll"}</h4>
          <p style="color: #9ca3af; margin: 0 0 1rem 0; font-size: 0.875rem;">Total votes: ${totalVotes}</p>
          ${optionsHtml}
        </div>
      `;
    });

    pollsEmptyState.style.display = pollCount === 0 ? "block" : "none";
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
        <div>
          <span style="font-weight: 600; color: #f3f4f6;">${comment.author || comment.email || 'Member'}</span>
          <div style="font-size: 0.8rem; color: #9ca3af;">${formatAnnouncementDate(comment.createdAt)}</div>
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

    const docs = [];
    snap.forEach(doc => docs.push(doc));
    docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

    docs.forEach(doc => {
      const announcement = doc.data();
      const assignedTo = Array.isArray(announcement.assignedTo) ? announcement.assignedTo : ["everyone"];
      if (!assignedTo.includes("everyone") && !assignedTo.includes(userEmail)) return;
      
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

    announcementsEmptyState.style.display = announcementCount === 0 ? "block" : "none";
  }, (error) => {
    console.error('Announcements onSnapshot error:', error);
  });
}

function loadResources() {
  const container = document.getElementById("resources");
  const emptyState = document.getElementById("resourcesEmptyState");
  if (!container) {
    console.log('=== RESOURCES CONTAINER NOT FOUND ===');
    return;
  }

  console.log('=== MEMBER RESOURCES LISTENER SETUP ===');
  onSnapshot(collection(db, "resources"), (snap) => {
    console.log('=== MEMBER RESOURCES LISTENER TRIGGERED ===');
    console.log('Resources snapshot received, docs count:', snap.size);
    container.innerHTML = "";

    if (emptyState) {
      emptyState.style.display = snap.empty ? "block" : "none";
    }

    if (snap.empty) {
      container.innerHTML = "";
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

function getChatRoomDisplayName(email) {
  return getUserName(email) || email;
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
    createdByName: getUserName(currentEmail),
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
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No live chat rooms available yet.</p>';
    return;
  }

  chatRooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  chatRoomsById = {};
  container.innerHTML = '';

  chatRooms.forEach((room) => {
    chatRoomsById[room.id] = room;
    const roomDiv = document.createElement('div');
    roomDiv.style.cssText = 'border: 1px solid #374151; background: #1e293b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;';
    const createdBy = room.createdByName || getUserName(room.createdByEmail) || 'Unknown';
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
        <button onclick="openChatRoom('${room.id}')" style="background: ${isActive ? '#10b981' : '#6b7280'}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">${isActive ? 'Open Chat' : 'View Chat'}</button>
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
        <div style="font-size: 0.9rem; color: #e5e7eb; line-height: 1.4;">${escapeHtml(msg.replyToText || '')}</div>
      </div>
    ` : '';
    const buttonBaseStyle = 'display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(96, 165, 250, 0.12); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;';
    const replyButton = !msg.deleted ? `<button type="button" onclick="setReplyToMessage('${msg.id}')" style="${buttonBaseStyle}">Reply</button>` : '';
    const unsendButton = isOwnMessage && !msg.deleted ? `<button type="button" onclick="unsendChatMessage('${selectedChatId}', '${msg.id}')" style="${buttonBaseStyle}">Unsend</button>` : '';
    const actionButtons = [replyButton, unsendButton].filter(Boolean).join('<span style="margin: 0 0.35rem; color: #374151;">|</span>');

    msgDiv.innerHTML = `
      ${replyPreview}
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem; opacity: ${opacity};">
        <div style="font-size: 0.85rem; color: #94a3b8;">${escapeHtml(sender)}</div>
        <div style="font-size: 0.75rem; color: #6b7280;">${timestamp}</div>
      </div>
      <div style="color: ${msg.deleted ? '#9ca3af' : '#e5e7eb'}; line-height: 1.6; margin-bottom: 0.5rem;">${imageMarkup}${renderedText}</div>
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
  const chatRoom = chatRoomsById[chatId];
  if (!chatRoom) return;

  selectedChatId = chatId;

  const panel = document.getElementById('chatRoomPanel');
  const titleEl = document.getElementById('activeChatTitle');
  const metaEl = document.getElementById('activeChatMeta');
  const messageInput = document.getElementById('chatMessageInput');
  const messageForm = document.getElementById('chatMessageForm');

  if (panel) panel.style.display = 'block';
  if (titleEl) titleEl.textContent = chatRoom.title;
  if (metaEl) metaEl.textContent = `Created by ${chatRoom.createdByName || getUserName(chatRoom.createdByEmail)} • Status: ${chatRoom.status}`;
  if (messageInput) messageInput.disabled = chatRoom.status !== 'Active';
  if (messageForm) messageForm.style.opacity = chatRoom.status !== 'Active' ? '0.7' : '1';

  clearReplyToMessage();
  subscribeChatMessages(chatId);
}

function closeChatRoomPanel() {
  const panel = document.getElementById('chatRoomPanel');
  if (panel) panel.style.display = 'none';

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

  const reader = new FileReader();
  reader.onload = () => {
    selectedChatImageData = reader.result;
    selectedChatImageName = file.name;
    updateChatImagePreview();
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
    senderName: getUserName(currentEmail),
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
window.sendChatMessage = sendChatMessage;
window.triggerChatImageInput = triggerChatImageInput;
window.handleChatImageInputChange = handleChatImageInputChange;
window.clearChatImageSelection = clearChatImageSelection;

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
    console.log('User authenticated, setting up dashboard for:', userEmail);
    if (!auth.currentUser) {
      console.log('Auth not ready, signing in anonymously...');
      await signInAnonymously(auth);
      console.log('Auth ready');
    }
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${getUserName(userEmail)}`;
    console.log('User logged in as:', userEmail);
    console.log('Starting to load data from Firestore...');
    
    // Initialize notifications
    initializeNotifications();
    
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

      const docs = [];
      snap.forEach(doc => docs.push(doc));
      docs.sort((a, b) => b.data().createdAt - a.data().createdAt);

      docs.forEach(doc => {
        const t = doc.data();
        console.log('Processing task:', t.title, 'assigned to:', t.assignedTo, 'current user:', userEmail);
        if (t.assignedTo !== "everyone" && t.assignedTo !== userEmail) return;

        taskCount++;
        const warning = getDeadlineWarning(t.deadline, t.status);
        container.innerHTML += `
          <div class="task-item ${warning.class} ${t.status === "needs action" ? "task-needs-action" : ""}">
            <div class="task-header">
              <h3 class="task-title">${t.title}</h3>
              <span class="task-status ${t.status === "done" ? "status-completed" : t.status === "pending validation" ? "status-validation" : t.status === "needs action" ? "status-needs-action" : "status-pending"}">${t.status === "needs action" ? "Needs Action" : t.status}</span>
              ${warning.message ? `<span class="task-warning">${warning.message}</span>` : ""}
            </div>
            ${t.description ? `<p style="color: #cbd5e1; margin: 0.75rem 0;">${t.description}</p>` : ""}
            ${t.status === "needs action" ? `<p style="color: #f59e0b; margin: 0.5rem 0; font-weight: bold;">⚠️ This task needs your immediate action from the admin.</p>` : ""}
            <div class="task-meta">
              <span>📅 ${t.deadline}</span>
            </div>
            ${t.linkURL ? `<a href="${t.linkURL}" target="_blank" style="display: inline-block; margin-top: 0.5rem;">🔗 Open Link</a>` : ""}
            ${t.status === "pending" || t.status === "needs action" ? `<button onclick="markDone('${doc.id}')" class="btn-submit">Already Submitted</button>` : ""}
          </div>
        `;
      });

      if (emptyState) {
        emptyState.style.display = taskCount === 0 ? "block" : "none";
      }

      if (taskCount === 0 && !emptyState) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">No tasks assigned yet. Check back soon!</p>';
      }
    }, (error) => {
      console.error('Tasks onSnapshot error:', error);
    });
    
    // Load polls and announcements
    loadPolls();
    loadAnnouncements();
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

function loadTicketHistory() {
  console.log('=== loadTicketHistory CALLED - STARTING ===');

  const container = document.getElementById("ticketHistory");
  const emptyState = document.getElementById("ticketHistoryEmptyState");
  const ticketCard = container?.closest('.card');

  if (!container) {
    console.log('=== TICKET HISTORY CONTAINER NOT FOUND ===');
    return;
  }

  if (ticketCard) {
    ticketCard.style.display = "block";
  }

  console.log('Container found, userEmail:', userEmail);

  // Show the section immediately with a static message
  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = '<div style="padding: 1rem; border: 2px solid #ff0000; border-radius: 0.5rem; background: #ffcccc; margin-bottom: 1rem;"><h4 style="margin: 0 0 0.5rem 0; color: #000000;">🎟️ TICKET HISTORY SECTION IS NOW VISIBLE!</h4><p style="margin: 0; color: #000000; font-weight: bold;">This section is working! User Email: ' + (userEmail || 'NULL') + '. Tickets will load here when available.</p></div>';

  // Optional: Still try to load from Firebase in background
  if (userEmail) {
    // Use real-time listener like admin
    const unsubscribe = onSnapshot(collection(db, "tickets"), (snapshot) => {
      console.log('=== TICKETS SNAPSHOT RECEIVED ===');
      console.log('Found', snapshot.size, 'tickets');

      let ticketHtml = '';
      let ticketCount = 0;

      // Collect all tickets first
      const docs = [];
      snapshot.forEach(doc => docs.push(doc));
      
      // Sort by createdAt descending (newest first)
      docs.sort((a, b) => {
        const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
        const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
        return timeB - timeA;
      });

      docs.forEach(doc => {
        const ticket = doc.data();
        console.log('Processing ticket:', ticket);

        // Filter by assigned user
        if (userEmail && ticket.assignedTo !== userEmail) {
          console.log('Skipping ticket - not assigned to current user');
          return;
        }

        ticketCount++;

        const createdDate = ticket.createdAt?.toDate?.() ? ticket.createdAt.toDate().toLocaleDateString() : "Unknown date";
        const status = ticket.status || "open";
        const statusLabel = status === "pending validation" ? "Pending Validation" : status.charAt(0).toUpperCase() + status.slice(1);

        const responses = Array.isArray(ticket.responses) ? ticket.responses : [];
        const responseHtml = responses.length > 0 ?
          responses.map(response => `
            <div style="margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid #4b5563; border-radius: 0.25rem; background: #1f2937;">
              <strong>${response.author || 'Admin'}:</strong> ${response.content}
            </div>
          `).join('') : '<p style="color: #9ca3af; margin: 0;">No admin feedback yet.</p>';

        ticketHtml += `
          <div style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1e293b;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; color: #f3f4f6;">${ticket.title}</h4>
              <span style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; font-weight: 600; background: ${status === 'open' ? '#ef4444' : status === 'pending validation' ? '#f59e0b' : '#10b981'}; color: white;">${statusLabel}</span>
            </div>
            <p style="margin: 0 0 0.5rem 0; color: #94a3b8; font-size: 0.8rem;">Assigned: ${createdDate}</p>
            <p style="margin: 0 0 0.5rem 0; color: #d1d5db;">${ticket.description}</p>
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
    }, (error) => {
      console.error('Error loading tickets:', error);
      // Keep the static message on error
    });

    // Store unsubscribe function if needed for cleanup
    window.ticketHistoryUnsubscribe = unsubscribe;
  }
}

// Make loadTicketHistory available globally
window.loadTicketHistory = loadTicketHistory;


