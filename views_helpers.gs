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
  return '<form class="' + cls + '">';
}

function _submitBtn(label, cls) {
  cls = cls || 'btn btn-primary';
  return '<button type="submit" class="' + cls + '">► ' + label + '</button>';
}

function _feedbackBtn(assignmentId, exerciseId, hasFeedback, cls) {
  cls = cls || 'btn btn-ghost btn-sm';
  const label = hasFeedback ? 'משוב ✓' : 'משוב';
  return _a(
    'page=feedback&assignmentId=' + encodeURIComponent(assignmentId) +
    '&id=' + encodeURIComponent(exerciseId),
    label,
    cls
  );
}

function _textarea(name, placeholder, value, extra) {
  value = value || '';
  extra = extra || '';
  return '<textarea name="' + name + '" class="form-input" placeholder="' + _esc(placeholder || '') + '" ' +
    extra + '>' + _esc(value) + '</textarea>';
}

function _input(name, placeholder, value, type, extra) {
  type = type || 'text';
  value = value || '';
  extra = extra || '';
  return '<input type="' + type + '" name="' + name + '" placeholder="' + _esc(placeholder || '') + '" value="' + _esc(value) + '" class="form-input" ' + extra + '>';
}

function _timeHalfHourOptions() {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    opts.push(hh + ':00');
    opts.push(hh + ':30');
  }
  return opts;
}

