// ═══════════════════════════════════════
//  Code.gs — Entry point (SPA shell, fixed URL)
// ═══════════════════════════════════════

const SS_ID = ''; // leave empty if bound to spreadsheet via container
function SS() {
  return SS_ID ? SpreadsheetApp.openById(SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
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
//  PERF: Script cache + request-scoped cache for sheet data
// ─────────────────────────────────────────────────────────────────────────────
var _rowsCache = {};

var DB_SHEET_NAMES = [
  'Users', 'Credentials', 'Teams', 'Exercises', 'ExerciseDetails',
  'Assignments', 'FieldForces', 'FireZones', 'HomeConstraints', 'TimelineBlocks'
];
// מינימום לעלייה — לוגין לא דורש DB; דשבורד (טאב חיפוש) רק Users+Teams
var DB_BOOT_SHEETS = ['Users', 'Teams'];
var DB_CACHE_TTL_SEC = 600;
var DB_CACHE_PREFIX = 'mdb:';
var DB_CACHE_CHUNK = 90000;

function _dbCacheKey(name, part) {
  return DB_CACHE_PREFIX + name + (part == null ? '' : ':' + part);
}

function _readSheetFromSpreadsheet(name) {
  const sh = _sheet(name);
  const last = sh.getLastRow();
  if (last < 2) {
    return {
      header: sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0],
      data: []
    };
  }
  const values = sh.getDataRange().getValues();
  return { header: values[0], data: values.slice(1) };
}

function _getScriptCacheRows(name) {
  const cache = CacheService.getScriptCache();
  const direct = cache.get(_dbCacheKey(name));
  if (direct) {
    try { return JSON.parse(direct); } catch (e1) { return null; }
  }
  const partsStr = cache.get(_dbCacheKey(name, 'parts'));
  if (!partsStr) return null;
  const parts = parseInt(partsStr, 10);
  if (!parts || parts < 1) return null;
  let json = '';
  for (let i = 0; i < parts; i++) {
    const chunk = cache.get(_dbCacheKey(name, 'c' + i));
    if (chunk == null) return null;
    json += chunk;
  }
  try { return JSON.parse(json); } catch (e2) { return null; }
}

function _putScriptCacheRows(name, result) {
  const cache = CacheService.getScriptCache();
  const json = JSON.stringify(result);
  if (json.length <= DB_CACHE_CHUNK) {
    cache.put(_dbCacheKey(name), json, DB_CACHE_TTL_SEC);
    cache.remove(_dbCacheKey(name, 'parts'));
    for (let i = 0; i < 30; i++) cache.remove(_dbCacheKey(name, 'c' + i));
    return;
  }
  const parts = Math.ceil(json.length / DB_CACHE_CHUNK);
  cache.put(_dbCacheKey(name, 'parts'), String(parts), DB_CACHE_TTL_SEC);
  cache.remove(_dbCacheKey(name));
  for (let i = 0; i < parts; i++) {
    cache.put(
      _dbCacheKey(name, 'c' + i),
      json.substring(i * DB_CACHE_CHUNK, (i + 1) * DB_CACHE_CHUNK),
      DB_CACHE_TTL_SEC
    );
  }
}

function _scriptCacheHas(name) {
  const cache = CacheService.getScriptCache();
  return !!(cache.get(_dbCacheKey(name)) || cache.get(_dbCacheKey(name, 'parts')));
}

function _cacheWarmSheet(name) {
  let result = _getScriptCacheRows(name);
  if (!result) {
    result = _readSheetFromSpreadsheet(name);
    _putScriptCacheRows(name, result);
  }
  _rowsCache[name] = result;
  return result;
}

function _cacheWarmSheetsIfNeeded(names) {
  (names || []).forEach(function(name) {
    if (_rowsCache[name]) return;
    if (_scriptCacheHas(name)) {
      const cached = _getScriptCacheRows(name);
      if (cached && cached.data) {
        _rowsCache[name] = cached;
        return;
      }
      _cacheInvalidate(name);
    }
    _cacheWarmSheet(name);
  });
}

function _cacheWarmAllIfNeeded() {
  _cacheWarmSheetsIfNeeded(DB_SHEET_NAMES);
}

function _cacheWarmAll(force) {
  if (force) {
    DB_SHEET_NAMES.forEach(function(name) { _cacheInvalidate(name); });
  }
  DB_SHEET_NAMES.forEach(function(name) { _cacheWarmSheet(name); });
  return { ok: true, sheets: DB_SHEET_NAMES.length };
}

function apiWarmCache(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: true, sheets: 0, scope: 'none' };
  try {
    Auth_current({ sid: s });
  } catch (e) {
    return { ok: true, sheets: 0, scope: 'none' };
  }
  _cacheWarmSheetsIfNeeded(DB_BOOT_SHEETS);
  return { ok: true, sheets: DB_BOOT_SHEETS.length, scope: 'boot' };
}

function _cacheFlush() {
  _rowsCache = {};
}

