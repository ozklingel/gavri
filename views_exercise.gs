// views_exercise.gs — exercise detail page + user profile

function _canViewExercise(user, exId) {
  if (Roles_canSeeAllExercises(user.role)) return true;
  if (Roles_isTrainee(user.role)) {
    return Assignments_byUser(user.id).some(function(a) {
      return String(a.exercise_id) === String(exId);
    });
  }
  if (Roles_isCompanyCommander(user.role)) {
    const traineeIds = Users_traineesOfCommander(user.id).map(function(t) { return t.id; });
    return Assignments_byExercise(exId).some(function(a) {
      return traineeIds.indexOf(a.user_id) !== -1;
    });
  }
  if (Roles_isDepartmentCommander(user.role)) {
    return Assignments_byExercise(exId).length > 0;
  }
  if (Roles_isTutor(user.role)) {
    return Assignments_byExercise(exId).some(function(a) {
      return String(a.tutor) === String(user.id);
    });
  }
  return false;
}

function Views_exercise(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const exId = String((p && (p.id || p.exerciseId)) || '').trim();
  if (!exId) return Views_error('חסר מזהה תרגיל.', p);
  const ex  = Exercises_get(exId);
  if (!ex) return Views_error('התרגיל לא נמצא.', p);
  if (!_canViewExercise(user, exId)) {
    return Views_error('אין הרשאה לצפות בתרגיל זה.', p);
  }
  const sidQ = encodeURIComponent(sid);

  let s = _topbar(user, sid) + '<div class="page">';
  s += _flash(p);

  // Page header with action buttons
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">' + _esc(ex.title) + '</div>' +
    '<div style="display:flex;gap:6px">' +
    _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm');

  if (Roles_hasAdminAccess(user.role)) {
    s += _a('action=duplicateExercise&id=' + encodeURIComponent(ex.id) + '&sid=' + sidQ, '⎘ שכפל', 'btn btn-ghost btn-sm');
s += _confirmDelete(
  'action=deleteExercise&id=' + encodeURIComponent(ex.id) + '&from=exercise&sid=' + sidQ,
  'מחיקת תרגיל "' + ex.title + '" תסיר גם את כל ההקצאות וציר הזמן שלו. להמשיך?'
);
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
    (ex.rawStartTime ? '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">שעת התחלה</span><br><b>' + _esc(ex.rawStartTime) + '</b></div>' : '') +
    (ex.rawEndTime   ? '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">שעת סיום</span><br><b>' + _esc(ex.rawEndTime) + '</b></div>' : '') +
    '<div style="flex:1"><span style="color:var(--muted);font-family:var(--mono);font-size:11px">תיאור</span><br>' +
    _esc(ex.description || '—') + '</div>' +
    '</div>' +
    '<div class="card-body" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border)">' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">אקט</span><br>' +
    '<b>' + _esc(ex.act || '—') + '</b></div>' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">סוג תרגיל</span><br>' +
    '<b>' + _esc(ex.exercise_type || '—') + '</b></div>' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">גדוד שת״פ</span><br>' +
    '<b>' + _esc(ex.partner_battalion || '—') + '</b></div>' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">מחנה / מגנן</span><br>' +
    '<b>' + _esc(ex.camp || '—') + '</b></div>' +
    '<div><span style="color:var(--muted);font-family:var(--mono);font-size:11px">מפקד אחראי גדוד</span><br>' +
    '<b>' + _esc(ex.battalion_commander || '—') + '</b></div>' +
    '</div></div>';

  // ── Two-column layout for timeline + participants ──
  s += '<div class="grid-2" style="margin-bottom:14px">';

  // Timeline
  const details = Exercises_details(ex.id);
  let tlHtml = '<div class="card">' +
    '<div class="card-header"><span class="card-title">🕐 ציר זמן (' + details.length + ')</span>';

  if (Roles_hasAdminAccess(user.role)) {
    tlHtml += '<button class="btn btn-ghost btn-sm" onclick="toggleCollapsible(\'add-detail\')">➕ הוסף</button>';
  }
  tlHtml += '</div>';

  if (!details.length) {
    tlHtml += '<div class="empty">אין רישומים</div>';
  } else {
    tlHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr><th>תאריך ושעה</th><th>מיקום</th><th>תיאור</th></tr></thead><tbody>';
    details.forEach(function(d) {
      tlHtml += '<tr><td class="mono">' + _esc(d.time) + '</td><td>' + _esc(d.location) + '</td><td>' + _esc(d.description) + '</td></tr>';
    });
    tlHtml += '</tbody></table></div>';
  }

  if (Roles_hasAdminAccess(user.role)) {
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
  } else if (Roles_hasAdminAccess(user.role)) {
    const allUsers = Users_all();
    const tutorOpts = [['', '— ללא חונך —']].concat(
      allUsers.map(function(u) { return [u.id, u.name + ' (' + _roleHe(u.role) + ')']; })
    );
    pHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr>' +
      '<th>שם</th><th>תפקיד</th><th>חונך</th><th>סטטוס</th><th>ציון</th><th>פעולות</th>' +
      '</tr></thead><tbody>';
    parts.forEach(function(a) {
      const u = Users_get(a.user_id);
      pHtml += '<tr data-assignment-id="' + _esc(a.id) + '" data-exercise-id="' + _esc(ex.id) + '">' +
        '<td>' + (u ? _userLink(u.id, u.name, sidQ) : '<b>' + _esc(a.user_id) + '</b>') + '</td>' +
        '<td><input type="text" name="responsibility" list="respList" placeholder="בחר או הקלד..." value="' +
        _esc(a.responsibility) + '" class="form-input" style="min-width:140px"></td>' +
        '<td>' + _select('tutor', tutorOpts, a.tutor || '') + '</td>' +
        '<td><select name="status" class="form-select">' +
        '<option value="pending"' + (a.status === 'pending' ? ' selected' : '') + '>◌ ממתין</option>' +
        '<option value="in_progress"' + (a.status === 'in_progress' ? ' selected' : '') + '>⟳ בביצוע</option>' +
        '<option value="completed"' + (a.status === 'completed' ? ' selected' : '') + '>✓ הושלם</option>' +
        '</select></td>' +
        '<td style="white-space:nowrap"><input type="text" name="score" value="' + _esc(a.score) + '" class="form-input" style="width:60px" placeholder="—"> ' +
        _feedbackBtn(a.id, ex.id, !!a.feedback) + '</td>' +
        '<td style="display:flex;gap:4px">' +
        '<button type="button" class="btn btn-primary btn-sm" onclick="spaSaveAssignmentRow(this)">💾</button>' +
        _formOpen('form-inline') +
        '<input type="hidden" name="action" value="removeAssignment">' +
        '<input type="hidden" name="assignmentId" value="' + _esc(a.id) + '">' +
        '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
        _submitBtn('✕', 'btn btn-danger btn-sm btn-icon') +
        '</form></td>' +
        '</tr>';
    });
    pHtml += '</tbody></table></div>';
  } else if (Roles_isTrainee(user.role)) {
    const myAssign = parts.find(function(a) { return String(a.user_id) === String(user.id); });
    if (myAssign) {
      pHtml += '<div class="card-body" style="border-bottom:1px solid var(--border);padding:10px 14px">' +
        '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px">השיבוץ שלי</div>' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">' +
        '<span><span style="color:var(--muted)">תפקיד: </span><b>' + _esc(myAssign.responsibility) + '</b></span>' +
        '<span><span style="color:var(--muted)">סטטוס: </span>' + _statusBadge(myAssign.status) + '</span>' +
        '<span><span style="color:var(--muted)">ציון: </span>' +
        (myAssign.score ? _badge(myAssign.score, 'green') : '—') + '</span>' +
        '</div></div>';
    }
    pHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr>' +
      '<th>שם</th><th>תפקיד</th>' +
      '</tr></thead><tbody>';
    parts.forEach(function(a) {
      const u = Users_get(a.user_id);
      const isSelf = String(a.user_id) === String(user.id);
      pHtml += '<tr' + (isSelf ? ' style="background:rgba(74,222,128,0.06)"' : '') + '>' +
        '<td>' + (isSelf ? '<b>' + _esc(u ? u.name : a.user_id) + '</b>' : _esc(u ? u.name : a.user_id)) + '</td>' +
        '<td>' + _esc(a.responsibility) + '</td>' +
        '</tr>';
    });
    pHtml += '</tbody></table></div>';
  } else if (Roles_isTutor(user.role)) {
    pHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr>' +
      '<th>שם</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th><th>משוב</th>' +
      '</tr></thead><tbody>';
    parts.forEach(function(a) {
      const u = Users_get(a.user_id);
      const canEdit = Assignments_isTuteeOf(user, a);
      pHtml += '<tr' + (canEdit ? ' data-assignment-id="' + _esc(a.id) + '" data-exercise-id="' + _esc(ex.id) + '"' : '') + '>' +
        '<td>' + (u ? _userLink(u.id, u.name, sidQ) : '<b>' + _esc(a.user_id) + '</b>') + '</td>' +
        '<td>' + _esc(a.responsibility) + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>' +
        '<td style="white-space:nowrap">';
      if (canEdit) {
        pHtml += '<input type="text" name="score" value="' + _esc(a.score) + '" class="form-input" style="width:60px" placeholder="—"> ' +
          '<button type="button" class="btn btn-primary btn-sm" onclick="spaSaveAssignmentRow(this)">💾</button>';
      } else {
        pHtml += (a.score ? _badge(a.score, 'green') : '—');
      }
      pHtml += '</td><td>' +
        (canEdit ? _feedbackBtn(a.id, ex.id, !!a.feedback) : '—') +
        '</td></tr>';
    });
    pHtml += '</tbody></table></div>';
  } else {
    const showFeedback = Roles_isCompanyCommander(user.role);
    const showScoreCol = Roles_isAdmin(user.role) || Roles_isUnitCommander(user.role) || showFeedback;
    pHtml += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr>' +
      '<th>שם</th><th>תפקיד</th><th>סטטוס</th>' +
      (showScoreCol ? '<th>ציון</th>' : '') +
      (showFeedback ? '<th>משוב</th>' : '') +
      '</tr></thead><tbody>';
    parts.forEach(function(a) {
      const u = Users_get(a.user_id);
      const canFb = showFeedback && Assignments_canEditFeedback(user, a);
      const showScore = Users_canViewScores(user, a.user_id);
      pHtml += '<tr><td>' + (u ? _userLink(u.id, u.name, sidQ) : '<b>' + _esc(a.user_id) + '</b>') + '</td>' +
        '<td>' + _esc(a.responsibility) + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>';
      if (showScoreCol) {
        pHtml += '<td>' + (showScore && a.score ? _badge(a.score, 'green') : (showScore ? '—' : '<span style="color:var(--muted)">מוסתר</span>')) + '</td>';
      }
      if (showFeedback) {
        pHtml += '<td>' + (canFb ? _feedbackBtn(a.id, ex.id, !!a.feedback) : '—') + '</td>';
      }
      pHtml += '</tr>';
    });
    pHtml += '</tbody></table></div>';
  }
  pHtml += '</div>';
  s += pHtml;
  s += '</div>'; // end grid-2

  // ── Admin-only panels ──
  if (Roles_hasAdminAccess(user.role)) {
    s += _respDatalistHtml('respList');

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
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">שעת התחלה</label><input type="time" name="start_time" value="' + _esc(ex.rawStartTime || '') + '" class="form-input"></div>' +
      '<div class="form-row"><label class="form-label">שעת סיום</label><input type="time" name="end_time" value="' + _esc(ex.rawEndTime || '') + '" class="form-input"></div>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">אקט</label>' + _input('act', 'אקט', ex.act) + '</div>' +
      '<div class="form-row"><label class="form-label">סוג תרגיל</label>' + _input('exercise_type', 'סוג תרגיל', ex.exercise_type) + '</div>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">גדוד שת״פ</label>' + _input('partner_battalion', 'גדוד שת״פ', ex.partner_battalion) + '</div>' +
      '<div class="form-row"><label class="form-label">מחנה / מגנן</label>' + _input('camp', 'מחנה / מגנן', ex.camp) + '</div>' +
      '</div>' +
      '<div class="form-row"><label class="form-label">מפקד אחראי גדוד</label>' + _input('battalion_commander', 'מפקד אחראי גדוד', ex.battalion_commander) + '</div>' +
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
      const userOptions = available.map(function(u){ return [u.id, u.id + ' — ' + u.name + ' (' + _roleHe(u.role) + ')']; });
      indivForm =
        _formOpen() +
        '<input type="hidden" name="action" value="assign">' +
        '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
        '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
        '<div class="form-row"><label class="form-label">חייל</label>' + _select('userId', userOptions) + '</div>' +
        '<div class="form-row"><label class="form-label">תפקיד</label>' +
        '<input name="responsibility" list="respList" placeholder="בחר או הקלד..." class="form-input" required>' +
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
  return _wrapPage(s, ex.title);
}

// ─────────── USERS & TEAMS PAGE ───────────
// ─────────── USER PROFILE PAGE ───────────
function Views_user(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);

  const targetId = p.id || sid;
  const target   = Users_get(targetId);
  if (!target) return Views_error('המשתמש לא נמצא.', p);

  const team     = target.team_id ? Teams_get(target.team_id) : null;
  const teamName = team ? team.name : (target.team_id || '—');
  const isAdmin  = Roles_hasAdminAccess(user.role);
  const canViewScores = Users_canViewScores(user, targetId);

  let s = _topbar(user, sid) + '<div class="page">';
  s += _flash(p);

  // Page header
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">👤 ' + _esc(target.name) + '</div>' +
    '<div style="display:flex;gap:6px">' +
    _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm');
  if (isAdmin) {
    s += _a('page=users&sid=' + sidQ, '← משתמשים', 'btn btn-ghost btn-sm');
  }
  s += '</div></div>';

  // ── Profile info card ──
  s += '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-header"><span class="card-title">📋 פרטי משתמש</span></div>' +
    '<div class="card-body">' +
    '<table class="tbl"><tbody>' +
    '<tr><td style="width:140px;color:var(--muted);font-family:var(--mono);font-size:12px">מספר אישי</td>' +
    '<td><span style="font-family:var(--mono);color:var(--green)">' + _esc(target.id) + '</span></td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">שם</td>' +
    '<td><b>' + _esc(target.name) + '</b></td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">תפקיד</td>' +
    '<td>' + _badge(_roleHe(target.role), _roleBadgeType(target.role)) + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">צוות</td>' +
    '<td>' + _esc(teamName) + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">מספר טלפון</td>' +
    '<td>' + (target.phone ? _esc(target.phone) : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">דוא"ל</td>' +
    '<td>' + (target.email ? _esc(target.email) : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">שיוך יחידתי</td>' +
    '<td>' + (target.unit_affiliation ? _esc(target.unit_affiliation) : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">סוג שירות</td>' +
    '<td>' + (target.service_type ? _badge(target.service_type, 'muted') : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">שיוך חיילי</td>' +
    '<td>' + (target.military_affiliation ? _esc(target.military_affiliation) : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">אפיון יחידתי</td>' +
    '<td>' + (target.unit_classification ? _esc(target.unit_classification) : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">תפקיד מיועד</td>' +
    '<td>' + (target.target_role ? _esc(target.target_role) : '<span style="color:var(--muted)">—</span>') + '</td></tr>' +
    '</tbody></table>' +
    '</div></div>';

  // ── Assignments for this user ──
  const assignments = Assignments_byUser(targetId);
  s += '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-header"><span class="card-title">🎯 תרגילים (' + assignments.length + ')</span></div>';
  if (!canViewScores && assignments.length && String(user.id) !== String(targetId)) {
    s += '<div style="padding:8px 14px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">' +
      'ציונים מוסתרים — נגישים לסגל, מגד ומפקד הצוות בלבד</div>';
  }
  if (!assignments.length) {
    s += '<div class="empty">אין הקצאות</div>';
  } else {
    s += '<div class="card-body" style="padding:0"><table class="tbl"><thead><tr>' +
      '<th>תרגיל</th><th>תפקיד</th><th>סטטוס</th>' +
      (canViewScores ? '<th>ציון</th>' : '') +
      '</tr></thead><tbody>';
    assignments.forEach(function(a) {
      const ex = Exercises_get(a.exercise_id);
      const exTitle = ex ? ex.title : a.exercise_id;
      s += '<tr>' +
        '<td><a href="#" data-spa-page="exercise"' + _spaParamsAttr({ id: a.exercise_id }) + ' style="color:var(--blue);text-decoration:underline">' +
        _esc(exTitle) + '</a></td>' +
        '<td>' + _esc(a.responsibility || '—') + '</td>' +
        '<td>' + _statusBadge(a.status) + '</td>';
      if (canViewScores) {
        s += '<td>' + (a.score ? _badge(a.score, 'green') : '—') + '</td>';
      }
      s += '</tr>';
    });
    s += '</tbody></table></div>';
  }
  s += '</div>';

  // ── Admin edit form ──
  if (isAdmin) {
    const allTeams = Teams_all();
    const teamOpts = [['', '— ללא צוות —']].concat(
      allTeams.map(function(t) { return [t.id, t.id + ' — ' + t.name]; })
    );

    s += '<div class="collapsible" style="margin-bottom:14px">' +
      '<button class="collapsible-toggle">✏ עריכת פרופיל <span class="arrow">▾</span></button>' +
      '<div class="collapsible-content"><div class="card"><div class="card-body">' +
      _formOpen() +
      '<input type="hidden" name="action" value="updateProfile">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="targetId" value="' + _esc(target.id) + '">' +
      '<input type="hidden" name="returnTo" value="user">' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">תפקיד</label>' +
        _select('newRole', Roles_selectOptions(), target.role) +
      '</div>' +
      '<div class="form-row"><label class="form-label">צוות</label>' +
        _select('newTeamId', teamOpts, target.team_id) +
      '</div>' +
      '</div>' +
      _extraProfileFields(target) +
      _submitBtn('💾 שמור שינויים', 'btn btn-primary') +
      '</form>' +
      '</div></div></div></div>';
  }

  s += '</div>';
  return _wrapPage(s, target.name + ' — פרופיל');
}