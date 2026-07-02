// views_timeline.gs — Weekly timeline RTL + week picker + edit mode (admin)

function _timelineWeekOffset(p) {
  let w = parseInt(p && p.week != null ? p.week : 0, 10);
  if (isNaN(w)) w = 0;
  if (w < -3) w = -3;
  if (w > 3) w = 3;
  return w;
}

function _timelineWeekLabel(offset) {
  if (offset === 0) return 'השבוע הנוכחי';
  if (offset > 0) return offset === 1 ? 'שבוע קדימה' : offset + ' שבועות קדימה';
  const n = -offset;
  return n === 1 ? 'שבוע אחורה' : n + ' שבועות אחורה';
}

function _timelineParseExercise(ex) {
  const DAY_MS  = 86400000;
  const HOUR_MS = 3600000;
  let startMs = _parseRawDate(ex.rawStartDate);
  let endMs = _parseRawDate(ex.rawEndDate || ex.rawStartDate);
  if (isNaN(startMs)) return null;
  if (isNaN(endMs)) endMs = startMs + DAY_MS;
  if (ex.rawStartTime) {
    const parts = ex.rawStartTime.split(':').map(Number);
    startMs += parts[0] * HOUR_MS + (parts[1] || 0) * 60000;
  }
  if (ex.rawEndTime) {
    const parts = ex.rawEndTime.split(':').map(Number);
    endMs = _parseRawDate(ex.rawEndDate || ex.rawStartDate) +
      parts[0] * HOUR_MS + (parts[1] || 0) * 60000;
  }
  if (endMs <= startMs) endMs = startMs + HOUR_MS;
  return { ex: ex, startMs: startMs, endMs: endMs };
}

function _timelineAttrEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function _timelineNormalizeType(ex) {
  const t = String(ex.exercise_type || '').replace(/״/g, '').trim();
  if (t === '900' || t.indexOf('900') !== -1) return '900';
  if (t.indexOf('חשן') !== -1) return 'חשן';
  if (t.indexOf('חיר') !== -1 || t.indexOf('חי') !== -1) return 'חיר';
  return 'אחר';
}

var TIMELINE_TYPE_LANES = {
  'חיר': 0,
  'חשן': 1,
  '900': 2
};

var TIMELINE_TYPE_COLORS = {
  'חיר': '#4ade80',
  'חשן': '#60a5fa',
  '900': '#fbbf24',
  'אחר': '#c084fc'
};

