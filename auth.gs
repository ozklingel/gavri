// ═══════════════════════════════════════
//  auth.gs — login / logout / session / optional email MFA
//  Session is carried client-side (sessionStorage) via sid passed to
//  google.script.run APIs (no PropertiesService for end-user sessions).
// ═══════════════════════════════════════

/** Set to true to require a one-time code sent by email after password login. */
var MFA_EMAIL_ENABLED = false;

/**
 * true = ניסיון GmailApp לפני MailApp (לפעמים עובד טוב יותר ב-Workspace).
 * false = רק MailApp.
 */
var MFA_TRY_GMAIL_FIRST = true;

var MFA_CODE_TTL_SEC = 600;
var MFA_CACHE_PREFIX = 'mfa_';

function Auth_login(p) {
  const userId = (p.userId || '').trim();
  const pass   = (p.password || '').trim();

  if (!userId || !pass) {
    return Views_login({ error: 'נא להזין מספר אישי וסיסמה.' });
  }

  if (!_authValidateCredentials(userId, pass)) {
    return Views_login({ error: 'מספר אישי או סיסמה שגויים.' });
  }

  const user = Users_get(userId);
  if (!user) return Views_login({ error: 'המשתמש אינו רשום במערכת.' });

  if (!MFA_EMAIL_ENABLED) {
    return _authCompleteLogin(user);
  }

  const email = _authUserEmail(user);
  if (!email) {
    return Views_login({
      error: 'לא מוגדר דוא"ל למשתמש. פנה למנהל המערכת להוספת כתובת דוא"ל.'
    });
  }

  const token = _authGenerateMfaToken();
  const code = _authGenerateMfaCode();
  _authStoreMfaChallenge(token, userId, code);

  try {
    _authSendMfaEmail(email, code, user.name);
  } catch (e) {
    _authClearMfaChallenge(token);
    return Views_login({ error: _authMailErrorMessage(e) });
  }

  return _authMfaPage(token, email, '');
}

function _authMfaPage(token, email, extraInfo) {
  const page = Views_login_mfa({
    mfaToken: token,
    info: extraInfo || ('נשלח קוד אימות ל-' + _authMaskEmail(email))
  });
  page.mfaToken = token;
  return page;
}

function Auth_verifyMfa(p) {
  const token = String(p.mfaToken || '').trim();
  const code = String(p.mfaCode || '').trim().replace(/\s/g, '');

  if (!token || !code) {
    return Views_login_mfa({ mfaToken: token, error: 'נא להזין קוד אימות.' });
  }

  const userId = _authConsumeMfaChallenge(token, code);
  if (!userId) {
    return Views_login_mfa({ mfaToken: token, error: 'קוד שגוי או שפג תוקפו. נסה שוב או שלח קוד מחדש.' });
  }

  const user = Users_get(userId);
  if (!user) return Views_login({ error: 'המשתמש לא נמצא.' });

  return _authCompleteLogin(user);
}

function Auth_resendMfa(p) {
  const token = String(p.mfaToken || '').trim();
  const challenge = _authGetMfaChallenge(token);
  if (!challenge) {
    return Views_login({ error: 'פג תוקף ההתחברות. התחבר מחדש.' });
  }

  const user = Users_get(challenge.userId);
  if (!user) return Views_login({ error: 'המשתמש לא נמצא.' });

  const email = _authUserEmail(user);
  if (!email) {
    return Views_login({ error: 'לא מוגדר דוא"ל למשתמש.' });
  }

  const code = _authGenerateMfaCode();
  _authUpdateMfaChallenge(token, code);

  try {
    _authSendMfaEmail(email, code, user.name);
  } catch (e) {
    return Views_login_mfa({ mfaToken: token, error: _authMailErrorMessage(e) });
  }

  return _authMfaPage(token, email, 'קוד חדש נשלח ל-' + _authMaskEmail(email));
}

