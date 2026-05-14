// views_dashboard.gs — exercises list + dashboard pages
function Views_exercises(p) {
  const user = Auth_requireRole(p, ['admin']);
  const sid = user.id;
  const sidQ = encodeURIComponent(sid);
  const exs = Exercises_all();

  let s = '<div style="display:flex;gap:20px;flex-wrap:wrap">';

  // ───── רשימת תרגילים ─────
  s += '<div style="flex:2;min-width:300px">';
  s += '<div class="card"><div class="card-header"><div class="card-title">📋 כל התרגילים</div></div>';

  if (!exs.length) {
    s += '<div class="empty">אין תרגילים במערכת</div>';
  } else {
    s += '<table class="tbl"><thead><tr>' +
      '<th>שם</th><th>התחלה</th><th>סיום</th><th style="text-align:left">פעולות</th>' +
      '</tr></thead><tbody>';

    exs.forEach(function(e) {
      s += '<tr>' +
        '<td>' +
          '<div class="ex-title">' + _esc(e.title) + '</div>' +
          '<div class="mono" style="font-size:10px;opacity:0.6">' + e.id + '</div>' +
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
        '<input type="text" name="partner_battalion" class="form-input" placeholder="גדוד שת״פ">' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">מחנה / מגנן</label>' +
        '<input type="text" name="camp" class="form-input" placeholder="מחנה / מגנן">' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label">מפקד אחראי גדוד</label>' +
        '<input type="text" name="battalion_commander" class="form-input" placeholder="מפקד אחראי גדוד">' +
      '</div>' +

      _submitBtn('צור תרגיל', 'btn btn-primary btn-full') +
    '</form>' +
    '</div></div>';

  s += '</div></div>';

  // ───── JS + Flatpickr ─────
  s += `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>

<script>
document.addEventListener("DOMContentLoaded", function () {
  flatpickr(".datepicker", {
    dateFormat: "Y-m-d",
    allowInput: true,
    disableMobile: true
  });
});
</script>
`;

  const body =
    _topbar(user, sid) +
    '<div class="page">' + _flash(p) +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
      '<h1 class="page-title" style="margin:0">🎯 ניהול תרגילים</h1>' +
      _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div>' +
    s +
    '</div>';

  return _html(body, 'ניהול תרגילים');
}
// ── Admin Dashboard ──
function _adminDashboard(sid) {
  const exs = Exercises_all();
  const sidQ = encodeURIComponent(sid);
  const assigns = Assignments_all ? Assignments_all() : [];
  const completed = assigns.filter(a => a.status === 'completed').length;

  let s = '<div class="page">';
  s += '<h1 class="page-title">לוח בקרה מפקד</h1>';

  // שורת סטטיסטיקה
  s += '<div class="grid-3" style="margin-bottom: 24px;">' +
    '<div class="stat-box"><div class="stat-num">' + exs.length + '</div><div class="stat-label">תרגילים פעילים</div></div>' +
    '<div class="stat-box"><div class="stat-num">' + completed + '</div><div class="stat-label">שיבוצים שהושלמו</div></div>' +
    '<div class="stat-box"><div class="stat-num" style="color:var(--green)">ON</div><div class="stat-label">סטטוס מערכת</div></div>' +
    '</div>';

  // ── תפריט פעולות ראשי במרכז המסך ──
  s += '<div style="display:flex;justify-content:center;margin:40px 0">';
s += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:18px;width:100%;max-width:600px">';
  const navBtn = function(query, icon, label) {
    return '<a target="_top" href="' + _esc(_url(query)) + '" ' +
      'style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'gap:10px;padding:32px 16px;background:var(--bg3);border:1px solid var(--border2);' +
      'border-radius:10px;color:var(--text);text-decoration:none;font-family:var(--mono);' +
      'font-size:15px;font-weight:bold;transition:all .15s" ' +
      'onmouseover="this.style.borderColor=\'var(--green)\';this.style.background=\'var(--bg4)\';this.style.color=\'var(--green)\'" ' +
      'onmouseout="this.style.borderColor=\'var(--border2)\';this.style.background=\'var(--bg3)\';this.style.color=\'var(--text)\'">' +
      '<span style="font-size:38px">' + icon + '</span>' +
      '<span>' + label + '</span></a>';
  };

  s += navBtn('page=exercises&sid=' + sidQ, '🎯', 'תרגילים');
  s += navBtn('page=users&sid='     + sidQ, '👤', 'משתמשים');
  s += navBtn('page=timeline&sid='  + sidQ, '📅', 'ציר זמן');
  s += navBtn('page=assign&sid='    + sidQ, '🔀', 'שיבוץ');

  s += '</div></div>';
  s += '</div>';

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