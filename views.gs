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
  tpl.pageTitle = title || 'צה״ל — מערכת תרגילים';
  tpl.body = body;
  return tpl.evaluate()
    .setTitle(title || 'צה״ל — מערכת תרגילים')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
    '<div><span>צה״ל</span><span class="sub">TRAINING CMD SYS // CLASSIFIED</span></div>' +
    '</div>' +
    '<div class="topbar-nav">';

  nav += _a('page=dashboard&sid=' + sidQ, '⊞ לוח בקרה', 'btn btn-ghost btn-sm');
  if (user.role === 'admin') {
    nav += _a('page=users&sid=' + sidQ, '👤 משתמשים', 'btn btn-ghost btn-sm');
    nav += _a('page=timeline&sid=' + sidQ, '📅 ציר זמן', 'btn btn-ghost btn-sm');
    nav += _a('page=assign&sid=' + sidQ, '🔀 שיבוץ', 'btn btn-ghost btn-sm');
  }
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
    '<div class="login-title">מערכת ניהול תרגילים</div>' +
    '<div class="login-sub">// AUTHORIZED PERSONNEL ONLY //</div>' +
    '</div>' +
    '<div class="login-body">' +
    _flash(p) +
    form +
    '<hr class="divider">' +
    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px">// משתמשי דמו</div>' +
    '<div class="demo-grid">' +
    '<div class="demo-item"><div class="demo-role">מפקד קורס</div><div class="demo-cred">U001<br>admin123</div></div>' +
    '<div class="demo-item"><div class="demo-role">מפקד צוות</div><div class="demo-cred">U002<br>cmd123</div></div>' +
    '<div class="demo-item"><div class="demo-role">חניך</div><div class="demo-cred">U003<br>train123</div></div>' +
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

