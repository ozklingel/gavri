// views_dashboard.gs — exercises list + dashboard pages
function Views_exercises(p) {
  const user = Auth_requireRole(p, ['admin']);
  const sid = user.id;
  const sidQ = encodeURIComponent(sid);
  let tab = String(p.tab || 'list').trim();
  const allowedTabs = ['list', 'calendar', 'new'];
  if (allowedTabs.indexOf(tab) === -1) tab = 'list';
  const exs = Exercises_all();

  let s = _spaTabsBar('exercises', {}, [
    { id: 'list', label: '📋 כל התרגילים' },
    { id: 'calendar', label: '📅 לוח שנה' },
    { id: 'new', label: '➕ תרגיל חדש' }
  ], tab);

  if (tab === 'list') {
    s += _exercisesListModuleHtml(user, sid);
  } else if (tab === 'calendar') {
    s += _exercisesCalendarModuleHtml(user, sid);
  } else {
    s += '<div class="spa-tab-panel" style="margin-top:14px">' +
      _exercisesSidebarModuleHtml(user, sid) + '</div>';
  }

  const body =
    _topbar(user, sid) +
    '<div class="page">' + _flash(p) +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
      '<h1 class="page-title" style="margin:0">🎯 ניהול תרגילים</h1>' +
      (exs.length
        ? '<button type="button" class="btn btn-secondary btn-sm" onclick="toggleCollapsible(\'ex-duplicate-panel\')">⎘ שכפל תרגיל</button>'
        : '') +
    '</div>' +
    (exs.length ? _exercisesDuplicatePanelHtml(exs) : '') +
    s +
    '</div>';

  return _wrapPage(body, 'ניהול תרגילים');
}