function _timelineMsToHmLocal(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _timelineMsToYmdLocal(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _timelineWeekTableRowsHtml(items, sidQ) {
  let s = '';
  items.forEach(function(item) {
    const ex = item.ex;
    const typeKey = item.typeKey || _timelineNormalizeType(ex);
    const startYmd = _timelineMsToYmdLocal(item.startMs);
    const endYmd = _timelineMsToYmdLocal(item.endMs);
    const startHm = _timelineMsToHmLocal(item.startMs);
    const endHm = _timelineMsToHmLocal(item.endMs);
    s += '<tr data-exercise-id="' + _timelineAttrEsc(ex.id) + '">' +
      '<td>' + _badge(typeKey, typeKey === 'חיר' ? 'green' : typeKey === 'חשן' ? 'blue' : 'yellow') + '</td>' +
      '<td><b>' + _esc(ex.title) + '</b></td>' +
      '<td class="mono">' + _esc(startYmd) + '</td>' +
      '<td class="mono">' + _esc(startHm) + '</td>' +
      '<td class="mono">' + _esc(endYmd) + '</td>' +
      '<td class="mono">' + _esc(endHm) + '</td>' +
      '<td><a href="#" data-spa-page="exercise"' + _spaParamsAttr({ id: ex.id }) +
      ' class="btn btn-secondary btn-sm">↗</a></td></tr>';
  });
  if (!items.length) {
    s += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">אין תרגילים בשבוע זה</td></tr>';
  }
  return s;
}

function _timelineAssignTypeLanes(items) {
  let maxLane = 2;
  items.forEach(function(item) {
    const typeKey = _timelineNormalizeType(item.ex);
    item.typeKey = typeKey;
    if (TIMELINE_TYPE_LANES.hasOwnProperty(typeKey)) {
      item.lane = TIMELINE_TYPE_LANES[typeKey];
    } else {
      item.lane = 3;
      if (item.lane > maxLane) maxLane = item.lane;
    }
  });
  return maxLane;
}

function Views_timeline(p) {

  const user = Auth_current(p);

  if (!user) {
    return Views_login({ error: 'נדרשת התחברות.' });
  }
 
  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);

  let exercises = Exercises_all();

  // ─────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────

  if (Roles_isCompanyCommander(user.role)) {

    const traineeIds = Users_traineesOfCommander(user.id).map(function(t) {
      return t.id;
    });
    const teamExerciseIds = {};
    (Assignments_all ? Assignments_all() : []).forEach(function(a) {
      if (traineeIds.indexOf(a.user_id) !== -1) {
        teamExerciseIds[a.exercise_id] = true;
      }
    });
    exercises = exercises.filter(function(ex) {
      return !!teamExerciseIds[ex.id];
    });

  } else if (Roles_isTutor(user.role)) {

    const tutoredExIds = {};
    (Assignments_byTutor ? Assignments_byTutor(user.id) : []).forEach(function(a) {
      tutoredExIds[a.exercise_id] = true;
    });

    exercises = exercises.filter(function(ex) {
      return !!tutoredExIds[ex.id];
    });

  } else if (Roles_isTrainee(user.role)) {

    const myAssigns =
      Assignments_byUser
      ? Assignments_byUser(user.id)
      : [];

    const myExIds =
      myAssigns.map(a => a.exercise_id);

    exercises = exercises.filter(ex =>
      myExIds.indexOf(ex.id) !== -1
    );
  }

  const weekOffset = _timelineWeekOffset(p);
  const canEdit = Roles_hasAdminAccess(user.role);

  const nowMs   = Date.now();
  const nowDate = new Date(nowMs);
  const DAY_MS  = 86400000;

  const baseWeek = new Date(nowDate);
  baseWeek.setHours(0, 0, 0, 0);
  baseWeek.setDate(nowDate.getDate() - nowDate.getDay());

  const weekStart = new Date(baseWeek);
  weekStart.setDate(baseWeek.getDate() + weekOffset * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekStartMs = weekStart.getTime();
  const weekEndMs   = weekEnd.getTime();

  const parsed = exercises.map(_timelineParseExercise).filter(Boolean);

  const weekItems = parsed.filter(item =>

    item.startMs < weekEndMs &&
    item.endMs > weekStartMs
  );

  const maxLane = _timelineAssignTypeLanes(weekItems);
  weekItems.sort(function(a, b) {
    if (a.lane !== b.lane) return a.lane - b.lane;
    return a.startMs - b.startMs;
  });

  // ─────────────────────────────────────
  // UI
  // ─────────────────────────────────────

  const DAY_LABELS = [
    'א׳',
    'ב׳',
    'ג׳',
    'ד׳',
    'ה׳',
    'ו׳',
    'ש׳'
  ];

  const COLORS = [
    '#4ade80',
    '#22c55e',
    '#60a5fa',
    '#fbbf24',
    '#f87171',
    '#c084fc',
    '#fb923c',
    '#a78bfa'
  ];

  // ─────────────────────────────────────
  // Page
  // ─────────────────────────────────────

  let s = _topbar(user, sid);

  s += '<div class="page">';

  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';

  s += '<div class="page-title" style="margin:0">📅 ציר זמן — ' + _esc(_timelineWeekLabel(weekOffset)) + '</div>';

  s += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';

  if (weekOffset > -3) {
    s += '<a href="#" class="btn btn-secondary btn-sm" data-spa-page="timeline"' +
      _spaParamsAttr({ week: weekOffset - 1 }) + '>שבוע →</a>';
  }
  if (weekOffset < 3) {
    s += '<a href="#" class="btn btn-secondary btn-sm" data-spa-page="timeline"' +
      _spaParamsAttr({ week: weekOffset + 1 }) + '>← שבוע</a>';
  }
  if (weekOffset !== 0) {
    s += '<a href="#" class="btn btn-ghost btn-sm" data-spa-page="timeline"' +
      _spaParamsAttr({ week: 0 }) + '>היום</a>';
  }

  s += '<select id="timelineWeekSelect" class="form-select" style="width:auto;min-width:150px;font-size:12px">';
  for (let w = -3; w <= 3; w++) {
    s += '<option value="' + w + '"' + (w === weekOffset ? ' selected' : '') + '>' +
      _esc(_timelineWeekLabel(w)) + '</option>';
  }
  s += '</select>';

  if (canEdit) {
    s += '<button type="button" id="timelineEditToggle" class="btn btn-ghost btn-sm">✏ מצב עריכה</button>';
  }

  s += _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm');
  s += '</div>';
  s += '</div>';

  // ─────────────────────────────────────
  // Timeline card
  // ─────────────────────────────────────

  s += '<div class="card" style="overflow:hidden;margin-bottom:20px" id="timelineWeekCard">';

  const wStartFmt =
    weekStart.getDate() +
    '/' +
    (weekStart.getMonth()+1);

  const wEndDate =
    new Date(weekEndMs - 1);

  const wEndFmt =
    wEndDate.getDate() +
    '/' +
    (wEndDate.getMonth()+1);

  s += '<div style="padding:10px 14px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:12px;color:var(--text2)">';

  s += '📅 ' +
       wStartFmt +
       ' – ' +
       wEndFmt +
       ' &nbsp;|&nbsp; ' +
       weekItems.length +
       ' תרגילים';

  s += '</div>';

  // ─────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────

  const rowCount = maxLane + 1;
  const trackH = Math.max(200, 52 + rowCount * 44 + 12);

  s += '<div id="timelineTrack" class="timeline-track" style="position:relative;height:' +
       trackH + 'px;background:var(--bg2);padding-right:36px' +
       ' data-week-start="' + weekStartMs + '"' +
       ' data-week-end="' + weekEndMs + '"' +
       ' data-week-offset="' + weekOffset + '"' +
       ' data-sid-q="' + _timelineAttrEsc(sidQ) + '"' +
       ' data-can-edit="' + (canEdit ? '1' : '0') + '">';

  const rowLabels = [
    { lane: 0, label: 'חי״ר' },
    { lane: 1, label: 'חשן' },
    { lane: 2, label: '900' }
  ];
  rowLabels.forEach(function(row) {
    s += '<div class="timeline-row-label" style="position:absolute;right:4px;top:' +
      (52 + row.lane * 44 + 8) + 'px;font-family:var(--mono);font-size:10px;color:var(--muted);' +
      'z-index:5;pointer-events:none">' + row.label + '</div>';
  });

  // vertical day lines RTL

  for (let d = 0; d <= 7; d++) {

    const rightPct = (d / 7) * 100;

    s += '<div style="' +
         'position:absolute;' +
         'top:0;' +
         'bottom:0;' +
         'right:' + rightPct + '%;' +
         'width:1px;' +
         'background:var(--border)">' +
         '</div>';
  }

  // day headers RTL

  for (let d = 0; d < 7; d++) {

    const dayStart =
      weekStartMs + d * DAY_MS;

    const dayDate =
      new Date(dayStart);

    const dayMs = weekStartMs + d * DAY_MS;
    const isTodayDay =
      weekOffset === 0 &&
      nowMs >= dayMs &&
      nowMs < dayMs + DAY_MS;

    s += '<div style="' +
         'position:absolute;' +
         'top:0;' +
         'right:' + ((d / 7) * 100) + '%;' +
         'width:' + (100 / 7) + '%;' +
         'height:42px;' +
         'border-bottom:1px solid var(--border);' +
         'display:flex;' +
         'flex-direction:column;' +
         'align-items:center;' +
         'justify-content:center;' +

         (isTodayDay
           ? 'background:rgba(74,222,128,0.06);'
           : '') +

         '">' +

         '<div style="font-family:var(--mono);font-size:12px;font-weight:bold;color:' +
         (isTodayDay ? 'var(--green)' : 'var(--text2)') +
         '">' +

         DAY_LABELS[d] +

         '</div>' +

         '<div style="font-family:var(--mono);font-size:10px;color:var(--muted)">' +

         dayDate.getDate() +
         '/' +
         (dayDate.getMonth()+1) +

         '</div>' +

         '</div>';
  }

  if (weekOffset === 0 && nowMs >= weekStartMs && nowMs < weekEndMs) {
    const nowOffset = ((nowMs - weekStartMs) / (7 * DAY_MS)) * 100;
    s += '<div class="timeline-now" style="' +
         'position:absolute;top:42px;bottom:0;right:' + nowOffset + '%;width:2px;' +
         'background:var(--green);z-index:30"></div>';
  }

  weekItems.forEach(function(item, idx) {
    const startPct = ((item.startMs - weekStartMs) / (7 * DAY_MS)) * 100;
    const widthPct = ((item.endMs - item.startMs) / (7 * DAY_MS)) * 100;
    const topPx = 52 + (item.lane || 0) * 44;
    const color = TIMELINE_TYPE_COLORS[item.typeKey] || COLORS[idx % COLORS.length];
    const isPast = item.endMs < nowMs;
    const exId = String(item.ex.id);
    const barDomId = 'tl-bar-' + exId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const barStyle =
      'position:absolute;top:' + topPx + 'px;right:' + startPct + '%;' +
      'width:' + Math.max(widthPct, 1.5) + '%;height:32px;' +
      'background:' + color + '22;border:1px solid ' + color + ';border-radius:8px;' +
      'padding:0 6px;overflow:hidden;color:var(--text);opacity:' + (isPast ? '0.55' : '1') + ';' +
      'z-index:' + (10 + (item.lane || 0)) + ';display:flex;align-items:center;box-sizing:border-box';

    const dataAttrs =
      ' id="' + _timelineAttrEsc(barDomId) + '"' +
      ' data-tl-bar="1" data-exercise-id="' + _timelineAttrEsc(exId) + '"' +
      ' data-exercise-type="' + _timelineAttrEsc(item.typeKey || '') + '"' +
      ' data-lane="' + (item.lane || 0) + '"' +
      ' data-start-ms="' + item.startMs + '" data-end-ms="' + item.endMs + '"';

    if (canEdit) {
      s += '<div class="tl-bar"' + dataAttrs + ' style="' + barStyle + '">' +
        '<span class="tl-handle tl-handle-start" title="שינוי התחלה"></span>' +
        '<span class="tl-bar-label" style="flex:1;font-size:11px;font-weight:bold;white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis;text-align:center">' + _esc(item.ex.title) + '</span>' +
        '<span class="tl-handle tl-handle-end" title="שינוי סיום"></span>' +
        '</div>';
    } else {
      s += '<a class="tl-bar tl-bar-link"' + dataAttrs + ' ' + _spaBarLink('exercise', { id: item.ex.id }) +
        ' style="' + barStyle + 'text-decoration:none">' +
        '<span class="tl-bar-label" style="font-size:11px;font-weight:bold;white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis">' + _esc(item.ex.title) + '</span></a>';
    }
  });

  s += '</div>';

  if (canEdit) {
    s += '<div id="timelineEditHint" style="display:none;padding:8px 14px;border-top:1px solid var(--border);' +
      'font-size:11px;color:var(--muted);font-family:var(--mono)">' +
      'מצב עריכה: גרור להזזה · ידית ימין = התחלה · ידית שמאל = סיום (RTL)</div>';
  }

  s += '</div>';

  s += '<div class="page-title" style="margin-top:10px">📋 תרגילים בשבוע זה</div>';

  s += '<div class="card" style="padding:0" id="timelineWeekTableCard">';

  s += '<table class="tbl" id="timelineWeekTable">';

  s += '<thead><tr>';

  s += '<th>סוג</th>';
  s += '<th>שם</th>';
  s += '<th>התחלה</th>';
  s += '<th>שעה</th>';
  s += '<th>סיום</th>';
  s += '<th>שעה</th>';
  s += '<th>פתיחה</th>';

  s += '</tr></thead><tbody id="timelineWeekTableBody">';

  s += _timelineWeekTableRowsHtml(weekItems, sidQ);

  s += '</tbody></table>';

  s += '</div>';

  s += '</div>';

  return _wrapPage(s, 'ציר זמן');
}