function Auth_logout(p) {
  const page = Views_login({ info: 'התנתקת בהצלחה.' });
  page.clearSid = true;
  return page;
}

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
  const norm = Roles_normalize(u.role);
  const allowed = roles.map(function(r) { return Roles_normalize(r); });
  if (allowed.indexOf(norm) === -1) throw new Error('אין הרשאה לפעולה זו.');
  return u;
}

function _authValidateCredentials(userId, pass) {
  const creds = _rows('Credentials').data;
  return creds.some(function(r) {
    return String(r[0]).trim() === userId && String(r[1]).trim() === pass;
  });
}

function _authUserEmail(user) {
  return String((user && user.email) || '').trim();
}

function _authCompleteLogin(user) {
  const page = Views_dashboard({ sid: user.id });
  page.sid = user.id;
  return page;
}

function _authGenerateMfaToken() {
  return Utilities.getUuid().replace(/-/g, '');
}

function _authGenerateMfaCode() {
  return ('000000' + Math.floor(Math.random() * 1000000)).slice(-6);
}

function _authMfaCacheKey(token) {
  return MFA_CACHE_PREFIX + token;
}

function _authStoreMfaChallenge(token, userId, code) {
  CacheService.getScriptCache().put(
    _authMfaCacheKey(token),
    JSON.stringify({ userId: userId, code: code }),
    MFA_CODE_TTL_SEC
  );
}

