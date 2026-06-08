import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJt3bCDYaqzLe_vGiFqvCMehJedZFvSJs",
  authDomain: "task-edd4d.firebaseapp.com",
  projectId: "task-edd4d",
  storageBucket: "task-edd4d.firebasestorage.app",
  messagingSenderId: "372695845973",
  appId: "1:372695845973:web:23b25b0de8ca2b72dfd8dc"
};

const app = initializeApp(firebaseConfig);
console.log('=== FIREBASE APP INITIALIZED ===');

export const db = getFirestore(app);
console.log('=== FIRESTORE DB INITIALIZED ===');
export const storage = getStorage(app);
export const auth = getAuth(app);

let messaging = null;
try {
  // Only try to initialize messaging if supported (mainly for web)
  // On native Android, we use the Capacitor Push Notifications plugin instead
  messaging = getMessaging(app);
} catch (e) {
  console.warn("Firebase Messaging not supported or failed to initialize:", e);
}

export { messaging };
