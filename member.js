import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc, setDoc, arrayUnion, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./firebase.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStoredUserEmail, signOutUser } from "./auth.js";
import { initializeNotifications, sendNotificationToUsers, showLocalNotification } from "./notifications.js";

window.signOutUser = signOutUser;

let userEmail = null;
let meetingsUnsubscribe = null;
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
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" }
];

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";

function getUserName(email) {
  const member = members.find(m => m.uid === email);
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
        { name: "Background of the Study", status: "Not Started" },
        { name: "Statement of the Problem", status: "Not Started" },
        { name: "Objectives of the Study", status: "Not Started" },
        { name: "Scope and Delimitation", status: "Not Started" },
        { name: "Significance of the Study", status: "Not Started" },
        { name: "Definition of Terms", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 2 – Review of Related Literature (RRL)",
      items: [
        { name: "Related studies and literature", status: "Not Started" },
        { name: "Theoretical framework (if required)", status: "Not Started" },
        { name: "Conceptual framework", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 3 – Methodology",
      items: [
        { name: "Research design", status: "Not Started" },
        { name: "Materials / instruments", status: "Not Started" },
        { name: "Procedure / implementation", status: "Not Started" },
        { name: "Data gathering method", status: "Not Started" },
        { name: "Statistical treatment (if applicable)", status: "Not Started" }
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

function loadProgressReport() {
  const progressRef = doc(db, progressReportCollection, progressReportDocId);
  onSnapshot(progressRef, (snap) => {
    let sections = getDefaultProgressStructure();
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.sections)) {
        sections = data.sections.map(section => ({
          ...section,
          items: Array.isArray(section.items) ? section.items.map(item => ({
            assignedTo: Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []),
            assignedToName: Array.isArray(item.assignedToName) ? item.assignedToName : (item.assignedToName ? [item.assignedToName] : []),
            ...item
          })) : []
        }));
      }
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