function _exercisesDuplicatePanelHtml(exs) {
  let opts = '<option value="">— בחר תרגיל —</option>';
  exs.forEach(function(e) {
    opts += '<option value="' + _esc(e.id) + '">' + _esc(e.title) + ' (' + _esc(e.id) + ')</option>';
  });
  return '<div id="ex-duplicate-panel" style="display:none;margin-bottom:14px" class="card">' +
    '<div class="card-header"><div class="card-title">⎘ שכפל תרגיל</div></div>' +
    '<div class="card-body">' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:10px">' +
    'בחר תרגיל קיים — ייווצר עותק עם ציר הזמן שלו, ללא הקצאות משתתפים.</p>' +
    '<div class="form-row">' +
    '<label class="form-label">תרגיל לשיכפול</label>' +
    '<select id="exDuplicateSelect" class="form-select">' + opts + '</select>' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="duplicateExerciseFromList()">⎘ שכפל ופתח</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" onclick="toggleCollapsible(\'ex-duplicate-panel\')">ביטול</button>' +
    '</div></div></div>';
}

function _exercisesListModuleHtml(user, sid) {
  const sidQ = encodeURIComponent(sid);
  const exs = Exercises_all();
  const mpCounts = Assignments_mpCountByExercise();

  let s = '<div class="card"><div class="card-header"><div class="card-title">📋 כל התרגילים</div></div>';

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
          '<div class="ex-title">' + _exerciseLink(e.id, e.title) + '</div>' +
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

  s += '</div>';
  return s;
}

function _exerciseCalendarEvents(exList, enrichFn) {
  const events = [];
  (exList || []).forEach(function(ex) {
    const range = _exerciseTimeRange(ex);
    if (!range || isNaN(range.startMs) || isNaN(range.endMs)) return;
    const ev = {
      id: String(ex.id),
      title: String(ex.title || ''),
      startMs: range.startMs,
      endMs: range.endMs,
      type: String(ex.exercise_type || ''),
      location: String(ex.camp || ex.partner_battalion || '')
    };
    if (typeof enrichFn === 'function') enrichFn(ev, ex);
    events.push(ev);
  });
  events.sort(function(a, b) { return a.startMs - b.startMs; });
  return events;
}

function _exerciseCalendarCardHtml(opts) {
  opts = opts || {};
  const events = opts.events || [];
  const payload = opts.payload || { events: events };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  let exportBtn = '';
  if (opts.showExport && opts.exportBtnId) {
    exportBtn = '<button type="button" id="' + _esc(opts.exportBtnId) + '" class="btn btn-secondary btn-sm">' +
      '⬇ הורד ליומן (.ics)</button>';
  }
  return '<div class="card" id="' + _esc(opts.rootId) + '" style="margin-bottom:16px" data-app-cal="1">' +
    '<div class="card-header" style="flex-wrap:wrap;gap:8px;align-items:center">' +
    '<span class="card-title">' + (opts.title || '📅 לוח שנה') + '</span>' + exportBtn +
    '</div>' +
    '<div class="card-body user-cal-body">' +
    '<div class="user-cal-nav">' +
    '<button type="button" class="btn btn-ghost btn-sm" data-app-cal-nav="prev">&#8250;</button>' +
    '<span class="user-cal-month-label" id="' + _esc(opts.monthLabelId) + '"></span>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-app-cal-nav="next">&#8249;</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-app-cal-nav="today">היום</button>' +
    '</div>' +
    '<div class="user-cal-grid" id="' + _esc(opts.gridId) + '" aria-label="לוח שנה חודשי"></div>' +
    '<div class="user-cal-day-detail" id="' + _esc(opts.dayDetailId) + '" hidden></div>' +
    '</div>' +
    '<script id="' + _esc(opts.dataId) + '" type="application/json">' + json + '</script>' +
    '</div>';
}

function _exercisesCalendarModuleHtml(user, sid) {
  const exs = Exercises_all();
  const mpCounts = Assignments_mpCountByExercise();
  const events = _exerciseCalendarEvents(exs, function(ev, ex) {
    ev.mpCount = mpCounts[ex.id] || 0;
    ev.schedule = _fmtExerciseScheduleRange(ex);
    ev.location = _dashExerciseLocation(ex);
  });

  if (!events.length) {
    return '<div class="spa-tab-panel" style="margin-top:14px">' +
      '<div class="card"><div class="empty">אין תרגילים עם תאריכים תקינים להצגה בלוח שנה</div></div></div>';
  }

  return '<div class="spa-tab-panel" style="margin-top:14px">' +
    _exerciseCalendarCardHtml({
      rootId: 'exercisesCalendar',
      gridId: 'exercisesCalGrid',
      monthLabelId: 'exercisesCalMonthLabel',
      dayDetailId: 'exercisesCalDayDetail',
      dataId: 'exercisesCalData',
      exportBtnId: 'exercisesCalExportIcs',
      title: '📅 לוח שנה — כל התרגילים (' + events.length + ')',
      showExport: true,
      payload: { events: events, fileName: 'mapim-all-exercises' },
      events: events
    }) + '</div>';
}

function _exercisesSidebarModuleHtml(user, sid) {
  let s = '<div class="card"><div class="card-header"><div class="card-title">➕ תרגיל חדש</div></div>' +
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
    '<div class="card-body">' + Series_buildFormHtml(sid) + '</div></div>';
  return s;
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

function _dashboardCorpsStatsHtml(corpsStats, compact) {
  const minW = compact ? '90px' : '130px';
  let s = '<p style="font-family:var(--mono);font-size:10px;color:var(--muted);margin:0 0 8px">' +
    'סך ההקצאות — לפי שיוך חיילי</p>';
  s += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(' + minW + ',1fr));gap:8px;margin-bottom:12px">';
  corpsStats.order.forEach(function(c) {
    s += '<div class="stat-box"><div class="stat-num">' + corpsStats.counts[c.key] +
      '</div><div class="stat-label">' + c.label + '</div></div>';
  });
  if (corpsStats.other > 0) {
    s += '<div class="stat-box"><div class="stat-num">' + corpsStats.other +
      '</div><div class="stat-label">אחר / ללא שיוך</div></div>';
  }
  return s + '</div>';
}

function _unitCommanderDashboardPanels(sid) {
  const corpsStats = _dashboardCorpsAssignedCounts();
  let s = '<div class="drawer-section-title">מסך הבית — מגד</div>';
  s += _dashboardCorpsStatsHtml(corpsStats, true);
  return s;
}

function _departmentCommanderDashboardPanels(user, sid) {
  return '<div class="drawer-section-title">מסך הבית — ממ</div>';
}

function _drawerDashboardPanels(user, sid) {
  if (!user) return '';
  let s = _homeConstraintsDashboardWidget(user, sid);
  const role = Roles_normalize(user.role);
  if (Roles_isUnitCommander(role))     s += _unitCommanderDashboardPanels(sid);
  else if (Roles_isCompanyCommander(role))  s += _commanderDashboardPanels(user, sid);
  else if (Roles_isDepartmentCommander(role)) s += _departmentCommanderDashboardPanels(user, sid);
  else if (Roles_isTutor(role))             s += _tutorDashboardPanels(user, sid);
  else                                      s += _traineeDashboardPanels(user, sid);
  return s;
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
  const range = _fmtExerciseScheduleRange(ex);
  return range || '—';
}

function _dashboardProcedurePanelHtml(ex, details) {
  if (!ex) {
    return '<div class="dash-proc-empty" style="padding:12px 14px;color:var(--muted);font-size:12px">אין נתוני תרגיל</div>';
  }
  if (!details || !details.length) {
    return '<div class="dash-proc-empty" style="padding:12px 14px;color:var(--muted);font-size:12px">' +
      'אין לוז נוה"ק לתרגיל זה.</div>';
  }
  let html = '<div class="dash-proc-panel">' +
    '<div class="dash-proc-head">' +
    '<span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text2)">⚔ נוהל קרב — ' +
    _esc(ex.title) + ' <span style="color:var(--muted);font-weight:600">(' + details.length + ')</span></span>' +
    '<a href="#" data-spa-page="exercise"' + _spaParamsAttr({ id: ex.id }) +
    ' class="btn btn-ghost btn-sm">↗ דף תרגיל מלא</a>' +
    '</div>' +
    '<div style="overflow-x:auto">' +
    '<table class="tbl dash-proc-tbl"><thead><tr>' +
    '<th>תאריך ושעה</th><th>מיקום</th><th>תיאור</th>' +
    '</tr></thead><tbody>';
  details.forEach(function(d) {
    html += '<tr><td class="mono" style="font-size:11px;white-space:nowrap">' + _esc(d.time) + '</td>' +
      '<td style="font-size:11px">' + _esc(d.location) + '</td>' +
      '<td style="font-size:11px">' + _esc(d.description) + '</td></tr>';
  });
  html += '</tbody></table></div></div>';
  return html;
}

function _dashboardUserCalendarEvents(assigns) {
  const events = [];
  assigns.forEach(function(a) {
    const ex = Exercises_get(a.exercise_id);
    if (!ex) return;
    const range = _exerciseTimeRange(ex);
    if (!range || isNaN(range.startMs) || isNaN(range.endMs)) return;
    const details = Exercises_details(ex.id);
    events.push({
      id: String(ex.id),
      title: String(ex.title || ''),
      startMs: range.startMs,
      endMs: range.endMs,
      location: _dashExerciseLocation(ex),
      responsibility: String(a.responsibility || ''),
      status: String(a.status || ''),
      type: String(ex.exercise_type || ''),
      procedureCount: details.length,
      schedule: _fmtExerciseScheduleRange(ex)
    });
  });
  events.sort(function(a, b) { return a.startMs - b.startMs; });
  return events;
}

function _dashboardUserCalendarHtml(target, events) {
  if (!events.length) return '';
  return _exerciseCalendarCardHtml({
    rootId: 'dashboardUserCalendar',
    gridId: 'userCalGrid',
    monthLabelId: 'userCalMonthLabel',
    dayDetailId: 'userCalDayDetail',
    dataId: 'dashboardUserCalData',
    exportBtnId: 'dashboardCalExportIcs',
    title: '📅 לוח שנה — תרגילים',
    showExport: true,
    payload: {
      events: events,
      fileName: 'mapim-exercises-' + String(target.name || 'user'),
      userName: String(target.name || '')
    },
    events: events
  });
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
    '<span class="card-title">🎯 תרגילים — ' + _userLink(target.id, target.name, '') + '</span>' +
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

  const calEvents = _dashboardUserCalendarEvents(assigns);
  s += _dashboardUserCalendarHtml(target, calEvents);

  if (!assigns.length) {
    s += '<div class="empty">אין תרגילים משויכים למשתמש זה</div>';
  } else {
    s += '<div class="card-body" style="padding:0;overflow-x:auto">' +
      '<table class="tbl" id="dashboardUserExTable"><thead><tr>' +
      '<th>תרגיל</th><th>שבוע לועזי</th><th>מיקום</th><th>זמן</th><th>תפקיד בתרגיל</th><th>סוג תרגיל</th><th>סטטוס</th><th>נוה"ק</th>' +
      '</tr></thead><tbody>';
    assigns.forEach(function(a) {
      const ex = Exercises_get(a.exercise_id);
      const title = ex ? ex.title : a.exercise_id;
      const details = ex ? Exercises_details(ex.id) : [];
      const exId = ex ? String(ex.id) : '';
      let procCell = '<span style="color:var(--muted);font-size:11px">—</span>';
      if (ex && details.length) {
        procCell = '<button type="button" class="btn btn-ghost btn-sm dash-proc-btn" ' +
          'data-dash-proc="' + _esc(exId) + '" data-proc-count="' + details.length + '" ' +
          'aria-expanded="false" title="הצג לוז נוהל קרב">' +
          '📋 נוה"ק (' + details.length + ')</button>';
      }
      s += '<tr class="dash-ex-row">' +
        '<td style="white-space:nowrap">' +
        (ex ? _exerciseLink(ex.id, title) : _esc(title)) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' +
        _dashCell(ex && ex.rawStartDate ? _isoWeekLabel(ex.rawStartDate) : '') + '</td>' +
        '<td>' + _dashCell(_dashExerciseLocation(ex)) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + _dashCell(_dashExerciseTime(ex)) + '</td>' +
        '<td>' + _dashCell(a.responsibility) + '</td>' +
        '<td>' + (ex && ex.exercise_type ? _badge(ex.exercise_type, 'muted') : _dashCell('')) + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>' +
        '<td style="white-space:nowrap">' + procCell + '</td>' +
        '</tr>';
      if (ex && details.length) {
        s += '<tr class="dash-proc-row" id="dash-proc-row-' + _esc(exId) + '" hidden>' +
          '<td colspan="8" style="padding:0;background:rgba(245,158,11,0.06);border-top:1px solid var(--border)">' +
          _dashboardProcedurePanelHtml(ex, details) + '</td></tr>';
      }
    });
    s += '</tbody></table></div>';
  }

  s += '</div>';
  return s;
}

function _dashCell(val) {
  return val ? _esc(val) : '<span style="color:var(--muted)">—</span>';
}

function _dashPhoneCell(phone) {
  return _whatsappLink(phone);
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
      (ex ? '<div style="font-size:11px;margin-top:2px;color:var(--muted)">' +
        _esc(_fmtExerciseScheduleRange(ex)) + '</div>' : '') +
      '<div style="font-size:11px;margin-top:2px;color:var(--muted)">' +
      _esc(a.responsibility || '—') + ' · ' + _statusBadge(a.status) +
      '</div></li>';
  });
  return html + '</ul>';
}

