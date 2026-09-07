import { collection, doc, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { requireAuth, getStoredUserEmail } from "./auth.js";

let currentSurvey = null;
let currentEmail = null;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSurveyId() {
  return new URLSearchParams(window.location.search).get('surveyId');
}

function matchesTarget(survey, email) {
  const targets = Array.isArray(survey.targetEmails) ? survey.targetEmails.map(normalizeEmail) : [];
  return targets.includes(normalizeEmail(email)) || targets.includes('everyone') || targets.includes('all');
}

function showMessage(message, isError = false) {
  const loading = document.getElementById('surveyLoading');
  if (!loading) return;
  loading.textContent = message;
  loading.style.color = isError ? '#fecaca' : '#bfdbfe';
  loading.style.borderColor = isError ? 'rgba(248, 113, 113, 0.4)' : 'rgba(96, 165, 250, 0.35)';
}

function renderSurveyIntro(survey) {
  const loading = document.getElementById('surveyLoading');
  const intro = document.getElementById('surveyIntro');
  const title = document.getElementById('surveyIntroTitle');
  const description = document.getElementById('surveyIntroDescription');
  const participateButton = document.getElementById('participateNowButton');
  if (!loading || !intro || !title || !description || !participateButton) return;

  title.textContent = survey.title || 'Survey';
  description.textContent = survey.description || 'Please participate in this survey and submit your response.';
  participateButton.onclick = () => {
    const nextUrl = `survey.html?surveyId=${encodeURIComponent(survey.id)}&participate=1`;
    window.location.replace(nextUrl);
  };
  loading.style.display = 'none';
  intro.style.display = 'block';
}

function renderSurvey(survey) {
  const loading = document.getElementById('surveyLoading');
  const content = document.getElementById('surveyContent');
  const title = document.getElementById('surveyTitle');
  const description = document.getElementById('surveyDescription');
  const form = document.getElementById('surveyForm');
  const intro = document.getElementById('surveyIntro');
  if (!loading || !content || !title || !description || !form) return;

  title.textContent = survey.title || 'Survey';
  description.textContent = survey.description || '';
  const questionMarkup = (Array.isArray(survey.questions) ? survey.questions : []).map((question, index) => {
    const questionText = escapeHtml(question);
    if (survey.mode === 'likert') {
      return `
        <fieldset class="survey-question">
          <div class="survey-question-prompt">${index + 1}. ${questionText}</div>
          <div class="likert-options">
            ${[1, 2, 3, 4, 5].map(value => `
              <label>
                <input type="radio" name="answer-${index}" value="${value}" required>
                <span>${value}</span>
              </label>
            `).join('')}
          </div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.75rem; margin-top:0.35rem;"><span>Strongly disagree</span><span>Strongly agree</span></div>
        </fieldset>
      `;
    }

    return `
      <div class="survey-question">
        <label for="answer-${index}">${index + 1}. ${questionText}</label>
        <textarea id="answer-${index}" name="answer-${index}" rows="4" required placeholder="Enter your answer"></textarea>
      </div>
    `;
  }).join('');

  const suggestionMarkup = survey.includeSuggestion === true ? `
    <div class="survey-question">
      <label for="surveySuggestion">Optional suggestion or recommendation</label>
      <textarea id="surveySuggestion" name="surveySuggestion" rows="5" class="survey-suggestion-box" placeholder="Share any suggestion you have"></textarea>
    </div>
  ` : '';

  form.innerHTML = questionMarkup + suggestionMarkup + '<button type="submit" class="survey-submit"><i class="fas fa-paper-plane"></i> Submit Survey</button>';

  loading.style.display = 'none';
  if (intro) intro.style.display = 'none';
  content.style.display = 'block';
  form.addEventListener('submit', submitSurvey);
}

async function submitSurvey(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const answers = (Array.isArray(currentSurvey.questions) ? currentSurvey.questions : []).map((question, index) => {
    const value = form.elements[`answer-${index}`]?.value;
    return { question, answer: currentSurvey.mode === 'likert' ? Number(value) : String(value || '').trim() };
  });
  const suggestion = currentSurvey.includeSuggestion === true
    ? String(form.elements.surveySuggestion?.value || '').trim()
    : '';

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
  }

  try {
    await setDoc(doc(db, 'surveys', currentSurvey.id, 'responses', normalizeEmail(currentEmail)), {
      surveyId: currentSurvey.id,
      surveyTitle: currentSurvey.title || 'Survey',
      memberEmail: normalizeEmail(currentEmail),
      answers,
      suggestion,
      submittedAt: new Date()
    });
    window.location.href = 'member.html';
  } catch (error) {
    console.error('Unable to submit survey:', error);
    showMessage('Unable to submit the survey. Please try again.', true);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Survey';
    }
  }
}

async function init() {
  await requireAuth(['member', 'admin']);
  currentEmail = await getStoredUserEmail();
  const surveyId = getSurveyId();
  if (!surveyId || !currentEmail) {
    showMessage('This survey link is invalid.', true);
    return;
  }

  const surveySnap = await getDoc(doc(db, 'surveys', surveyId));
  if (!surveySnap.exists()) {
    showMessage('This survey is no longer available.', true);
    return;
  }

  currentSurvey = { id: surveySnap.id, ...surveySnap.data() };
  if (currentSurvey.active === false || !matchesTarget(currentSurvey, currentEmail)) {
    showMessage('You are not assigned to this survey.', true);
    return;
  }

  const responseSnap = await getDoc(doc(db, 'surveys', surveyId, 'responses', normalizeEmail(currentEmail)));
  if (responseSnap.exists()) {
    window.location.href = 'member.html';
    return;
  }

  const participate = new URLSearchParams(window.location.search).get('participate') === '1';
  if (participate) {
    renderSurvey(currentSurvey);
  } else {
    renderSurveyIntro(currentSurvey);
  }
}

init().catch(error => {
  console.error('Survey initialization failed:', error);
  showMessage('Unable to load this survey. Please try again.', true);
});
