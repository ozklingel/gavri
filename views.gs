/**
 * views.gs — HTML rendering (no CSS, no JS — just HTML)
 *
 * Every page is server-rendered. Navigation is plain links and forms.
 * `Views_redirect` uses an HTML meta-refresh because Apps Script web apps
 * cannot send HTTP redirects directly.
 */

function Views_wrap(title, bodyHtml, session) {
  var nav = '';
  if (session) {
    nav += '<p>Logged in as <b>' + escapeHtml(session.name) +
           '</b> (' + escapeHtml(session.role) + ') | ' +
           '<a href="?page=dashboard">Dashboard</a>';
    if (session.role === 'admin') {
      nav += ' | <a href="?page=users">User Roles</a>';
      nav += ' | <a href="?page=exerciseForm">New Exercise</a>';
    }
    nav += ' | <a href="?page=logout">Logout</a></p><hr>';
  }
  var html =
    '<!DOCTYPE html><html><head><title>' + escapeHtml(title) + '</title></head>' +
    '<body><h1>' + escapeHtml(title) + '</h1>' + nav + bodyHtml + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function Views_redirect(query) {
  // Apps Script web app URL is unknown to the script directly; use relative refresh.
  var url = ScriptApp.getService().getUrl() + query;
  var html = '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0; url=' + escapeHtml(url) + '">' +
    '</head><body><p>Redirecting... <a href="' + escapeHtml(url) + '">click here</a></p>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function Views_message(msg) {
  return Views_wrap('Notice',
    '<p>' + escapeHtml(msg) + '</p><p><a href="?page=dashboard">Back</a></p>',
    Auth_getSession());
}

function Views_msgBanner(params) {
  if (!params || !params.msg) return '';
  return '<p><i>' + escapeHtml(params.msg) + '</i></p>';
}

/* ---------- LOGIN ---------- */
function Views_loginPage(params) {
  var body = Views_msgBanner(params) +
    '<form method="post" action="">' +
    '<input type="hidden" name="action" value="login">' +
    '<p>User ID: <input type="text" name="userId" required></p>' +
    '<p>Password: <input type="password" name="password" required></p>' +
    '<p><button type="submit">Login</button></p>' +
    '</form>';
  return Views_wrap('Login', body, null);
}

/* ---------- DASHBOARD (router by role) ---------- */
function Views_dashboardPage(session, params) {
  if (session.role === 'admin')     return Views_adminDashboard(session, params);
  if (session.role === 'commander') return Views_commanderDashboard(session, params);
  return Views_traineeDashboard(session, params);
}

/* ---------- ADMIN DASHBOARD ---------- */
function Views_adminDashboard(session, params) {
  var body = Views_msgBanner(params);
  var exs = Exercises_all();
  var users = Users_all();

  body += '<h2>All Exercises</h2>';
  body += '<table border="1" cellpadding="4"><tr><th>ID</th><th>Title</th><th>Date</th><th>Actions</th></tr>';
  exs.forEach(function (e) {
    body += '<tr>' +
      '<td>' + escapeHtml(e.id) + '</td>' +
      '<td><a href="?page=exercise&id=' + escapeHtml(e.id) + '">' + escapeHtml(e.title) + '</a></td>' +
      '<td>' + escapeHtml(e.date) + '</td>' +
      '<td>' +
        '<a href="?page=exerciseForm&id=' + escapeHtml(e.id) + '">Edit</a> | ' +
        '<form method="post" action="" style="display:inline">' +
          '<input type="hidden" name="action" value="duplicateExercise">' +
          '<input type="hidden" name="id" value="' + escapeHtml(e.id) + '">' +
          '<button type="submit">Duplicate</button>' +
        '</form>' +
      '</td>' +
    '</tr>';
  });
  body += '</table>';

  body += '<h2>Quick Assign Exercise</h2>';
  body += Views_assignForm(exs, users);

  body += '<h2>All Users</h2>';
  body += '<p><a href="?page=users">Manage user roles</a></p>';
  return Views_wrap('Admin Dashboard', body, session);
}

function Views_assignForm(exs, users) {
  var html = '<form method="post" action="">' +
    '<input type="hidden" name="action" value="assignExercise">' +
    '<p>Exercise: <select name="exercise_id" required>';
  exs.forEach(function (e) {
    html += '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.title) + '</option>';
  });
  html += '</select></p>' +
    '<p>User: <select name="user_id" required>';
  users.forEach(function (u) {
    html += '<option value="' + escapeHtml(u.id) + '">' +
      escapeHtml(u.name) + ' (' + escapeHtml(u.role) + ')</option>';
  });
  html += '</select></p>' +
    '<p><button type="submit">Assign</button></p>' +
    '</form>';
  return html;
}

/* ---------- COMMANDER DASHBOARD ---------- */
function Views_commanderDashboard(session, params) {
  var body = Views_msgBanner(params);
  var trainees = Users_traineesOfTeam(session.team_id);
  var exs = Exercises_all();

  body += '<h2>Team: ' + escapeHtml(Users_teamName(session.team_id)) + '</h2>';

  trainees.forEach(function (t) {
    body += '<h3>' + escapeHtml(t.name) + ' (ID ' + escapeHtml(t.id) + ')</h3>';
    var assigns = Assignments_forUser(t.id);

    var pending = assigns.filter(function (a) { return a.status !== 'completed'; });
    var done    = assigns.filter(function (a) { return a.status === 'completed'; });

    body += '<h4>Pending</h4>';
    body += Views_assignmentsTable(pending, true);

    body += '<h4>Completed</h4>';
    body += Views_assignmentsTable(done, false);

    // Per-trainee assign form
    body += '<form method="post" action="">' +
      '<input type="hidden" name="action" value="assignExercise">' +
      '<input type="hidden" name="user_id" value="' + escapeHtml(t.id) + '">' +
      '<p>Assign exercise: <select name="exercise_id" required>';
    exs.forEach(function (e) {
      body += '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.title) + '</option>';
    });
    body += '</select> <button type="submit">Assign</button></p></form><hr>';
  });

  return Views_wrap('Commander Dashboard', body, session);
}

function Views_assignmentsTable(assigns, allowComplete) {
  if (!assigns.length) return '<p><i>None.</i></p>';
  var html = '<table border="1" cellpadding="4"><tr><th>Assignment</th><th>Exercise</th><th>Status</th><th>Score</th>';
  if (allowComplete) html += '<th>Action</th>';
  html += '</tr>';
  assigns.forEach(function (a) {
    var ex = findById('Exercises', a.exercise_id);
    html += '<tr>' +
      '<td>' + escapeHtml(a.id) + '</td>' +
      '<td>' + (ex
        ? '<a href="?page=exercise&id=' + escapeHtml(ex.id) + '">' + escapeHtml(ex.title) + '</a>'
        : '?') + '</td>' +
      '<td>' + escapeHtml(a.status) + '</td>' +
      '<td>' + escapeHtml(a.score) + '</td>';
    if (allowComplete) {
      html += '<td><form method="post" action="" style="display:inline">' +
        '<input type="hidden" name="action" value="completeAssignment">' +
        '<input type="hidden" name="assignment_id" value="' + escapeHtml(a.id) + '">' +
        'Score: <input type="text" name="score" size="4"> ' +
        '<button type="submit">Mark complete</button></form></td>';
    }
    html += '</tr>';
  });
  html += '</table>';
  return html;
}

/* ---------- TRAINEE DASHBOARD ---------- */
function Views_traineeDashboard(session, params) {
  var body = Views_msgBanner(params);
  var assigns = Assignments_forUser(session.id);
  body += '<h2>My Assigned Exercises</h2>';
  if (!assigns.length) {
    body += '<p>No assignments yet.</p>';
  } else {
    body += '<table border="1" cellpadding="4"><tr><th>Exercise</th><th>Status</th><th>Score</th></tr>';
    assigns.forEach(function (a) {
      var ex = findById('Exercises', a.exercise_id);
      body += '<tr>' +
        '<td>' + (ex
          ? '<a href="?page=exercise&id=' + escapeHtml(ex.id) + '">' + escapeHtml(ex.title) + '</a>'
          : '?') + '</td>' +
        '<td>' + escapeHtml(a.status) + '</td>' +
        '<td>' + escapeHtml(a.score) + '</td>' +
      '</tr>';
    });
    body += '</table>';
  }
  return Views_wrap('Trainee Dashboard', body, session);
}

/* ---------- EXERCISE PAGE ---------- */
function Views_exercisePage(session, params) {
  var ex = Exercises_get(params.id);
  if (!ex) return Views_message('Exercise not found.');

  var body = Views_msgBanner(params);
  body += '<p><b>Title:</b> ' + escapeHtml(ex.title) + '</p>';
  body += '<p><b>Description:</b> ' + escapeHtml(ex.description) + '</p>';
  body += '<p><b>Date:</b> ' + escapeHtml(ex.date) + '</p>';

  body += '<h2>Timeline</h2>';
  var details = Exercises_details(ex.id);
  if (details.length) {
    body += '<table border="1" cellpadding="4"><tr><th>Time</th><th>Location</th><th>Description</th></tr>';
    details.forEach(function (d) {
      body += '<tr>' +
        '<td>' + escapeHtml(d.time) + '</td>' +
        '<td>' + escapeHtml(d.location) + '</td>' +
        '<td>' + escapeHtml(d.description) + '</td>' +
      '</tr>';
    });
    body += '</table>';
  } else {
    body += '<p><i>No timeline entries yet.</i></p>';
  }

  // Admin can add timeline entries
  if (session.role === 'admin') {
    body += '<h3>Add Timeline Entry</h3>' +
      '<form method="post" action="">' +
      '<input type="hidden" name="action" value="addExerciseDetail">' +
      '<input type="hidden" name="exercise_id" value="' + escapeHtml(ex.id) + '">' +
      '<p>Time: <input type="text" name="time"></p>' +
      '<p>Location: <input type="text" name="location"></p>' +
      '<p>Description: <input type="text" name="description"></p>' +
      '<p><button type="submit">Add</button></p>' +
      '</form>';
  }

  body += '<h2>Participants</h2>';
  var assigns = Assignments_forExercise(ex.id);
  if (assigns.length) {
    body += '<table border="1" cellpadding="4"><tr><th>User</th><th>Status</th><th>Score</th></tr>';
    assigns.forEach(function (a) {
      var u = findById('Users', a.user_id);
      body += '<tr>' +
        '<td>' + (u ? escapeHtml(u.name) : '?') + '</td>' +
        '<td>' + escapeHtml(a.status) + '</td>' +
        '<td>' + escapeHtml(a.score) + '</td>' +
      '</tr>';
    });
    body += '</table>';
  } else {
    body += '<p><i>No participants yet.</i></p>';
  }

  if (session.role === 'admin') {
    body += '<p><a href="?page=exerciseForm&id=' + escapeHtml(ex.id) + '">Edit exercise</a></p>';
  }

  return Views_wrap('Exercise: ' + ex.title, body, session);
}

/* ---------- EXERCISE FORM (create / edit) — admin only ---------- */
function Views_exerciseFormPage(session, params) {
  if (session.role !== 'admin') return Views_message('Forbidden.');
  var ex = params.id ? Exercises_get(params.id) : null;
  var action = ex ? 'updateExercise' : 'createExercise';

  var body = '<form method="post" action="">' +
    '<input type="hidden" name="action" value="' + action + '">';
  if (ex) body += '<input type="hidden" name="id" value="' + escapeHtml(ex.id) + '">';
  body += '<p>Title: <input type="text" name="title" value="' + escapeHtml(ex ? ex.title : '') + '" required></p>' +
    '<p>Description: <br><textarea name="description" rows="4" cols="40">' +
      escapeHtml(ex ? ex.description : '') + '</textarea></p>' +
    '<p>Date: <input type="text" name="date" value="' + escapeHtml(ex ? ex.date : '') + '"></p>' +
    '<p><button type="submit">' + (ex ? 'Update' : 'Create') + '</button></p>' +
    '</form>';
  return Views_wrap(ex ? 'Edit Exercise' : 'New Exercise', body, session);
}

/* ---------- USER ROLES PAGE — admin only ---------- */
function Views_usersPage(session, params) {
  if (session.role !== 'admin') return Views_message('Forbidden.');
  var body = Views_msgBanner(params);
  var users = Users_all();
  var teams = Users_teams();

  body += '<table border="1" cellpadding="4"><tr><th>ID</th><th>Name</th><th>Role</th><th>Team</th><th>Update</th></tr>';
  users.forEach(function (u) {
    body += '<tr>' +
      '<td>' + escapeHtml(u.id) + '</td>' +
      '<td>' + escapeHtml(u.name) + '</td>' +
      '<td>' + escapeHtml(u.role) + '</td>' +
      '<td>' + escapeHtml(Users_teamName(u.team_id)) + '</td>' +
      '<td>' +
        '<form method="post" action="">' +
          '<input type="hidden" name="action" value="updateUserRole">' +
          '<input type="hidden" name="userId" value="' + escapeHtml(u.id) + '">' +
          'Role: <select name="role">' +
            ['admin', 'commander', 'trainee'].map(function (r) {
              return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>';
            }).join('') +
          '</select> ' +
          'Team: <select name="team_id">' +
            '<option value="">(none)</option>' +
            teams.map(function (t) {
              return '<option value="' + escapeHtml(t.id) + '"' +
                (String(u.team_id) === String(t.id) ? ' selected' : '') + '>' +
                escapeHtml(t.name) + '</option>';
            }).join('') +
          '</select> ' +
          '<button type="submit">Save</button>' +
        '</form>' +
      '</td>' +
    '</tr>';
  });
  body += '</table>';

  return Views_wrap('User Roles', body, session);
}
