/**
 * Code.gs — Entry point
 * Routes all GET / POST requests via ?page=... URL parameter.
 *
 * Pages:
 *   ?page=login       (default)
 *   ?page=logout
 *   ?page=dashboard
 *   ?page=exercise&id=...
 *   ?page=users        (admin only)
 *   ?page=exerciseForm (admin: create/edit)
 *
 * POST actions (?action=...):
 *   login, createExercise, updateExercise, duplicateExercise,
 *   assignExercise, completeAssignment, updateUserRole
 */

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var page = params.page || 'login';

  // Handle logout
  if (page === 'logout') {
    Auth_logout();
    return Views_redirect('?page=login&msg=Logged+out');
  }

  // All pages except login require auth
  var session = Auth_getSession();
  if (page !== 'login' && !session) {
    return Views_redirect('?page=login&msg=Please+login');
  }

  switch (page) {
    case 'login':       return Views_loginPage(params);
    case 'dashboard':   return Views_dashboardPage(session, params);
    case 'exercise':    return Views_exercisePage(session, params);
    case 'users':       return Views_usersPage(session, params);
    case 'exerciseForm':return Views_exerciseFormPage(session, params);
    default:            return Views_message('Unknown page: ' + page);
  }
}

function doPost(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';

  // Login is the only POST allowed without an existing session
  if (action === 'login') {
    return Auth_handleLogin(params);
  }

  var session = Auth_getSession();
  if (!session) {
    return Views_redirect('?page=login&msg=Session+expired');
  }

  switch (action) {
    case 'createExercise':    return Exercises_handleCreate(session, params);
    case 'updateExercise':    return Exercises_handleUpdate(session, params);
    case 'duplicateExercise': return Exercises_handleDuplicate(session, params);
    case 'addExerciseDetail': return Exercises_handleAddDetail(session, params);
    case 'assignExercise':    return Assignments_handleAssign(session, params);
    case 'completeAssignment':return Assignments_handleComplete(session, params);
    case 'updateUserRole':    return Users_handleUpdateRole(session, params);
    default:                  return Views_message('Unknown action: ' + action);
  }
}

/**
 * Sheet helpers — all data lives in the bound Google Sheet.
 */
function SS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function SHEET(name) {
  var sh = SS().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name);
  return sh;
}

/**
 * Read a sheet as an array of objects keyed by header row.
 */
function readSheet(name) {
  var sh = SHEET(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 }; // store 1-based row index for updates
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function appendRow(name, obj) {
  var sh = SHEET(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) { return obj[h] != null ? obj[h] : ''; });
  sh.appendRow(row);
  return row;
}

function updateRow(name, rowIndex, obj) {
  var sh = SHEET(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var current = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var newRow = headers.map(function (h, i) {
    return obj[h] != null ? obj[h] : current[i];
  });
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
}

function nextId(name) {
  var rows = readSheet(name);
  var max = 0;
  rows.forEach(function (r) {
    var n = parseInt(r.id, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

function findById(name, id) {
  var rows = readSheet(name);
  id = String(id);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === id) return rows[i];
  }
  return null;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * One-time setup: run from the Apps Script editor to create all sheets.
 */
function setupSheets() {
  var defs = {
    Users:            ['id', 'name', 'role', 'team_id'],
    Credentials:      ['user_id', 'password'],
    Teams:            ['id', 'name', 'commander_id'],
    Exercises:        ['id', 'title', 'description', 'created_by', 'date'],
    ExerciseDetails:  ['id', 'exercise_id', 'time', 'location', 'description'],
    Assignments:      ['id', 'exercise_id', 'user_id', 'status', 'score']
  };
  var ss = SS();
  Object.keys(defs).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]);
  });

  // Seed an initial admin if Users is empty
  if (readSheet('Users').length === 0) {
    appendRow('Users', { id: 1, name: 'Admin',     role: 'admin',     team_id: '' });
    appendRow('Users', { id: 2, name: 'Commander', role: 'commander', team_id: 1 });
    appendRow('Users', { id: 3, name: 'Trainee',   role: 'trainee',   team_id: 1 });
    appendRow('Credentials', { user_id: 1, password: 'admin123' });
    appendRow('Credentials', { user_id: 2, password: 'cmd123' });
    appendRow('Credentials', { user_id: 3, password: 'train123' });
    appendRow('Teams', { id: 1, name: 'Alpha Team', commander_id: 2 });
  }
}
