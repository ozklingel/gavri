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

function _assignmentConflictsTimeCard(timeItems) {
  let s = '<div class="card" style="margin-top:14px' +
    (timeItems.length ? ';border-color:#f87171' : '') + '">';
  s += '<div class="card-header"><div class="card-title">🚨 חניך ב-2 תרגילים במקביל (' +
    timeItems.length + ')</div></div>';
  s += '<div class="card-body" style="font-size:13px">';
  if (timeItems.length) {
    s += '<p style="font-size:11px;color:var(--muted);margin:0 0 10px">אדם משובץ לשני תרגילים שזמניהם חופפים.</p>' +
      _assignmentConflictsListHtml(timeItems, '');
  } else {
    s += '<div style="color:var(--green);font-size:12px">✓ אין התנגשויות מסוג זה</div>';
  }
  s += '</div></div>';
  return s;
}

function _assignmentConflictsProcedureCard(procItems) {
  let s = '<div class="card" style="margin-top:14px' +
    (procItems.length ? ';border-color:#fbbf24' : '') + '">';
  s += '<div class="card-header"><div class="card-title">⚠ תרגיל מול נוה״ק של תרגיל אחר (' +
    procItems.length + ')</div></div>';
  s += '<div class="card-body" style="font-size:13px">';
  if (procItems.length) {
    s += '<p style="font-size:11px;color:var(--muted);margin:0 0 10px">משובץ לתרגיל בזמן שמתקיים נוהל קרב של תרגיל אחר שהוא משובץ אליו.</p>' +
      _assignmentConflictsListHtml(procItems, '');
  } else {
    s += '<div style="color:var(--green);font-size:12px">✓ אין התנגשויות מסוג זה</div>';
  }
  s += '</div></div>';
  return s;
}

/** דף התנגשויות — 2 לשוניות: תרגיל↔תרגיל | תרגיל↔נוה״ק */
function _assignmentConflictsTabsShell(conflicts, sid, opts) {
  opts = opts || {};
  const timeItems = conflicts.timeOverlaps || [];
  const procItems = conflicts.procedureGaps || [];
  const total = timeItems.length + procItems.length;
  if (!total && !opts.alwaysShow) return '';

  const active = (opts.subTab === 'procedure') ? 'procedure' : 'time';

  let s = '<div class="conflicts-page">';
  s += '<nav class="spa-tabs-bar tabs conflicts-local-tabs" aria-label="סוגי התנגשות">';
  s += '<a href="#" class="tab-link' + (active === 'time' ? ' active' : '') +
    '" data-conflicts-tab="time">🚨 חניך ב-2 תרגילים (' + timeItems.length + ')</a>';
  s += '<a href="#" class="tab-link' + (active === 'procedure' ? ' active' : '') +
    '" data-conflicts-tab="procedure">⚠ תרגיל מול נוה״ק (' + procItems.length + ')</a>';
  s += '</nav>';

  s += '<div class="conflicts-tab-panel"' + (active === 'time' ? '' : ' hidden') +
    ' data-conflicts-tab-panel="time">';
  s += _assignmentConflictsTimeCard(timeItems);
  s += '</div>';

  s += '<div class="conflicts-tab-panel"' + (active === 'procedure' ? '' : ' hidden') +
    ' data-conflicts-tab-panel="procedure">';
  s += _assignmentConflictsProcedureCard(procItems);
  s += '</div>';

  if (sid) {
    s += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      _a('page=assign&sid=' + encodeURIComponent(sid), '↗ מעבר ללוח שיבוץ', 'btn btn-secondary btn-sm') +
      '</div>';
  }
  s += '</div>';
  return s;
}

function _assignmentConflictsPanel(conflicts, opts) {
  return _assignmentConflictsTabsShell(conflicts, '', opts);
}

function _assignmentConflictsDashboardWidget() {
  const conflicts = AssignmentConflicts_scan();
  const total = conflicts.timeOverlaps.length + conflicts.procedureGaps.length;
  if (!total) return '';

  let s = '<div class="card" style="margin-bottom:16px;border-color:#f87171">' +
    '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<span class="card-title">⚠ התנגשויות שיבוץ</span>' +
    _a('page=dashboard&tab=conflicts', 'פתח', 'btn btn-secondary btn-sm') +
    '</div><div class="card-body" style="font-size:13px;line-height:1.6">';
  if (conflicts.timeOverlaps.length) {
    s += '<p style="margin:0 0 6px"><b style="color:#b91c1c">' + conflicts.timeOverlaps.length +
      '</b> — חניך ב-2 תרגילים במקביל</p>';
  }
  if (conflicts.procedureGaps.length) {
    s += '<p style="margin:0"><b style="color:#a16207">' + conflicts.procedureGaps.length +
      '</b> — תרגיל מול נוה״ק של תרגיל אחר</p>';
  }
  s += '</div></div>';
  return s;
}

function _dashboardConflictsTabHtml(sid) {
  return _assignmentConflictsTabsShell(AssignmentConflicts_scan(), sid, { alwaysShow: true });
}

function _assignmentConflictsExerciseBanner(exerciseId) {
  const conflicts = AssignmentConflicts_forExercise(exerciseId);
  const total = (conflicts.timeOverlaps || []).length + (conflicts.procedureGaps || []).length;
  if (!total) return '';
  return _assignmentConflictsTabsShell(conflicts, '', { alwaysShow: true });
}
