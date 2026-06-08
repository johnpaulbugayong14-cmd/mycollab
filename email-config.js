/**
 * Gmail Configuration System
 * Separates login credentials from Gmail notification addresses
 * Each member has:
 * - Login Email: Used for account credentials and authentication
 * - Gmail Address: Used for receiving notifications
 */

export const memberGmails = {};
export const userInfo = {};

/**
 * Get the Gmail address for a member
 * @param {string} loginEmail - The user's login email (credentials)
 * @returns {string|null} - The Gmail address if set, null otherwise
 */
export function getGmailAddress(loginEmail) {
  return memberGmails[loginEmail] || null;
}

/**
 * Get user information
 * @param {string} loginEmail - The user's login email (credentials)
 * @returns {object} - User info object with name and role
 */
export function getUserInfo(loginEmail) {
  return userInfo[loginEmail] || { name: loginEmail, role: 'user' };
}

/**
 * Load all members' Gmail addresses from member data
 * Called during initialization to populate the Gmail mapping
 * @param {array} members - Array of member objects from Firestore
 */
export function loadGmailsFromMembers(members) {
  if (!Array.isArray(members)) return;
  
  members.forEach(member => {
    if (member.email && member.email !== 'everyone') {
      // Store Gmail address for notifications if provided
      if (member.gmailAddress) {
        memberGmails[member.email] = member.gmailAddress;
      }
      // Always store user info (login email is in credentials)
      userInfo[member.email] = { 
        name: member.name || member.email, 
        role: member.role || 'member' 
      };
    }
  });
}