/** שעה — גלגלת חצאי שעה + הקלדה ידנית HH:MM */
function _timeInputHalfHour(name, value, extra) {
  extra = extra || '';
  const uid = 'tw-' + String(name).replace(/[^a-zA-Z0-9_]/g, '_');
  return '<div class="time-wheel-wrap" data-time-wheel="' + uid + '">' +
    '<input type="text" name="' + _esc(name) + '" class="form-input time-half-input" ' +
    'value="' + _esc(value || '') + '" placeholder="08:00" autocomplete="off" ' +
    'inputmode="numeric" title="שעה בפורמט HH:MM" ' + extra + '>' +
    '<button type="button" class="time-wheel-btn" tabindex="-1" aria-label="בחר שעה">▾</button>' +
    '<div class="time-wheel-popup" hidden><div class="time-wheel-list" role="listbox"></div></div>' +
    '</div>';
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

function _select(name, options, selected, extraAttrs) {
  // options: array of [value, label]
  let s = '<select name="' + name + '" class="form-select"' + (extraAttrs ? ' ' + extraAttrs : '') + '>';
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

function _spaModuleSlot(moduleId, params, label) {
  label = label || 'טוען...';
  return '<div class="spa-module" data-spa-module="' + _esc(moduleId) + '"' +
    _spaParamsAttr(params || {}) + '>' +
    '<div class="spa-module-skeleton" aria-busy="true">' +
    '<span class="spa-module-skeleton-bar"></span>' +
    '<span class="spa-module-skeleton-text">' + _esc(label) + '</span>' +
    '</div></div>';
}

function _parseOpenSections(p) {
  const raw = String((p && p.open) || '').trim();
  if (!raw) return {};
  const set = {};
  raw.split(',').forEach(function(part) {
    part = String(part).trim();
    if (part) set[part] = true;
  });
  return set;
}

function _spaTabsBar(page, baseParams, items, activeId) {
  let bar = '<nav class="spa-tabs-bar tabs" aria-label="לשוניות">';
  items.forEach(function(item) {
    const params = Object.assign({}, baseParams || {}, item.params || {}, { tab: item.id });
    delete params.open;
    delete params.section;
    const isActive = item.id === activeId;
    bar += '<a href="#" class="tab-link' + (isActive ? ' active' : '') +
      '" data-spa-page="' + _esc(page) + '"' + _spaParamsAttr(params) + '>' +
      item.label + '</a>';
  });
  return bar + '</nav>';
}

function _spaSectionTabsBar(page, baseParams, paramKey, items, activeId) {
  let bar = '<nav class="spa-tabs-bar tabs" aria-label="לשוניות">';
  items.forEach(function(item) {
    const params = Object.assign({}, baseParams || {}, item.params || {});
    params[paramKey] = item.id;
    delete params.open;
    const isActive = item.id === activeId;
    bar += '<a href="#" class="tab-link' + (isActive ? ' active' : '') +
      '" data-spa-page="' + _esc(page) + '"' + _spaParamsAttr(params) + '>' +
      item.label + '</a>';
  });
  return bar + '</nav>';
}

function _expandablePanel(page, baseParams, sectionId, title, contentHtml, openSet) {
  openSet = openSet || {};
  const isOpen = !!openSet[sectionId];
  if (isOpen) {
    const closeParams = Object.assign({}, baseParams || {});
    delete closeParams.open;
    return '<div class="collapsible open" id="panel-' + _esc(sectionId) + '">' +
      '<a href="#" class="collapsible-toggle coll-open" data-spa-page="' + _esc(page) + '"' +
      _spaParamsAttr(closeParams) + '>' + title + ' <span class="arrow">▴</span></a>' +
      '<div class="collapsible-content open">' + contentHtml + '</div></div>';
  }
  const openParams = Object.assign({}, baseParams || {}, { open: sectionId });
  return '<div class="expandable-closed-wrap">' +
    '<a href="#" class="expandable-closed collapsible-toggle" data-spa-page="' + _esc(page) + '"' +
    _spaParamsAttr(openParams) + '>' + title + ' <span class="arrow">▾</span></a></div>';
}

function _htmlShell() {
  const tpl = HtmlService.createTemplateFromFile('index');
  tpl.pageTitle = 'סדרת השטח — מערכת תרגילים';
  tpl.body = '';
  tpl.appBgDataUri = typeof _appBgDataUri === 'function' ? _appBgDataUri() : '';
  return tpl.evaluate()
    .setTitle('סדרת השטח — מערכת תרגילים')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _userLink(userId, userName, sidQ) {
  return '<a href="#" data-spa-page="user"' + _spaParamsAttr({ id: userId }) +
    ' style="color:var(--blue);text-decoration:underline"><b>' + _esc(userName) + '</b></a>';
}

function _whatsappDigits(phone) {
  var d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('972') === 0) return d;
  if (d.charAt(0) === '0') return '972' + d.slice(1);
  if (d.length === 9 && d.charAt(0) === '5') return '972' + d;
  return d;
}

function _whatsappUrl(phone) {
  var d = _whatsappDigits(phone);
  return d ? ('https://wa.me/' + d) : '';
}

function _whatsappLink(phone, label) {
  var raw = String(phone || '').trim();
  if (!raw) return '<span style="color:var(--muted)">—</span>';
  var url = _whatsappUrl(raw);
  if (!url) return _esc(raw);
  var text = label != null ? String(label) : raw;
  return '<a href="' + _esc(url) + '" target="_blank" rel="noopener noreferrer" class="whatsapp-link" title="פתח צ\'אט בוואטסאפ">' +
    _esc(text) + '</a>';
}

function _exerciseLink(exerciseId, title) {
  return '<a href="#" class="exercise-name-link" data-spa-page="exercise"' + _spaParamsAttr({ id: exerciseId }) +
    '><b>' + _esc(title) + '</b></a>';
}

function _assignmentRespOptions() {
  return [
    'מפ חיר א', 'סמפ חיר א', 'חונך מפ א', 'מפ חיר ב', 'סמפ חיר ב', 'חונך מפ ב',
    'מפ מסייעת', 'סמפ מסייעת', 'חונך מפ מסייעת',
    'מפ חהן', 'סמפ חהן', 'חנוך מפ חהן',
    'מפ חשן', 'סמפ חשן', 'חונך מפ חשן',
    'מנהל התרגיל (מפקץ / מחט)', 'רען ק בטיחות (מלי)', 'קמבץ מנהל תרגיל (קמפ)',
    'בקר שטח וצלם (ארזים)', 'מטיס רחפן תחקור (ארזים)', 'מפעיל מגנט (בגירה)',
    'מנהל לחימה (ארזים)', 'מסח (מרהש - מלי)', 'קלח (ארזים)',
    'ע קלח (השלמה חיילית לוגיסטיקה)', 'קמן (ארזים)', 'מדריכת שוב (מח שוב מלפק)',
    'מפקד אחראי גדוד',
    'מגד (חניך קמג)', 'מפקד מכלול מבצעים (חניך קמג)', 'קמבץ גדוד (חניך קמפ)',
    'מ חפק מגד רגלי (ממ מגדוד שתפ)', 'קשא (השלמה חיילית)', 'קשרג (השלמה חילית)',
    'קמן (השלמה חיילית)', 'קסג (השלמה חיילית)', 'קמן (השלמה חיילית)',
    'קשרג (השלמה חיילית)', 'מ מכלול מנהלה (חניך קמפ)', 'חונך מפ חלג'
  ];
}

function _respDatalistHtml(listId) {
  return '<datalist id="' + listId + '">' +
    _assignmentRespOptions().map(function(r) {
      return '<option value="' + _esc(r) + '">';
    }).join('') +
    '</datalist>';
}

function _fireZoneSelectOptions(selected) {
  const opts = FireZones_names().map(function(name) { return [name, name]; });
  if (selected && !opts.some(function(o) { return o[0] === selected; })) {
    opts.unshift([selected, selected + ' (לא ברשימה — בחר מחדש)']);
  }
  return [['', '— בחר שטח אש —']].concat(opts);
}

function _fieldForceSelectOptions(selected) {
  const opts = FieldForces_all()
    .map(function(f) {
      const name = FieldForces_displayLabel(f);
      return name ? [name, name] : null;
    })
    .filter(Boolean);
  if (selected && !opts.some(function(o) { return o[0] === selected; })) {
    opts.unshift([selected, selected + ' (לא ברשימה — בחר מחדש)']);
  }
  return [['', '— בחר גדוד שת״פ —']].concat(opts);
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
    '<div class="form-row"><label class="form-label">דוא"ל (MFA)</label>' +
    _input('email', 'user@example.com', target.email || '', 'email') + '</div>' +
    '</div>';
}

function _roleHe(r) {
  return Roles_label(r);
}

function _roleBadgeType(r) {
  return Roles_badgeType(r);
}

function _dashboardUserSearchBar(selectedUserId) {
  const users = Users_all().map(function(u) {
    return { id: u.id, name: u.name, role: Roles_label(u.role) };
  });
  const json = JSON.stringify(users).replace(/</g, '\\u003c');
  let prefill = '';
  const uid = String(selectedUserId || '').trim();
  if (uid) {
    const u = Users_get(uid);
    if (u) prefill = u.name + ' (' + u.id + ')';
  }
  return '<div class="dashboard-search-panel">' +
    '<label class="form-label dashboard-search-label">🔍 חיפוש משתמש</label>' +
    '<div class="dashboard-search-row">' +
    '<div class="user-search-wrap">' +
    '<input type="text" id="dashboardUserSearch" class="form-input dashboard-search-input" ' +
    'placeholder="הקלד שם או מספר אישי..." autocomplete="off" ' +
    'value="' + _esc(prefill) + '" ' +
    'data-selected-id="' + _esc(uid) + '" ' +
    'data-users="' + json.replace(/"/g, '&quot;') + '">' +
    '</div>' +
    '<button type="button" id="dashboardUserSearchBtn" class="btn btn-primary dashboard-search-btn">חפש</button>' +
    '</div>' +
    '<div id="dashboardUserSearchResults" class="user-search-results dashboard-search-results" hidden></div>' +
    '</div>';
}

function _statusHe(s) {
  return s === 'completed' ? 'הושלם' : s === 'pending' ? 'ממתין' : s === 'in_progress' ? 'בביצוע' : s;
}

function _statusBadge(s) {
  if (s === 'completed') return _badge('✓ הושלם', 'green');
  if (s === 'in_progress') return _badge('⟳ בביצוע', 'blue');
  return _badge('◌ ממתין', 'yellow');
}

function _parseBool(val) {
  if (val === true || val === 1) return true;
  const s = String(val == null ? '' : val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'כן' || s === 'on';
}

function _boolToSheet(val) {
  return _parseBool(val) ? 'true' : 'false';
}

function _boolBadge(val) {
  return _parseBool(val) ? _badge('✓ כן', 'green') : _badge('לא', 'muted');
}

function _checkboxRow(name, label, checked) {
  return '<label class="form-check" style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer">' +
    '<input type="checkbox" name="' + name + '" value="true"' + (_parseBool(checked) ? ' checked' : '') + '>' +
    '<span>' + _esc(label) + '</span></label>';
}

function _drawerNavItems(user) {
  const items = [{ page: 'dashboard', label: 'מסך הבית', icon: '⊞' }];
  if (Roles_hasAdminAccess(user.role)) {
    items.push({ page: 'exercises', label: 'תרגילים', icon: '🎯' });
    items.push(
      { page: 'assign', label: 'לוח שיבוץ', icon: '🔀' },
      { page: 'timeline', label: 'ציר זמן', icon: '📅' },
      { page: 'users', label: 'משתמשים וצוותים', icon: '👤', params: { tab: 'users' } },
      { page: 'statistics', label: 'סטטיסטיקות', icon: '📊' }
    );
  } else if (Roles_hasTimelineAccess(user.role)) {
    items.push({ page: 'timeline', label: 'ציר זמן', icon: '📅' });
  }
  items.push(
    { page: 'homeConstraints', label: 'אילוצי בית', icon: '🏠' },
    { page: 'fieldForces', label: 'כוחות בשטח', icon: '⚔' },
    { page: 'fireZones', label: 'שטחי אש', icon: '🔥' }
  );
  return items;
}

function _appDrawer(user, sid) {
  let nav = '';
  _drawerNavItems(user).forEach(function(item) {
    const params = item.params || {};
    nav += '<a href="#" class="app-drawer-link" data-spa-page="' + _esc(item.page) + '"' +
      _spaParamsAttr(params) + '>' +
      '<span class="app-drawer-link-icon">' + item.icon + '</span>' +
      '<span>' + _esc(item.label) + '</span></a>';
  });

  const panelsHtml =
    '<div class="app-drawer-panels" id="appDrawerPanels">' +
    '<div data-spa-module="drawer.panels" data-spa-module-loaded="0"></div></div>';

  return '<div class="app-drawer-overlay" id="appDrawerOverlay" hidden></div>' +
    '<aside class="app-drawer" id="appDrawer" aria-hidden="true" aria-label="תפריט ראשי">' +
    '<div class="app-drawer-head">' +
    '<div class="app-drawer-identity">' +
    '<div class="app-drawer-user-name">' + _userLink(user.id, user.name, '') + '</div>' +
    '<div class="app-drawer-user-role">' + _esc(_roleHe(user.role)) + '</div>' +
    '</div>' +
    '<button type="button" class="app-drawer-close" id="appDrawerClose" aria-label="סגור">✕</button>' +
    '</div>' +
    '<div class="app-drawer-scroll">' +
    '<nav class="app-drawer-nav">' + nav + '</nav>' +
    panelsHtml +
    '</div>' +
    '<div class="app-drawer-foot">' +
    _confirmAction('action=logout', '⏻ יציאה', 'האם אתה בטוח שברצונך לצאת?', 'btn btn-danger btn-full') +
    '</div></aside>';
}

function _spaBackBtn(cls) {
  cls = cls || 'btn btn-ghost btn-sm';
  return '<button type="button" class="' + cls + '" data-spa-back title="חזרה">← חזרה</button>';
}

function _topbar(user, sid) {
  if (!user) return '';
  return _appDrawer(user, sid) +
    '<nav class="topbar">' +
    '<div class="topbar-start">' +
    '<button type="button" class="btn btn-ghost btn-sm topbar-menu-btn" id="appDrawerOpen" aria-label="פתח תפריט">☰</button>' +
    '<button type="button" class="btn btn-ghost btn-sm topbar-back-btn" id="appTopbarBack" data-spa-back title="חזרה" hidden>← חזרה</button>' +
    '<a href="#" class="topbar-brand" data-spa-page="dashboard"' + _spaParamsAttr({}) + '>' +
    '<span class="star">★</span>' +
    '<div><span>סדרת השטח</span><span class="sub">TRAINING CMD</span></div>' +
    '</a></div></nav>';
}

// ─────────── ERROR ───────────
function Views_error(msg, p) {
  const body =
    '<div class="login-wrap">' +
    '<div class="login-box">' +
    '<div class="login-head"><div class="login-star">⚠</div>' +
    '<div class="login-title" style="color:#f87171">שגיאה</div></div>' +
    '<div class="login-body">' +
    '<p style="color:#fca5a5;margin-bottom:16px">' + _esc(msg) + '</p>' +
    _spaBackBtn('btn btn-secondary') + '</div></div></div>';
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
    '</div>' +
    '<div class="login-body">' +
    _flash(p) +
    form +
    '<hr class="divider">' +
    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px">// משתמשי דמו</div>' +
    '<div class="demo-grid">' +
    '<div class="demo-item"><div class="demo-role">סגל</div><div class="demo-cred">1<br>111</div></div>' +
    '<div class="demo-item"><div class="demo-role">מפקצ</div><div class="demo-cred">222<br>222</div></div>' +
    '<div class="demo-item"><div class="demo-role">חניך</div><div class="demo-cred">3332<br>3332</div></div>' +
    '<div class="demo-item"><div class="demo-role">חונך</div><div class="demo-cred">333<br>333</div></div>' +
    '<div class="demo-item"><div class="demo-role">מגד</div><div class="demo-cred">1010<br>1010</div></div>' +
    '</div>' +
    '</div></div></div>';
  return _wrapPage(body, 'התחברות');
}

function Views_login_mfa(p) {
  const token = String((p && p.mfaToken) || '').trim();
  const verifyForm =
    _formOpen() +
    '<input type="hidden" name="action" value="verifyMfa">' +
    '<input type="hidden" name="mfaToken" value="' + _esc(token) + '">' +
    '<div class="form-row"><label class="form-label">קוד אימות (6 ספרות)</label>' +
    _input('mfaCode', '000000', '', 'text', 'required maxlength="6" inputmode="numeric" autocomplete="one-time-code"') +
    '</div>' +
    _submitBtn('אימות והמשך', 'btn btn-primary btn-full btn-lg') +
    '</form>';

  const resendForm =
    '<div style="margin-top:12px">' +
    _formOpen() +
    '<input type="hidden" name="action" value="resendMfa">' +
    '<input type="hidden" name="mfaToken" value="' + _esc(token) + '">' +
    _submitBtn('שלח קוד מחדש', 'btn btn-ghost btn-full') +
    '</form></div>';

  const body =
    '<div class="login-wrap">' +
    '<div class="login-box">' +
    '<div class="login-head">' +
    '<div class="login-star">✉</div>' +
    '<div class="login-title">אימות דוא"ל</div>' +
    '<div class="login-sub">// TWO-FACTOR AUTH //</div>' +
    '</div>' +
    '<div class="login-body">' +
    _flash(p) +
    '<p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.5">' +
    'הזן את הקוד שנשלח לדוא"ל שלך.</p>' +
    verifyForm +
    resendForm +
    '<hr class="divider">' +
    '<a href="#" class="btn btn-secondary btn-full" data-spa-page="login">← חזרה להתחברות</a>' +
    '</div></div></div>';
  return _wrapPage(body, 'אימות דוא"ל');
}

function _isoWeekNumber(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(String(dateStr) + 'T12:00:00');
  if (isNaN(d.getTime())) return 0;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function _isoWeekYear(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(String(dateStr) + 'T12:00:00');
  if (isNaN(d.getTime())) return 0;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  return target.getFullYear();
}

function _isoWeekLabel(dateStr) {
  const w = _isoWeekNumber(dateStr);
  if (!w) return '';
  const y = _isoWeekYear(dateStr);
  return 'שבוע לועזי ' + w + (y ? ' · ' + y : '');
}

// ─────────── DASHBOARD ───────────

function _dashboardResolveSearchUserId(p, user, tab) {
  const explicit = String((p && p.searchUserId) || '').trim();
  if (explicit) return explicit;
  if (String(tab || 'search').trim() === 'search' && user && user.id) {
    return String(user.id).trim();
  }
  return '';
}

/** משתמש להדגשה במטריצות צוות / תרגיל — מחיפוש או המשתמש המחובר */
function _dashboardHighlightUserId(p, user) {
  const explicit = String((p && p.searchUserId) || '').trim();
  if (explicit) return explicit;
  if (user && user.id) return String(user.id).trim();
  return '';
}

function _dashboardTabItems(user) {
  const items = [{ id: 'search', label: '🔍 חיפוש' }];
  if (typeof _teamMatrixAllowedTeams === 'function' && _teamMatrixAllowedTeams(user).length) {
    items.push({ id: 'team', label: '🪖 תצוגת צוות' });
  }
  items.push({ id: 'exercise', label: '🎯 תצוגה לפי תרגיל' });
  if (Roles_hasAdminAccess(user.role)) {
    items.push({ id: 'conflicts', label: '⚠ התנגשויות' });
  }
  return items;
}

function _dashboardResolveTab(p, user) {
  const tab = String((p && p.tab) || 'search').trim();
  const allowed = _dashboardTabItems(user).map(function(item) { return item.id; });
  if (allowed.indexOf(tab) === -1) return 'search';
  return tab;
}

function _dashboardTabPanelHtml(user, sid, tab, p) {
  if (tab === 'team') {
    return '<div class="team-matrix-page">' + _teamMatrixEmbedHtml(user, p) + '</div>';
  }
  if (tab === 'exercise') {
    return '<div class="ex-matrix-page">' + _exerciseMatrixEmbedHtml(user, p) + '</div>';
  }
  if (tab === 'conflicts') {
    return _dashboardConflictsTabHtml(sid);
  }
  const searchUserId = _dashboardResolveSearchUserId(p, user, tab);
  let s = _dashboardUserSearchBar(searchUserId);
  if (searchUserId) {
    s += _dashboardUserExerciseResults(user, searchUserId);
  } else {
    s += '<p style="font-size:12px;color:var(--muted);margin:8px 0 0">' +
      'הקלד שם או מספר אישי בשורת החיפוש.</p>';
  }
  return s;
}

function _dashboardTabsShell(user, sid, activeTab, p) {
  const highlightUserId = _dashboardHighlightUserId(p, user);
  const baseParams = {};
  if (highlightUserId) baseParams.searchUserId = highlightUserId;
  if (activeTab === 'search') {
    const searchUserId = _dashboardResolveSearchUserId(p, user, 'search');
    if (searchUserId) baseParams.searchUserId = searchUserId;
  }
  const items = _dashboardTabItems(user);
  let s = _spaTabsBar('dashboard', baseParams, items, activeTab);
  s += '<div class="dashboard-shell">';
  s += '<div class="spa-tab-panel dashboard-tab-panel">' +
    _dashboardTabPanelHtml(user, sid, activeTab, p) + '</div>';
  s += '</div>';
  return s;
}

function _dashboardTabContent(user, sid, tab, p) {
  return _dashboardTabsShell(user, sid, tab, p);
}

function Views_dashboard(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;

  const tab = _dashboardResolveTab(p, user);

  const body = _topbar(user, sid) +
    '<div class="page page-dashboard">' + _flash(p) +
    _dashboardTabsShell(user, sid, tab, p) +
    '</div>';
  return _wrapPage(body, 'מסך הבית');
}

// ─────────── EXERCISES MANAGEMENT ───────────
