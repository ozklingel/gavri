// ═══════════════════════════════════════
//  Code.gs — Entry point & router
//  GET-only architecture (works inside Apps Script iframe sandbox)
// ═══════════════════════════════════════

const SS_ID = ''; // leave empty if bound to spreadsheet via container
function SS() {
  return SS_ID ? SpreadsheetApp.openById(SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const action = p.action || '';
  const page   = p.page   || 'login';

  try {
    // ── Actions (mutations) — performed via GET, then re-render a page ──
    if (action === 'login')              return Auth_login(p);
    if (action === 'logout')             return Auth_logout(p);
    if (action === 'createExercise')     return Exercises_create(p);
    if (action === 'editExercise')       return Exercises_edit(p);
    if (action === 'duplicateExercise')  return Exercises_duplicate(p);
    if (action === 'addDetail')          return Exercises_addDetail(p);
    if (action === 'assign')             return Assignments_assign(p);
    if (action === 'complete')           return Assignments_complete(p);
    if (action === 'updateRole')         return Users_updateRole(p);

    // ── Pages (read-only renders) ──
    if (page === 'login')     return Views_login(p);
    if (page === 'dashboard') return Views_dashboard(p);
    if (page === 'exercise')  return Views_exercise(p);
    if (page === 'users')     return Views_users(p);
    return Views_login(p);
  } catch (err) {
    return Views_error(err && err.message ? err.message : String(err), p);
  }
}

// We keep doPost as a thin wrapper that delegates to doGet, in case
// any form is submitted via POST. Apps Script POST inside the iframe
// is unreliable for redirects, so we always re-render directly.
function doPost(e) {
  return doGet(e);
}

// ─── Tiny helpers ───
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
function _append(name, row) { _sheet(name).appendRow(row); }
function _nextId(name) {
  const { data } = _rows(name);
  let max = 0;
  data.forEach(r => { const n = parseInt(r[0], 10); if (!isNaN(n) && n > max) max = n; });
  return max + 1;
}
function _findRowIndex(name, idValue) {
  // returns 1-based sheet row number for the row whose first col == idValue
  const { data } = _rows(name);
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) return i + 2; // +2: header + 1-based
  }
  return -1;
}
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// One-time setup — run from the editor once
function setupSheets() {
  const ss = SS();
  const ensure = (name, header) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(header);
  };
  const ensureColumn = (name, columnName) => {
    const sh = ss.getSheetByName(name);
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (headers.indexOf(columnName) === -1) sh.getRange(1, lastCol + 1).setValue(columnName);
  };
  ensure('Users',            ['id','name','role','team_id']);
  ensure('Credentials',      ['user_id','password']);
  ensure('Teams',            ['id','name','commander_id']);
  ensure('Exercises',        ['id','title','description','created_by','date']);
  ensure('ExerciseDetails',  ['id','exercise_id','time','location','description']);
  ensure('Assignments',      ['id','exercise_id','user_id','status','score','responsibility']);
  ensureColumn('Assignments', 'responsibility');

  // Seed demo users if Users is empty
  const usersSh = ss.getSheetByName('Users');
  if (usersSh.getLastRow() === 1) {
    usersSh.appendRow(['U001','Admin User','admin','']);
    usersSh.appendRow(['U002','Commander Alpha','commander','T1']);
    usersSh.appendRow(['U003','Trainee One','trainee','T1']);
    ss.getSheetByName('Credentials').appendRow(['U001','admin123']);
    ss.getSheetByName('Credentials').appendRow(['U002','cmd123']);
    ss.getSheetByName('Credentials').appendRow(['U003','train123']);
    ss.getSheetByName('Teams').appendRow(['T1','Alpha Team','U002']);
  }
}

// FULL RESET — run this once if sheets/headers are broken.
// WARNING: this clears all app data and recreates clean tables.
function resetTrainingTables() {
  const ss = SS();
  const schemas = {
    Users: ['id','name','role','team_id'],
    Credentials: ['user_id','password'],
    Teams: ['id','name','commander_id'],
    Exercises: ['id','title','description','created_by','date'],
    ExerciseDetails: ['id','exercise_id','time','location','description'],
    Assignments: ['id','exercise_id','user_id','status','score','responsibility']
  };

  Object.keys(schemas).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
  });

  ss.getSheetByName('Users').appendRow(['1','Admin','admin','']);
  ss.getSheetByName('Credentials').appendRow(['1','admin123']);

  // Optional demo data so dashboard/exercise page is not empty.
  ss.getSheetByName('Users').appendRow(['2','Commander Alpha','commander','T1']);
  ss.getSheetByName('Users').appendRow(['3','Trainee One','trainee','T1']);
  ss.getSheetByName('Credentials').appendRow(['2','cmd123']);
  ss.getSheetByName('Credentials').appendRow(['3','train123']);
  ss.getSheetByName('Teams').appendRow(['T1','Alpha Team','2']);
  ss.getSheetByName('Exercises').appendRow(['E1','Exercise 1','Demo exercise','1','2026-04-21']);
  ss.getSheetByName('Assignments').appendRow(['A1','E1','3','pending','','Rifleman']);
}
