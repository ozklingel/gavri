// ═══════════════════════════════════════
//  auth.gs — login / logout / session
//  Session is carried in the URL via &sid=USERID (no PropertiesService,
//  because PropertiesService is per-script-user, not per-end-user, so
//  it cannot be used as a real session store on a web app).
// ═══════════════════════════════════════

function Auth_login(p) {
  const userId = (p.userId || '').trim();
  const pass   = (p.password || '').trim();

  if (!userId || !pass) {
    return Views_login({ error: 'Please enter user ID and password.' });
  }

  const creds = _rows('Credentials').data;
  const ok = creds.some(r => String(r[0]).trim() === userId && String(r[1]).trim() === pass);
  if (!ok) return Views_login({ error: 'Invalid user ID or password.' });

  // Confirm user exists in Users sheet
  const user = Users_get(userId);
  if (!user) return Views_login({ error: 'User not registered.' });

  // Build dashboard with sid in query
  return Views_dashboard({ sid: userId });
}

function Auth_logout(p) {
  return Views_login({ info: 'Logged out.' });
}

// Resolve current user from sid query param
function Auth_current(p) {
  const sid = (p && p.sid) ? String(p.sid).trim() : '';
  if (!sid) return null;
  return Users_get(sid);
}

function Auth_require(p) {
  const u = Auth_current(p);
  if (!u) throw new Error('Not authenticated. Please log in again.');
  return u;
}

function Auth_requireRole(p, roles) {
  const u = Auth_require(p);
  if (roles.indexOf(u.role) === -1) throw new Error('Forbidden: insufficient role.');
  return u;
}
