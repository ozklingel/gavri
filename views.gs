// ═══════════════════════════════════════
//  views.gs — HTML rendering בעברית, סגנון צה"ל ירוק
//  HTML טהור: ללא CSS, ללא JS. רק תגיות, טבלאות, צבעים בתגיות.
// ═══════════════════════════════════════

function _appUrl() {
  const url = ScriptApp.getService().getUrl();
  return url || '';
}

function _url(query) {
  const base = _appUrl();
  return (base ? base : '') + (query ? '?' + query : '');
}

function _link(query, label) {
  return '<a target="_top" href="' + _esc(_url(query)) + '"><font color="#9fd66e"><b>[ ' + label + ' ]</b></font></a>';
}

function _formOpen() {
  return '<form action="' + _esc(_appUrl()) + '" method="get" target="_top">';
}

function _btn(label) {
  return '<button type="submit" style="background:#4B5320;color:#fff;border:2px solid #9fd66e;padding:6px 18px;font-family:Courier New,monospace;font-weight:bold;cursor:pointer">► ' + label + '</button>';
}

function _panel(title, inner) {
  return '<table width="100%" cellpadding="12" cellspacing="0" border="2" bordercolor="#4B5320" bgcolor="#0f1f0f">' +
         '<tr><td bgcolor="#2a3a2a"><font color="#9fd66e" face="Courier New, monospace" size="3"><b>▌ ' + title + '</b></font></td></tr>' +
         '<tr><td>' + inner + '</td></tr></table><br>';
}

function _tableOpen(headers) {
  let s = '<table width="100%" cellpadding="8" cellspacing="0" border="1" bordercolor="#4B5320" bgcolor="#1a2a1a">' +
          '<tr bgcolor="#2a3a2a">';
  headers.forEach(h => { s += '<th><font color="#9fd66e" face="Courier New, monospace">' + h + '</font></th>'; });
  return s + '</tr>';
}

