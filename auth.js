// Firebase Auth imports
import { createUserWithEmailAndPassword, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { addDoc, collection, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// Storage utility for cross-platform compatibility
class StorageManager {
  constructor() {
    this.isCapacitor = false;
    this.preferences = null;
    this.initialized = false;
    this.initializationPromise = null;

    // Check for Capacitor more reliably
    this.initializationPromise = this.checkCapacitorAvailability();
  }

  async checkCapacitorAvailability() {
    // Wait a bit for Capacitor to initialize
    if (typeof window !== 'undefined') {
      let retryCount = 0;
      while (retryCount < 5 && !window.Capacitor) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retryCount++;
      }
    }

    this.isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    if (this.isCapacitor) {
      try {
        const module = await import('@capacitor/preferences');
        this.preferences = module.Preferences;
        console.log('Capacitor Preferences loaded successfully');
      } catch (err) {
        console.warn('Capacitor Preferences not available, falling back to localStorage:', err);
        this.isCapacitor = false;
      }
    } else {
      console.log('Running in browser, using localStorage');
    }

    this.initialized = true;
  }

  async ensureInitialized() {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null; // Clear to avoid re-awaiting
    }
    if (!this.initialized) {
      await this.checkCapacitorAvailability();
    }
  }

  async get(key) {
    console.log(`StorageManager.get: Requesting key "${key}"`);
    await this.ensureInitialized();

    // Attempt multiple retries for Capacitor Preferences on cold start
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      if (this.isCapacitor && this.preferences) {
        try {
          console.log(`StorageManager.get: Trying Capacitor Preferences (Attempt ${attempts + 1})`);
          const result = await this.preferences.get({ key });
          if (result && result.value) {
            console.log(`StorageManager.get: Success from Capacitor`);
            return result;
          }
        } catch (error) {
          console.error('StorageManager.get: Capacitor error:', error);
        }
      }

      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small wait before retry
      }
      attempts++;
    }

    // Fallback to localStorage
    console.log(`StorageManager.get: Falling back to localStorage for "${key}"`);
    const value = localStorage.getItem(key);
    return value ? { value } : { value: null };
  }

  async set(key, value) {
    console.log(`StorageManager.set: Setting key "${key}" with value:`, value);
    await this.ensureInitialized();
    console.log(`StorageManager.set: Initialized. Saving to localStorage...`);

    // Save to both for maximum reliability
    if (this.isCapacitor && this.preferences) {
      try {
        console.log(`StorageManager.set: Also saving to Capacitor Preferences`);
        await this.preferences.set({ key, value });
      } catch (error) {
        console.error('StorageManager.set: Error setting in Capacitor Preferences:', error);
      }
    }
    localStorage.setItem(key, value);
    console.log(`StorageManager.set: Successfully saved to localStorage`);
  }

  async remove(key) {
    await this.ensureInitialized();

    if (this.isCapacitor && this.preferences) {
      try {
        await this.preferences.remove({ key });
      } catch (error) {
        console.error('Error removing from Capacitor Preferences:', error);
      }
    }
    localStorage.removeItem(key);
  }
}

const storage = new StorageManager();

