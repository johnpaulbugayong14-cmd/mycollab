import { doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getStoredUserEmail, getStoredUserRole } from "./auth.js";

const WATCH_COLLECTION = "watchTogether";
const WATCH_DOC_ID = "youtubeLobby";
const watchDocRef = doc(db, WATCH_COLLECTION, WATCH_DOC_ID);

let player = null;
let playerReady = false;
let pendingRemoteState = null;
let isApplyingRemoteState = false;
let currentUserEmail = null;
let currentUserRole = null;
let hostSyncInterval = null;
let lastHostSyncTime = 0;

async function loadYouTubeSDK() {
  if (window.YT && window.YT.Player) {
    return;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      const waitForApi = () => {
        if (window.YT && window.YT.Player) {
          resolve();
        } else {
          setTimeout(waitForApi, 100);
        }
      };
      waitForApi();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onload = () => {
      const waitForApi = () => {
        if (window.YT && window.YT.Player) {
          resolve();
        } else {
          setTimeout(waitForApi, 100);
        }
      };
      waitForApi();
    };
    script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
    document.head.appendChild(script);
  });
}

function getEl(id) {
  return document.getElementById(id);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const idMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  if (idMatch && idMatch[1]) return idMatch[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

function userHasControl(hostEmail) {
  if (!currentUserEmail) return false;
  if (!hostEmail) return currentUserRole === 'admin';
  return hostEmail === currentUserEmail || currentUserRole === 'admin';
}

async function updateWatchState(changes) {
  try {
    await updateDoc(watchDocRef, {
      ...changes,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('watchtogether: failed to update state', error);
  }
}

function stopHostSyncTimer() {
  if (hostSyncInterval) {
    clearInterval(hostSyncInterval);
    hostSyncInterval = null;
  }
  lastHostSyncTime = 0;
}

function startHostSyncTimer() {
  stopHostSyncTimer();
  hostSyncInterval = setInterval(async () => {
    if (!player || !playerReady || !currentUserEmail) return;
    const hostEmail = getEl('watchTogetherHost')?.textContent || '';
    if (!userHasControl(hostEmail)) return;

    const currentTime = player.getCurrentTime();
    if (Math.abs(currentTime - lastHostSyncTime) < 1.0) return;

    lastHostSyncTime = currentTime;
    await updateWatchState({
      status: 'playing',
      currentTime
    });
  }, 1200);
}

async function ensureWatchDocExists() {
  const snapshot = await getDoc(watchDocRef);
  if (!snapshot.exists()) {
    await setDoc(watchDocRef, {
      videoId: 'dQw4w9WgXcQ',
      status: 'paused',
      currentTime: 0,
      hostEmail: '',
      updatedAt: serverTimestamp()
    });
  }
}

function updateUI(state) {
  const statusText = getEl('watchTogetherStatus');
  const hostText = getEl('watchTogetherHost');
  const controlNote = getEl('watchTogetherControlNote');
  const loadButton = getEl('loadYoutubeButton');
  const pauseButton = getEl('youtubePauseButton');
  const seekInput = getEl('youtubeSeekTime');
  const seekButton = getEl('seekButton');
  const currentTimeText = getEl('watchTogetherCurrentTime');

  if (statusText) {
    statusText.textContent = state.status === 'playing' ? 'Playing' : 'Paused';
  }
  if (hostText) {
    hostText.textContent = state.hostEmail ? state.hostEmail : 'No host yet';
  }
  if (currentTimeText) {
    currentTimeText.textContent = formatTime(state.currentTime || 0);
  }

  const hasControl = userHasControl(state.hostEmail);
  if (controlNote) {
    if (hasControl) {
      controlNote.textContent = 'You control this lobby. Use the buttons below to sync video playback.';
    } else {
      controlNote.textContent = `Watching in sync. Host: ${state.hostEmail || 'waiting for host'}`;
    }
  }

  if (loadButton) loadButton.disabled = false;
  if (playButton) playButton.disabled = !hasControl;
  if (pauseButton) pauseButton.disabled = !hasControl;
  if (syncButton) syncButton.disabled = !hasControl;
  if (seekInput) seekInput.disabled = !hasControl;
  if (seekButton) seekButton.disabled = !hasControl;
  if (claimButton) claimButton.disabled = state.hostEmail === currentUserEmail;
}

async function applyRemoteState(state) {
  if (!playerReady || !player) return;
  isApplyingRemoteState = true;

  const currentTime = state.currentTime || 0;
  const videoId = state.videoId;

  if (videoId && videoId !== player.getVideoData().video_id) {
    player.loadVideoById({
      videoId,
      startSeconds: currentTime,
      suggestedQuality: 'large'
    });
  }

  const localTime = player.getCurrentTime();
  const timeDifference = Math.abs(localTime - currentTime);
  if (timeDifference > 1.5) {
    player.seekTo(currentTime, true);
  }

  if (state.status === 'playing') {
    player.playVideo();
  } else {
    player.pauseVideo();
  }

  updateUI(state);

  const hostEmail = state.hostEmail || '';
  if (state.status === 'playing' && userHasControl(hostEmail)) {
    startHostSyncTimer();
  } else {
    stopHostSyncTimer();
  }

  isApplyingRemoteState = false;
}

function onPlayerStateChange(event) {
  if (isApplyingRemoteState) return;
  const state = event.data;
  if (!player || !currentUserEmail) return;
  const hostEmail = getEl('watchTogetherHost')?.textContent || '';
  const hasControl = userHasControl(hostEmail);
  if (!hasControl) return;

  if (state === window.YT.PlayerState.PLAYING) {
    updateWatchState({ status: 'playing', currentTime: player.getCurrentTime() });
    startHostSyncTimer();
  } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) {
    stopHostSyncTimer();
    updateWatchState({ status: 'paused', currentTime: player.getCurrentTime() });
  }
}

function createPlayer() {
  const playerContainer = getEl('youtube-player');
  if (!playerContainer) return;

  player = new window.YT.Player('youtube-player', {
    height: '360',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: () => {
        playerReady = true;
        if (pendingRemoteState) {
          applyRemoteState(pendingRemoteState);
        }
      },
      onStateChange: onPlayerStateChange
    }
  });
}

async function initWatchTogether() {
  currentUserEmail = await getStoredUserEmail();
  currentUserRole = await getStoredUserRole();
  if (!currentUserEmail) {
    currentUserEmail = 'guest';
  }

  const section = getEl('watch-together');
  if (!section) return;

  const loadButton = getEl('loadYoutubeButton');
  const claimButton = getEl('claimHostButton');
  const playButton = getEl('youtubePlayButton');
  const pauseButton = getEl('youtubePauseButton');
  const syncButton = getEl('syncButton');
  const seekButton = getEl('seekButton');
  const seekInput = getEl('youtubeSeekTime');

  await loadYouTubeSDK();
  createPlayer();
  await ensureWatchDocExists();

  onSnapshot(watchDocRef, (snapshot) => {
    if (!snapshot.exists()) return;
    pendingRemoteState = snapshot.data();
    if (playerReady) {
      applyRemoteState(pendingRemoteState);
    }
  });

  if (loadButton) {
    loadButton.addEventListener('click', async () => {
      const url = getEl('youtubeUrlInput')?.value;
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        alert('Please enter a valid YouTube link or video ID.');
        return;
      }
      await updateWatchState({
        videoId,
        status: 'paused',
        currentTime: 0,
        hostEmail: currentUserEmail
      });
      getEl('youtubeUrlInput').value = '';
    });
  }

  if (claimButton) {
    claimButton.addEventListener('click', async () => {
      await updateWatchState({ hostEmail: currentUserEmail });
    });
  }

  if (playButton) {
    playButton.addEventListener('click', async () => {
      if (!playerReady) return;
      await updateWatchState({ status: 'playing', currentTime: player.getCurrentTime() });
    });
  }

  if (pauseButton) {
    pauseButton.addEventListener('click', async () => {
      if (!playerReady) return;
      await updateWatchState({ status: 'paused', currentTime: player.getCurrentTime() });
    });
  }

  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      if (!playerReady) return;
      await updateWatchState({ currentTime: player.getCurrentTime() });
    });
  }

  if (seekButton) {
    seekButton.addEventListener('click', async () => {
      const value = Number(seekInput?.value);
      if (Number.isNaN(value) || value < 0) {
        alert('Please enter a valid time in seconds to seek.');
        return;
      }
      await updateWatchState({ currentTime: value, status: 'paused' });
    });
  }
}

initWatchTogether().catch(error => {
  console.error('watchtogether: initialization failed', error);
});
