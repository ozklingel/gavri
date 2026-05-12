// views_timeline.gs — Gantt timeline
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
      '<div class="page">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
      '<div class="page-title" style="margin:0">📅 ציר זמן תרגילים</div>' +
      _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm') +
      '</div>' +
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
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
       '<div class="page-title" style="margin:0">📅 ציר זמן תרגילים</div>' +
       _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm') +
       '</div>';
  
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