// Show message function
function showMessage(text, type = "error") {
  const message = document.getElementById("loginMessage");
  if (!message) return;
  message.textContent = text;
  message.style.display = "block";
  message.style.color = type === "error" ? "#fecaca" : "#d1fae5";
  message.style.background = type === "error" ? "rgba(248, 113, 113, 0.15)" : "rgba(16, 185, 129, 0.15)";
  message.style.border = type === "error" ? "1px solid rgba(248, 113, 113, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)";
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateRecoveryPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function ensureAuthenticatedForFirestore() {
  try {
    if (auth.currentUser) return auth.currentUser;
    await signInAnonymously(auth);
    return auth.currentUser;
  } catch (error) {
    console.warn('Unable to authenticate anonymously for Firestore access:', error);
    return null;
  }
}

function requiresPasswordChange(data = {}) {
  return Boolean(
    data.requirePasswordChange === true ||
    data.passwordChangeRequired === true ||
    data.mustChangePassword === true ||
    (data.createdByAdmin === true && data.passwordChangedAt === undefined && data.passwordChangeCompleted !== true)
  );
}

const LEGACY_ADMIN_CREDENTIALS = {
  email: 'johnpaulbugayong@gmail.com',
  password: 'johnpaul001'
};

async function getFirestoreCredential(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return null;

  try {
    const credentialRef = doc(db, 'userCredentials', normalizedEmail);
    const credentialSnap = await getDoc(credentialRef);

    if (!credentialSnap.exists()) {
      if (normalizeEmail(email) === normalizeEmail(LEGACY_ADMIN_CREDENTIALS.email) && password === LEGACY_ADMIN_CREDENTIALS.password) {
        await setDoc(credentialRef, {
          email: normalizedEmail,
          password,
          role: 'admin',
          accessAllowed: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
        return {
          email: normalizedEmail,
          role: 'admin',
          accessAllowed: true,
          password
        };
      }
      return null;
    }

    const data = credentialSnap.data() || {};
    const passwordMatches = String(data.password || '') === String(password);
    const recoveryPasswordMatches = String(data.recoveryPassword || '') === String(password);

    if (!passwordMatches && !recoveryPasswordMatches) return null;

    return {
      email: normalizedEmail,
      role: data.role || 'member',
      accessAllowed: typeof data.accessAllowed === 'boolean' ? data.accessAllowed : true,
      password,
      usedRecoveryPassword: recoveryPasswordMatches
    };
  } catch (error) {
    console.warn('Unable to read Firestore credential record:', error);
    return null;
  }
}

export async function getEffectiveRole(email) {
  if (!email) return null;

  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    const roleSnap = await getDoc(roleRef);
    if (roleSnap.exists()) {
      const data = roleSnap.data() || {};
      if (typeof data.role === 'string' && data.role.trim()) {
        return data.role.trim().toLowerCase();
      }
    }

    const credentialRef = doc(db, "userCredentials", normalized);
    const credentialSnap = await getDoc(credentialRef);
    if (credentialSnap.exists()) {
      const data = credentialSnap.data() || {};
      if (typeof data.role === 'string' && data.role.trim()) {
        return data.role.trim().toLowerCase();
      }
    }
  } catch (error) {
    console.warn("Unable to read custom role from Firestore:", error);
  }

  return null;
}

export async function setUserRole(email, role) {
  if (!email) return;
  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    await setDoc(roleRef, {
      role,
      hasAuthAccount: true,
      authProvider: 'password',
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("Error setting user role in Firestore:", error);
    throw error;
  }
}

export async function getUserAccessDetails(email) {
  if (!email) return { accessAllowed: true, accessReason: '' };

  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    const roleSnap = await getDoc(roleRef);
    if (roleSnap.exists()) {
      const data = roleSnap.data() || {};
      return {
        accessAllowed: typeof data.accessAllowed === 'boolean' ? data.accessAllowed : true,
        accessReason: typeof data.accessReason === 'string' ? data.accessReason : ''
      };
    }
  } catch (error) {
    console.warn("Unable to read account access from Firestore:", error);
  }

  return { accessAllowed: true, accessReason: '' };
}

export async function getUserAccessStatus(email) {
  const { accessAllowed } = await getUserAccessDetails(email);
  return accessAllowed;
}

export async function getUserAccessReason(email) {
  const { accessReason } = await getUserAccessDetails(email);
  return accessReason;
}

export async function setUserAccess(email, isAccessAllowed, reason = '') {
  if (!email) return;
  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    await setDoc(roleRef, {
      accessAllowed: Boolean(isAccessAllowed),
      accessReason: String(reason || ''),
      hasAuthAccount: true,
      authProvider: 'password',
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("Error setting user access in Firestore:", error);
    throw error;
  }
}

// Get stored user from storage
async function getStoredUser() {
  try {
    console.log('getStoredUser: Attempting to retrieve authUser from localStorage...');
    const value = localStorage.getItem('authUser');
    console.log('getStoredUser: Retrieved value:', value);
    
    if (value) {
      const parsed = JSON.parse(value);
      console.log('getStoredUser: Parsed user:', parsed);
      return parsed;
    } else {
      console.log('getStoredUser: No value found in localStorage');
    }
  } catch (error) {
    console.error("Error getting auth user from localStorage", error);
  }
  return null;
}

// Store user in storage
async function storeUser(user) {
  try {
    console.log('storeUser: Storing user:', user);
    const userString = JSON.stringify(user);
    console.log('storeUser: Serialized to:', userString);
    localStorage.setItem('authUser', userString);
    console.log('storeUser: Successfully saved to localStorage');
  } catch (error) {
    console.error("Error storing auth user to localStorage", error);
  }
}

export async function getAccountPasswordHint(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const credentialSnap = await getDoc(doc(db, 'userCredentials', normalizedEmail));
    if (!credentialSnap.exists()) return null;
    const data = credentialSnap.data() || {};
    return typeof data.password === 'string' && data.password.trim() ? data.password : null;
  } catch (error) {
    console.warn('Unable to read password hint:', error);
    return null;
  }
}

export async function getPasswordChangeRequired(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  try {
    const roleRef = doc(db, 'userRoles', normalizedEmail);
    const roleSnap = await getDoc(roleRef);
    if (roleSnap.exists()) {
      return requiresPasswordChange(roleSnap.data() || {});
    }

    const credentialRef = doc(db, 'userCredentials', normalizedEmail);
    const credentialSnap = await getDoc(credentialRef);
    if (credentialSnap.exists()) {
      return requiresPasswordChange(credentialSnap.data() || {});
    }
  } catch (error) {
    console.warn('Unable to read password change requirement:', error);
  }

  return false;
}

export async function requestPasswordReset(email, ticketId = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  await ensureAuthenticatedForFirestore();

  const now = new Date();
  const payload = {
    passwordResetStatus: 'pending',
    passwordResetRequested: true,
    passwordResetApproved: false,
    passwordResetRejected: false,
    passwordResetRequestedAt: now,
    passwordResetTicketId: ticketId || null,
    requirePasswordChange: true,
    passwordChangeRequired: true,
    updatedAt: now
  };

  try {
    await setDoc(doc(db, 'userCredentials', normalizedEmail), payload, { merge: true });
    await setDoc(doc(db, 'userRoles', normalizedEmail), payload, { merge: true });
    return true;
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
}

export async function approvePasswordReset(email, ticketId = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  await ensureAuthenticatedForFirestore();

  const now = new Date();
  const payload = {
    passwordResetStatus: 'approved',
    passwordResetRequested: false,
    passwordResetApproved: true,
    passwordResetRejected: false,
    passwordResetApprovedAt: now,
    passwordResetTicketId: ticketId || null,
    requirePasswordChange: true,
    passwordChangeRequired: true,
    updatedAt: now
  };

  try {
    await setDoc(doc(db, 'userCredentials', normalizedEmail), payload, { merge: true });
    await setDoc(doc(db, 'userRoles', normalizedEmail), payload, { merge: true });
    return true;
  } catch (error) {
    console.error('Error approving password reset:', error);
    throw error;
  }
}

export async function updateAccountPassword(email, newPassword) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email is required.');
  if (String(newPassword || '').length < 6) throw new Error('Password must be at least 6 characters long.');

  try {
    await ensureAuthenticatedForFirestore();
    const now = new Date();
    const recoveryPassword = generateRecoveryPassword();

    await setDoc(doc(db, 'userCredentials', normalizedEmail), {
      password: String(newPassword),
      recoveryPassword,
      recoveryPasswordUsed: false,
      recoveryPasswordGeneratedAt: now,
      requirePasswordChange: false,
      passwordChangeRequired: false,
      passwordChangedAt: now,
      updatedAt: now
    }, { merge: true });

    await setDoc(doc(db, 'userRoles', normalizedEmail), {
      recoveryPassword,
      recoveryPasswordUsed: false,
      recoveryPasswordGeneratedAt: now,
      requirePasswordChange: false,
      passwordChangeRequired: false,
      passwordChangedAt: now,
      updatedAt: now
    }, { merge: true });

    return { success: true, recoveryPassword };
  } catch (error) {
    console.error('Error updating account password:', error);
    throw error;
  }
}

export async function createMemberAccount(email, password, role = 'member', displayName = '') {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required.');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const trimmedDisplayName = String(displayName || '').trim();

  try {
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (anonymousError) {
        console.warn('Unable to initialize anonymous auth for account creation:', anonymousError);
      }
    }

    const createdEmail = normalizedEmail;

    await setDoc(doc(db, 'userCredentials', createdEmail), {
      email: createdEmail,
      password,
      role,
      displayName: trimmedDisplayName,
      accessAllowed: true,
      accessReason: '',
      createdAt: new Date(),
      createdByAdmin: true,
      requirePasswordChange: true,
      passwordChangeRequired: true,
      updatedAt: new Date()
    }, { merge: true });

    await setDoc(doc(db, 'userRoles', createdEmail), {
      email: createdEmail,
      role,
      displayName: trimmedDisplayName,
      accessAllowed: true,
      accessReason: '',
      hasAuthAccount: true,
      authProvider: 'firestore',
      createdAt: new Date(),
      createdByAdmin: true,
      authTracked: true,
      createdViaAuth: true,
      requirePasswordChange: true,
      passwordChangeRequired: true
    }, { merge: true });

    try {
      await setDoc(doc(db, 'userRoles', createdEmail), {
        lastActive: new Date().toISOString(),
        isOnline: true,
        updatedAt: new Date()
      }, { merge: true });
    } catch (presenceError) {
      console.warn('Unable to update created account presence:', presenceError);
    }

    return { email: createdEmail, role };
  } catch (error) {
    console.error('Error creating member account:', error);
    throw error;
  }
}

export async function deleteMemberAccount(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  if (normalizedEmail === normalizeEmail(LEGACY_ADMIN_CREDENTIALS.email)) {
    throw new Error('The primary admin account cannot be deleted.');
  }

  try {
    await deleteDoc(doc(db, 'userRoles', normalizedEmail));
  } catch (error) {
    console.warn('Unable to delete userRoles record:', error);
  }

  try {
    await deleteDoc(doc(db, 'userCredentials', normalizedEmail));
  } catch (error) {
    console.warn('Unable to delete userCredentials record:', error);
  }

  return true;
}

// Login function - attached to window for global access
window.login = async function() {
  console.log('=== LOGIN FUNCTION CALLED ===');
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  console.log('Login attempt for email:', email);

  try {
    let signedInEmail = normalizeEmail(email);
    let role = 'member';
    let accessAllowed = true;
    let accessReason = '';
    let firestoreCredential = null;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      signedInEmail = normalizeEmail(userCredential.user.email || email);
      console.log('Firebase Auth successful');
    } catch (firebaseError) {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (anonymousError) {
        console.warn('Unable to initialize anonymous auth for fallback login:', anonymousError);
      }

      firestoreCredential = await getFirestoreCredential(email, password);
      if (!firestoreCredential) {
        console.error('Firebase Auth error:', firebaseError);
        showMessage('Invalid email or password. Please try again.');
        return;
      }

      signedInEmail = firestoreCredential.email;
      role = firestoreCredential.role || 'member';
      accessAllowed = firestoreCredential.accessAllowed !== false;
      accessReason = '';
      console.log('Using Firestore credential fallback for login');
    }

    if (!role || role === 'member') {
      role = await getEffectiveRole(signedInEmail) || 'member';
      const accessDetails = await getUserAccessDetails(signedInEmail);
      accessAllowed = accessDetails.accessAllowed;
      accessReason = accessDetails.accessReason || '';
    }

    let passwordChangeRequired = await getPasswordChangeRequired(signedInEmail);

    if (accessAllowed === false) {
      showMessage('Your account is restricted. Limited member access will be available after sign in.', 'info');
    }

    if (role !== 'admin' && (passwordChangeRequired || firestoreCredential?.usedRecoveryPassword)) {
      if (firestoreCredential?.usedRecoveryPassword) {
        await setDoc(doc(db, 'userCredentials', signedInEmail), {
          recoveryPasswordUsed: true,
          requirePasswordChange: true,
          passwordChangeRequired: true,
          updatedAt: new Date()
        }, { merge: true });

        await setDoc(doc(db, 'userRoles', signedInEmail), {
          recoveryPasswordUsed: true,
          requirePasswordChange: true,
          passwordChangeRequired: true,
          updatedAt: new Date()
        }, { merge: true });
      }

      const newPassword = window.prompt('For your security, please enter a new password (at least 6 characters):');
      if (!newPassword) {
        showMessage('A new password is required before you can continue.');
        return;
      }

      const confirmPassword = window.prompt('Please confirm your new password:');
      if (!confirmPassword) {
        showMessage('Please confirm your new password to continue.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showMessage('The new passwords do not match.');
        return;
      }

      const passwordResult = await updateAccountPassword(signedInEmail, newPassword);
      if (passwordResult?.recoveryPassword) {
        window.alert(`Your recovery password is: ${passwordResult.recoveryPassword}\n\nPlease copy it or take a screenshot and save it somewhere safe. You can use it later to recover your account.`);
      }
      passwordChangeRequired = false;
    }

    console.log('Storing user in storage...');
    await storeUser({ email: signedInEmail, role, accessAllowed, accessReason, passwordChangeRequired });

    try {
      await setDoc(doc(db, 'userRoles', signedInEmail), {
        email: signedInEmail,
        role,
        lastActive: new Date().toISOString(),
        isOnline: true,
        hasAuthAccount: true,
        authProvider: 'password',
        updatedAt: new Date()
      }, { merge: true });
    } catch (presenceError) {
      console.warn('Unable to update login presence:', presenceError);
    }

    const destination = role === "admin" ? "organization-management.html" : "member.html";
    console.log('User stored, redirecting to:', destination);

    window.location.href = destination;
  } catch (error) {
    console.error("Firebase Auth error:", error);
    showMessage("Invalid email or password. Please try again.");
  }
};

// Exported functions for other modules
export async function getStoredUserEmail() {
  console.log('getStoredUserEmail: Called');
  const user = await getStoredUser();
  console.log('getStoredUserEmail: Got user:', user);
  const email = user ? user.email : null;
  console.log('getStoredUserEmail: Returning email:', email);
  return email;
}

export async function getStoredUserRole() {
  const user = await getStoredUser();
  if (!user) return null;

  try {
    const effectiveRole = await getEffectiveRole(user.email);
    const normalizedStoredRole = typeof user.role === 'string' ? user.role.trim().toLowerCase() : null;
    const normalizedEffectiveRole = typeof effectiveRole === 'string' ? effectiveRole.trim().toLowerCase() : null;

    if (normalizedEffectiveRole) {
      if (normalizedEffectiveRole !== normalizedStoredRole) {
        await storeUser({ email: user.email, role: normalizedEffectiveRole, accessAllowed: user.accessAllowed !== false, accessReason: user.accessReason || '' });
      }
      return normalizedEffectiveRole;
    }
  } catch (error) {
    console.warn('Failed to resolve effective role from Firestore, using stored role:', error);
  }

  return user.role;
}

export async function getStoredUserAccess() {
  const user = await getStoredUser();
  if (!user) return true;

  try {
    const effectiveAccess = await getUserAccessStatus(user.email);
    if (typeof effectiveAccess === 'boolean' && effectiveAccess !== (user.accessAllowed !== false)) {
      await storeUser({ ...user, accessAllowed: effectiveAccess });
    }
    return effectiveAccess;
  } catch (error) {
    console.warn('Failed to resolve account access from Firestore, using stored access:', error);
  }

  return user.accessAllowed !== false;
}

export async function getStoredUserAccessReason() {
  const user = await getStoredUser();
  if (!user) return '';

  try {
    const effectiveReason = await getUserAccessReason(user.email);
    if (typeof effectiveReason === 'string' && effectiveReason !== (user.accessReason || '')) {
      await storeUser({ ...user, accessReason: effectiveReason });
    }
    return effectiveReason;
  } catch (error) {
    console.warn('Failed to resolve account access reason from Firestore, using stored reason:', error);
  }

  return user.accessReason || '';
}

export async function isAuthenticated() {
  const storedUser = await getStoredUser();
  return storedUser !== null;
}

export async function requireAuth(allowedRoles = null) {
  const storedUser = await getStoredUser();

  if (!storedUser) {
    window.location.href = "login.html";
    return;
  }

  // Wait for Firebase auth to restore the session if it exists
  if (!auth.currentUser) {
    console.log("requireAuth: Waiting for Firebase Auth session settlement...");
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
      setTimeout(resolve, 3000); // 2-second timeout safety
    });
  }

  if (!auth.currentUser) {
    console.warn("requireAuth: Firebase Auth session is unavailable; returning to login.");
    await clearAuthData();
    window.location.href = "login.html";
    return;
  }

  const accessAllowed = await getStoredUserAccess();
  if (accessAllowed === false && allowedRoles && allowedRoles.includes('member')) {
    // Restricted members are allowed to enter the member experience with limited access.
  } else if (accessAllowed === false) {
    await clearAuthData();
    window.location.href = "login.html";
    return;
  }

  let effectiveRole = storedUser.role;
  if (allowedRoles) {
    effectiveRole = await getStoredUserRole();
  }

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    window.location.href = "login.html";
    return;
  }

  // Start maintenance for auth persistence
  maintainAuthPersistence();

  // Also initialize notifications
  safeInitializeNotifications();
}

