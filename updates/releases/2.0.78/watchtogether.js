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
  if (window.YT && window.YT.Player) return;

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

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

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
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

    script.onerror = () =>
      reject(new Error("Failed to load YouTube API"));

    document.head.appendChild(script);
  });
}

function getEl(id) {
  return document.getElementById(id);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;

  const trimmed = urlOrId.trim();

  const idMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/
  );

  if (idMatch && idMatch[1]) return idMatch[1];

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  return null;
}

function userHasControl(hostEmail) {
  if (!currentUserEmail) return false;

  if (!hostEmail) {
    return currentUserRole === "admin";
  }

  return (
    hostEmail === currentUserEmail ||
    currentUserRole === "admin"
  );
}

async function updateWatchState(changes) {
  try {
    await updateDoc(watchDocRef, {
      ...changes,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("watchtogether update failed", error);
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

    const hostEmail =
      getEl("watchTogetherHost")?.textContent || "";

    if (!userHasControl(hostEmail)) return;

    const currentTime = player.getCurrentTime();

    if (
      Math.abs(currentTime - lastHostSyncTime) < 1
    ) {
      return;
    }

    lastHostSyncTime = currentTime;

    await updateWatchState({
      status: "playing",
      currentTime
    });

  }, 1200);
}

async function ensureWatchDocExists() {
  const snapshot = await getDoc(watchDocRef);

  if (!snapshot.exists()) {
    await setDoc(watchDocRef, {
      videoId: "",
      status: "paused",
      currentTime: 0,
      hostEmail: "",
      updatedAt: serverTimestamp()
    });
  }
}

function updateUI(state) {
  const statusText = getEl("watchTogetherStatus");
  const hostText = getEl("watchTogetherHost");
  const controlNote = getEl("watchTogetherControlNote");
  const currentTimeText = getEl("watchTogetherCurrentTime");

  if (statusText) {
    statusText.textContent =
      state.status === "playing"
        ? "Playing"
        : "Paused";
  }

  if (hostText) {
    hostText.textContent =
      state.hostEmail || "No host yet";
  }

  if (currentTimeText) {
    currentTimeText.textContent =
      formatTime(state.currentTime || 0);
  }

  const hasControl =
    userHasControl(state.hostEmail);

  if (controlNote) {
    if (hasControl) {
      controlNote.textContent =
        "You control this lobby.";
    } else {
      controlNote.textContent =
        `Watching host: ${
          state.hostEmail || "none"
        }`;
    }
  }

  [
    "youtubePlayButton",
    "youtubePauseButton",
    "youtubeStopButton",
    "syncButton",
    "seekButton"
  ].forEach(id => {
    const el = getEl(id);

    if (el) {
      el.disabled = !hasControl;
    }
  });

  const seekInput =
    getEl("youtubeSeekTime");

  if (seekInput) {
    seekInput.disabled = !hasControl;
  }
}

async function applyRemoteState(state) {
  if (!playerReady || !player) return;

  isApplyingRemoteState = true;

  const currentTime =
    state.currentTime || 0;

  const videoId =
    state.videoId || "";

  if (!videoId) {

    try {
      player.stopVideo();
      player.clearVideo();
    } catch {}

    updateUI(state);
    stopHostSyncTimer();

    isApplyingRemoteState = false;

    return;
  }

  const currentVideo =
    player.getVideoData()?.video_id || "";

  if (videoId !== currentVideo) {

    player.loadVideoById({
      videoId,
      startSeconds: currentTime
    });

  }

  const localTime =
    player.getCurrentTime();

  if (
    Math.abs(localTime - currentTime) > 1.5
  ) {
    player.seekTo(
      currentTime,
      true
    );
  }

  if (
    state.status === "playing"
  ) {
    player.playVideo();
  } else {
    player.pauseVideo();
  }

  updateUI(state);

  if (
    state.status === "playing" &&
    userHasControl(
      state.hostEmail
    )
  ) {
    startHostSyncTimer();
  } else {
    stopHostSyncTimer();
  }

  isApplyingRemoteState = false;
}

function onPlayerStateChange(
  event
) {
  if (
    isApplyingRemoteState
  ) {
    return;
  }

  if (
    !player ||
    !currentUserEmail
  ) {
    return;
  }

  const hostEmail =
    getEl(
      "watchTogetherHost"
    )?.textContent || "";

  if (
    !userHasControl(
      hostEmail
    )
  ) {
    return;
  }

  if (
    event.data ===
    window.YT.PlayerState.PLAYING
  ) {

    updateWatchState({
      status: "playing",
      currentTime:
        player.getCurrentTime()
    });

    startHostSyncTimer();

  } else if (
    event.data ===
      window.YT.PlayerState.PAUSED ||
    event.data ===
      window.YT.PlayerState.ENDED
  ) {

    stopHostSyncTimer();

    updateWatchState({
      status: "paused",
      currentTime:
        player.getCurrentTime()
    });

  }
}

function createPlayer() {
  const container =
    getEl(
      "youtube-player"
    );

  if (!container) return;

  player =
    new window.YT.Player(
      "youtube-player",
      {
        height: "360",
        width: "100%",

        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0
        },

        events: {
          onReady: () => {

            playerReady = true;

            if (
              pendingRemoteState
            ) {
              applyRemoteState(
                pendingRemoteState
              );
            }

          },

          onStateChange:
            onPlayerStateChange
        }
      }
    );
}

