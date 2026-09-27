/**
 * GitHub Actions Email Notification Trigger
 * Securely triggers email notifications via GitHub Actions repository_dispatch
 */

class GitHubEmailNotifier {
  constructor(githubToken, repoOwner, repoName) {
    this.githubToken = githubToken;
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`;
  }

  /**
   * Send email notification via GitHub Actions
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} type - Type of notification (task, announcement, poll, ticket, thesisProgress)
   * @param {string} title - Document title
   * @returns {Promise<boolean>} - Success status
   */
  async sendEmail(email, name, type, title) {
    if (!email || !name || !type || !title) {
      console.error('Missing required fields for email notification');
      return false;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'send-email',
          client_payload: {
            email: email,
            name: name,
            type: type,
            title: title
          }
        })
      });

      if (response.ok) {
        console.log(`Email notification queued for ${email}`);
        return true;
      } else {
        const error = await response.text();
        console.error(`Failed to trigger email: ${response.status} - ${error}`);
        return false;
      }
    } catch (error) {
      console.error('Error triggering email notification:', error);
      return false;
    }
  }

  /**
   * Send emails to multiple users
   * @param {Array} users - Array of {email, name} objects
   * @param {string} type - Notification type
   * @param {string} title - Document title
   * @returns {Promise<number>} - Number of successfully queued emails
   */
  async sendEmailsToUsers(users, type, title) {
    let successCount = 0;
    
    for (const user of users) {
      if (user.email && user.name) {
        const result = await this.sendEmail(user.email, user.name, type, title);
        if (result) successCount++;
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    return successCount;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubEmailNotifier;
}
