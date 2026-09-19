import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwaMDGG7ke7fwM0wYsywSfPPZ2qZGPZLc",
  authDomain: "mycollab-89c11.firebaseapp.com",
  projectId: "mycollab-89c11",
  storageBucket: "mycollab-89c11.firebasestorage.app",
  messagingSenderId: "1089766419760",
  appId: "1:1089766419760:web:26b4307d2fd78fd067acf5",
  measurementId: "G-N0JF8FKPHP"
};

const app = initializeApp(firebaseConfig);
console.log('=== FIREBASE APP INITIALIZED ===');

// Use the same Firestore transport as the GitHub-hosted web app in every runtime.
export const db = initializeFirestore(app, {});
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
