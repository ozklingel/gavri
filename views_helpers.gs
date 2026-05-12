// views_helpers.gs — UI helpers, topbar, error, login, dashboard
// ═══════════════════════════════════════
//  views.gs — Modern compact UI, RTL Hebrew
//  Pure HTML + inline CSS. No external JS beyond index.html script tag.
// ═══════════════════════════════════════

function _appUrl() {
  return ScriptApp.getService().getUrl() || '';
}
function _url(query) {
  return _appUrl() + (query ? '?' + query : '');
}

// ── Core building blocks ──

function _a(query, label, cls) {
  cls = cls || 'btn btn-secondary btn-sm';
  return '<a target="_top" href="' + _esc(_url(query)) + '" class="' + cls + '">' + label + '</a>';
}

// Render a confirm-before-delete link button
function _confirmDelete(query, msg) {
  return '<a target="_top" href="' + _esc(_url(query)) + '" ' +
    'class="btn btn-danger btn-sm" ' +
    'data-confirm="' + _esc(msg) + '" ' +
    'onclick="return confirmDelete(this)">🗑 מחק</a>';
}

// Render a generic confirm-before-action link button
function _confirmAction(query, label, msg, cls) {
  cls = cls || 'btn btn-secondary';
  return '<a target="_top" href="' + _esc(_url(query)) + '" ' +
    'class="' + cls + '" ' +
    'data-confirm="' + _esc(msg) + '" ' +
    'onclick="return confirmDelete(this)">' + label + '</a>';
}

function _formOpen(extraClass) {
  return '<form action="' + _esc(_appUrl()) + '" method="get" target="_top"' + (extraClass ? ' class="' + extraClass + '"' : '') + '>';
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

function _html(body, title) {
  const tpl = HtmlService.createTemplateFromFile('index');
  tpl.pageTitle = title || 'סדרת שטח — מערכת תרגילים';
  tpl.body = body;
  return tpl.evaluate()
    .setTitle(title || 'סדרת שטח — מערכת תרגילים')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _userLink(userId, userName, sidQ) {
  return '<a target="_top" href="' + _esc(_url('page=user&id=' + encodeURIComponent(userId) + '&sid=' + sidQ)) +
    '" style="color:var(--blue);text-decoration:underline"><b>' + _esc(userName) + '</b></a>';
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
    '<div><span>סדרת שטח</span><span class="sub">TRAINING CMD SYS // CLASSIFIED</span></div>' +
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
  return _html(body, 'שגיאה');
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
    '<div class="login-title">סדרת שטח</div>' +
    '<div class="login-sub">// AUTHORIZED PERSONNEL ONLY //</div>' +
    '</div>' +
    '<div class="login-body">' +
    _flash(p) +
    form +
    '<hr class="divider">' +
    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px">// משתמשי דמו</div>' +
    '<div class="demo-grid">' +
    '<div class="demo-item"><div class="demo-role">מפקד קורס</div><div class="demo-cred">1<br>admin123</div></div>' +
    '<div class="demo-item"><div class="demo-role">מפקד צוות</div><div class="demo-cred">222<br>222</div></div>' +
    '<div class="demo-item"><div class="demo-role">חניך</div><div class="demo-cred">3332<br>3332</div></div>' +
    '</div>' +
    '</div></div></div>';
  return _html(body, 'התחברות');
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
  return _html(body, 'לוח בקרה');
}

// ─────────── EXERCISES MANAGEMENT ───────────