// ── Admin Dashboard ──
function _adminDashboard(sid) {
  const exs = Exercises_all();
  const sidQ = encodeURIComponent(sid);
  const assigns = Assignments_all ? Assignments_all() : [];
  const completed = assigns.filter(a => a.status === 'completed').length;

  let s = '<div class="page">';
  s += '<h1 class="page-title">לוח בקרה מפקד</h1>';

  // שורת סטטיסטיקה - שימוש ב-grid-3 הקיים ב-CSS שלך
  s += '<div class="grid-3" style="margin-bottom: 20px;">' +
    '<div class="stat-box"><div class="stat-num">' + exs.length + '</div><div class="stat-label">תרגילים פעילים</div></div>' +
    '<div class="stat-box"><div class="stat-num">' + completed + '</div><div class="stat-label">שיבוצים שהושלמו</div></div>' +
    '<div class="stat-box"><div class="stat-num" style="color:var(--green)">ON</div><div class="stat-label">סטטוס מערכת</div></div>' +
    '</div>';

  // חלוקה לטורים (טור מרכזי וטור צד)
  s += '<div style="display: flex; gap: 20px; flex-wrap: wrap;">';

  // --- טור מרכזי: רשימת תרגילים ---
  s += '<div style="flex: 2; min-width: 300px;">';
  s += '<div class="card">' +
    '<div class="card-header"><div class="card-title">📋 ניהול תרגילים</div></div>';
  
  if (!exs.length) {
    s += '<div class="empty">אין תרגילים פעילים במערכת</div>';
  } else {
    s += '<table class="tbl"><thead><tr><th>שם התרגיל</th><th>תאריך</th><th style="text-align:left">פעולות</th></tr></thead><tbody>';
    exs.forEach(e => {
      s += '<tr>' +
        '<td><div class="ex-title">' + _esc(e.title) + '</div><div class="mono" style="font-size:10px opacity:0.6">' + e.id + '</div></td>' +
        '<td>' + _esc(e.start_date || '—') + '</td>' +
        '<td style="text-align:left">' + 
          _a('page=exercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ, 'ניהול', 'btn btn-primary btn-sm') + 
        '</td>' +
        '</tr>';
    });
    s += '</tbody></table>';
  }
  s += '</div></div>';

  // --- טור צד: פעולות מהירות ---
  s += '<div style="flex: 1; min-width: 250px;">';
  
  // כרטיס פעולות
  s += '<div class="card" style="margin-bottom: 15px;">' +
    '<div class="card-header"><div class="card-title">⚡ פעולות מהירות</div></div>' +
    '<div class="card-body">' +
    _a('action=autoAssignAll&sid=' + sidQ, '🤖 הרץ שיבוץ אוטומטי', 'btn btn-secondary btn-full', 'style="margin-bottom:10px"') +
    _a('page=users&sid=' + sidQ, '👥 ניהול סד"כ משתמשים', 'btn btn-ghost btn-full') +
    '</div></div>';

  // כרטיס יצירת תרגיל חדש
  s += '<div class="card">' +
    '<div class="card-header"><div class="card-title">➕ תרגיל חדש</div></div>' +
    '<div class="card-body">' +
    _formOpen() +
    '<input type="hidden" name="action" value="createExercise">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<div class="form-row">' +
      '<label class="form-label">שם התרגיל</label>' +
      '<input type="text" name="title" class="form-input" required placeholder="לדוגמה: אימון הקמת קשר">' +
    '</div>' +
    _submitBtn('צור תרגיל', 'btn btn-primary btn-full') +
    '</form></div></div>';

  s += '</div>'; // סגירת טור צד
  s += '</div>'; // סגירת flex layout
  s += '</div>'; // סגירת page
  
  return s;
}
// ── Commander Dashboard ──
function _commanderDashboard(user, sid) {
  const sidQ = encodeURIComponent(sid);
  const trainees = Users_traineesOfCommander(user.id);

  let s = '<div class="page-title">⊞ לוח בקרה — מפקד צוות</div>';

  if (!trainees.length) {
    return s + '<div class="card"><div class="empty">אין חיילים מוקצים לצוות שלך עדיין</div></div>';
  }

  // Summary stats
  let totalAssigns = 0, totalDone = 0;
  trainees.forEach(function(t) {
    const a = Assignments_byUser(t.id);
    totalAssigns += a.length;
    totalDone += a.filter(function(x){ return x.status === 'completed'; }).length;
  });

  s += '<div class="grid-2" style="margin-bottom:16px">' +
    '<div class="stat-box"><div class="stat-num">' + trainees.length + '</div><div class="stat-label">חיילים בצוות</div></div>' +
    '<div class="stat-box"><div class="stat-num">' + totalDone + '/' + totalAssigns + '</div><div class="stat-label">הקצאות הושלמו</div></div>' +
    '</div>';

  trainees.forEach(function(t) {
    const assigns = Assignments_byUser(t.id);
    let inner = '';
    if (!assigns.length) {
      inner = '<div class="empty">אין תרגילים מוקצים</div>';
    } else {
      inner = '<table class="tbl"><thead><tr>' +
        '<th>תרגיל</th><th>תפקיד</th><th>סטטוס</th><th>פעולה</th>' +
        '</tr></thead><tbody>';
      assigns.forEach(function(a) {
        const ex = Exercises_get(a.exercise_id);
        inner += '<tr>' +
          '<td>' + _esc(ex ? ex.title : a.exercise_id) + '</td>' +
          '<td>' + _esc(a.responsibility) + '</td>' +
          '<td>' + _statusBadge(a.status) + '</td>' +
          '<td class="actions">';
        if (a.status !== 'completed') {
          inner += _a('action=complete&assignmentId=' + encodeURIComponent(a.id) + '&sid=' + sidQ, '✓ סמן הושלם', 'btn btn-primary btn-sm');
        } else {
          inner += _badge('✓ הושלם', 'green');
        }
        inner += '</td></tr>';
      });
      inner += '</tbody></table>';
    }

    s += '<div class="collapsible" style="margin-bottom:8px">' +
      '<button class="collapsible-toggle">🪖 ' + _esc(t.name) +
      ' <span class="badge badge-muted" style="font-size:10px;margin-right:6px">' + assigns.length + ' תרגילים</span>' +
      '<span class="arrow">▾</span></button>' +
      '<div class="collapsible-content">' +
      '<div class="card"><div class="card-body" style="padding:0">' + inner + '</div></div>' +
      '</div></div>';
  });

  return s;
}

// ── Trainee Dashboard ──
function _traineeDashboard(user, sid) {
  const sidQ = encodeURIComponent(sid);
  const assigns = Assignments_byUser(user.id);

  let s = '<div class="page-title">⊞ התרגילים שלי</div>';

  if (!assigns.length) {
    return s + '<div class="card"><div class="empty">אין תרגילים מוקצים עדיין</div></div>';
  }

  const done = assigns.filter(function(a){ return a.status === 'completed'; }).length;
  s += '<div class="grid-2" style="margin-bottom:16px">' +
    '<div class="stat-box"><div class="stat-num">' + assigns.length + '</div><div class="stat-label">סה״כ תרגילים</div></div>' +
    '<div class="stat-box"><div class="stat-num">' + done + '</div><div class="stat-label">הושלמו</div></div>' +
    '</div>';

  s += '<div class="card"><div class="card-body" style="padding:0">' +
    '<table class="tbl"><thead><tr>' +
    '<th>תרגיל</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th><th>פרטים</th>' +
    '</tr></thead><tbody>';

  assigns.forEach(function(a) {
    const ex = Exercises_get(a.exercise_id);
    s += '<tr>' +
      '<td><b>' + _esc(ex ? ex.title : a.exercise_id) + '</b></td>' +
      '<td>' + _esc(a.responsibility) + '</td>' +
      '<td>' + _statusBadge(a.status) + '</td>' +
      '<td>' + (a.score ? _badge(a.score, 'green') : '—') + '</td>' +
      '<td>' + _a('page=exercise&id=' + encodeURIComponent(a.exercise_id) + '&sid=' + sidQ, '↗ פתיחה', 'btn btn-secondary btn-sm') + '</td>' +
      '</tr>';
  });

  s += '</tbody></table></div></div>';
  return s;
}

// ─────────── EXERCISE PAGE ───────────
function Views_exercise(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const ex  = Exercises_get(p.id);
  if (!ex) return Views_error('התרגיל לא נמצא.', p);
  const sidQ = encodeURIComponent(sid);

  let s = _topbar(user, sid) + '<div class="page">';
  s += _flash(p);

  // Page header with action buttons
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">' + _esc(ex.title) + '</div>' +
    '<div style="display:flex;gap:6px">' +
    _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm');

  if (user.role === 'admin') {
    s += _a('action=duplicateExercise&id=' + encodeURIComponent(ex.id) + '&sid=' + sidQ, '⎘ שכפל', 'btn btn-ghost btn-sm');
    s += _confirmDelete('action=deleteExercise&id=' + encodeURIComponent(ex.id) + '&sid=' + sidQ, 'מחיקת תרגיל "' + ex.title + '" תסיר גם את כל ההקצאות וציר הזמן שלו. להמשיך?');
  }
  s += '</div></div>';

  // ── Top info strip ──
  s += '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-body" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">מזהה</span><br>' +
    '<span style="font-family:var(--mono);color:var(--green)">' + _esc(ex.id) + '</span></div>' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">תחילה</span><br>' +
    '<b>' + _esc(ex.start_date || '—') + '</b></div>' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">סיום</span><br>' +
    '<b>' + _esc(ex.end_date || '—') + '</b></div>' +
    '<div style="flex:1"><span style="color:var(--muted);font-family:var(--mono);font-size:11px">תיאור</span><br>' +
    _esc(ex.description || '—') + '</div>' +
    '</div></div>';

  // ── Two-column layout for timeline + participants ──
  s += '<div class="grid-2" style="margin-bottom:14px">';

  // Timeline
  const details = Exercises_details(ex.id);
  let tlHtml = '<div class="card">' +
    '<div class="card-header"><span class="card-title">🕐 ציר זמן (' + details.length + ')</span>';

  if (user.role === 'admin') {
    tlHtml += '<button class="btn btn-ghost btn-sm" onclick="toggleCollapsible(\'add-detail\')">➕ הוסף</button>';
  }
  tlHtml += '</div>';

  if (!details.length) {
    tlHtml += '<div class="empty">אין רישומים</div>';
  } else {
    tlHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr><th>שעה</th><th>מיקום</th><th>תיאור</th></tr></thead><tbody>';
    details.forEach(function(d) {
      tlHtml += '<tr><td class="mono">' + _esc(d.time) + '</td><td>' + _esc(d.location) + '</td><td>' + _esc(d.description) + '</td></tr>';
    });
    tlHtml += '</tbody></table></div>';
  }

  if (user.role === 'admin') {
    tlHtml += '<div id="add-detail" style="display:none">' +
      '<div class="card-body" style="border-top:1px solid var(--border)">' +
      _formOpen() +
      '<input type="hidden" name="action" value="addDetail">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">שעה</label>' + _input('time', '08:00') + '</div>' +
      '<div class="form-row"><label class="form-label">מיקום</label>' + _input('location', 'שם מיקום') + '</div>' +
      '</div>' +
      '<div class="form-row"><label class="form-label">תיאור</label>' + _input('detailDescription', 'תיאור הפעילות', '', 'text') + '</div>' +
      _submitBtn('➕ הוסף רישום', 'btn btn-primary btn-sm') +
      '</form></div></div>';
  }
  tlHtml += '</div>';
  s += tlHtml;

  // Participants
  const parts = Assignments_byExercise(ex.id);
  let pHtml = '<div class="card">' +
    '<div class="card-header"><span class="card-title">👥 משתתפים (' + parts.length + ')</span></div>';

  if (!parts.length) {
    pHtml += '<div class="empty">אין משתתפים</div>';
  } else {
    pHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr><th>שם</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th>' +
      (user.role === 'admin' ? '<th>הסרה</th>' : '') + '</tr></thead><tbody>';
    parts.forEach(function(a) {
      const u = Users_get(a.user_id);
      pHtml += '<tr><td><b>' + _esc(u ? u.name : a.user_id) + '</b></td>' +
        '<td>' + _esc(a.responsibility) + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>' +
        '<td>' + (a.score ? _badge(a.score, 'green') : '—') + '</td>';
      if (user.role === 'admin') {
        pHtml += '<td>' +
          _formOpen('form-inline') +
          '<input type="hidden" name="action" value="removeAssignment">' +
          '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
          '<input type="hidden" name="assignmentId" value="' + _esc(a.id) + '">' +
          '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
          _submitBtn('✕', 'btn btn-danger btn-sm btn-icon') +
          '</form></td>';
      }
      pHtml += '</tr>';
    });
    pHtml += '</tbody></table></div>';
  }
  pHtml += '</div>';
  s += pHtml;
  s += '</div>'; // end grid-2

  // ── Admin-only panels ──
  if (user.role === 'admin') {

    // Edit exercise + Assign soldier — side by side
    s += '<div class="grid-2" style="margin-bottom:14px">';

    // Edit form
    s += '<div class="collapsible">' +
      '<button class="collapsible-toggle">✏ עריכת פרטי תרגיל <span class="arrow">▾</span></button>' +
      '<div class="collapsible-content"><div class="card"><div class="card-body">' +
      _formOpen() +
      '<input type="hidden" name="action" value="editExercise">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="id" value="' + _esc(ex.id) + '">' +
      '<div class="form-row"><label class="form-label">שם התרגיל</label>' + _input('title', '', ex.title, 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">תיאור</label>' + _input('description', '', ex.description) + '</div>' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">תאריך התחלה</label>' + _dateInput('start_date', ex.rawStartDate) + '</div>' +
      '<div class="form-row"><label class="form-label">תאריך סיום</label>' + _dateInput('end_date', ex.rawEndDate) + '</div>' +
      '</div>' +
      _submitBtn('💾 שמור שינויים', 'btn btn-primary') +
      '</form>' +
      '</div></div></div></div>';

    // ── Assign panel (individual + team) ──
    const allUsers    = Users_all();
    const allTeams    = Teams_all();
    const assignedIds = parts.map(function(a){ return a.user_id; });
    const available   = allUsers.filter(function(u){ return assignedIds.indexOf(u.id) === -1; });

    // Individual assign form
    let indivForm;
    if (!available.length) {
      indivForm = '<div class="empty">כל המשתמשים כבר הוקצו</div>';
    } else {
const respOptions = [
  'קמבצ',
  'מפ חיר',
  'מפ חהן',
  'סמפ',
  'מפ סיוע מנהלתי',
  'קצין בטיחות',
  'מנהל תרגיל',
  'קצין עורף',
  'מפ חשן',
  'מפ מסיעת'
];
      const userOptions = available.map(function(u){ return [u.id, u.id + ' — ' + u.name + ' (' + _roleHe(u.role) + ')']; });
      indivForm =
        _formOpen() +
        '<input type="hidden" name="action" value="assign">' +
        '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
        '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
        '<div class="form-row"><label class="form-label">חייל</label>' + _select('userId', userOptions) + '</div>' +
        '<div class="form-row"><label class="form-label">תפקיד</label>' +
        '<input name="responsibility" list="respList" placeholder="בחר או הקלד..." class="form-input" required>' +
        '<datalist id="respList">' + respOptions.map(function(r){ return '<option value="' + r + '">'; }).join('') + '</datalist>' +
        '</div>' +
        _submitBtn('➤ הקצה חייל', 'btn btn-primary') +
        '</form>';
    }

    // Team assign form
    let teamForm;
    if (!allTeams.length) {
      teamForm = '<div class="empty">אין צוותות מוגדרים</div>';
    } else {
      const teamOptions = allTeams.map(function(t) {
        const cnt = Users_byTeam(t.id).length;
        return [t.id, t.name + ' (' + cnt + ' חברים)'];
      });
      teamForm =
        _formOpen() +
        '<input type="hidden" name="action" value="assignTeam">' +
        '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
        '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
        '<div class="form-row"><label class="form-label">צוות</label>' + _select('teamId', teamOptions) + '</div>' +
        '<p style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:8px">' +
        'ישובצו אוטומטית: מפקד הצוות + 2 החניכים הראשונים. מי שכבר רשום ידולג.</p>' +
        _submitBtn('🪖 הוסף צוות שלם', 'btn btn-primary') +
        '</form>';
    }

    const exIdSafe = _esc(ex.id);
    s += '<div class="collapsible">' +
      '<button class="collapsible-toggle">➤ הוספת משתתפים <span class="arrow">▾</span></button>' +
      '<div class="collapsible-content"><div class="card">' +
      '<div class="dp-tabs" style="display:flex;border-bottom:1px solid var(--border)">' +
      '<div class="dp-tab dp-tab-active" data-target="dp-indiv-' + exIdSafe + '" style="padding:8px 16px;font-family:var(--mono);font-size:12px;color:var(--green);border-bottom:2px solid var(--green);cursor:pointer">👤 חייל בודד</div>' +
      '<div class="dp-tab" data-target="dp-team-' + exIdSafe + '" style="padding:8px 16px;font-family:var(--mono);font-size:12px;color:var(--muted);cursor:pointer">🪖 צוות שלם</div>' +
      '</div>' +
      '<div id="dp-indiv-' + exIdSafe + '" class="card-body dp-panel">' + indivForm + '</div>' +
      '<div id="dp-team-'  + exIdSafe + '" class="card-body dp-panel" style="display:none">' + teamForm + '</div>' +
      '</div></div></div>';

    s += '</div>'; // end grid-2
  }

  s += '</div>'; // end page
  return _html(s, ex.title);
}

// ─────────── USERS & TEAMS PAGE ───────────
function Views_users(p) {
  const user = Auth_current(p);
  if (!user || user.role !== 'admin') return Views_error('גישה למפקדי קורס בלבד.', p);
  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);
  const tab  = p.tab || 'teams';

  const tabs =
    '<div class="tabs">' +
    _a('page=users&sid=' + sidQ + '&tab=teams',  '🪖 צוותים',       'tab-link' + (tab === 'teams'  ? ' active' : '')) +
    _a('page=users&sid=' + sidQ + '&tab=users',  '👤 משתמשים',      'tab-link' + (tab === 'users'  ? ' active' : '')) +
    _a('page=users&sid=' + sidQ + '&tab=create', '➕ יצירת משתמש', 'tab-link' + (tab === 'create' ? ' active' : '')) +
    '</div>';

  let content = '';
  if (tab === 'teams')  content = _teamsTab(sid, sidQ);
  else if (tab === 'users')  content = _usersTab(sid, sidQ);
  else if (tab === 'create') content = _createUserTab(sid, sidQ);

  const body = _topbar(user, sid) +
    '<div class="page">' +
    _flash(p) +
    '<div class="page-title">⚙ ניהול משתמשים וצוותות</div>' +
    tabs + content +
    '</div>';
  return _html(body, 'ניהול משתמשים');
}


// Shared helper: render the 5 extra profile fields
function _extraProfileFields(u) {
  u = u || {};
  const svcOpts = [
    ['', '— בחר —'],
    ['סדיר', 'סדיר'],
    ['מילואים', 'מילואים'],
    ['קבע', 'קבע'],
    ['חובה', 'חובה']
  ];
  return '<hr class="divider">' +
    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">// שדות פרופיל מורחב</div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">שיוך יחידתי</label>' +
      _input('unit_affiliation', 'גולני / שריון...', u.unit_affiliation || '') + '</div>' +
    '<div class="form-row"><label class="form-label">סוג שירות</label>' +
      _select('service_type', svcOpts, u.service_type || '') + '</div>' +
    '<div class="form-row"><label class="form-label">שיוך חיילי</label>' +
      _input('military_affiliation', 'חיל הרגלים...', u.military_affiliation || '') + '</div>' +
    '<div class="form-row"><label class="form-label">אפיון יחידתי</label>' +
      _input('unit_classification', 'קרבי / תומכי לחימה...', u.unit_classification || '') + '</div>' +
    '</div>' +
    '<div class="form-row"><label class="form-label">תפקיד מיועד מיועד</label>' +
      _input('target_role', 'מ"כ / קמ"ן...', u.target_role || '') + '</div>';
}
// ── טאב צוותות ──
function _teamsTab(sid, sidQ) {
  const teams = Teams_all();
  const users = Users_all();

  // Create team form (collapsible)
  const createTeamForm =
    _formOpen() +
    '<input type="hidden" name="action" value="createTeam">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<div class="form-inline">' +
    '<div class="form-row" style="flex:1"><label class="form-label">שם הצוות</label>' + _input('teamName', 'לדוגמה: כוח אלפא...', '', 'text', 'required') + '</div>' +
    _submitBtn('➕ צור צוות', 'btn btn-primary') +
    '</div></form>';

  let s = '<div class="collapsible" style="margin-bottom:14px">' +
    '<button class="collapsible-toggle">➕ צור צוות חדש <span class="arrow">▾</span></button>' +
    '<div class="collapsible-content"><div class="card"><div class="card-body">' + createTeamForm + '</div></div></div></div>';

  if (!teams.length) {
    return s + '<div class="card"><div class="empty">אין צוותות. צור צוות ראשון למעלה.</div></div>';
  }

  teams.forEach(function(t) {
    const members  = users.filter(function(u) { return u.team_id === t.id; });
    const commander = users.find(function(u) { return u.id === t.commander_id; });
    const trainees  = members.filter(function(u) { return u.role === 'trainee'; });
    const cmders    = members.filter(function(u) { return u.role === 'commander'; });

    // Members table
    let memberRows = '';
    members.forEach(function(u) {
      memberRows += '<tr>' +
        '<td class="mono">' + _esc(u.id) + '</td>' +
        '<td><b>' + _esc(u.name) + '</b></td>' +
        '<td>' + _badge(_roleHe(u.role), u.role === 'commander' ? 'blue' : 'muted') + '</td>' +
        '<td>' +
        _formOpen('form-inline') +
        '<input type="hidden" name="action" value="removeMember">' +
        '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
        '<input type="hidden" name="userId" value="' + _esc(u.id) + '">' +
        '<input type="hidden" name="teamId" value="' + _esc(t.id) + '">' +
        _submitBtn('✕ הסר', 'btn btn-danger btn-sm') +
        '</form></td></tr>';
    });

    // Users not in this team (for add-member dropdown)
    const notInTeam = users.filter(function(u) { return u.team_id !== t.id; });
    const notInTeamOptions = notInTeam.map(function(u) {
      return [u.id, u.id + ' — ' + u.name + ' (' + _roleHe(u.role) + ')'];
    });

    // Commanders available for this team
    const cmdOptions = [['', '— ללא מפקד —']].concat(
      users.filter(function(u) { return u.role === 'commander' || u.role === 'admin'; })
        .map(function(u) { return [u.id, u.id + ' — ' + u.name]; })
    );

    // Set commander form
    const setCmdForm =
      _formOpen('form-inline') +
      '<input type="hidden" name="action" value="setCommander">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="teamId" value="' + _esc(t.id) + '">' +
      _select('commanderId', cmdOptions, t.commander_id) +
      _submitBtn('💾 הגדר', 'btn btn-primary btn-sm') +
      '</form>';

    // Add member form
    let addMemberForm = '';
    if (notInTeam.length) {
      addMemberForm =
        _formOpen('form-inline') +
        '<input type="hidden" name="action" value="addMember">' +
        '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
        '<input type="hidden" name="teamId" value="' + _esc(t.id) + '">' +
        _select('userId', notInTeamOptions) +
        _submitBtn('➕ הוסף', 'btn btn-primary btn-sm') +
        '</form>';
    } else {
      addMemberForm = '<span style="color:var(--muted);font-family:var(--mono);font-size:12px">כל המשתמשים כבר בצוות זה</span>';
    }

    // Rename + delete forms
    const renameForm =
      _formOpen('form-inline') +
      '<input type="hidden" name="action" value="renameTeam">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="teamId" value="' + _esc(t.id) + '">' +
      _input('teamName', 'שם חדש...', t.name, 'text', 'required') +
      _submitBtn('✏ שנה שם', 'btn btn-ghost btn-sm') +
      '</form>';

    const deleteForm = _confirmDelete(
      'action=deleteTeam&sid=' + _esc(sid) + '&teamId=' + _esc(t.id),
      'מחיקת צוות "' + t.name + '" תסיר את כל החברים מהצוות. להמשיך?'
    );

    s += '<div class="card" style="margin-bottom:12px">' +
      // Header
      '<div class="card-header">' +
      '<div>' +
      '<span class="card-title">🪖 ' + _esc(t.name) + '</span>' +
      '&nbsp;<span class="badge badge-muted" style="font-size:10px">' + _esc(t.id) + '</span>' +
      (commander ? '&nbsp;' + _badge('מפקד: ' + commander.name, 'blue') : '') +
      '<span style="margin-right:8px;color:var(--muted);font-family:var(--mono);font-size:11px">' + members.length + ' חברים</span>' +
      '</div>' +
      '<div style="display:flex;gap:6px">' + renameForm + deleteForm + '</div>' +
      '</div>' +
      // Commander row
      '<div class="card-body" style="border-bottom:1px solid var(--border);padding:10px 14px">' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<span style="font-family:var(--mono);font-size:12px;color:var(--text2)">מפקד צוות:</span>' +
      setCmdForm +
      '</div></div>' +
      // Members table
      '<div style="padding:0">' +
      (members.length
        ? '<table class="tbl"><thead><tr><th>מספר אישי</th><th>שם</th><th>תפקיד</th><th>הסרה</th></tr></thead><tbody>' +
          memberRows + '</tbody></table>'
        : '<div class="empty">אין חברים בצוות זה</div>') +
      '</div>' +
      // Add member footer
      '<div class="card-actions">' +
      '<span style="font-family:var(--mono);font-size:12px;color:var(--text2);margin-left:8px">הוסף חבר:</span>' +
      addMemberForm +
      '</div>' +
      '</div>';
  });

  return s;
}

// ── טאב משתמשים ──
function _usersTab(sid, sidQ) {
  const users = Users_all();
  const teams = Teams_all();

  const teamMap = {};
  teams.forEach(function(t) { teamMap[t.id] = t.name; });

  let table = '<div class="card"><div class="card-body" style="padding:0;overflow-x:auto">' +
    '<table class="tbl"><thead><tr>' +
    '<th>מספר אישי</th><th>שם</th><th>תפקיד</th><th>צוות</th>' +
    '<th>שיוך יחידתי</th><th>סוג שירות</th><th>שיוך חיילי</th><th>אפיון יחידתי</th><th>תפקיד מיועד</th>' +
    '<th>עריכה</th><th>מחיקה</th>' +
    '</tr></thead><tbody>';

  users.forEach(function(u) {
    const teamName = u.team_id && teamMap[u.team_id] ? teamMap[u.team_id] : (u.team_id || '—');
    // Edit profile collapsible form
    const editProfileForm =
      _formOpen() +
      '<input type="hidden" name="action" value="updateProfile">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="targetId" value="' + _esc(u.id) + '">' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">תפקיד</label>' +
        _select('newRole', [['admin','מפקד קורס'],['commander','מפקד צוות'],['trainee','חניך']], u.role) +
      '</div>' +
      '</div>' +
      _extraProfileFields(u) +
      _submitBtn('💾 שמור', 'btn btn-primary btn-sm') +
      '</form>';

    table += '<tr>' +
      '<td class="mono">' + _esc(u.id) + '</td>' +
      '<td><b>' + _esc(u.name) + '</b></td>' +
      '<td>' + _badge(_roleHe(u.role), u.role === 'admin' ? 'green' : u.role === 'commander' ? 'blue' : 'muted') + '</td>' +
      '<td>' + _esc(teamName) + '</td>' +
      '<td>' + (u.unit_affiliation     ? _esc(u.unit_affiliation)     : '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' + (u.service_type         ? _badge(_esc(u.service_type), 'muted') : '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' + (u.military_affiliation ? _esc(u.military_affiliation) : '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' + (u.unit_classification  ? _esc(u.unit_classification)  : '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' + (u.target_role          ? _esc(u.target_role)          : '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' +
        '<button class="btn btn-ghost btn-sm" data-target="edit-' + _esc(u.id) + '" onclick="toggleEditPanel(this)">✏ עריכה</button>' +
      '</td>' +
      '<td>' +
        _confirmDelete(
          'action=deleteUser&sid=' + _esc(sid) + '&targetId=' + _esc(u.id),
          'מחיקת המשתמש ' + u.name + ' תסיר גם את ההקצאות שלו. להמשיך?'
        ) +
      '</td></tr>' +
      // Inline edit row
      '<tr id="edit-' + _esc(u.id) + '" style="display:none">' +
      '<td colspan="11" style="background:var(--bg3);padding:14px">' +
        editProfileForm +
      '</td></tr>';
  });

  table += '</tbody></table></div></div>';
  return table;
}

// ── טאב יצירת משתמש ──
function _createUserTab(sid, sidQ) {
  const teams = Teams_all();
  const teamOptions = [['', '— ללא צוות —']].concat(
    teams.map(function(t) { return [t.id, t.id + ' — ' + t.name]; })
  );

  const form =
    _formOpen() +
    '<input type="hidden" name="action" value="createUser">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">מספר אישי *</label>' + _input('newUserId', 'U004', '', 'text', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">שם מלא *</label>' + _input('newName', 'שם ושם משפחה', '', 'text', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">סיסמה *</label>' + _input('newPassword', 'סיסמה ראשונית', '', 'text', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">תפקיד</label>' +
      _select('newRole', [['trainee','חניך'],['commander','מפקד צוות'],['admin','מפקד קורס']]) +
    '</div>' +
    '<div class="form-row"><label class="form-label">צוות</label>' + _select('newTeamId', teamOptions) + '</div>' +
    '</div>' +
    _extraProfileFields() +
    '<div style="margin-top:4px">' + _submitBtn('➕ צור משתמש', 'btn btn-primary') + '</div>' +
    '</form>';

  return '<div class="card"><div class="card-header"><span class="card-title">➕ יצירת משתמש חדש</span></div>' +
    '<div class="card-body">' + form + '</div></div>';
}

// ═══════════════════════════════════════
//  Views_timeline — Gantt-style timeline
//  תרגילים מקבילים מוצגים בשורות נפרדות באותה רמה
// ═══════════════════════════════════════
function Views_timeline(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);

  let exercises = Exercises_all();

  // Filter: commander/trainee see only their relevant exercises
  if (user.role === 'commander') {
    const myTrainees = Users_traineesOfCommander(user.id).map(t => t.id);
    const allAssigns = Assignments_all ? Assignments_all() : [];
    exercises = exercises.filter(ex =>
      ex.created_by === user.id ||
      allAssigns.some(a => a.exercise_id === ex.id && myTrainees.indexOf(a.user_id) !== -1)
    );
  } else if (user.role === 'trainee') {
    const myAssigns = Assignments_byUser ? Assignments_byUser(user.id) : [];
    const myExIds   = myAssigns.map(a => a.exercise_id);
    exercises = exercises.filter(ex => myExIds.indexOf(ex.id) !== -1);
  }

  // Parse dates → timestamps for layout
  const parsed = exercises.map(ex => {
    const s = _parseRawDate(ex.rawStartDate);
    const e = _parseRawDate(ex.rawEndDate || ex.rawStartDate); // fallback: single day
    return { ex, start: isNaN(s) ? null : s, end: isNaN(e) ? null : e };
  }).filter(x => x.start !== null);

  if (!parsed.length) {
    const body = _topbar(user, sid) +
      '<div class="page"><div class="page-title">📅 ציר זמן תרגילים</div>' +
      '<div class="card"><div class="empty">אין תרגילים עם תאריכים להצגה. הוסף תאריך התחלה לפחות לתרגיל אחד.</div></div></div>';
    return _html(body, 'ציר זמן');
  }

  // Sort by start date
  parsed.sort((a, b) => a.start - b.start);

  // ── Compute chart bounds ──
  const minTs  = parsed.reduce((m, x) => Math.min(m, x.start), Infinity);
  const maxTs  = parsed.reduce((m, x) => Math.max(m, x.end),   -Infinity);
  const span   = Math.max(maxTs - minTs, 86400000); // at least 1 day
  const DAY_MS = 86400000;

  // Add 5% padding on each side
  const padMs   = span * 0.05;
  const chartMin = minTs - padMs;
  const chartMax = maxTs + padMs;
  const chartSpan = chartMax - chartMin;

  function pct(ts) {
    return ((ts - chartMin) / chartSpan * 100).toFixed(3) + '%';
  }
  function pctW(from, to) {
    return (Math.max(to - from, DAY_MS) / chartSpan * 100).toFixed(3) + '%';
  }

  // ── Lane assignment (greedy, prevents overlap) ──
  // Each "lane" tracks the rightmost end-timestamp currently in it
  const lanes = []; // array of { endTs }
  const itemLanes = parsed.map(item => {
    let placed = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endTs <= item.start) {
        lanes[i].endTs = item.end;
        placed = i;
        break;
      }
    }
    if (placed === -1) {
      lanes.push({ endTs: item.end });
      placed = lanes.length - 1;
    }
    return placed;
  });

  const laneCount  = lanes.length;
  const laneH      = 44; // px per lane
  const headerH    = 40; // px for date ruler
  const totalH     = headerH + laneCount * laneH;

  // ── Date ruler ticks ──
  // Choose a sensible tick interval based on total span
  const spanDays = span / DAY_MS;
  let tickInterval; // in days
  if      (spanDays <= 14)  tickInterval = 1;
  else if (spanDays <= 60)  tickInterval = 7;
  else if (spanDays <= 180) tickInterval = 14;
  else if (spanDays <= 730) tickInterval = 30;
  else                      tickInterval = 90;

  const tickMs = tickInterval * DAY_MS;
  // Start ticks from the nearest tickInterval boundary after chartMin
  const firstTick = Math.ceil(chartMin / tickMs) * tickMs;
  const ticks = [];
  for (let t = firstTick; t <= chartMax; t += tickMs) ticks.push(t);

  function fmtTick(ts) {
    const d = new Date(ts);
    const months = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
    if (tickInterval >= 30) return months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    return d.getUTCDate() + '/' + (d.getUTCMonth()+1);
  }
// --- המשך הפונקציה Views_timeline ---

  const COLORS = ['#4ade80', '#22c55e', '#60a5fa', '#fbbf24', '#f87171', '#c084fc'];
  const today = new Date().setHours(0,0,0,0);

  let s = _topbar(user, sid);
  s += '<div class="page">';
  s += '<div class="page-title">📅 ציר זמן תרגילים</div>';
  
  s += '<div class="card" style="padding:0; overflow:hidden;">';
  
  // התיקון הקריטי: הגדרת גובה דינמי ל-Wrapper לפי ה-totalH שחישבת
  s += '<div class="gantt-container" style="position:relative; width:100%; min-width:800px; height:' + totalH + 'px; background:var(--bg2); overflow-x:auto;">';

  // 1. ציור קווי הרקע (ימים/תאריכים)
  ticks.forEach(t => {
    const pos = pct(t);
    // קו אנכי
    s += '<div style="position:absolute; top:0; bottom:0; right:' + pos + '; width:1px; background:var(--border); z-index:1;"></div>';
    // כיתוב תאריך
    s += '<div class="mono" style="position:absolute; top:8px; right:' + pos + '; transform:translateX(50%); font-size:10px; color:var(--muted); z-index:2;">' + fmtTick(t) + '</div>';
  });

  // 2. ציור התרגילים (הברים)
  parsed.forEach((item, idx) => {
    const laneIndex = itemLanes[idx];
    const top       = headerH + (laneIndex * laneH);
    const right     = pct(item.start);
    const width     = pctW(item.start, item.end);
    const color     = COLORS[idx % COLORS.length];
    
    // בדיקת סטטוס לטובת עיצוב (אופציונלי)
    const isPast = today > item.end;
    const opacity = isPast ? '0.4' : '1';

    s += '<a href="' + _url('page=exercise&id=' + item.ex.id + '&sid=' + sidQ) + '" ';
    s += ' class="gantt-bar" style="position:absolute; top:' + (top + 6) + 'px; right:' + right + '; width:' + width + '; ';
    s += ' height:32px; background:' + color + '22; border:1px solid ' + color + '; border-radius:4px; ';
    s += ' display:flex; align-items:center; padding:0 8px; text-decoration:none; color:var(--text); z-index:3; ';
    s += ' overflow:hidden; white-space:nowrap; opacity:' + opacity + ';">';
    
    // סימון קטן של צבע וטקסט
    s += '<span style="width:8px; height:8px; background:' + color + '; border-radius:2px; margin-left:8px; flex-shrink:0;"></span>';
    s += '<span class="mono" style="font-size:12px; font-weight:bold; text-overflow:ellipsis; overflow:hidden;">' + _esc(item.ex.title) + '</span>';
    s += '</a>';
  });

  s += '</div>'; // סגירת gantt-container
  s += '</div>'; // סגירת card
  
  // הוספת טבלת סיכום מתחת לגרף (שכבר התחלת לכתוב ב-views.gs)
  s += '<div class="page-title" style="margin-top:30px;">📋 פירוט תרגילים</div>';
  s += '<div class="card" style="padding:0">';
  s += '<table class="tbl"><thead><tr>';
  s += '<th>שם התרגיל</th><th>תאריך התחלה</th><th>תאריך סיום</th><th>סטטוס</th><th>פתיחה</th>';
  s += '</tr></thead><tbody>';
  
  parsed.forEach((item, idx) => {
    const ex = item.ex;
    const isActive = today >= item.start && today <= item.end;
    const isPast   = today > item.end;
    const status   = isActive ? '<span class="badge" style="background:#1e3a1e; color:#4ade80;">● פעיל</span>' 
                   : isPast   ? '<span class="badge" style="background:#2a2a2a; color:#888;">✓ הסתיים</span>' 
                   :            '<span class="badge" style="background:#1e2a3a; color:#60a5fa;">◌ עתידי</span>';
    
    s += '<tr>';
    s += '<td><b>' + _esc(ex.title) + '</b></td>';
    s += '<td class="mono">' + _esc(ex.start_date || '—') + '</td>';
    s += '<td class="mono">' + _esc(ex.end_date || '—') + '</td>';
    s += '<td>' + status + '</td>';
    s += '<td>' + _a('page=exercise&id=' + ex.id + '&sid=' + sidQ, '🔎 ניהול', 'btn btn-secondary btn-sm') + '</td>';
    s += '</tr>';
  });

  s += '</tbody></table></div>';
  s += '</div>'; // סגירת page

  return _html(s, 'ציר זמן');

}
// ═══════════════════════════════════════
//  Views_assign — דף שיבוץ drag & drop
//  נתונים נטענים בתוך ה-HTML כ-JSON
//  עדכונים מתבצעים דרך google.script.run
// ═══════════════════════════════════════
function Views_assign(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  if (user.role !== 'admin') return Views_error('גישה למפקדי קורס בלבד.', p);

  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);

  const exercises = Exercises_all();
  const allUsers  = Users_all();
  const assigns   = Assignments_all();

  // Build data payload for client-side JS
  // exercises: [{id, title, start_date, end_date}]
  // users:     [{id, name, role}]
  // assigns:   [{id, exercise_id, user_id, responsibility, status}]
  const exData = exercises.map(function(e) {
    return { id: e.id, title: e.title, start: e.start_date || '', end: e.end_date || '' };
  });
  const userMap = {};
  allUsers.forEach(function(u) { userMap[u.id] = { name: u.name, role: u.role }; });

  const exMap = {}; // exercise_id → [assignments]
  assigns.forEach(function(a) {
    if (!exMap[a.exercise_id]) exMap[a.exercise_id] = [];
    exMap[a.exercise_id].push({ id: a.id, userId: a.user_id, resp: a.responsibility, status: a.status });
  });

  // Unassigned users (not assigned to any exercise)
  const assignedUserIds = new Set(assigns.map(function(a) { return a.user_id; }));
  const unassigned = allUsers.filter(function(u) { return !assignedUserIds.has(u.id); });

  const jsonData = JSON.stringify({
    exercises: exData,
    userMap:   userMap,
    exMap:     exMap,
    unassigned: unassigned.map(function(u) { return { id: u.id, name: u.name, role: u.role }; })
  });

  const body = _topbar(user, sid) +
    '<div class="page">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">🔀 לוח שיבוץ</div>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    '<span id="assignStatus" style="font-family:var(--mono);font-size:12px;color:var(--muted)"></span>' +
    _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div></div>' +

    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:12px">' +
    '// גרור חייל מהעמודה השמאלית לתרגיל · גרור בין תרגילים להעברה · גרור לשורה השמאלית להסרה' +
    '</div>' +

    // Data island
    '<script id="assignData" type="application/json">' + jsonData + '</script>' +
    '<input type="hidden" id="assignSid" value="' + _esc(sid) + '">' +

    // Board
    '<div id="assignBoard" style="display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:16px">' +
    // Unassigned column rendered by JS
    '</div>' +
    '</div>' +

    '<script>' + _assignBoardJs() + '</script>';

  return _html(body, 'לוח שיבוץ');
}
function _assignBoardJs() {
  return `
(function() {
  var data  = JSON.parse(document.getElementById('assignData').textContent);
  var sid   = document.getElementById('assignSid').value;
  var board = document.getElementById('assignBoard');
  var status = document.getElementById('assignStatus');

  var ROLE_LABELS = { admin: 'מפקד קורס', commander: 'מפקד צוות', trainee: 'חניך' };
  var ROLE_COLORS = { admin: '#4ade80', commander: '#60a5fa', trainee: '#94a3b8' };

  function setStatus(msg, color) {
    status.textContent = msg;
    status.style.color = color || 'var(--muted)';
  }

  // ── Build a draggable chip ──
  function makeChip(userId, assignId, resp, exId) {
    var u    = data.userMap[userId] || { name: userId, role: 'trainee' };
    var div  = document.createElement('div');
    div.className   = 'assign-chip';
    div.draggable   = true;
    div.dataset.userId   = userId;
    div.dataset.assignId = assignId || '';
    div.dataset.exId     = exId     || '';
    div.dataset.resp     = resp     || '';
    div.style.cssText = [
      'display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:4px',
      'background:var(--bg3);border:1px solid var(--border);border-radius:4px',
      'cursor:grab;font-family:var(--mono);font-size:12px;color:var(--text1)',
      'user-select:none;transition:opacity .15s'
    ].join(';');

    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (ROLE_COLORS[u.role] || '#888');

    var txt = document.createElement('span');
    txt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    txt.textContent = u.name + (resp ? ' · ' + resp : '');

    var del = document.createElement('span');
    del.textContent = '✕';
    del.title = 'הסר מתרגיל';
    del.style.cssText = 'color:var(--muted);cursor:pointer;padding:0 2px;flex-shrink:0';
    del.onclick = function(e) {
      e.stopPropagation();
      if (assignId) removeAssignment(assignId, div, exId);
    };

    div.appendChild(dot);
    div.appendChild(txt);
    if (assignId) div.appendChild(del);

    // Drag events
    div.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        userId: userId, assignId: assignId || '', fromExId: exId || '', resp: resp || ''
      }));
      div.style.opacity = '0.4';
    });

    div.addEventListener('dragend', function() {
      div.style.opacity = '1';
    });

    return div;
  }

  // ── Build a column (exercise or unassigned) ──
  function makeColumn(exId, title, subtitle, chips) {
    var col = document.createElement('div');
    col.dataset.exId = exId;
    col.style.cssText = [
      'min-width:200px;max-width:220px;flex-shrink:0',
      'background:var(--bg2);border:1px solid var(--border);border-radius:6px',
      'display:flex;flex-direction:column'
    ].join(';');

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:10px 12px;border-bottom:1px solid var(--border)';

    var h3 = document.createElement('div');
    h3.style.cssText = 'font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text1);margin-bottom:2px;word-break:break-word';
    h3.textContent = title;

    var sub = document.createElement('div');
    sub.style.cssText = 'font-family:var(--mono);font-size:10px;color:var(--muted)';
    sub.textContent = subtitle || '';

    hdr.appendChild(h3);
    if (subtitle) hdr.appendChild(sub);

    col.appendChild(hdr);

    // Drop zone
    var zone = document.createElement('div');
    zone.style.cssText = 'padding:8px;flex:1;min-height:60px';
    zone.dataset.exId = exId;

    chips.forEach(function(c) {
      zone.appendChild(c);
    });

    // Drag-over highlight
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      zone.style.background = 'rgba(74,222,128,0.07)';
    });

    zone.addEventListener('dragleave', function() {
      zone.style.background = '';
    });

    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.style.background = '';

      var payload;

      try {
        payload = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch(err) {
        return;
      }

      var toExId = exId;
      var fromExId = payload.fromExId;

      if (toExId === fromExId) return;

      if (toExId === '__unassigned__') {
        // Remove assignment
        if (payload.assignId) {
          removeAssignment(payload.assignId, null, fromExId);
        }
      } else {
        // Move or add
        if (payload.assignId && fromExId) {
          moveAssignment(payload.assignId, toExId, payload.userId, payload.resp, zone, fromExId);
        } else {
          addAssignment(toExId, payload.userId, payload.resp || '', zone);
        }
      }
    });

    col.appendChild(zone);

    return col;
  }

  // ── Render board ──
  function render() {
    board.innerHTML = '';

    // Unassigned column
    var unassignedChips = data.unassigned.map(function(u) {
      return makeChip(u.id, '', '', '');
    });

    board.appendChild(
      makeColumn(
        '__unassigned__',
        '👤 לא משובצים',
        data.unassigned.length + ' חיילים',
        unassignedChips
      )
    );

    // Exercise columns
    data.exercises.forEach(function(ex) {
      var parts = data.exMap[ex.id] || [];

      var chips = parts.map(function(a) {
        return makeChip(a.userId, a.id, a.resp, ex.id);
      });

      var subtitle = [ex.start, ex.end].filter(Boolean).join(' — ') || '';

      board.appendChild(
        makeColumn(ex.id, ex.title, subtitle, chips)
      );
    });
  }

  // ── API calls via google.script.run ──
  function addAssignment(exId, userId, resp, zone) {
    setStatus('⏳ משבץ...', '#fbbf24');

    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.id) {
          if (!data.exMap[exId]) data.exMap[exId] = [];

          data.exMap[exId].push({
            id: result.id,
            userId: userId,
            resp: resp,
            status: 'pending'
          });

          data.unassigned = data.unassigned.filter(function(u) {
            return u.id !== userId;
          });

          render();

          setStatus('✓ שובץ בהצלחה', '#4ade80');
        }
      })
      .withFailureHandler(function(err) {
        setStatus('✗ ' + err.message, '#f87171');
      })
      .assignFromBoard(sid, exId, userId, resp);
  }

  function removeAssignment(assignId, chip, fromExId) {
    setStatus('⏳ מסיר...', '#fbbf24');

    google.script.run
      .withSuccessHandler(function() {
        var userId = '';

        if (data.exMap[fromExId]) {
          var a = data.exMap[fromExId].find(function(x) {
            return x.id === assignId;
          });

          if (a) userId = a.userId;

          data.exMap[fromExId] = data.exMap[fromExId].filter(function(x) {
            return x.id !== assignId;
          });
        }

        if (userId && data.userMap[userId]) {
          data.unassigned.push({
            id: userId,
            name: data.userMap[userId].name,
            role: data.userMap[userId].role
          });
        }

        render();

        setStatus('✓ הוסר בהצלחה', '#4ade80');
      })
      .withFailureHandler(function(err) {
        setStatus('✗ ' + err.message, '#f87171');
      })
      .removeAssignmentById(sid, assignId);
  }

  function moveAssignment(assignId, toExId, userId, resp, zone, fromExId) {
    setStatus('⏳ מעביר...', '#fbbf24');

    google.script.run
      .withSuccessHandler(function() {
        if (data.exMap[fromExId]) {
          var a = data.exMap[fromExId].find(function(x) {
            return x.id === assignId;
          });

          if (a) {
            data.exMap[fromExId] = data.exMap[fromExId].filter(function(x) {
              return x.id !== assignId;
            });

            if (!data.exMap[toExId]) data.exMap[toExId] = [];

            data.exMap[toExId].push({
              id: assignId,
              userId: userId,
              resp: resp,
              status: a.status
            });
          }
        }

        render();

        setStatus('✓ הועבר בהצלחה', '#4ade80');
      })
      .withFailureHandler(function(err) {
        setStatus('✗ ' + err.message, '#f87171');
      })
      .moveAssignmentById(sid, assignId, toExId);
  }

  render();
})();
`;
}