// Ensure init runs after the script is loaded
if (document.readyState === 'loading') {
  window.firebaseAuthReady = new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => init().then(resolve, resolve), { once: true });
  });
} else {
  window.firebaseAuthReady = init();
}

// Helper to safely initialize notifications
async function safeInitializeNotifications() {
  try {
    const { initializeNotifications } = await import("./notifications.js");
    await initializeNotifications();
  } catch (err) {
    console.error("Failed to initialize notifications:", err);
  }
}

// Global initialization for all pages
async function init() {
  console.log('Init: Starting...');
  await storage.ensureInitialized();

  // On Android, give the native bridge an extra moment to settle
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  if (!auth.currentUser) {
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
      setTimeout(resolve, 3000);
    });
  }

  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.endsWith('login.html') || path.endsWith('index.html') || path === '/' || path === '';

  const user = await getStoredUser();
  console.log('Init: user found:', user, 'isLoginPage:', isLoginPage, 'path:', path);

  // Initialize notifications if user is logged in
  if (user) {
    console.log('User logged in, initializing notifications...');
    safeInitializeNotifications();
  }

  if (user && isLoginPage) {
    // Admins always choose a workspace after login or app restart.
    console.log('Redirecting to landing page...');
    window.location.href = user.role === "admin" ? "organization-management.html" : "member.html";
  } else if (!user && !isLoginPage) {
    // If not logged in and on a protected page, redirect to login
    console.log('Redirecting to login...');
    window.location.href = "login.html";
  }
}


