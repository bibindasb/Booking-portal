// utils/adAuth.js

const ActiveDirectory = require('activedirectory2');

// Create Active Directory config from environment variables
const config = {
  url: process.env.AD_URL,                      // e.g. ldap://internal.media.net
  baseDN: process.env.AD_BASE_DN,              // e.g. DC=internal,DC=media,DC=net
  username: process.env.AD_SERVICE_USER,       // e.g. CN=ldapreader,OU=Service Accounts,...
  password: process.env.AD_SERVICE_PASSWORD,
};

const ad = new ActiveDirectory(config);

/**
 * Authenticate user credentials against Active Directory.
 * Will automatically append domain if missing.
 * 
 * @param {string} username - login username (sAMAccountName or UPN)
 * @param {string} password - user password
 * @returns {Promise<boolean>}
 */
function authenticateADUser(username, password) {
  return new Promise((resolve) => {
    if (!username || !password) {
      console.warn('[AD] Missing username or password for authentication.');
      return resolve(false);
    }

    const domain = process.env.AD_DOMAIN || 'internal.media.net';
    const loginUser = username.includes('@') ? username : `${username}@${domain}`;

    console.log(`[AD] Authenticating user: ${loginUser}`);

    ad.authenticate(loginUser, password, (err, auth) => {
      if (err) {
        console.error('[AD] Authentication error:', err.message);
        return resolve(false);
      }

      console.log(`[AD] Authentication result for ${loginUser}:`, auth);
      resolve(auth === true);
    });
  });
}

function getUserEmail(username) {
  return new Promise((resolve) => {
    const domain = process.env.AD_DOMAIN || 'internal.media.net';
    const loginUser = username.includes('@') ? username : `${username}@${domain}`;

    ad.findUser(loginUser, (err, user) => {
      if (err) {
        console.error('[AD] Error fetching user object:', err);
        return resolve(null);
      }
      if (!user || !user.mail) {
        console.warn(`[AD] No email found for user: ${loginUser}`);
        return resolve(null);
      }

      console.log(`[AD] Email for ${loginUser}: ${user.mail}`);
      resolve(user.mail);
    });
  });
}

/**
 * Check whether the authenticated user is a member of a specific group (by DN).
 *
 * @param {string} username - Same username used in authenticateADUser (w/ or w/o @domain)
 * @param {string} groupDN - Full distinguished name of group
 * @returns {Promise<boolean>}
 */
function isUserInGroup(username, groupDN) {
  return new Promise((resolve) => {
    if (!username || !groupDN) {
      console.warn('[AD] Missing username or group DN for group check.');
      return resolve(false);
    }

    const domain = process.env.AD_DOMAIN || 'internal.media.net';
    const loginUser = username.includes('@') ? username : `${username}@${domain}`;

    console.log(`[AD] Checking group membership: user=${loginUser}, group=${groupDN}`);

    ad.isUserMemberOf(loginUser, groupDN, (err, isMember) => {
      if (err) {
        console.error('[AD] Group check error:', err.message);
        return resolve(false);
      }

      console.log(`[AD] User ${loginUser} is member of group ${groupDN}:`, isMember);
      resolve(isMember === true);
    });
  });
}

module.exports = {
  authenticateADUser,
  isUserInGroup,
  getUserEmail
};