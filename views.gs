// ═══════════════════════════════════════
//  views.gs — HTML rendering (pure HTML, no JS, no CSS)
//  Every form uses GET so navigation stays inside the iframe.
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
  return '<a target="_top" href="' + _esc(_url(query)) + '">' + label + '</a>';
}

function _formOpen() {
  return '<form action="' + _esc(_appUrl()) + '" method="get" target="_top">';
}

function _html(body, title) {
  const template = HtmlService.createTemplateFromFile('index');
  template.pageTitle = title || 'Military Training';
  template.body = body;
  return template.evaluate()
    .setTitle(title || 'Military Training')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _nav(user, sid) {
  if (!user) return '';
  let nav = '<p>Logged in as <b>' + _esc(user.name) + '</b> (' + _esc(user.role) + ') &nbsp;|&nbsp; ' +
            _link('page=dashboard&sid=' + encodeURIComponent(sid), 'Dashboard');
  if (user.role === 'admin') {
    nav += ' | ' + _link('page=users&sid=' + encodeURIComponent(sid), 'User Roles');
  }
  nav += ' | ' + _link('action=logout', 'Logout') + '</p><hr>';
  return nav;
}

function _flash(p) {
  let s = '';
  if (p && p.error) s += '<p><b>Error:</b> ' + _esc(p.error) + '</p>';
  if (p && p.info)  s += '<p><i>' + _esc(p.info) + '</i></p>';
  return s;
}

function Views_error(msg, p) {
  const sid = (p && p.sid) ? p.sid : '';
  const back = sid
    ? '<p>' + _link('page=dashboard&sid=' + encodeURIComponent(sid), 'Back to dashboard') + '</p>'
    : '<p>' + _link('page=login', 'Back to login') + '</p>';
  return _html('<h2>Error</h2><p>' + _esc(msg) + '</p>' + back, 'Error');
}

// ─────────── LOGIN ───────────
function Views_login(p) {
  const body =
    '<h1>Military Training — Login</h1>' +
    _flash(p) +
    _formOpen() +
    '<input type="hidden" name="action" value="login">' +
    '<p>User ID: <input type="text" name="userId" required></p>' +
    '<p>Password: <input type="password" name="password" required></p>' +
    '<p><button type="submit">Login</button></p>' +
    '</form>' +
    '<hr><p><small>Demo: U001/admin123 · U002/cmd123 · U003/train123</small></p>';
  return _html(body, 'Login');
}

// ─────────── DASHBOARD ───────────
function Views_dashboard(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'Please log in.' });
  const sid = user.id;

  let body = _nav(user, sid) + _flash(p) + '<h1>Dashboard</h1>';

  if (user.role === 'admin')      body += _adminDashboard(sid);
  else if (user.role === 'commander') body += _commanderDashboard(user, sid);
  else                            body += _traineeDashboard(user, sid);

  return _html(body, 'Dashboard');
}