function _html(body, title) {
  const template = HtmlService.createTemplateFromFile('index');
  template.pageTitle = title || 'צה״ל — תרגילי אימון';
  template.body = body;
  return template.evaluate()
    .setTitle(title || 'צה״ל — תרגילי אימון')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// תרגום תפקידים
function _roleHe(r) {
  return r === 'admin' ? 'מפקד קורס' : r === 'commander' ? 'מפקד צוות' : r === 'trainee' ? 'חניך' : r;
}
function _statusHe(s) {
  return s === 'completed' ? 'הושלם' : s === 'pending' ? 'ממתין' : s === 'in_progress' ? 'בביצוע' : s;
}

function _nav(user, sid) {
  if (!user) return '';
  let nav = '<table width="100%" cellpadding="8" cellspacing="0" border="0" bgcolor="#2a3a2a"><tr><td>' +
            '<font face="Courier New, monospace" color="#d4e8c4">' +
            '👤 מחובר: <b><font color="#9fd66e">' + _esc(user.name) + '</font></b> ' +
            '(<i>' + _esc(_roleHe(user.role)) + '</i>) ' +
            '</font></td><td align="left">' +
            _link('page=dashboard&sid=' + encodeURIComponent(sid), 'לוח בקרה');
  if (user.role === 'admin') {
    nav += '&nbsp;' + _link('page=users&sid=' + encodeURIComponent(sid), 'ניהול משתמשים');
  }
  nav += '&nbsp;' + _link('action=logout', 'התנתקות') + '</td></tr></table><br>';
  return nav;
}

function _flash(p) {
  let s = '';
  if (p && p.error) s += '<table width="100%" bgcolor="#5a1a1a" cellpadding="10" border="2" bordercolor="#ff6666"><tr><td><font color="#ffcccc"><b>⚠ שגיאה:</b> ' + _esc(p.error) + '</font></td></tr></table><br>';
  if (p && p.info)  s += '<table width="100%" bgcolor="#1a4a1a" cellpadding="10" border="2" bordercolor="#9fd66e"><tr><td><font color="#d4e8c4"><b>✓</b> ' + _esc(p.info) + '</font></td></tr></table><br>';
  return s;
}

function Views_error(msg, p) {
  const sid = (p && p.sid) ? p.sid : '';
  const back = sid
    ? '<p>' + _link('page=dashboard&sid=' + encodeURIComponent(sid), 'חזרה ללוח הבקרה') + '</p>'
    : '<p>' + _link('page=login', 'חזרה למסך התחברות') + '</p>';
  return _html('<h2><font color="#ff6666">⚠ שגיאה</font></h2><p>' + _esc(msg) + '</p>' + back, 'שגיאה');
}

// ─────────── התחברות ───────────
function Views_login(p) {
  const form =
    _formOpen() +
    '<input type="hidden" name="action" value="login">' +
    '<p><font color="#9fd66e"><b>מספר אישי:</b></font><br>' +
    '<input type="text" name="userId" required size="30" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Courier New,monospace;font-size:14px"></p>' +
    '<p><font color="#9fd66e"><b>סיסמה:</b></font><br>' +
    '<input type="password" name="password" required size="30" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Courier New,monospace;font-size:14px"></p>' +
    '<p>' + _btn('כניסה למערכת') + '</p>' +
    '</form>';

  const body =
    '<center>' +
    '<table width="500" cellpadding="0" cellspacing="0" border="0"><tr><td>' +
    '<h1 align="center"><font color="#9fd66e" face="Courier New, monospace">🔒 התחברות מאובטחת</font></h1>' +
    '<p align="center"><font color="#7fb84e" face="Courier New, monospace" size="2">// AUTHORIZED PERSONNEL ONLY //</font></p>' +
    _flash(p) +
    _panel('כניסה למערכת', form) +
    _panel('משתמשי דמו', 
      '<font face="Courier New, monospace" color="#d4e8c4">' +
      '<b>מפקד קורס:</b> U001 / admin123<br>' +
      '<b>מפקד צוות:</b> U002 / cmd123<br>' +
      '<b>חניך:</b> U003 / train123' +
      '</font>') +
    '</td></tr></table>' +
    '</center>';
  return _html(body, 'התחברות');
}

// ─────────── לוח בקרה ───────────
function Views_dashboard(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;

  let body = _nav(user, sid) + _flash(p) +
             '<h1><font color="#9fd66e">▌ לוח בקרה</font></h1>';

  if (user.role === 'admin')          body += _adminDashboard(sid);
  else if (user.role === 'commander') body += _commanderDashboard(user, sid);
  else                                body += _traineeDashboard(user, sid);

  return _html(body, 'לוח בקרה');
}

function _datalistResp() {
  return '<datalist id="respList">' +
         '<option value="מפקד">' +
         '<option value="נווט">' +
         '<option value="חובש">' +
         '<option value="קשר">' +
         '<option value="צלף">' +
         '<option value="נהג">' +
         '<option value="לוחם">' +
         '<option value="תצפיתן">' +
         '<option value="לוגיסטיקה">' +
         '</datalist>';
}

function _adminDashboard(sid) {
  const exs = Exercises_all();
  const users = Users_all();
  const sidQ = encodeURIComponent(sid);

  // טבלת תרגילים
  let table = _tableOpen(['מזהה', 'שם התרגיל', 'תאריך', 'פעולות']);
  exs.forEach(e => {
    table += '<tr><td><font face="Courier New, monospace" color="#9fd66e">' + _esc(e.id) + '</font></td>' +
             '<td><b>' + _esc(e.title) + '</b></td>' +
             '<td>' + _esc(e.date) + '</td>' +
             '<td>' +
               _link('page=exercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ, 'צפייה / עריכה') + '&nbsp;' +
               _link('action=duplicateExercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ, 'שכפול') +
             '</td></tr>';
  });
  table += '</table>';
  let s = _panel('כל התרגילים (' + exs.length + ')', table);

  // יצירת תרגיל
  s += _panel('יצירת תרגיל חדש',
    _formOpen() +
    '<input type="hidden" name="action" value="createExercise">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<p><b>שם התרגיל:</b><br><input name="title" required size="50" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Arial"></p>' +
    '<p><b>תיאור:</b><br><input name="description" size="60" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Arial"></p>' +
    '<p><b>תאריך:</b><br><input type="date" name="date" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
    '<p>' + _btn('צור תרגיל') + '</p></form>');

  // הקצאת תרגיל
  s += _panel('הקצאת תרגיל לחייל',
    _formOpen() +
    '<input type="hidden" name="action" value="assign">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<p><b>תרגיל:</b><br><select name="exerciseId" required style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Arial">' +
       exs.map(e => '<option value="' + _esc(e.id) + '">' + _esc(e.id + ' — ' + e.title) + '</option>').join('') +
    '</select></p>' +
    '<p><b>חייל:</b><br><select name="userId" required style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Arial">' +
       users.map(u => '<option value="' + _esc(u.id) + '">' + _esc(u.id + ' — ' + u.name + ' (' + _roleHe(u.role) + ')') + '</option>').join('') +
    '</select></p>' +
    '<p><b>תפקיד באירוע:</b><br><input name="responsibility" list="respList" required placeholder="לדוגמה: חובש, צלף, מפקד..." size="40" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px;font-family:Arial"></p>' +
    _datalistResp() +
    '<p>' + _btn('הקצה תרגיל') + '</p></form>');

  return s;
}

function _commanderDashboard(user, sid) {
  const trainees = Users_traineesOfCommander(user.id);
  const exs = Exercises_all();
  const sidQ = encodeURIComponent(sid);

  if (!trainees.length) return _panel('הצוות שלי', '<p><i>אין חיילים מוקצים לצוות שלך עדיין.</i></p>');

  let s = '';
  trainees.forEach(t => {
    const assigns = Assignments_byUser(t.id);
    let inner = '';
    if (!assigns.length) {
      inner += '<p><i>אין תרגילים מוקצים.</i></p>';
    } else {
      inner += _tableOpen(['מזהה', 'תרגיל', 'תפקיד', 'סטטוס', 'פעולה']);
      assigns.forEach(a => {
        const ex = Exercises_get(a.exercise_id);
        inner += '<tr><td><font face="Courier New, monospace">' + _esc(a.id) + '</font></td>' +
                 '<td>' + _esc(ex ? ex.title : a.exercise_id) + '</td>' +
                 '<td><b>' + _esc(a.responsibility) + '</b></td>' +
                 '<td>' + _esc(_statusHe(a.status)) + '</td><td>';
        if (a.status !== 'completed') {
          inner += _link('action=complete&assignmentId=' + encodeURIComponent(a.id) + '&sid=' + sidQ, 'סמן כהושלם');
        } else inner += '<font color="#9fd66e" size="4">✓</font>';
        inner += '</td></tr>';
      });
      inner += '</table>';
    }
    inner += '<br><b>הקצאת תרגיל חדש:</b><br>' +
             _formOpen() +
             '<input type="hidden" name="action" value="assign">' +
             '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
             '<input type="hidden" name="userId" value="' + _esc(t.id) + '">' +
             'תרגיל: <select name="exerciseId" required style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:4px">' +
               exs.map(e => '<option value="' + _esc(e.id) + '">' + _esc(e.title) + '</option>').join('') +
             '</select> ' +
             'תפקיד: <input name="responsibility" list="respList" required placeholder="לדוגמה: חובש" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:4px"> ' +
             _btn('הקצה');
    inner += '</form>';

    s += _panel('🪖 ' + _esc(t.name) + ' &nbsp; (' + _esc(t.id) + ')', inner);
  });

  s += _datalistResp();
  return s;
}

function _traineeDashboard(user, sid) {
  const sidQ = encodeURIComponent(sid);
  const assigns = Assignments_byUser(user.id);
  if (!assigns.length) return _panel('התרגילים שלי', '<p><i>אין תרגילים מוקצים עדיין.</i></p>');

  let table = _tableOpen(['תרגיל', 'תפקיד', 'סטטוס', 'ציון', 'פרטים']);
  assigns.forEach(a => {
    const ex = Exercises_get(a.exercise_id);
    table += '<tr><td><b>' + _esc(ex ? ex.title : a.exercise_id) + '</b></td>' +
             '<td><font color="#9fd66e">' + _esc(a.responsibility) + '</font></td>' +
             '<td>' + _esc(_statusHe(a.status)) + '</td>' +
             '<td>' + _esc(a.score) + '</td>' +
             '<td>' + _link('page=exercise&id=' + encodeURIComponent(a.exercise_id) + '&sid=' + sidQ, 'צפייה') + '</td></tr>';
  });
  table += '</table>';
  return _panel('התרגילים המוקצים שלי', table);
}

// ─────────── דף תרגיל ───────────
function Views_exercise(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const ex  = Exercises_get(p.id);
  if (!ex) return Views_error('התרגיל לא נמצא.', p);

  let s = _nav(user, sid) + _flash(p) +
          '<h1><font color="#9fd66e">▌ ' + _esc(ex.title) + '</font></h1>' +
          _panel('פרטי התרגיל',
            '<p><b>מזהה:</b> <font face="Courier New, monospace" color="#9fd66e">' + _esc(ex.id) + '</font> ' +
            '&nbsp;&nbsp; <b>תאריך:</b> ' + _esc(ex.date) + '</p>' +
            '<p><b>תיאור:</b><br>' + _esc(ex.description) + '</p>');

  // ציר זמן
  const details = Exercises_details(ex.id);
  let timeline;
  if (details.length) {
    timeline = _tableOpen(['שעה', 'מיקום', 'תיאור']);
    details.forEach(d => {
      timeline += '<tr><td><font face="Courier New, monospace" color="#9fd66e">' + _esc(d.time) + '</font></td>' +
                  '<td>' + _esc(d.location) + '</td>' +
                  '<td>' + _esc(d.description) + '</td></tr>';
    });
    timeline += '</table>';
  } else timeline = '<p><i>אין רישומים בציר הזמן.</i></p>';
  s += _panel('🕐 ציר זמן', timeline);

  // משתתפים
  const parts = Assignments_byExercise(ex.id);
  let pHtml;
  if (parts.length) {
    pHtml = _tableOpen(['חייל', 'תפקיד', 'סטטוס', 'ציון']);
    parts.forEach(a => {
      const u = Users_get(a.user_id);
      pHtml += '<tr><td><b>' + _esc(u ? u.name : a.user_id) + '</b></td>' +
               '<td><font color="#9fd66e">' + _esc(a.responsibility) + '</font></td>' +
               '<td>' + _esc(_statusHe(a.status)) + '</td>' +
               '<td>' + _esc(a.score) + '</td></tr>';
    });
    pHtml += '</table>';
  } else pHtml = '<p><i>אין משתתפים מוקצים.</i></p>';
  s += _panel('👥 משתתפים (' + parts.length + ')', pHtml);

  if (user.role === 'admin') {
    s += _panel('✏ עריכת תרגיל',
      _formOpen() +
      '<input type="hidden" name="action" value="editExercise">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="id" value="' + _esc(ex.id) + '">' +
      '<p><b>שם התרגיל:</b><br><input name="title" value="' + _esc(ex.title) + '" required size="50" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
      '<p><b>תיאור:</b><br><input name="description" size="60" value="' + _esc(ex.description) + '" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
      '<p><b>תאריך:</b><br><input type="date" name="date" value="' + _esc(ex.date) + '" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
      '<p>' + _btn('שמור שינויים') + '</p></form>');

    s += _panel('➕ הוספת רישום לציר זמן',
      _formOpen() +
      '<input type="hidden" name="action" value="addDetail">' +
      '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
      '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
      '<p><b>שעה:</b> <input name="time" placeholder="08:00" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
      '<p><b>מיקום:</b> <input name="location" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
      '<p><b>תיאור:</b><br><input name="detailDescription" size="60" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:6px"></p>' +
      '<p>' + _btn('הוסף רישום') + '</p></form>');
  }

  return _html(s, ex.title);
}

// ─────────── ניהול משתמשים ───────────
function Views_users(p) {
  const user = Auth_current(p);
  if (!user || user.role !== 'admin') return Views_error('גישה למפקדי קורס בלבד.', p);
  const sid = user.id;
  const users = Users_all();

  let table = _tableOpen(['מספר אישי', 'שם', 'תפקיד', 'צוות', 'עדכון']);
  users.forEach(u => {
    table += '<tr><td><font face="Courier New, monospace" color="#9fd66e">' + _esc(u.id) + '</font></td>' +
             '<td><b>' + _esc(u.name) + '</b></td>' +
             '<td>' + _esc(_roleHe(u.role)) + '</td>' +
             '<td>' + _esc(u.team_id) + '</td><td>' +
             _formOpen() +
             '<input type="hidden" name="action" value="updateRole">' +
             '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
             '<input type="hidden" name="targetId" value="' + _esc(u.id) + '">' +
             '<select name="newRole" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:4px">' +
               [['admin','מפקד קורס'],['commander','מפקד צוות'],['trainee','חניך']].map(r =>
                 '<option value="' + r[0] + '"' + (r[0] === u.role ? ' selected' : '') + '>' + r[1] + '</option>').join('') +
             '</select> ' +
             'צוות: <input name="newTeam" value="' + _esc(u.team_id) + '" size="6" style="background:#0a1a0a;color:#9fd66e;border:2px solid #4B5320;padding:4px"> ' +
             _btn('שמור') +
             '</form></td></tr>';
  });
  table += '</table>';

  const body = _nav(user, sid) + _flash(p) +
               '<h1><font color="#9fd66e">▌ ניהול משתמשים ותפקידים</font></h1>' +
               _panel('כל המשתמשים במערכת (' + users.length + ')', table);
  return _html(body, 'ניהול משתמשים');
}
