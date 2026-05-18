// views_helpers.gs — UI helpers, topbar, error, login, dashboard
// ═══════════════════════════════════════
//  views.gs — Modern compact UI, RTL Hebrew
//  Pure HTML + inline CSS. No external JS beyond index.html script tag.
// ═══════════════════════════════════════

function _appUrl() {
  return ScriptApp.getService().getUrl() || '';
}

// ── SPA query parsing (legacy page= / action= strings) ──

function _spaParseQuery(query) {
  const params = {};
  let page = null;
  let action = null;
  (query || '').split('&').forEach(function(part) {
    if (!part) return;
    const eq = part.indexOf('=');
    const k = eq === -1 ? part : part.substring(0, eq);
    const v = eq === -1 ? '' : decodeURIComponent(part.substring(eq + 1).replace(/\+/g, ' '));
    if (k === 'page') page = v;
    else if (k === 'action') action = v;
    else if (k === 'sid') { /* session from client */ }
    else params[k] = v;
  });
  return { page: page, action: action, params: params };
}

function _spaParamsAttr(params) {
  const json = JSON.stringify(params || {});
  return ' data-spa-params="' + json.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
}

function _spaNavCard(page, params, icon, label) {
  return '<a href="#" data-spa-page="' + _esc(page) + '"' + _spaParamsAttr(params) +
    ' style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:10px;padding:32px 16px;background:var(--bg3);border:1px solid var(--border2);' +
    'border-radius:10px;color:var(--text);text-decoration:none;font-family:var(--mono);' +
    'font-size:15px;font-weight:bold;transition:all .15s" ' +
    'onmouseover="this.style.borderColor=\'var(--green)\';this.style.background=\'var(--bg4)\';this.style.color=\'var(--green)\'" ' +
    'onmouseout="this.style.borderColor=\'var(--border2)\';this.style.background=\'var(--bg3)\';this.style.color=\'var(--text)\'">' +
    '<span style="font-size:38px">' + icon + '</span>' +
    '<span>' + label + '</span></a>';
}

function _spaBarLink(page, params) {
  return 'href="#" data-spa-page="' + _esc(page) + '"' + _spaParamsAttr(params);
}

// ── Core building blocks ──

function _a(query, label, cls) {
  cls = cls || 'btn btn-secondary btn-sm';
  const parsed = _spaParseQuery(query);
  if (parsed.page) {
    return '<a href="#" class="' + cls + '" data-spa-page="' + _esc(parsed.page) + '"' +
      _spaParamsAttr(parsed.params) + '>' + label + '</a>';
  }
  if (parsed.action) {
    return '<a href="#" class="' + cls + '" data-spa-action="' + _esc(parsed.action) + '"' +
      _spaParamsAttr(parsed.params) + '>' + label + '</a>';
  }
  return '<a href="#" class="' + cls + '">' + label + '</a>';
}

function _confirmDelete(query, msg) {
  const parsed = _spaParseQuery(query);
  return '<a href="#" class="btn btn-danger btn-sm" data-spa-action="' + _esc(parsed.action) + '"' +
    _spaParamsAttr(parsed.params) +
    ' data-confirm="' + _esc(msg) + '" onclick="return confirmDelete(this)">🗑 מחק</a>';
}

function _confirmAction(query, label, msg, cls) {
  cls = cls || 'btn btn-secondary';
  const parsed = _spaParseQuery(query);
  return '<a href="#" class="' + cls + '" data-spa-action="' + _esc(parsed.action) + '"' +
    _spaParamsAttr(parsed.params) +
    ' data-confirm="' + _esc(msg) + '" onclick="return confirmDelete(this)">' + label + '</a>';
}

function _formOpen(extraClass) {
  const cls = 'spa-form' + (extraClass ? ' ' + extraClass : '');
  return '<form class="' + cls + '" onsubmit="return false">';
}

function _submitBtn(label, cls) {
  cls = cls || 'btn btn-primary';
  return '<button type="submit" class="' + cls + '">► ' + label + '</button>';
}

function _input(name, placeholder, value, type, extra) {
  type = type || 'text';
  value = value || '';
  extra = extra || '';
  return '<input type="' + type + '" name="' + name + '" placeholder="' + _esc(placeholder || '') + '" value="' + _esc(value) + '" class="form-input" ' + extra + '>';
}


function _dateInput(name, value) {
  // Custom Hebrew date picker — replaces <input type="date">
  // value should be "YYYY-MM-DD" or empty
  value = value || '';
  return '<div class="dp-wrap">' +
    '<input type="hidden" name="' + name + '" value="' + _esc(value) + '">' +
    '<div class="dp-trigger">' +
    '<span class="dp-val"><span class="dp-placeholder">בחר תאריך...</span></span>' +
    '<span class="dp-icon">📅</span>' +
    '</div>' +
    '<div class="dp-popup"></div>' +
    '</div>';
}