function _adminDashboard(sid) {
  const exs = Exercises_all();
  const users = Users_all();
  const sidQ = encodeURIComponent(sid);

  // Exercises table
  let s = '<h2>All Exercises</h2><table border="1" cellpadding="5">' +
          '<tr><th>ID</th><th>Title</th><th>Date</th><th>Actions</th></tr>';
  exs.forEach(e => {
    s += '<tr><td>' + _esc(e.id) + '</td><td>' + _esc(e.title) + '</td><td>' + _esc(e.date) + '</td>' +
         '<td>' +
           _link('page=exercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ, 'View / Edit') + ' | ' +
           _link('action=duplicateExercise&id=' + encodeURIComponent(e.id) + '&sid=' + sidQ, 'Duplicate') +
         '</td></tr>';
  });
  s += '</table>';

  // Create exercise
  s += '<h2>Create Exercise</h2>' +
       _formOpen() +
       '<input type="hidden" name="action" value="createExercise">' +
       '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
       '<p>Title: <input name="title" required></p>' +
       '<p>Description: <input name="description" size="60"></p>' +
       '<p>Date: <input type="date" name="date"></p>' +
       '<p><button type="submit">Create</button></p></form>';

  // Assign exercise
  s += '<h2>Assign Exercise</h2>' +
       _formOpen() +
       '<input type="hidden" name="action" value="assign">' +
       '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
       '<p>Exercise: <select name="exerciseId" required>' +
         exs.map(e => '<option value="' + _esc(e.id) + '">' + _esc(e.id + ' — ' + e.title) + '</option>').join('') +
       '</select></p>' +
       '<p>User: <select name="userId" required>' +
         users.map(u => '<option value="' + _esc(u.id) + '">' + _esc(u.id + ' — ' + u.name + ' (' + u.role + ')') + '</option>').join('') +
       '</select></p>' +
       '<p>Responsibility: <input name="responsibility" list="respList" required placeholder="e.g. Commander, Medic, Sniper..."></p>' +
       '<datalist id="respList">' +
         '<option value="Commander">' +
         '<option value="Navigator">' +
         '<option value="Medic">' +
         '<option value="Communications">' +
         '<option value="Sniper">' +
         '<option value="Driver">' +
         '<option value="Rifleman">' +
         '<option value="Observer">' +
         '<option value="Logistics">' +
       '</datalist>' +
       '<p><button type="submit">Assign</button></p></form>';

  return s;
}

function _commanderDashboard(user, sid) {
  const trainees = Users_traineesOfCommander(user.id);
  const exs = Exercises_all();
  const sidQ = encodeURIComponent(sid);

  let s = '<h2>My Trainees</h2>';
  if (!trainees.length) s += '<p>No trainees in your team yet.</p>';

  trainees.forEach(t => {
    const assigns = Assignments_byUser(t.id);
    s += '<h3>' + _esc(t.name) + ' (' + _esc(t.id) + ')</h3>';
    if (!assigns.length) {
      s += '<p>No assignments.</p>';
    } else {
      s += '<table border="1" cellpadding="5"><tr><th>Assignment</th><th>Exercise</th><th>Responsibility</th><th>Status</th><th>Action</th></tr>';
      assigns.forEach(a => {
        const ex = Exercises_get(a.exercise_id);
        s += '<tr><td>' + _esc(a.id) + '</td><td>' + _esc(ex ? ex.title : a.exercise_id) + '</td>' +
             '<td>' + _esc(a.responsibility) + '</td>' +
             '<td>' + _esc(a.status) + '</td><td>';
        if (a.status !== 'completed') {
          s += _link('action=complete&assignmentId=' + encodeURIComponent(a.id) + '&sid=' + sidQ, 'Mark completed');
        } else s += '✓';
        s += '</td></tr>';
      });
      s += '</table>';
    }
    // Assign form per trainee
    s += _formOpen() +
         '<input type="hidden" name="action" value="assign">' +
         '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
         '<input type="hidden" name="userId" value="' + _esc(t.id) + '">' +
         'Exercise: <select name="exerciseId" required>' +
           exs.map(e => '<option value="' + _esc(e.id) + '">' + _esc(e.title) + '</option>').join('') +
         '</select> ' +
         'Responsibility: <input name="responsibility" list="respList" required placeholder="e.g. Medic"> ' +
         '<button type="submit">Assign</button></form>';
  });

  s += '<datalist id="respList">' +
         '<option value="Commander">' +
         '<option value="Navigator">' +
         '<option value="Medic">' +
         '<option value="Communications">' +
         '<option value="Sniper">' +
         '<option value="Driver">' +
         '<option value="Rifleman">' +
         '<option value="Observer">' +
         '<option value="Logistics">' +
       '</datalist>';

  return s;
}

function _traineeDashboard(user, sid) {
  const sidQ = encodeURIComponent(sid);
  const assigns = Assignments_byUser(user.id);
  let s = '<h2>My Assigned Exercises</h2>';
  if (!assigns.length) return s + '<p>No assignments yet.</p>';
  s += '<table border="1" cellpadding="5"><tr><th>Exercise</th><th>Responsibility</th><th>Status</th><th>Score</th><th>Details</th></tr>';
  assigns.forEach(a => {
    const ex = Exercises_get(a.exercise_id);
    s += '<tr><td>' + _esc(ex ? ex.title : a.exercise_id) + '</td>' +
         '<td>' + _esc(a.responsibility) + '</td>' +
         '<td>' + _esc(a.status) + '</td><td>' + _esc(a.score) + '</td>' +
         '<td>' + _link('page=exercise&id=' + encodeURIComponent(a.exercise_id) + '&sid=' + sidQ, 'View') + '</td></tr>';
  });
  s += '</table>';
  return s;
}

// ─────────── EXERCISE PAGE ───────────
function Views_exercise(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'Please log in.' });
  const sid = user.id;
  const ex  = Exercises_get(p.id);
  if (!ex) return Views_error('Exercise not found.', p);

  let s = _nav(user, sid) + _flash(p) +
          '<h1>' + _esc(ex.title) + '</h1>' +
          '<p><b>ID:</b> ' + _esc(ex.id) + ' &nbsp; <b>Date:</b> ' + _esc(ex.date) + '</p>' +
          '<p>' + _esc(ex.description) + '</p>';

  // Timeline
  s += '<h2>Timeline</h2>';
  const details = Exercises_details(ex.id);
  if (details.length) {
    s += '<table border="1" cellpadding="5"><tr><th>Time</th><th>Location</th><th>Description</th></tr>';
    details.forEach(d => {
      s += '<tr><td>' + _esc(d.time) + '</td><td>' + _esc(d.location) + '</td><td>' + _esc(d.description) + '</td></tr>';
    });
    s += '</table>';
  } else s += '<p>No timeline entries.</p>';

  // Participants
  s += '<h2>Participants</h2>';
  const parts = Assignments_byExercise(ex.id);
  if (parts.length) {
    s += '<table border="1" cellpadding="5"><tr><th>User</th><th>Responsibility</th><th>Status</th><th>Score</th></tr>';
    parts.forEach(a => {
      const u = Users_get(a.user_id);
      s += '<tr><td>' + _esc(u ? u.name : a.user_id) + '</td>' +
           '<td>' + _esc(a.responsibility) + '</td>' +
           '<td>' + _esc(a.status) + '</td><td>' + _esc(a.score) + '</td></tr>';
    });
    s += '</table>';
  } else s += '<p>No participants yet.</p>';

  // Admin: edit + add detail
  if (user.role === 'admin') {
    s += '<hr><h2>Edit Exercise</h2>' +
         _formOpen() +
         '<input type="hidden" name="action" value="editExercise">' +
         '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
         '<input type="hidden" name="id" value="' + _esc(ex.id) + '">' +
         '<p>Title: <input name="title" value="' + _esc(ex.title) + '" required></p>' +
         '<p>Description: <input name="description" size="60" value="' + _esc(ex.description) + '"></p>' +
         '<p>Date: <input type="date" name="date" value="' + _esc(ex.date) + '"></p>' +
         '<p><button type="submit">Save</button></p></form>';

    s += '<h2>Add Timeline Entry</h2>' +
         _formOpen() +
         '<input type="hidden" name="action" value="addDetail">' +
         '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
         '<input type="hidden" name="exerciseId" value="' + _esc(ex.id) + '">' +
         '<p>Time: <input name="time"></p>' +
         '<p>Location: <input name="location"></p>' +
         '<p>Description: <input name="detailDescription" size="60"></p>' +
         '<p><button type="submit">Add</button></p></form>';
  }

  return _html(s, ex.title);
}