function _rows(name) {
  if (_rowsCache[name]) return _rowsCache[name];

  let result = _getScriptCacheRows(name);
  if (!result) {
    result = _readSheetFromSpreadsheet(name);
    _putScriptCacheRows(name, result);
  }
  _rowsCache[name] = result;
  return result;
}

function _cacheInvalidate(name) {
  delete _rowsCache[name];
  const cache = CacheService.getScriptCache();
  cache.remove(_dbCacheKey(name));
  cache.remove(_dbCacheKey(name, 'parts'));
  for (let i = 0; i < 30; i++) cache.remove(_dbCacheKey(name, 'c' + i));
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
  ensure('Users',            ['id','name','role','team_id','unit_affiliation','service_type','military_affiliation','unit_classification','target_role','phone','email']);
  ensureColumn('Users', 'phone');
  ensureColumn('Users', 'email');
  ensure('Credentials',      ['user_id','password']);
  ensure('Teams',            ['id','name','commander_id']);
  ensure('Exercises',        ['id','title','description','created_by','start_date','end_date','act','exercise_type','partner_battalion','camp','battalion_commander']);
  ensureColumn('Exercises', 'act');
  ensureColumn('Exercises', 'exercise_type');
  ensureColumn('Exercises', 'partner_battalion');
  ensureColumn('Exercises', 'camp');
  ensureColumn('Exercises', 'battalion_commander');
  ensureColumn('Exercises', 'start_time');
  ensureColumn('Exercises', 'end_time');
  ensureColumn('Exercises', 'series_force_slot');
  ensureColumn('Exercises', 'field_force_id');
  ensure('ExerciseDetails',  ['id','exercise_id','time','location','description']);
  ensure('Assignments',      ['id','exercise_id','user_id','status','score','responsibility','feedback']);
  ensureColumn('Assignments', 'responsibility');
  ensureColumn('Assignments', 'feedback');
  ensureColumn('Assignments', 'tutor');
  ensure('FieldForces', ['id','role','commander_name','camp_location','force_type','force_name']);
  ensureColumn('FieldForces', 'force_name');
  ensure('FireZones', ['id','name','advancement','attack','defense','dry_wet_day','dry_wet_night']);
  ensure('HomeConstraints', ['id','user_id','start_date','start_time','end_date','end_time','notes','status','approval_tier','supervisor_id','approved_by','approved_at','rejection_note','created_at']);
  ensure('TimelineBlocks', ['id','label','start_date','end_date','start_time','end_time','lane','created_by']);
  ensureColumn('Users', 'unit_affiliation');
  ensureColumn('Users', 'service_type');
  ensureColumn('Users', 'military_affiliation');
  ensureColumn('Users', 'unit_classification');
  ensureColumn('Users', 'target_role');

  const usersSh = ss.getSheetByName('Users');
  if (usersSh.getLastRow() === 1) {
    usersSh.appendRow(['U001','Admin User','admin','']);
    usersSh.appendRow(['U002','Commander Alpha','companyCommander','T1']);
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
    Users: ['id','name','role','team_id','unit_affiliation','service_type','military_affiliation','unit_classification','target_role','phone','email'],
    Credentials: ['user_id','password'],
    Teams: ['id','name','commander_id'],
    Exercises: ['id','title','description','created_by','start_date','end_date','act','exercise_type','partner_battalion','camp','battalion_commander'],
    ExerciseDetails: ['id','exercise_id','time','location','description'],
    Assignments: ['id','exercise_id','user_id','status','score','responsibility','feedback','tutor'],
    FieldForces: ['id','role','commander_name','camp_location','force_type','force_name'],
    FireZones: ['id','name','advancement','attack','defense','dry_wet_day','dry_wet_night'],
    HomeConstraints: ['id','user_id','start_date','start_time','end_date','end_time','notes','status','approval_tier','supervisor_id','approved_by','approved_at','rejection_note','created_at']
  };

  Object.keys(schemas).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
  });

  ss.getSheetByName('Users').appendRow(['U001','Admin','admin','']);
  ss.getSheetByName('Credentials').appendRow(['U001','admin123']);
  ss.getSheetByName('Users').appendRow(['U002','Commander Alpha','companyCommander','T1']);
  ss.getSheetByName('Users').appendRow(['U003','Trainee One','trainee','T1']);
  ss.getSheetByName('Users').appendRow(['U004','Trainee Two','trainee','T1']);
  ss.getSheetByName('Credentials').appendRow(['U002','cmd123']);
  ss.getSheetByName('Credentials').appendRow(['U003','train123']);
  ss.getSheetByName('Credentials').appendRow(['U004','train123']);
  ss.getSheetByName('Teams').appendRow(['T1','Alpha Team','U002']);
  ss.getSheetByName('Exercises').appendRow(['E1','תרגיל ראשון','תרגיל הדגמה','U001','2026-04-21','2026-04-23','','','','','']);
}
