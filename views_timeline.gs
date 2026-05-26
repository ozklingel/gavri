// views_timeline.gs — Compact weekly timeline RTL

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

  if (user.role === 'commander') {

    const myTrainees =
      Users_traineesOfCommander(user.id)
      .map(t => t.id);

    const allAssigns =
      Assignments_all
      ? Assignments_all()
      : [];

    exercises = exercises.filter(ex =>

      ex.created_by === user.id ||

      allAssigns.some(a =>
        a.exercise_id === ex.id &&
        myTrainees.indexOf(a.user_id) !== -1
      )
    );

  } else if (user.role === 'tutor') {

    const tutoredExIds = {};
    (Assignments_byTutor ? Assignments_byTutor(user.id) : []).forEach(function(a) {
      tutoredExIds[a.exercise_id] = true;
    });

    exercises = exercises.filter(function(ex) {
      return !!tutoredExIds[ex.id];
    });

  } else if (user.role === 'trainee') {

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

  // ─────────────────────────────────────
  // Time setup
  // ─────────────────────────────────────

  const nowMs   = Date.now();
  const nowDate = new Date(nowMs);

  const DAY_MS  = 86400000;
  const HOUR_MS = 3600000;

  const dow = nowDate.getDay();

  const weekStart = new Date(nowDate);

  weekStart.setHours(0,0,0,0);
  weekStart.setDate(nowDate.getDate() - dow);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekStartMs = weekStart.getTime();
  const weekEndMs   = weekEnd.getTime();

  // ─────────────────────────────────────
  // Parse exercises
  // ─────────────────────────────────────

  const parsed = exercises.map(ex => {

    let startMs =
      _parseRawDate(ex.rawStartDate);

    let endMs =
      _parseRawDate(
        ex.rawEndDate || ex.rawStartDate
      );

    if (isNaN(startMs)) {
      return null;
    }

    if (isNaN(endMs)) {
      endMs = startMs + DAY_MS;
    }

    if (ex.rawStartTime) {

      const [sh, sm] =
        ex.rawStartTime
        .split(':')
        .map(Number);

      startMs +=
        sh * HOUR_MS +
        sm * 60000;
    }

    if (ex.rawEndTime) {

      const [eh, em] =
        ex.rawEndTime
        .split(':')
        .map(Number);

      endMs =
        _parseRawDate(
          ex.rawEndDate || ex.rawStartDate
        ) +
        eh * HOUR_MS +
        em * 60000;
    }

    return {
      ex,
      startMs,
      endMs
    };

  }).filter(Boolean);

  const weekItems = parsed.filter(item =>

    item.startMs < weekEndMs &&
    item.endMs > weekStartMs
  );

  weekItems.sort((a,b) => a.startMs - b.startMs);

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

  s += '<div class="page-title" style="margin:0">📅 השבוע הקרוב</div>';

  s += '<div style="display:flex;gap:6px">';

  s += _a(
    'page=dashboard&sid=' + sidQ,
    '← לוח בקרה',
    'btn btn-ghost btn-sm'
  );

  s += '</div>';
  s += '</div>';

  // ─────────────────────────────────────
  // Timeline card
  // ─────────────────────────────────────

  s += '<div class="card" style="overflow:hidden;margin-bottom:20px">';

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

  s += '<div style="position:relative;height:' +
       Math.max(320, weekItems.length * 42 + 40) +
       'px;background:var(--bg2)">';

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

    const isToday =
      d === nowDate.getDay();

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

         (isToday
           ? 'background:rgba(74,222,128,0.06);'
           : '') +

         '">' +

         '<div style="font-family:var(--mono);font-size:12px;font-weight:bold;color:' +
         (isToday ? 'var(--green)' : 'var(--text2)') +
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

  // now line RTL

  const nowOffset =
    ((nowMs - weekStartMs) / (7 * DAY_MS)) * 100;

  s += '<div style="' +
       'position:absolute;' +
       'top:42px;' +
       'bottom:0;' +
       'right:' + nowOffset + '%;' +
       'width:2px;' +
       'background:var(--green);' +
       'z-index:30">' +
       '</div>';

  // exercises RTL

  weekItems.forEach((item, idx) => {

    const startPct =
      ((item.startMs - weekStartMs) / (7 * DAY_MS)) * 100;

    const widthPct =
      ((item.endMs - item.startMs) / (7 * DAY_MS)) * 100;

    const topPx =
      52 + idx * 42;

    const color =
      COLORS[idx % COLORS.length];

    const isPast =
      item.endMs < nowMs;

    s += '<a ' + _spaBarLink('exercise', { id: item.ex.id }) + ' style="' +

         'position:absolute;' +
         'top:' + topPx + 'px;' +
         'right:' + startPct + '%;' +
         'width:' + Math.max(widthPct, 2) + '%;' +
         'height:30px;' +

         'background:' + color + '22;' +
         'border:1px solid ' + color + ';' +
         'border-radius:8px;' +

         'padding:4px 6px;' +
         'overflow:hidden;' +
         'text-decoration:none;' +
         'color:var(--text);' +
         'opacity:' + (isPast ? '0.5' : '1') + ';' +
         'z-index:10">' +

         '<div style="' +
         'font-size:11px;' +
         'font-weight:bold;' +
         'white-space:nowrap;' +
         'overflow:hidden;' +
         'text-overflow:ellipsis">' +

         _esc(item.ex.title) +

         '</div>' +

         '</a>';
  });

  s += '</div>';
  s += '</div>';

  // ─────────────────────────────────────
  // Table
  // ─────────────────────────────────────

  s += '<div class="page-title" style="margin-top:10px">📋 כל התרגילים</div>';

  s += '<div class="card" style="padding:0">';

  s += '<table class="tbl">';

  s += '<thead><tr>';

  s += '<th>שם</th>';
  s += '<th>התחלה</th>';
  s += '<th>שעה</th>';
  s += '<th>סיום</th>';
  s += '<th>שעה</th>';
  s += '<th>פתיחה</th>';

  s += '</tr></thead><tbody>';

  parsed
    .sort((a,b) => a.startMs - b.startMs)
    .forEach(item => {

      const ex = item.ex;

      s += '<tr>';

      s += '<td><b>' +
           _esc(ex.title) +
           '</b></td>';

      s += '<td class="mono">' +
           _esc(ex.start_date || '—') +
           '</td>';

      s += '<td class="mono">' +
           _esc(ex.rawStartTime || '—') +
           '</td>';

      s += '<td class="mono">' +
           _esc(ex.end_date || '—') +
           '</td>';

      s += '<td class="mono">' +
           _esc(ex.rawEndTime || '—') +
           '</td>';

      s += '<td>' +

           _a(
             'page=exercise&id=' +
             ex.id +
             '&sid=' + sidQ,
             '↗',
             'btn btn-secondary btn-sm'
           ) +

           '</td>';

      s += '</tr>';
    });

  s += '</tbody></table>';

  s += '</div>';

  s += '</div>';

  return _wrapPage(s, 'ציר זמן');
}