// ─────────── USERS PAGE ───────────
function Views_users(p) {
  const user = Auth_current(p);
  if (!user || user.role !== 'admin') return Views_error('Admins only.', p);
  const sid = user.id;
  const users = Users_all();

  let s = _nav(user, sid) + _flash(p) + '<h1>User Roles</h1>' +
          '<table border="1" cellpadding="5"><tr><th>ID</th><th>Name</th><th>Role</th><th>Team</th><th>Update</th></tr>';
  users.forEach(u => {
    s += '<tr><td>' + _esc(u.id) + '</td><td>' + _esc(u.name) + '</td>' +
         '<td>' + _esc(u.role) + '</td><td>' + _esc(u.team_id) + '</td><td>' +
         _formOpen() +
         '<input type="hidden" name="action" value="updateRole">' +
         '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
         '<input type="hidden" name="targetId" value="' + _esc(u.id) + '">' +
         '<select name="newRole">' +
           ['admin','commander','trainee'].map(r =>
             '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + r + '</option>').join('') +
         '</select> ' +
         'Team: <input name="newTeam" value="' + _esc(u.team_id) + '" size="6"> ' +
         '<button type="submit">Save</button>' +
         '</form></td></tr>';
  });
  s += '</table>';
  return _html(s, 'User Roles');
}