export async function signOutUser() {
  try {
    const storedUser = await getStoredUser();
    if (storedUser?.email) {
      try {
        await setDoc(doc(db, 'userRoles', normalizeEmail(storedUser.email)), {
          isOnline: false
        }, { merge: true });
      } catch (presenceError) {
        console.warn('Unable to update sign-out presence:', presenceError);
      }
    }

    await signOut(auth);
  } catch (error) {
    console.error("Error signing out from Firebase:", error);
  }

  await clearAuthData();

  window.location.href = "login.html";
}

window.signOutUser = signOutUser;

// Function to maintain persistent authentication
export async function maintainAuthPersistence() {
  const storedUser = await getStoredUser();

  if (!storedUser) {
    // No stored user, redirect to login
    window.location.href = "login.html";
    return;
  }

  // Listen for Firebase auth state changes
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Firebase user is authenticated, all good
      console.log("User authenticated with Firebase");
    } else {
      // Firebase auth expired, re-authenticate anonymously
      console.log("Firebase auth expired, re-authenticating...");
      try {
        await signInAnonymously(auth);
        console.log("Re-authenticated anonymously");
      } catch (error) {
        console.error("Failed to re-authenticate:", error);
        // Don't redirect - allow access with stored credentials
        console.warn("Continuing with stored credentials despite Firebase auth failure");
      }
    }
  });

  // Store the unsubscribe function for cleanup if needed
  window.authStateUnsubscribe = unsubscribe;

  // Handle app resume (when app is reopened from background)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      // App became visible
      console.log("App became visible, checking authentication...");
      const storedUser = await getStoredUser();
      if (storedUser && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
          console.log("Restored Firebase auth on app resume");
        } catch (error) {
          console.error("Failed to restore auth on app resume:", error);
        }
      }
    }
  });

  // Also check periodically (every 30 minutes) if we need to refresh
  setInterval(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("No current Firebase user, attempting re-auth...");
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Periodic re-auth failed:", error);
        // Don't redirect here - let the user continue with stored credentials
      }
    }
  }, 30 * 60 * 1000); // 30 minutes
}

// Clear all authentication data (for debugging/reset purposes)
export async function clearAuthData() {
  try {
    await storage.remove('authUser');
  } catch (error) {
    console.error("Error clearing auth data", error);
  }
  localStorage.removeItem("authUser");
  sessionStorage.removeItem("authUser");
  if (window.authStateUnsubscribe) {
    window.authStateUnsubscribe();
  }
}

// Make clearAuthData available globally for debugging
window.clearAuthData = clearAuthData;
