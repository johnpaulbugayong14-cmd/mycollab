/**
 * Email Configuration and User Mapping
 * Maps login emails to official notification emails
 */

export const emailMapping = {
  'johnpaulbugayong@gmail.com': 'johnpaulbugayong14@gmail.com',
  'kingfordnabor@gmail.com': 'kingfordnabor20@gmail.com',
  'allancorral@gmail.com': 'allancorral084@gmail.com',
  'phricksborebor@gmail.com': 'boreborpj16@gmail.com',
  'moezarperez@gmail.com': 'moezarg19@gmail.com',
  'rogelioledda@gmail.com': 'rogelioledda051506@gmail.com'
};

export const userInfo = {
  'johnpaulbugayong@gmail.com': { name: 'John Paul Bugayong', role: 'admin' },
  'kingfordnabor@gmail.com': { name: 'Kingford Nabor', role: 'member' },
  'allancorral@gmail.com': { name: 'Allan Corral', role: 'member' },
  'phricksborebor@gmail.com': { name: 'Phricks Borebor', role: 'member' },
  'moezarperez@gmail.com': { name: 'Moezar Perez', role: 'member' },
  'rogelioledda@gmail.com': { name: 'Rogelio Ledda', role: 'member' }
};

// Cache for dynamically loaded email mappings from Firestore
let dynamicEmailMappings = {};
let isLoadingMappings = false;
let mappingsLoaded = false;

/**
 * Load email mappings from Firestore (for dynamically created members)
 * This is called asynchronously to fetch mappings stored by the admin
 */
export async function loadEmailMappingsFromFirestore() {
  if (mappingsLoaded || isLoadingMappings) {
    return dynamicEmailMappings;
  }
  
  isLoadingMappings = true;
  try {
    const { db } = await import("./firebase.js");
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    
    const snapshot = await getDocs(collection(db, "emailMappings"));
    snapshot.forEach(doc => {
      const data = doc.data();
      dynamicEmailMappings[data.loginEmail] = data.notificationEmail;
    });
    
    mappingsLoaded = true;
    console.log('Email mappings loaded from Firestore:', dynamicEmailMappings);
  } catch (error) {
    console.warn('Could not load email mappings from Firestore:', error);
    mappingsLoaded = true;
  }
  isLoadingMappings = false;
  return dynamicEmailMappings;
}

/**
 * Get the notification email for a user
 * Checks both static config and Firestore mappings
 * @param {string} loginEmail - The user's login email
 * @returns {string} - The notification email address
 */
export async function getNotificationEmail(loginEmail) {
  // First check static mapping
  if (emailMapping[loginEmail]) {
    return emailMapping[loginEmail];
  }
  
  // Then check dynamic mappings from Firestore
  if (!mappingsLoaded) {
    await loadEmailMappingsFromFirestore();
  }
  
  return dynamicEmailMappings[loginEmail] || loginEmail;
}

/**
 * Get user information
 * @param {string} loginEmail - The user's login email
 * @returns {object} - User info object with name and role
 */
export function getUserInfo(loginEmail) {
  return userInfo[loginEmail] || { name: loginEmail, role: 'user' };
}
