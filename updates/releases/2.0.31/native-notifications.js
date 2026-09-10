/**
 * Native Push Notifications Handler for My Collab
 * Uses Capacitor Firebase Cloud Messaging for Android and iOS
 */

import { db } from './firebase.js';
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStoredUserEmail } from './auth.js';

let isNativePushInitialized = false;
let nativeBridgePromise = null;

async function getNativeBridge() {
  if (nativeBridgePromise) return nativeBridgePromise;

  nativeBridgePromise = (async () => {
    let capacitor = window.Capacitor;
    if (!capacitor) return null;

    if (typeof capacitor.isNativePlatform !== 'function' || !capacitor.isNativePlatform()) {
      return null;
    }

    // These files are copied into the APK by Capacitor. They are imported only
    // on native platforms, so GitHub Pages never tries to resolve npm specifiers.
    const coreModule = await import('./node_modules/@capacitor/core/dist/index.js');
    capacitor = coreModule.Capacitor || capacitor;

    return {
      capacitor,
      messaging: capacitor.Plugins?.FirebaseMessaging || coreModule.registerPlugin('FirebaseMessaging')
    };
  })().catch(error => {
    nativeBridgePromise = null;
    console.warn('Native Capacitor plugins are unavailable:', error.message);
    return null;
  });

  return nativeBridgePromise;
}

async function getNativeBridgePlatform() {
  const capacitor = window.Capacitor;
  if (!capacitor || typeof capacitor.isNativePlatform !== 'function' || !capacitor.isNativePlatform()) {
    return null;
  }
  return getNativeBridge();
}

/**
 * Initialize native push notifications using Capacitor Firebase
 */
export async function initializeNativePushNotifications() {
  try {
    const nativeBridge = await getNativeBridgePlatform();
    if (!nativeBridge?.messaging) {
      console.log('Not running on native platform, skipping native push initialization');
      return false;
    }

    if (isNativePushInitialized) {
      console.log('Native push notifications already initialized');
      return true;
    }

    console.log('Initializing native push notifications...');

    // Request push notification permissions
    const result = await nativeBridge.messaging.requestPermissions();
    
    if (result.receive === 'granted') {
      console.log('Push notification permissions granted');
    } else {
      console.warn('Push notification permissions not fully granted', result);
    }

    // Get FCM token for this device
    const tokenResult = await nativeBridge.messaging.getToken();
    if (tokenResult.token) {
      console.log('FCM Token obtained:', tokenResult.token);
      await saveFcmTokenForCurrentUser(tokenResult.token);
    }

    // Listen for incoming messages when app is in foreground
    nativeBridge.messaging.addListener('message', async (event) => {
      console.log('Foreground message received:', event);
      
      const remoteMessage = event.message;
      let title = 'My Collab';
      let body = 'You have a new message';

      if (remoteMessage.data) {
        title = remoteMessage.data.title || title;
        body = remoteMessage.data.body || body;
      }

      if (remoteMessage.notification) {
        title = remoteMessage.notification.title || title;
        body = remoteMessage.notification.body || body;
      }

      handleForegroundNotification(title, body, remoteMessage.data);
    });

    // Listen for token refresh events
    nativeBridge.messaging.addListener('tokenReceived', async (event) => {
      console.log('New FCM token received:', event.token);
      await saveFcmTokenForCurrentUser(event.token);
    });

    isNativePushInitialized = true;
    console.log('✓ Native push notifications initialized successfully');
    return true;

  } catch (error) {
    console.error('Failed to initialize native push notifications:', error);
    return false;
  }
}

/**
 * Save FCM token to Firestore for current user
 */
async function saveFcmTokenForCurrentUser(token) {
  try {
    const email = await getStoredUserEmail();
    
    if (!email || !token) {
      console.warn('Cannot save FCM token: missing email or token');
      return;
    }

    const tokenDoc = doc(db, 'fcmTokens', email);
    await setDoc(tokenDoc, {
      email,
      token,
      updatedAt: new Date(),
      platform: window.Capacitor?.getPlatform?.() || 'android',
      appVersion: '2.0.31',
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log('✓ FCM token saved for user:', email);
    
  } catch (error) {
    console.error('Failed to save FCM token:', error);
  }
}

/**
 * Handle notification received when app is in foreground
 */
function handleForegroundNotification(title, body, data) {
  try {
    // Show browser notification if supported
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    }

    // Emit custom event for app to handle
    const notificationEvent = new CustomEvent('nativePushNotification', {
      detail: { title, body, data }
    });
    window.dispatchEvent(notificationEvent);

  } catch (error) {
    console.error('Error handling foreground notification:', error);
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromNativePushNotifications() {
  try {
    const nativeBridge = await getNativeBridgePlatform();
    if (nativeBridge?.messaging) {
      // Optionally delete the token
      const result = await nativeBridge.messaging.deleteToken();
      console.log('FCM token deleted:', result);
    }
    isNativePushInitialized = false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
  }
}

/**
 * Request push notification permissions explicitly
 */
export async function requestNativePushPermissions() {
  try {
    const nativeBridge = await getNativeBridgePlatform();
    if (!nativeBridge?.messaging) {
      console.log('Not running on native platform');
      return false;
    }

    const result = await nativeBridge.messaging.requestPermissions();
    console.log('Permission request result:', result);
    
    return result.receive === 'granted';

  } catch (error) {
    console.error('Failed to request push permissions:', error);
    return false;
  }
}
