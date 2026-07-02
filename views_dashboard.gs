// views_dashboard.gs — exercises list + dashboard pages
function Views_exercises(p) {
  const user = Auth_requireRole(p, ['admin']);
  const sid = user.id;
  const sidQ = encodeURIComponent(sid);
  const exs = Exercises_all();
  const mpCounts = Assignments_mpCountByExercise();

  let s = '<div style="display:flex;gap:20px;flex-wrap:wrap">';

  // ───── רשימת תרגילים ─────
  s += '<div style="flex:2;min-width:300px">';
  s += '<div class="card"><div class="card-header"><div class="card-title">📋 כל התרגילים</div></div>';

  if (!exs.length) {
    s += '<div class="empty">אין תרגילים במערכת</div>';
  } else {
    s += '<table class="tbl"><thead><tr>' +
      '<th>שם</th><th>סוג</th><th>מפים</th><th>התחלה</th><th>סיום</th><th style="text-align:left">פעולות</th>' +
      '</tr></thead><tbody>';

    exs.forEach(function(e) {
      const mpN = mpCounts[e.id] || 0;
      s += '<tr>' +
        '<td>' +
          '<div class="ex-title">' + _esc(e.title) + '</div>' +
          '<div class="mono" style="font-size:10px;opacity:0.6">' + e.id + '</div>' +
        '</td>' +
        '<td>' + (e.exercise_type ? _badge(e.exercise_type, 'muted') : '—') + '</td>' +
        '<td style="text-align:center">' +
          (mpN ? '<span class="badge badge-green">' + mpN + '</span>' : '<span style="color:var(--muted)">0</span>') +
        '</td>' +
        '<td>' + _esc(e.start_date || '—') + '</td>' +
        '<td>' + _esc(e.end_date || '—') + '</td>' +
        '<td style="text-align:left;white-space:nowrap">' +
          _a('page=exercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ,
             '✎ ערוך', 'btn btn-primary btn-sm') +
          ' ' +
          _confirmDelete(
            'action=deleteExercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ,
            'למחוק את התרגיל "' + e.title + '"?'
          ) +
        '</td>' +
      '</tr>';
    });

    s += '</tbody></table>';
  }

  s += '</div></div>';

  // ───── יצירת תרגיל חדש ─────
  s += '<div style="flex:1;min-width:260px">';
  s += '<div class="card"><div class="card-header"><div class="card-title">➕ תרגיל חדש</div></div>' +
    '<div class="card-body">' +
    _formOpen() +
      '<input type="hidden" name="action" value="createExercise">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +

      '<div class="form-row">' +
        '<label class="form-label">שם התרגיל</label>' +
        '<input type="text" name="title" class="form-input" required>' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">תיאור</label>' +
        '<textarea name="description" class="form-input"></textarea>' +
      '</div>' +

      '<div class="form-grid">' +
        '<div class="form-row"><label class="form-label">תאריך התחלה</label>' +
        '<input type="text" name="start_date" class="form-input datepicker" required></div>' +
        '<div class="form-row"><label class="form-label">שעת התחלה</label>' +
        '<input type="time" name="start_time" class="form-input"></div>' +
      '</div>' +
      '<div class="form-grid">' +
        '<div class="form-row"><label class="form-label">תאריך סיום</label>' +
        '<input type="text" name="end_date" class="form-input datepicker" required></div>' +
        '<div class="form-row"><label class="form-label">שעת סיום</label>' +
        '<input type="time" name="end_time" class="form-input"></div>' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">אקט</label>' +
        '<input type="text" name="act" class="form-input" placeholder="אקט">' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">סוג תרגיל</label>' +
        '<input type="text" name="exercise_type" class="form-input" placeholder="סוג תרגיל">' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">גדוד שת״פ</label>' +
        _select('partner_battalion', _fieldForceSelectOptions(''), '', 'required') +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">מחנה / מגנן</label>' +
        _select('camp', _fireZoneSelectOptions(''), '', 'required') +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">מפקד אחראי גדוד</label>' +
        '<input type="text" name="battalion_commander" class="form-input" placeholder="מפקד אחראי גדוד">' +
      '</div>' +

      _submitBtn('צור תרגיל', 'btn btn-primary btn-full') +
    '</form>' +
    '</div></div>';

  s += '<div class="card" style="margin-top:14px"><div class="card-header"><div class="card-title">📅 בניית סדרה</div></div>' +
    '<div class="card-body">' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:12px">' +
    'תזמון אוטומטי של תרגילים במערכת בטווח תאריכים — לפי מכסות חיר / חשן / 900. ' +
    'כל רשומה: תרגיל יום (6 שעות) או תרגיל לילה (9 שעות), ללא ציר זמן פנימי.</p>' +
    '<ul style="font-size:11px;color:var(--muted);margin:0 0 14px 18px;line-height:1.6">' +
    '<li>התחלה ביום הראשון בשעה 06:00</li>' +
    '<li>מרווח 18 שעות בין תרגילים מאותו סוג</li>' +
    '<li>עד 3 תרגילים במקביל — כל אחד מסוג אחר (כולל קיימים)</li>' +
    '<li>ללא שבתות וחגים (Hebcal + שבת)</li>' +
    '<li>ללא התחלה 05:00–06:00</li>' +
    '<li>בקיץ (יוני–ספט׳) ללא התחלה 12:00–16:00</li>' +
    '</ul>' +
    _formOpen() +
    '<input type="hidden" name="action" value="buildSeries">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">מתאריך</label>' +
    '<input type="text" name="series_start" class="form-input datepicker" required></div>' +
    '<div class="form-row"><label class="form-label">עד תאריך</label>' +
    '<input type="text" name="series_end" class="form-input datepicker" required></div>' +
    '</div>' +
    '<div class="form-grid" style="margin-top:8px">' +
    '<div class="form-row"><label class="form-label">חיר</label>' +
    '<input type="number" name="count_chir" class="form-input" min="0" value="0" required></div>' +
    '<div class="form-row"><label class="form-label">חשן</label>' +
    '<input type="number" name="count_chashan" class="form-input" min="0" value="0" required></div>' +
    '<div class="form-row"><label class="form-label">900</label>' +
    '<input type="number" name="count_900" class="form-input" min="0" value="0" required></div>' +
    '</div>' +
    _submitBtn('בנה סדרה', 'btn btn-primary btn-full') +
    '</form></div></div>';

  s += '</div></div>';

  const body =
    _topbar(user, sid) +
    '<div class="page">' + _flash(p) +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
      '<h1 class="page-title" style="margin:0">🎯 ניהול תרגילים</h1>' +
      _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div>' +
    s +
    '</div>';

  return _wrapPage(body, 'ניהול תרגילים');
}
// ── Admin Dashboard ──
function _normalizeAffiliation(v) {
  return String(v || '').replace(/״/g, '').trim();
}