async function initWatchTogether() {

  currentUserEmail =
    await getStoredUserEmail();

  currentUserRole =
    await getStoredUserRole();

  if (
    !currentUserEmail
  ) {
    currentUserEmail =
      "guest";
  }

  if (
    !getEl(
      "watch-together"
    )
  ) {
    return;
  }

  await loadYouTubeSDK();

  createPlayer();

  await ensureWatchDocExists();

  onSnapshot(
    watchDocRef,
    snapshot => {

      if (
        !snapshot.exists()
      ) {
        return;
      }

      pendingRemoteState =
        snapshot.data();

      if (
        playerReady
      ) {
        applyRemoteState(
          pendingRemoteState
        );
      }

    }
  );

  getEl(
    "loadYoutubeButton"
  )?.addEventListener(
    "click",
    async () => {

      const url =
        getEl(
          "youtubeUrlInput"
        )?.value;

      const videoId =
        extractYouTubeId(
          url
        );

      if (
        !videoId
      ) {

        alert(
          "Enter a valid YouTube link."
        );

        return;
      }

      await updateWatchState(
        {
          videoId,
          status:
            "paused",
          currentTime: 0,
          hostEmail:
            currentUserEmail
        }
      );

      getEl(
        "youtubeUrlInput"
      ).value = "";

    }
  );

  getEl(
    "youtubePlayButton"
  )?.addEventListener(
    "click",
    async () => {

      await updateWatchState(
        {
          status:
            "playing",
          currentTime:
            player.getCurrentTime()
        }
      );

    }
  );

  getEl(
    "youtubePauseButton"
  )?.addEventListener(
    "click",
    async () => {

      await updateWatchState(
        {
          status:
            "paused",
          currentTime:
            player.getCurrentTime()
        }
      );

    }
  );

  getEl(
    "youtubeStopButton"
  )?.addEventListener(
    "click",
    async () => {

      await updateWatchState(
        {
          videoId: "",
          status:
            "paused",
          currentTime: 0
        }
      );

    }
  );

  getEl(
    "syncButton"
  )?.addEventListener(
    "click",
    async () => {

      await updateWatchState(
        {
          currentTime:
            player.getCurrentTime()
        }
      );

    }
  );

  getEl(
    "seekButton"
  )?.addEventListener(
    "click",
    async () => {

      const value =
        Number(
          getEl(
            "youtubeSeekTime"
          )?.value
        );

      if (
        Number.isNaN(
          value
        ) ||
        value < 0
      ) {

        alert(
          "Invalid seek time."
        );

        return;
      }

      await updateWatchState(
        {
          currentTime:
            value,
          status:
            "paused"
        }
      );

    }
  );
}

initWatchTogether().catch(
  error => {
    console.error(
      "watchtogether init failed",
      error
    );
  }
);