// ── Commander Dashboard ──
function _commanderDashboardPanels(user, sid) {
  const trainees = Users_traineesOfCommander(user.id);

  let s = '<div class="drawer-section-title">מסך הבית — ' + Roles_label(user.role) + '</div>';

  if (!trainees.length) {
    return s + '<div class="card"><div class="empty">אין חיילים מוקצים לצוות שלך עדיין</div></div>';
  }

  let totalAssigns = 0;
  trainees.forEach(function(t) {
    totalAssigns += Assignments_byUser(t.id).length;
  });

  s += '<div class="grid-2" style="margin-bottom:12px">' +
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
      '<td class="mono" style="font-size:12px">' + _dashPhoneCell(t.phone) + '</td>' +
      '<td>' + _dashCell(unitDetail) + '</td>' +
      '<td>' + _dashCell(t.target_role) + '</td>' +
      '<td>' + _commanderTraineeExercisesHtml(assigns) + '</td>' +
      '</tr>';
  });

  s += '</tbody></table></div></div>';
  return s;
}

// ── Tutor Dashboard ──
function _tutorDashboardPanels(user, sid) {
  const myAssigns = Assignments_byTutor(user.id);
  const exMap = {};

  myAssigns.forEach(function(a) {
    const u = Users_get(a.user_id);
    if (!u || !Roles_isTrainee(u.role)) return;
    if (!exMap[a.exercise_id]) exMap[a.exercise_id] = [];
    exMap[a.exercise_id].push({ assign: a, trainee: u });
  });

  const exIds = Object.keys(exMap);
  let s = '<div class="drawer-section-title">מסך הבית — חונך</div>';

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
      '<div><span class="card-title">🎯 ' + _exerciseLink(exId, title) + '</span>' +
      (ex ? '<div style="font-size:11px;color:var(--muted);margin-top:4px">' +
        _esc(_fmtExerciseScheduleRange(ex)) + '</div>' : '') +
      '</div></div><div class="card-body" style="padding:0">' +
      '<table class="tbl"><thead><tr><th>חניך</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th><th>משוב</th></tr></thead><tbody>';

    rows.forEach(function(row) {
      const a = row.assign;
      const t = row.trainee;
      s += '<tr>' +
        '<td>' + _userLink(t.id, t.name, '') + '</td>' +
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
function _traineeDashboardPanels(user, sid) {
  const sidQ = encodeURIComponent(sid);
  const assigns = Assignments_byUser(user.id);

  let s = '<div class="drawer-section-title">התרגילים שלי</div>';

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
    '<th>תרגיל</th><th>זמן</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th>' +
    '</tr></thead><tbody>';

  assigns.forEach(function(a) {
    const ex = Exercises_get(a.exercise_id);
    const exTitle = ex ? ex.title : a.exercise_id;
    s += '<tr>' +
      '<td>' + (ex ? _exerciseLink(ex.id, exTitle) : _esc(exTitle)) + '</td>' +
      '<td style="font-size:12px;white-space:nowrap">' + _dashCell(_fmtExerciseScheduleRange(ex)) + '</td>' +
      '<td>' + _esc(a.responsibility) + '</td>' +
      '<td>' + _statusBadge(a.status) + '</td>' +
      '<td>' + (a.score ? _badge(a.score, 'green') : '—') + '</td>' +
      '</tr>';
  });

  s += '</tbody></table></div></div>';
  return s;
}

// ─────────── EXERCISE PAGE ───────────