function _dashboardCorpsAssignedCounts() {
  const assigns = Assignments_all();
  const users = Users_all();
  const userById = {};
  users.forEach(function(u) { userById[u.id] = u; });

  const order = [
    { key: 'חיר', label: 'חי״ר' },
    { key: 'חשן', label: 'חשן' },
    { key: 'חהן', label: 'חה״ן' },
    { key: 'מסייעת', label: 'מסייעת' },
    { key: 'מנהלי', label: 'מנהלי' }
  ];
  const counts = {};
  order.forEach(function(c) { counts[c.key] = 0; });
  let other = 0;

  assigns.forEach(function(a) {
    const u = userById[a.user_id];
    if (!u || !Roles_isTrainee(u.role)) return;
    const aff = _normalizeAffiliation(u.military_affiliation);
    if (counts.hasOwnProperty(aff)) counts[aff]++;
    else other++;
  });

  return { order: order, counts: counts, other: other };
}

function _adminDashboard(sid) {
  const corpsStats = _dashboardCorpsAssignedCounts();

  let s = '<div class="page">';
  s += '<h1 class="page-title">לוח בקרה — סגל</h1>';

  s += '<p style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:10px">' +
    'סך ההקצאות — לפי שיוך חיילי</p>';
  s += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin-bottom:24px">';
  corpsStats.order.forEach(function(c) {
    s += '<div class="stat-box"><div class="stat-num">' + corpsStats.counts[c.key] +
      '</div><div class="stat-label">' + c.label + '</div></div>';
  });
  if (corpsStats.other > 0) {
    s += '<div class="stat-box"><div class="stat-num">' + corpsStats.other +
      '</div><div class="stat-label">אחר / ללא שיוך</div></div>';
  }
  s += '</div></div>';

  return s;
}

function _unitCommanderDashboard(sid) {
  const corpsStats = _dashboardCorpsAssignedCounts();
  let s = '<div class="page">';
  s += '<h1 class="page-title">לוח בקרה — מגד</h1>';
  s += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin-bottom:24px">';
  corpsStats.order.forEach(function(c) {
    s += '<div class="stat-box"><div class="stat-num">' + corpsStats.counts[c.key] +
      '</div><div class="stat-label">' + c.label + '</div></div>';
  });
  s += '</div></div>';
  return s;
}

function _departmentCommanderDashboard(user, sid) {
  return '<div class="page-title">⊞ לוח בקרה — ממ</div>';
}
function _dashExerciseLocation(ex) {
  if (!ex) return '—';
  const details = Exercises_details(ex.id);
  for (let i = 0; i < details.length; i++) {
    if (details[i].location) return details[i].location;
  }
  return ex.camp || ex.partner_battalion || '—';
}

