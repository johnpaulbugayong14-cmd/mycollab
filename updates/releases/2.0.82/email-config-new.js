/**
 * Email Configuration and User Mapping
 * Dynamically maps login emails to notification emails
 * Members can set their notification email during account creation
 */

export const emailMapping = {};

export const userInfo = {};

/**
 * Add or update a member's email mapping
 * @param {string} loginEmail - The user's login email
 * @param {string} notificationEmail - The email where notifications should be sent (optional)
 * @param {object} info - User info object with name and role
 */
export function addMemberEmailMapping(loginEmail, notificationEmail, info) {
  emailMapping[loginEmail] = notificationEmail || loginEmail;
  userInfo[loginEmail] = info || { name: loginEmail, role: 'member' };
}

/**
 * Remove a member's email mapping
 * @param {string} loginEmail - The user's login email
 */
export function removeMemberEmailMapping(loginEmail) {
  delete emailMapping[loginEmail];
  delete userInfo[loginEmail];
}

/**
 * Get the notification email for a user
 * @param {string} loginEmail - The user's login email
 * @returns {string} - The notification email address
 */
export function getNotificationEmail(loginEmail) {
  return emailMapping[loginEmail] || loginEmail;
}

/**
 * Get user information
 * @param {string} loginEmail - The user's login email
 * @returns {object} - User info object with name and role
 */
export function getUserInfo(loginEmail) {
  return userInfo[loginEmail] || { name: loginEmail, role: 'user' };
}

/**
 * Load all members' email mappings from data
 * @param {array} members - Array of member objects from Firestore
 */
export function loadEmailMappingsFromMembers(members) {
  // Clear existing mappings
  Object.keys(emailMapping).forEach(key => delete emailMapping[key]);
  Object.keys(userInfo).forEach(key => delete userInfo[key]);
  
  // Load from members array
  if (Array.isArray(members)) {
    members.forEach(member => {
      if (member.email) {
        addMemberEmailMapping(
          member.email,
          member.notificationEmail || member.email,
          { name: member.name, role: member.role }
        );
      }
    });
  }
}
