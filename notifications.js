/**
 * Notification System for My Thesis Hub
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to Firebase Console > Project Settings > Cloud Messaging
 * 2. Add your Web Push certificate public key below
 * 3. Add your Android `google-services.json` for native Android push support
 * 4. Use Firebase Cloud Functions or your own server to send messages to FCM tokens
 */

import { db, messaging } from "./firebase.js";
import { getStoredUserEmail } from "./auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

// IMPORTANT: Replace with your actual VAPID public key from Firebase Console
// Steps to get your VAPID key:
// 1. Go to https://console.firebase.google.com
// 2. Select your project (task-edd4d)
// 3. Go to Project Settings (gear icon)
// 4. Click on "Cloud Messaging" tab
// 5. Scroll down to "Web Push certificates"
// 6. Click "Generate key pair" (if not already generated)
// 7. Copy the "Key pair" value and replace the line below
const VAPID_PUBLIC_KEY = 'BBu_m1NKUZO5bp6k5q29DgzYpmjVWe8z1C6KojHrq7RDqOJ0O01txWvzqKWrnLMAGlrm8eOcdTn_O1wDnf5OZB8';

const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

export async function requestNotificationPermission() {
  if (isNative) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const permission = await PushNotifications.requestPermissions();
      return permission.receive === 'granted';
    } catch (error) {
      console.error('Error requesting native notification permission:', error);
      return false;
    }
  }

  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
}

async function getFcmToken(registration) {
  // Check if VAPID key is configured (real keys are much longer than the placeholder)
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.length < 50 || VAPID_PUBLIC_KEY === 'BBu_m1NKUZO5bp6k5q29DgzYpmjVWe8z1C6KojHrq7RDqOJ0O01txWvzqKWrnLMAGlrm8eOcdTn_O1wDnf5OZB8') {
    console.log('VAPID key not configured. FCM web notifications will not work.');
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    console.log('Firebase messaging token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}

export async function saveFcmTokenForCurrentUser(token) {
  const email = await getStoredUserEmail();
  if (!email || !token) {
    return;
  }

  try {
    const tokenDoc = doc(db, 'fcmTokens', email);
    await setDoc(tokenDoc, {
      email,
      token,
      updatedAt: new Date(),
      platform: window.Capacitor?.getPlatform() || 'web'
    }, { merge: true });

    console.log('Saved FCM token for user:', email);
  } catch (error) {
    console.error('Failed to save FCM token:', error);
  }
}

export async function subscribeToNotifications() {
  // Skip FCM in local development to prevent VAPID key errors
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Skipping FCM notifications in local development');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.log('Service workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('service-worker.js');
    await navigator.serviceWorker.ready;

    const token = await getFcmToken(registration);
    if (!token) {
      console.log('Could not get FCM token for this device');
      return null;
    }

    console.log('Successfully subscribed to Firebase push notifications');
    return token;
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return null;
  }
}

export function showLocalNotification(title, body, icon = null) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  }
}

export async function sendNotificationToUsers(userEmails, title, body, type = 'general') {
  // Email notifications are now handled by GitHub Actions
  // This function is kept for backward compatibility but no longer calls an API
  
  console.log(`📧 Email notification will be sent via GitHub Actions:`, { 
    recipients: userEmails, 
    title, 
    type 
  });
  
  // Show local browser notification if permission granted
  if (Notification.permission === 'granted') {
    showLocalNotification(title, body);
  }
  
  // GitHub Actions workflows will check Firestore and send emails automatically
  return;
}

export async function initializeNotifications() {
  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    return null;
  }

  if (isNative) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Register with FCM
      await PushNotifications.register();

      // Listen for registration success
      PushNotifications.addListener('registration', async (token) => {
        console.log('Native push registration success, token:', token.value);
        await saveFcmTokenForCurrentUser(token.value);
      });

      // Listen for registration error
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Native push registration error:', error);
      });

      // Listen for incoming notifications while app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Native push received in foreground:', notification);
        showLocalNotification(notification.title, notification.body);
      });

      // Listen for notification clicks
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Native push action performed:', notification);
        // Handle notification click (e.g., navigate to a specific page)
      });

      return "native-registered";
    } catch (error) {
      console.error('Error initializing native notifications:', error);
      return null;
    }
  }

  const token = await subscribeToNotifications();
  if (!token) {
    return null;
  }

  await saveFcmTokenForCurrentUser(token);

  onMessage(messaging, (payload) => {
    console.log('Foreground FCM message received:', payload);
    const title = payload.notification?.title || payload.data?.title || 'My Thesis Hub';
    const body = payload.notification?.body || payload.data?.body || 'You have a new message';
    showLocalNotification(title, body);
  });

  return token;
}