function _dashExerciseTime(ex) {
  if (!ex) return '—';
  const start = ex.start_date || '';
  const end = ex.end_date || '';
  if (start && end && start !== end) return start + ' — ' + end;
  return start || end || '—';
}

function _dashboardUserExerciseResults(viewer, targetUserId) {
  const target = Users_get(targetUserId);
  if (!target) {
    return '<div class="flash flash-error" style="margin-bottom:16px">משתמש לא נמצא</div>';
  }

  const assigns = Assignments_byUser(targetUserId).slice();
  assigns.sort(function(a, b) {
    const ea = Exercises_get(a.exercise_id);
    const eb = Exercises_get(b.exercise_id);
    const da = ea && ea.rawStartDate ? ea.rawStartDate : '9999';
    const db = eb && eb.rawStartDate ? eb.rawStartDate : '9999';
    return String(da).localeCompare(String(db));
  });

  const respCounts = {};
  assigns.forEach(function(a) {
    const key = String(a.responsibility || '').trim() || 'ללא תפקיד';
    respCounts[key] = (respCounts[key] || 0) + 1;
  });

  let s = '<div class="card" style="margin-bottom:16px" id="dashboardUserExerciseResults">';
  s += '<div class="card-header" style="flex-wrap:wrap;gap:8px">' +
    '<span class="card-title">🎯 תרגילים — ' + _esc(target.name) + '</span>' +
    '<a href="#" data-spa-page="user"' + _spaParamsAttr({ id: target.id }) +
    ' class="btn btn-ghost btn-sm">פרופיל מלא</a>' +
    '</div>';

  s += '<div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--border)">' +
    '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:10px">' +
    '<div class="stat-box" style="min-width:120px;margin:0"><div class="stat-num">' + assigns.length +
    '</div><div class="stat-label">סה״כ תרגילים</div></div>';

  const respKeys = Object.keys(respCounts).sort();
  if (respKeys.length) {
    s += '<div style="flex:1;min-width:200px"><div style="font-size:11px;color:var(--muted);margin-bottom:6px">לפי תפקיד בתרגיל</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    respKeys.forEach(function(key) {
      s += '<span class="badge badge-muted" style="font-size:11px">' +
        _esc(key) + ' <b style="color:var(--green)">' + respCounts[key] + '</b></span>';
    });
    s += '</div></div>';
  }
  s += '</div></div>';

  if (!assigns.length) {
    s += '<div class="empty">אין תרגילים משויכים למשתמש זה</div>';
  } else {
    s += '<div class="card-body" style="padding:0;overflow-x:auto">' +
      '<table class="tbl"><thead><tr>' +
      '<th>תרגיל</th><th>מיקום</th><th>זמן</th><th>תפקיד בתרגיל</th><th>סוג תרגיל</th><th>סטטוס</th>' +
      '</tr></thead><tbody>';
    assigns.forEach(function(a) {
      const ex = Exercises_get(a.exercise_id);
      const title = ex ? ex.title : a.exercise_id;
      s += '<tr>' +
        '<td style="white-space:nowrap">' +
        (ex ? _exerciseLink(ex.id, title) : _esc(title)) + '</td>' +
        '<td>' + _dashCell(_dashExerciseLocation(ex)) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + _dashCell(_dashExerciseTime(ex)) + '</td>' +
        '<td>' + _dashCell(a.responsibility) + '</td>' +
        '<td>' + (ex && ex.exercise_type ? _badge(ex.exercise_type, 'muted') : _dashCell('')) + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>' +
        '</tr>';
    });
    s += '</tbody></table></div>';
  }

  s += '</div>';
  return s;
}

function _dashCell(val) {
  return val ? _esc(val) : '<span style="color:var(--muted)">—</span>';
}

function _commanderTraineeExercisesHtml(assigns) {
  if (!assigns.length) {
    return '<span style="color:var(--muted)">אין תרגילים</span>';
  }
  let html = '<ul style="margin:0;padding:0 18px 0 0;list-style:disc;min-width:140px">';
  assigns.forEach(function(a) {
    const ex = Exercises_get(a.exercise_id);
    html += '<li style="margin:5px 0;line-height:1.4">' +
      (ex ? _exerciseLink(ex.id, ex.title) : _esc(a.exercise_id)) +
      '<div style="font-size:11px;margin-top:2px;color:var(--muted)">' +
      _esc(a.responsibility || '—') + ' · ' + _statusBadge(a.status) +
      '</div></li>';
  });
  return html + '</ul>';
}

