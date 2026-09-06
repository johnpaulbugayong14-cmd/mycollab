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
