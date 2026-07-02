// views_assignment_conflicts.gs — תצוגת התנגשויות שיבוץ

function _assignmentConflictsListHtml(items, emptyText) {
  if (!items || !items.length) {
    return '<div style="font-size:12px;color:var(--muted)">' + _esc(emptyText) + '</div>';
  }
  let s = '<ul style="margin:0;padding:0 18px 0 0;list-style:disc">';
  items.forEach(function(item) {
    s += '<li style="margin:6px 0;line-height:1.5;font-size:12px">' +
      '<b>' + _esc(item.user_name) + '</b> — ' +
      _esc(item.exercise_a_title) + ' ↔ ' + _esc(item.exercise_b_title);
    if (item.type === 'procedure') {
      s += ' <span class="badge badge-yellow" style="font-size:10px">' +
        item.gap_hours + ' שע׳</span>';
    }
    s += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' +
      _esc(item.exercise_a_label) + '<br>' + _esc(item.exercise_b_label) +
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
    s += '<div style="margin-bottom:12px">' +
      '<div style="font-weight:600;color:#f87171;margin-bottom:6px">⏱ התנגשות תרגיל — חפיפה בזמן (' +
      timeItems.length + ')</div>' +
      _assignmentConflictsListHtml(timeItems, '') + '</div>';
  }

  if (procItems.length) {
    s += '<div>' +
      '<div style="font-weight:600;color:var(--yellow);margin-bottom:6px">⚔ התנגשות נוהל קרב — פחות מ-5 שעות (' +
      procItems.length + ')</div>' +
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
    s += '<p style="margin:0 0 6px"><b style="color:#f87171">' + conflicts.timeOverlaps.length +
      '</b> חפיפות זמן בין תרגילים</p>';
  }
  if (conflicts.procedureGaps.length) {
    s += '<p style="margin:0"><b style="color:var(--yellow)">' + conflicts.procedureGaps.length +
      '</b> מרווחי נוהל קרב קצרים מ-5 שעות</p>';
  }
  s += '</div></div>';
  return s;
}

function _assignmentConflictsExerciseBanner(exerciseId) {
  const conflicts = AssignmentConflicts_forExercise(exerciseId);
  return _assignmentConflictsPanel(conflicts, { alwaysShow: false });
}
