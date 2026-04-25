/**
 * auth.gs — Authentication & session
 *
 * Sessions are stored per-user via PropertiesService.getUserProperties().
 * Apps Script web apps deployed as "execute as user accessing the web app"
 * give each viewer their own user properties bucket — sufficient for a
 * lightweight session.
 */

var SESSION_KEY = 'session_user_id';

function Auth_handleLogin(params) {
  var userId   = (params.userId || '').toString().trim();
  var password = (params.password || '').toString();

  if (!userId || !password) {
    return Views_redirect('?page=login&msg=Missing+credentials');
  }

  var creds = readSheet('Credentials');
  var ok = creds.some(function (c) {
    return String(c.user_id) === userId && String(c.password) === password;
  });

  if (!ok) {
    return Views_redirect('?page=login&msg=Invalid+credentials');
  }

  var user = findById('Users', userId);
  if (!user) {
    return Views_redirect('?page=login&msg=User+not+found');
  }

  PropertiesService.getUserProperties().setProperty(SESSION_KEY, String(userId));
  return Views_redirect('?page=dashboard');
}

function Auth_logout() {
  PropertiesService.getUserProperties().deleteProperty(SESSION_KEY);
}

/**
 * Returns a session object: { id, name, role, team_id } or null.
 */
function Auth_getSession() {
  var uid = PropertiesService.getUserProperties().getProperty(SESSION_KEY);
  if (!uid) return null;
  var u = findById('Users', uid);
  if (!u) return null;
  return {
    id: String(u.id),
    name: u.name,
    role: u.role,
    team_id: u.team_id != null ? String(u.team_id) : ''
  };
}

function Auth_requireRole(session, roles) {
  if (!session) throw new Error('Not authenticated');
  if (roles.indexOf(session.role) === -1) {
    throw new Error('Forbidden: requires one of ' + roles.join(', '));
  }
}