function _select(name, options, selected) {
  // options: array of [value, label]
  let s = '<select name="' + name + '" class="form-select">';
  options.forEach(function(o) {
    s += '<option value="' + _esc(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + _esc(o[1]) + '</option>';
  });
  return s + '</select>';
}

function _badge(label, type) {
  type = type || 'muted';
  return '<span class="badge badge-' + type + '">' + label + '</span>';
}

function _flash(p) {
  let s = '';
  if (p && p.error) s += '<div class="flash flash-error">⚠ ' + _esc(p.error) + '</div>';
  if (p && p.info)  s += '<div class="flash flash-info">✓ ' + _esc(p.info) + '</div>';
  return s;
}

function _wrapPage(body, title) {
  return {
    body: body,
    title: title || 'סדרת השטח — מערכת תרגילים',
    sid: null,
    clearSid: false
  };
}

function _htmlShell() {
  const tpl = HtmlService.createTemplateFromFile('index');
  tpl.pageTitle = 'סדרת השטח — מערכת תרגילים';
  tpl.body = '';
  return tpl.evaluate()
    .setTitle('סדרת השטח — מערכת תרגילים')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _userLink(userId, userName, sidQ) {
  return '<a href="#" data-spa-page="user"' + _spaParamsAttr({ id: userId }) +
    ' style="color:var(--blue);text-decoration:underline"><b>' + _esc(userName) + '</b></a>';
}

function _extraProfileFields(target) {
  return '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">שיוך יחידתי</label>' +
    _input('unit_affiliation', '', target.unit_affiliation || '') + '</div>' +
    '<div class="form-row"><label class="form-label">סוג שירות</label>' +
    _input('service_type', '', target.service_type || '') + '</div>' +
    '<div class="form-row"><label class="form-label">שיוך חיילי</label>' +
    _input('military_affiliation', '', target.military_affiliation || '') + '</div>' +
    '<div class="form-row"><label class="form-label">אפיון יחידתי</label>' +
    _input('unit_classification', '', target.unit_classification || '') + '</div>' +
    '<div class="form-row"><label class="form-label">תפקיד מיועד</label>' +
    _input('target_role', '', target.target_role || '') + '</div>' +
    '<div class="form-row"><label class="form-label">טלפון</label>' +
    _input('phone', '', target.phone || '', 'tel') + '</div>' +
    '</div>';
}

function _roleHe(r) {
  return r === 'admin' ? 'מפקד קורס' : r === 'commander' ? 'מפקד צוות' : r === 'trainee' ? 'חניך' : r;
}

function _statusHe(s) {
  return s === 'completed' ? 'הושלם' : s === 'pending' ? 'ממתין' : s === 'in_progress' ? 'בביצוע' : s;
}

function _statusBadge(s) {
  if (s === 'completed') return _badge('✓ הושלם', 'green');
  if (s === 'in_progress') return _badge('⟳ בביצוע', 'blue');
  return _badge('◌ ממתין', 'yellow');
}

function _topbar(user, sid) {
  if (!user) return '';
  const sidQ = encodeURIComponent(sid);
  let nav = '<nav class="topbar">' +
    '<div class="topbar-brand">' +
    '<span class="star">★</span>' +
    '<div><span>סדרת השטח</span><span class="sub">TRAINING CMD SYS // CLASSIFIED</span></div>' +
    '</div>' +
    '<div class="topbar-nav">';

  nav += '<span class="topbar-user">👤 ' + _esc(user.name) + ' · ' + _esc(_roleHe(user.role)) + '</span>';
  nav += _a('action=logout', '⏻ יציאה', 'btn btn-ghost btn-sm');
  nav += '</div></nav>';
  return nav;
}

// ─────────── ERROR ───────────
function Views_error(msg, p) {
  const sid = (p && p.sid) ? p.sid : '';
  const back = sid
    ? _a('page=dashboard&sid=' + encodeURIComponent(sid), '← לוח בקרה', 'btn btn-secondary')
    : _a('page=login', '← התחברות', 'btn btn-secondary');
  const body =
    '<div class="login-wrap">' +
    '<div class="login-box">' +
    '<div class="login-head"><div class="login-star">⚠</div>' +
    '<div class="login-title" style="color:#f87171">שגיאה</div></div>' +
    '<div class="login-body">' +
    '<p style="color:#fca5a5;margin-bottom:16px">' + _esc(msg) + '</p>' +
    back + '</div></div></div>';
  return _wrapPage(body, 'שגיאה');
}

// ─────────── LOGIN ───────────
function Views_login(p) {
  const form =
    _formOpen() +
    '<input type="hidden" name="action" value="login">' +
    '<div class="form-row"><label class="form-label">מספר אישי</label>' +
    _input('userId', 'U001', '', 'text', 'required autofocus') + '</div>' +
    '<div class="form-row"><label class="form-label">סיסמה</label>' +
    _input('password', '••••••••', '', 'password', 'required') + '</div>' +
    _submitBtn('כניסה למערכת', 'btn btn-primary btn-full btn-lg') +
    '</form>';

  const body =
    '<div class="login-wrap">' +
    '<div class="login-box">' +
    '<div class="login-head">' +
    '<div class="login-star">★</div>' +
    '<div class="login-title">סדרת השטח</div>' +
    '<div class="login-sub">// AUTHORIZED PERSONNEL ONLY //</div>' +
    '</div>' +
    '<div class="login-body">' +
    _flash(p) +
    form +
    '<hr class="divider">' +
    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px">// משתמשי דמו</div>' +
    '<div class="demo-grid">' +
    '<div class="demo-item"><div class="demo-role">מפקד קורס</div><div class="demo-cred">1<br>111</div></div>' +
    '<div class="demo-item"><div class="demo-role">מפקד צוות</div><div class="demo-cred">222<br>222</div></div>' +
    '<div class="demo-item"><div class="demo-role">חניך</div><div class="demo-cred">3332<br>3332</div></div>' +
    '</div>' +
    '</div></div></div>';
  return _wrapPage(body, 'התחברות');
}

// ─────────── DASHBOARD ───────────
function Views_dashboard(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;

  let content = '';
  if (user.role === 'admin')          content = _adminDashboard(sid);
  else if (user.role === 'commander') content = _commanderDashboard(user, sid);
  else                                content = _traineeDashboard(user, sid);

  const body = _topbar(user, sid) +
    '<div class="page">' + _flash(p) + content + '</div>';
  return _wrapPage(body, 'לוח בקרה');
}

// ─────────── EXERCISES MANAGEMENT ───────────