function _authGetMfaChallenge(token) {
  const raw = CacheService.getScriptCache().get(_authMfaCacheKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function _authUpdateMfaChallenge(token, code) {
  const ch = _authGetMfaChallenge(token);
  if (!ch) return false;
  ch.code = code;
  CacheService.getScriptCache().put(
    _authMfaCacheKey(token),
    JSON.stringify(ch),
    MFA_CODE_TTL_SEC
  );
  return true;
}

function _authClearMfaChallenge(token) {
  CacheService.getScriptCache().remove(_authMfaCacheKey(token));
}

function _authConsumeMfaChallenge(token, code) {
  const ch = _authGetMfaChallenge(token);
  if (!ch) return null;
  if (String(ch.code).trim() !== String(code).trim()) return null;
  _authClearMfaChallenge(token);
  return ch.userId;
}

function _authMaskEmail(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const masked = local.length <= 2
    ? '**'
    : local.charAt(0) + '***' + local.charAt(local.length - 1);
  return masked + '@' + parts[1];
}

function _authMailErrorMessage(err) {
  const msg = String((err && err.message) || err || '');
  const blocked = msg.indexOf('blocked') !== -1 ||
    msg.indexOf('חסומ') !== -1 ||
    msg.indexOf('403') !== -1 ||
    msg.indexOf('Access Not Configured') !== -1;

  if (blocked) {
    return 'Google חסם את האפליקציה. בחשבון פרטי: הגדר OAuth consent (Testing) + הוסף את עצמך כ-Test user, ' +
      'ואז הרץ authorizeMfaEmail() בעורך Apps Script → Advanced → "Go to app (unsafe)". ' +
      'פרטים: getMfaSetupInfo(). זמני: MFA_EMAIL_ENABLED = false.';
  }

  if (msg.indexOf('script.send_mail') !== -1 || msg.indexOf('MailApp') !== -1 ||
      msg.indexOf('GmailApp') !== -1 || msg.indexOf('gmail.send') !== -1) {
    return 'שליחת דוא"ל לא מאושרת. הרץ authorizeMfaEmail() בעורך Apps Script, ' +
      'אשר הרשאות, ופרוס מחדש (Execute as: Me). ' +
      'אם Google חוסם — הרץ getMfaSetupInfo() בעורך הסקריפט.';
  }
  return 'שליחת קוד האימות נכשלה: ' + msg;
}

/**
 * הרצה מעורך Apps Script — מדפיס הוראות הגדרה (חשבון Google פרטי).
 */
function getMfaSetupInfo() {
  const scriptId = ScriptApp.getScriptId();
  const email = Session.getActiveUser().getEmail() || '(לא זוהה — התחבר ל-Google בעורך)';
  const info =
    '=== MFA — חשבון Google פרטי ===\n' +
    'Script ID: ' + scriptId + '\n' +
    'המשתמש שלך: ' + email + '\n\n' +
    'שלב 1 — OAuth consent (חובה, פעם אחת):\n' +
    '  script.google.com → Project Settings ⚙\n' +
    '  → Google Cloud Platform project → Open project\n' +
    '  → OAuth consent screen\n' +
    '  → User type: External → Create\n' +
    '  → App name + Support email + Developer email\n' +
    '  → Scopes → Add: .../auth/script.send_mail\n' +
    '  → Test users → ADD: ' + email + '\n' +
    '  → Save (Publishing status: Testing)\n\n' +
    'שלב 2 — אישור הרשאות:\n' +
    '  חזור ל-Apps Script → בחר authorizeMfaEmail → Run\n' +
    '  → Review permissions → Advanced\n' +
    '  → "Go to [app name] (unsafe)" → Allow\n' +
    '  (זו האפליקציה שלך — בטוח לאשר)\n\n' +
    'שלב 3 — פריסה:\n' +
    '  Deploy → Manage deployments → Edit → New version → Deploy\n' +
    '  Execute as: Me · Who has access: Anyone (or Only you)\n\n' +
    'עריכה: https://script.google.com/home/projects/' + scriptId + '/edit\n';
  Logger.log(info);
  return info;
}

/** @deprecated use getMfaSetupInfo */
function getMfaAdminSetupInfo() {
  return getMfaSetupInfo();
}

/**
 * הרצה חד-פעמית מעורך Apps Script (לא מהאפליקציה):
 * 1. בחר authorizeMfaEmail → Run → אשר הרשאות
 * 2. Deploy → New version
 */
function authorizeMfaEmail() {
  const to = Session.getActiveUser().getEmail();
  if (!to) {
    throw new Error('לא נמצא דוא"ל למשתמש הפעיל.');
  }
  _authSendMfaEmail(to, '123456', 'בדיקה');
  Logger.log('MFA email authorized — test sent to ' + to);
  return 'OK — test email sent to ' + to;
}

function _authSendMfaEmail(email, code, userName) {
  const subject = 'קוד אימות — סדרת השטח';
  const body =
    'שלום ' + (userName || '') + ',\n\n' +
    'קוד האימות שלך: ' + code + '\n\n' +
    'הקוד תקף ל-' + Math.floor(MFA_CODE_TTL_SEC / 60) + ' דקות.\n' +
    'אם לא ביקשת להתחבר, התעלם מהודעה זו.\n';

  const htmlBody =
    '<div dir="rtl" style="font-family:Arial,sans-serif">' +
    '<p>שלום <b>' + _esc(userName || '') + '</b>,</p>' +
    '<p>קוד האימות שלך:</p>' +
    '<p style="font-size:28px;font-weight:bold;letter-spacing:6px">' + _esc(code) + '</p>' +
    '<p style="color:#666;font-size:13px">הקוד תקף ל-' + Math.floor(MFA_CODE_TTL_SEC / 60) +
    ' דקות.</p></div>';

  const opts = { htmlBody: htmlBody, name: 'סדרת השטח' };
  const errors = [];

  if (MFA_TRY_GMAIL_FIRST) {
    try {
      GmailApp.sendEmail(email, subject, body, opts);
      return;
    } catch (e1) {
      errors.push('GmailApp: ' + (e1.message || e1));
    }
  }

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: 'סדרת השטח'
    });
  } catch (e2) {
    errors.push('MailApp: ' + (e2.message || e2));
    throw new Error(errors.join(' | '));
  }
}
