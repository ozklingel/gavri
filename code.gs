// ═══════════════════════════════════════
//  Code.gs — Entry point (SPA shell, fixed URL)
// ═══════════════════════════════════════

const SS_ID = ''; // leave empty if bound to spreadsheet via container
function SS() {
  return SS_ID ? SpreadsheetApp.openById(SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  _cacheFlush();
  return _htmlShell();
}

function doPost(e) {
  return doGet(e);
}

// ─── Tiny helpers ───

function _sheet(name) {
  const sh = SS().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PERF: Request-scoped in-memory cache
//  All _rows() calls are memoized for the duration of a single doGet/doPost
//  execution. This eliminates repeated Spreadsheet API round-trips.
// ─────────────────────────────────────────────────────────────────────────────
var _rowsCache = {};

function _cacheFlush() {
  _rowsCache = {};
}

function _rows(name) {
  if (_rowsCache[name]) return _rowsCache[name];          // ← cache hit

  const sh = _sheet(name);
  const last = sh.getLastRow();
  let result;
  if (last < 2) {
    result = {
      header: sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0],
      data: []
    };
  } else {
    const values = sh.getDataRange().getValues();
    result = { header: values[0], data: values.slice(1) };
  }
  _rowsCache[name] = result;                              // ← store in cache
  return result;
}

// Invalidate a single sheet from the cache (call after any write to that sheet)
function _cacheInvalidate(name) {
  delete _rowsCache[name];
}

function _append(name, row) {
  _sheet(name).appendRow(row);
  _cacheInvalidate(name);   // keep cache consistent after write
}

// Batch-append multiple rows at once — far faster than N appendRow() calls
function _appendBatch(name, rows) {
  if (!rows || !rows.length) return;
  const sh   = _sheet(name);
  const last = sh.getLastRow();
  sh.getRange(last + 1, 1, rows.length, rows[0].length).setValues(rows);
  _cacheInvalidate(name);
}

function _nextId(name) {
  const { data } = _rows(name);
  let max = 0;
  data.forEach(r => { const n = parseInt(r[0], 10); if (!isNaN(n) && n > max) max = n; });
  return max + 1;
}

function _findRowIndex(name, idValue) {
  const { data } = _rows(name);
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) return i + 2; // 1-indexed + header
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
  ensure('Users',            ['id','name','role','team_id','unit_affiliation','service_type','military_affiliation','unit_classification','target_role','phone']);
  ensureColumn('Users', 'phone');
  ensure('Credentials',      ['user_id','password']);
  ensure('Teams',            ['id','name','commander_id']);
  ensure('Exercises',        ['id','title','description','created_by','start_date','end_date','act','exercise_type','partner_battalion','camp','battalion_commander']);
  ensureColumn('Exercises', 'act');
  ensureColumn('Exercises', 'exercise_type');
  ensureColumn('Exercises', 'partner_battalion');
  ensureColumn('Exercises', 'camp');
  ensureColumn('Exercises', 'battalion_commander');
  ensure('ExerciseDetails',  ['id','exercise_id','time','location','description']);
  ensure('Assignments',      ['id','exercise_id','user_id','status','score','responsibility','feedback']);
  ensureColumn('Assignments', 'responsibility');
  ensureColumn('Assignments', 'feedback');
  ensureColumn('Users', 'unit_affiliation');
  ensureColumn('Users', 'service_type');
  ensureColumn('Users', 'military_affiliation');
  ensureColumn('Users', 'unit_classification');
  ensureColumn('Users', 'target_role');

  const usersSh = ss.getSheetByName('Users');
  if (usersSh.getLastRow() === 1) {
    usersSh.appendRow(['U001','Admin User','admin','']);
    usersSh.appendRow(['U002','Commander Alpha','commander','T1']);
    usersSh.appendRow(['U003','Trainee One','trainee','T1']);
    usersSh.appendRow(['U004','Trainee Two','trainee','T1']);
    ss.getSheetByName('Credentials').appendRow(['U001','admin123']);
    ss.getSheetByName('Credentials').appendRow(['U002','cmd123']);
    ss.getSheetByName('Credentials').appendRow(['U003','train123']);
    ss.getSheetByName('Credentials').appendRow(['U004','train123']);
    ss.getSheetByName('Teams').appendRow(['T1','Alpha Team','U002']);
  }
}

function resetTrainingTables() {
  const ss = SS();
  const schemas = {
    Users: ['id','name','role','team_id','unit_affiliation','service_type','military_affiliation','unit_classification','target_role','phone'],
    Credentials: ['user_id','password'],
    Teams: ['id','name','commander_id'],
    Exercises: ['id','title','description','created_by','start_date','end_date','act','exercise_type','partner_battalion','camp','battalion_commander'],
    ExerciseDetails: ['id','exercise_id','time','location','description'],
    Assignments: ['id','exercise_id','user_id','status','score','responsibility','feedback']
  };

  Object.keys(schemas).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
  });

  ss.getSheetByName('Users').appendRow(['U001','Admin','admin','']);
  ss.getSheetByName('Credentials').appendRow(['U001','admin123']);
  ss.getSheetByName('Users').appendRow(['U002','Commander Alpha','commander','T1']);
  ss.getSheetByName('Users').appendRow(['U003','Trainee One','trainee','T1']);
  ss.getSheetByName('Users').appendRow(['U004','Trainee Two','trainee','T1']);
  ss.getSheetByName('Credentials').appendRow(['U002','cmd123']);
  ss.getSheetByName('Credentials').appendRow(['U003','train123']);
  ss.getSheetByName('Credentials').appendRow(['U004','train123']);
  ss.getSheetByName('Teams').appendRow(['T1','Alpha Team','U002']);
  ss.getSheetByName('Exercises').appendRow(['E1','תרגיל ראשון','תרגיל הדגמה','U001','2026-04-21','2026-04-23','','','','','']);
}
