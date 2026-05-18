// ═══════════════════════════════════════
//  auth.gs — login / logout / session
//  Session is carried client-side (sessionStorage) via sid passed to
//  google.script.run APIs (no PropertiesService for end-user sessions).
// ═══════════════════════════════════════

function Auth_login(p) {
  const userId = (p.userId || '').trim();
  const pass   = (p.password || '').trim();

  if (!userId || !pass) {
    return Views_login({ error: 'נא להזין מספר אישי וסיסמה.' });
  }

  const creds = _rows('Credentials').data;
  const ok = creds.some(r => String(r[0]).trim() === userId && String(r[1]).trim() === pass);
  if (!ok) return Views_login({ error: 'מספר אישי או סיסמה שגויים.' });

  // Confirm user exists in Users sheet
  const user = Users_get(userId);
  if (!user) return Views_login({ error: 'המשתמש אינו רשום במערכת.' });

  const page = Views_dashboard({ sid: userId });
  page.sid = userId;
  return page;
}

function Auth_logout(p) {
  const page = Views_login({ info: 'התנתקת בהצלחה.' });
  page.clearSid = true;
  return page;
}

// Resolve current user from sid query param
function Auth_current(p) {
  const sid = (p && p.sid) ? String(p.sid).trim() : '';
  if (!sid) return null;
  return Users_get(sid);
}

function Auth_require(p) {
  const u = Auth_current(p);
  if (!u) throw new Error('לא מחובר. נא להתחבר מחדש.');
  return u;
}

function Auth_requireRole(p, roles) {
  const u = Auth_require(p);
  if (roles.indexOf(u.role) === -1) throw new Error('אין הרשאה לפעולה זו.');
  return u;
}
