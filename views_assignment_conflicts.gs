// views_assignment_conflicts.gs — תצוגת התנגשויות שיבוץ

function _assignmentConflictsListHtml(items, emptyText) {
  if (!items || !items.length) {
    return '<div style="font-size:12px;color:var(--muted)">' + _esc(emptyText) + '</div>';
  }
  let s = '<ul style="margin:0;padding:0 18px 0 0;list-style:disc">';
  items.forEach(function(item) {
    s += '<li style="margin:6px 0;line-height:1.5;font-size:12px">' +
      _userLink(item.user_id, item.user_name, '') + ' — ' +
      _exerciseLink(item.exercise_a_id, item.exercise_a_title) + ' ↔ ' +
      _exerciseLink(item.exercise_b_id, item.exercise_b_title);
    if (item.type === 'procedure' && item.procedure_label) {
      s += ' <span class="badge badge-yellow" style="font-size:10px">נוה״ק: ' +
        _esc(item.procedure_label) + '</span>';
    } else if (item.type === 'time') {
      s += ' <span class="badge" style="font-size:10px;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5">חמורה</span>';
    }
    s += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' +
      _esc(AssignmentConflicts_message(item)) +
      '</div></li>';
  });
  return s + '</ul>';
}

function _assignmentConflictsPanel(conflicts, opts) {
  opts = opts || {};
  const timeItems = conflicts.timeOverlaps || [];
  const procItems = conflicts.procedureGaps || [];
  const total = timeItems.length + procItems.length;
  if (!total && !opts.alwaysShow) return '';

  let s = '<div class="card" style="margin-bottom:14px' +
    (timeItems.length ? ';border-color:#f87171' : '') + '">';
  s += '<div class="card-header"><div class="card-title">⚠ התנגשויות שיבוץ (' + total + ')</div></div>';
  s += '<div class="card-body" style="font-size:13px">';

  if (timeItems.length) {
    s += '<div style="margin-bottom:12px;padding:10px;border-radius:6px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.35)">' +
      '<div style="font-weight:700;color:#b91c1c;margin-bottom:6px">🚨 אזהרה חמורה — שיבוץ בשני תרגילים חופפים (' +
      timeItems.length + ')</div>' +
      '<p style="font-size:11px;color:var(--muted);margin:0 0 8px">אדם משובץ לשני תרגילים שזמניהם חופפים.</p>' +
      _assignmentConflictsListHtml(timeItems, '') + '</div>';
  }

  if (procItems.length) {
    s += '<div style="padding:10px;border-radius:6px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.35)">' +
      '<div style="font-weight:700;color:#a16207;margin-bottom:6px">⚠ אזהרה — נוה״ק מול תרגיל (' +
      procItems.length + ')</div>' +
      '<p style="font-size:11px;color:var(--muted);margin:0 0 8px">משובץ לתרגיל בזמן שמתקיים נוהל קרב של תרגיל אחר שהוא משובץ אליו.</p>' +
      _assignmentConflictsListHtml(procItems, '') + '</div>';
  }

  if (!total) {
    s += '<div style="color:var(--green);font-size:12px">✓ אין התנגשויות שיבוץ</div>';
  }

  s += '</div></div>';
  return s;
}

function _assignmentConflictsDashboardWidget() {
  const conflicts = AssignmentConflicts_scan();
  const total = conflicts.timeOverlaps.length + conflicts.procedureGaps.length;
  if (!total) return '';

  let s = '<div class="card" style="margin-bottom:16px;border-color:#f87171">' +
    '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<span class="card-title">⚠ התנגשויות שיבוץ</span>' +
    _a('page=assign', 'לוח שיבוץ', 'btn btn-secondary btn-sm') +
    '</div><div class="card-body" style="font-size:13px;line-height:1.6">';
  if (conflicts.timeOverlaps.length) {
    s += '<p style="margin:0 0 6px"><b style="color:#b91c1c">' + conflicts.timeOverlaps.length +
      '</b> אזהרות חמורות — שיבוץ בשני תרגילים חופפים</p>';
  }
  if (conflicts.procedureGaps.length) {
    s += '<p style="margin:0"><b style="color:#a16207">' + conflicts.procedureGaps.length +
      '</b> אזהרות — נוה״ק מול תרגיל</p>';
  }
  s += '</div></div>';
  return s;
}

function _dashboardConflictsTabHtml(sid) {
  const conflicts = AssignmentConflicts_scan();
  let s = _assignmentConflictsPanel(conflicts, { alwaysShow: true });
  s += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
    _a('page=assign&sid=' + encodeURIComponent(sid), '↗ מעבר ללוח שיבוץ', 'btn btn-secondary btn-sm') +
    '</div>';
  return s;
}

function _assignmentConflictsExerciseBanner(exerciseId) {
  const conflicts = AssignmentConflicts_forExercise(exerciseId);
  return _assignmentConflictsPanel(conflicts, { alwaysShow: false });
}
