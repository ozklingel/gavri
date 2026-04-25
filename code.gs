// ═══════════════════════════════════════
//  Code.gs — Entry point & router
//  Uses index.html as the single HtmlService shell.
// ═══════════════════════════════════════

const SS_ID = ''; // leave empty if bound to spreadsheet via container

function SS() {
  return SS_ID ? SpreadsheetApp.openById(SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  return App_route((e && e.parameter) ? e.parameter : {});
}

function doPost(e) {
  return App_route((e && e.parameter) ? e.parameter : {});
}

function App_route(p) {
  const action = p.action || '';
  const page = p.page || 'login';

  try {
    if (action === 'login') return Auth_login(p);
    if (action === 'logout') return Auth_logout(p);
    if (action === 'createExercise') return Exercises_create(p);
    if (action === 'editExercise') return Exercises_edit(p);
    if (action === 'duplicateExercise') return Exercises_duplicate(p);
    if (action === 'addDetail') return Exercises_addDetail(p);
    if (action === 'assign') return Assignments_assign(p);
    if (action === 'complete') return Assignments_complete(p);
    if (action === 'updateRole') return Users_updateRole(p);
  } catch (err) {
    return Views_error(err && err.message ? err.message : String(err), p);
  }

  if (page === 'login') return Views_login(p);
  if (page === 'dashboard') return Views_dashboard(p);
  if (page === 'exercise') return Views_exercise(p);
  if (page === 'users') return Views_users(p);
  return Views_login(p);
}

function _sheet(name) {
  const sh = SS().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function _rows(name) {
  const sh = _sheet(name);
  const last = sh.getLastRow();
  if (last < 2) return { header: sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], data: [] };
  const values = sh.getDataRange().getValues();
  return { header: values[0], data: values.slice(1) };
}

function _append(name, row) {
  _sheet(name).appendRow(row);
}

function _nextId(name) {
  const data = _rows(name).data;
  let max = 0;
  data.forEach(function (r) {
    const n = parseInt(String(r[0]).replace(/^[A-Za-z]+/, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

function _findRowIndex(name, idValue) {
  const data = _rows(name).data;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) return i + 2;
  }
  return -1;
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _appUrl() {
  const url = ScriptApp.getService().getUrl();
  return url || '';
}

function _url(params) {
  const parts = [];
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key])));
    }
  });
  const qs = parts.join('&');
  const base = _appUrl();
  return base ? base + (qs ? '?' + qs : '') : (qs ? '?' + qs : '');
}

function setupSheets() {
  const ss = SS();
  const ensure = function (name, header) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(header);
  };

  ensure('Users', ['id', 'name', 'role', 'team_id']);
  ensure('Credentials', ['user_id', 'password']);
  ensure('Teams', ['id', 'name', 'commander_id']);
  ensure('Exercises', ['id', 'title', 'description', 'created_by', 'date']);
  ensure('ExerciseDetails', ['id', 'exercise_id', 'time', 'location', 'description']);
  ensure('Assignments', ['id', 'exercise_id', 'user_id', 'status', 'score']);

  const usersSh = ss.getSheetByName('Users');
  if (usersSh.getLastRow() === 1) {
    usersSh.appendRow(['U001', 'Admin User', 'admin', '']);
    usersSh.appendRow(['U002', 'Commander Alpha', 'commander', 'T1']);
    usersSh.appendRow(['U003', 'Trainee One', 'trainee', 'T1']);
    ss.getSheetByName('Credentials').appendRow(['U001', 'admin123']);
    ss.getSheetByName('Credentials').appendRow(['U002', 'cmd123']);
    ss.getSheetByName('Credentials').appendRow(['U003', 'train123']);
    ss.getSheetByName('Teams').appendRow(['T1', 'Alpha Team', 'U002']);
  }
}