// ── Commander Dashboard ──
function _commanderDashboard(user, sid) {
  const trainees = Users_traineesOfCommander(user.id);

  let s = '<div class="page-title">⊞ לוח בקרה — מפ</div>';

  if (!trainees.length) {
    return s + '<div class="card"><div class="empty">אין חיילים מוקצים לצוות שלך עדיין</div></div>';
  }

  let totalAssigns = 0;
  trainees.forEach(function(t) {
    totalAssigns += Assignments_byUser(t.id).length;
  });

  s += '<div class="grid-2" style="margin-bottom:16px">' +
    '<div class="stat-box"><div class="stat-num">' + trainees.length + '</div><div class="stat-label">חניכים בצוות</div></div>' +
    '<div class="stat-box"><div class="stat-num">' + totalAssigns + '</div><div class="stat-label">הקצאות לתרגילים</div></div>' +
    '</div>';

  s += '<div class="card"><div class="card-header"><div class="card-title">🪖 חניכי הצוות</div></div>' +
    '<div class="card-body" style="padding:0;overflow-x:auto">' +
    '<table class="tbl"><thead><tr>' +
    '<th>שיוך חיילי</th>' +
    '<th>סוג שירות</th>' +
    '<th>שם חניך</th>' +
    '<th>פלאפון</th>' +
    '<th>פירוט יחידה</th>' +
    '<th>תפקיד מיועד</th>' +
    '<th>תרגילים</th>' +
    '</tr></thead><tbody>';

  trainees.forEach(function(t) {
    const assigns = Assignments_byUser(t.id);
    const unitDetail = t.unit_affiliation || t.unit_classification || '';
    s += '<tr>' +
      '<td>' + _dashCell(t.military_affiliation) + '</td>' +
      '<td>' + (t.service_type ? _badge(t.service_type, 'muted') : _dashCell('')) + '</td>' +
      '<td style="white-space:nowrap">' + _userLink(t.id, t.name, '') + '</td>' +
      '<td class="mono" style="font-size:12px">' + _dashCell(t.phone) + '</td>' +
      '<td>' + _dashCell(unitDetail) + '</td>' +
      '<td>' + _dashCell(t.target_role) + '</td>' +
      '<td>' + _commanderTraineeExercisesHtml(assigns) + '</td>' +
      '</tr>';
  });

  s += '</tbody></table></div></div>';
  return s;
}

// ── Tutor Dashboard ──
function _tutorDashboard(user, sid) {
  const myAssigns = Assignments_byTutor(user.id);
  const exMap = {};

  myAssigns.forEach(function(a) {
    const u = Users_get(a.user_id);
    if (!u || !Roles_isTrainee(u.role)) return;
    if (!exMap[a.exercise_id]) exMap[a.exercise_id] = [];
    exMap[a.exercise_id].push({ assign: a, trainee: u });
  });

  const exIds = Object.keys(exMap);
  let s = '<div class="page-title">⊞ לוח בקרה — חונך</div>';

  if (!exIds.length) {
    return s + '<div class="card"><div class="empty">אין תרגילים עם חניכים משויכים אליך</div></div>';
  }

  exIds.sort(function(a, b) {
    const ea = Exercises_get(a);
    const eb = Exercises_get(b);
    const da = ea && ea.start_date ? ea.start_date : a;
    const db = eb && eb.start_date ? eb.start_date : b;
    return String(da).localeCompare(String(db));
  });

  s += '<p style="font-size:12px;color:var(--muted);margin-bottom:14px">' +
    'תרגילים שבהם משובצים חניכים שהוקצו לך כחונך — ניתן לתת ציון ומשוב לחניכים שלך בלבד.</p>';

  exIds.forEach(function(exId) {
    const ex = Exercises_get(exId);
    const title = ex ? ex.title : exId;
    const rows = exMap[exId];

    s += '<div class="card" style="margin-bottom:12px">' +
      '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<span class="card-title">🎯 ' + _exerciseLink(exId, title) + '</span>' +
      '<a href="#" data-spa-page="exercise"' + _spaParamsAttr({ id: exId }) +
      ' class="btn btn-secondary btn-sm">↗ פתיחה</a>' +
      '</div><div class="card-body" style="padding:0">' +
      '<table class="tbl"><thead><tr><th>חניך</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th><th>משוב</th></tr></thead><tbody>';

    rows.forEach(function(row) {
      const a = row.assign;
      const t = row.trainee;
      s += '<tr>' +
        '<td><b>' + _esc(t.name) + '</b></td>' +
        '<td>' + _esc(a.responsibility || '—') + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>' +
        '<td>' + (a.score ? _badge(a.score, 'green') : '—') + '</td>' +
        '<td>' + _feedbackBtn(a.id, exId, !!a.feedback) + '</td>' +
        '</tr>';
    });

    s += '</tbody></table></div></div>';
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
    const exTitle = ex ? ex.title : a.exercise_id;
    s += '<tr>' +
      '<td><a href="#" data-spa-page="exercise"' + _spaParamsAttr({ id: a.exercise_id }) +
        ' style="color:var(--blue);text-decoration:underline"><b>' + _esc(exTitle) + '</b></a></td>' +
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