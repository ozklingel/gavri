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
  'Assignments', 'FieldForces', 'FireZones', 'HomeConstraints', 'TimelineBlocks',
  'UserFieldDefs', 'UserFieldValues', 'Series', 'SystemLog'
];
// מינימום לעלייה אחרי התחברות — דשבורד, חיפוש, שיבוצים (ללא Credentials / שטחי אש / ציר זמן)
var DB_SESSION_SHEETS = ['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'Series'];
// כל מה שטאבי הדשבורד (חיפוש / צוות / תרגיל / התנגשויות) קוראים
var DB_DASHBOARD_SHEETS = DB_SESSION_SHEETS;
var DB_BOOT_SHEETS = DB_SESSION_SHEETS;
var DB_TIMELINE_SHEETS = ['Users', 'Exercises', 'ExerciseDetails', 'TimelineBlocks', 'Assignments', 'FieldForces', 'FireZones'];
var DB_CACHE_TTL_SEC = 21600;
var DB_CACHE_PREFIX = 'mdb:';
var DB_CACHE_CHUNK = 90000;
var DB_WARM_FLAG = 'warmed';
var DB_HTML_GEN_KEY = 'htmlgen';
// כל הגיליונות למעט Credentials — נטען בכניסה (עלייה איטית, ניווט מהיר)
var DB_FULL_CACHE_SHEETS = DB_SHEET_NAMES.filter(function(n) { return n !== 'Credentials'; });

function _dbCacheKey(name, part) {
  return DB_CACHE_PREFIX + name + (part == null ? '' : ':' + part);
}

function _cacheIsFullyWarmed() {
  try {
    return CacheService.getScriptCache().get(_dbCacheKey(DB_WARM_FLAG)) === '1';
  } catch (e1) {
    return false;
  }
}

function _cacheMarkWarmed() {
  try {
    CacheService.getScriptCache().put(_dbCacheKey(DB_WARM_FLAG), '1', DB_CACHE_TTL_SEC);
  } catch (e1) {}
}

function _cacheClearWarmFlag() {
  try {
    CacheService.getScriptCache().remove(_dbCacheKey(DB_WARM_FLAG));
  } catch (e1) {}
}

/** מחמם את כל הגיליונות פעם אחת; בקשות הבאות משתמשות רק ב-Script Cache (ללא Sheets). */
function _cacheEnsureFullWarm() {
  if (_cacheIsFullyWarmed()) {
    // וידוא מהיר שהקאש לא התרוקן
    if (_getScriptCacheRows('Users')) return { ok: true, warmed: true, skipped: true };
    _cacheClearWarmFlag();
  }
  _cacheWarmSheetsIfNeeded(DB_FULL_CACHE_SHEETS);
  _cacheMarkWarmed();
  return { ok: true, warmed: true, sheets: DB_FULL_CACHE_SHEETS.length };
}

function _htmlCacheGen() {
  try {
    const g = CacheService.getScriptCache().get(_dbCacheKey(DB_HTML_GEN_KEY));
    return g || '0';
  } catch (e1) {
    return '0';
  }
}

function _htmlCacheBump() {
  try {
    CacheService.getScriptCache().put(
      _dbCacheKey(DB_HTML_GEN_KEY),
      String(Date.now()),
      DB_CACHE_TTL_SEC
    );
  } catch (e1) {}
}

function _htmlCacheKey(sid, page, params) {
  const clean = {};
  const src = params || {};
  Object.keys(src).forEach(function(k) {
    if (k === 'sid' || k === 'action' || k === 'error' || k === 'info') return;
    clean[k] = src[k];
  });
  let hash = '';
  try {
    hash = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD5,
        JSON.stringify(clean)
      )
    ).substring(0, 16);
  } catch (e1) {
    hash = String(JSON.stringify(clean).length);
  }
  return DB_CACHE_PREFIX + 'html:' + _htmlCacheGen() + ':' +
    String(sid || '') + ':' + String(page || '') + ':' + hash;
}

function _htmlCacheGet(sid, page, params) {
  const key = _htmlCacheKey(sid, page, params);
  const cache = CacheService.getScriptCache();
  try {
    const direct = cache.get(key);
    if (direct) {
      const parsed = JSON.parse(direct);
      if (parsed && parsed.body != null) return parsed;
    }
    const partsStr = cache.get(key + ':parts');
    if (!partsStr) return null;
    const parts = parseInt(partsStr, 10);
    if (!parts || parts < 1) return null;
    let json = '';
    for (let i = 0; i < parts; i++) {
      const chunk = cache.get(key + ':c' + i);
      if (chunk == null) return null;
      json += chunk;
    }
    const parsed2 = JSON.parse(json);
    if (parsed2 && parsed2.body != null) return parsed2;
  } catch (e1) {}
  return null;
}

function _htmlCachePut(sid, page, params, result) {
  if (!result || result.body == null) return;
  if (result.clearSid || result.mfaToken) return;
  // דפים עם flash חד-פעמי — לא לקאש
  if (params && (params.error || params.info)) return;
  const payload = {
    body: result.body,
    title: result.title || '',
    sid: result.sid || null
  };
  const json = JSON.stringify(payload);
  // מעל ~350KB לא שווה לקאש בשרת (מגבלות CacheService)
  if (json.length > 350000) return;
  const key = _htmlCacheKey(sid, page, params);
  const cache = CacheService.getScriptCache();
  try {
    if (json.length <= DB_CACHE_CHUNK) {
      cache.put(key, json, DB_CACHE_TTL_SEC);
      return;
    }
    const parts = Math.ceil(json.length / DB_CACHE_CHUNK);
    cache.put(key + ':parts', String(parts), DB_CACHE_TTL_SEC);
    for (let i = 0; i < parts; i++) {
      cache.put(
        key + ':c' + i,
        json.substring(i * DB_CACHE_CHUNK, (i + 1) * DB_CACHE_CHUNK),
        DB_CACHE_TTL_SEC
      );
    }
  } catch (e1) {}
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
  let json;
  try {
    json = JSON.stringify(result);
  } catch (e0) {
    return false;
  }
  try {
    if (json.length <= DB_CACHE_CHUNK) {
      cache.put(_dbCacheKey(name), json, DB_CACHE_TTL_SEC);
      cache.remove(_dbCacheKey(name, 'parts'));
      for (let i = 0; i < 30; i++) cache.remove(_dbCacheKey(name, 'c' + i));
      return true;
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
    return true;
  } catch (e1) {
    return false;
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

function _cacheWarmFullIfNeeded() {
  return _cacheEnsureFullWarm();
}

function _cacheWarmAllIfNeeded() {
  _cacheWarmFullIfNeeded();
}

function _cacheWarmAll(force) {
  if (force) {
    DB_SHEET_NAMES.forEach(function(name) { _cacheInvalidate(name, { skipRewarm: true }); });
    _cacheClearWarmFlag();
  }
  DB_FULL_CACHE_SHEETS.forEach(function(name) { _cacheWarmSheet(name); });
  _cacheMarkWarmed();
  return { ok: true, sheets: DB_FULL_CACHE_SHEETS.length };
}

/** מוחק קאש של גיליונות וקורא אותם מחדש מה-Spreadsheet. */
function _cacheForceReloadSheets(names) {
  const list = names && names.length ? names : DB_FULL_CACHE_SHEETS;
  _cacheClearWarmFlag();
  _htmlCacheBump();
  const cache = CacheService.getScriptCache();
  list.forEach(function(name) {
    delete _rowsCache[name];
    try {
      cache.remove(_dbCacheKey(name));
      cache.remove(_dbCacheKey(name, 'parts'));
      for (let i = 0; i < 30; i++) cache.remove(_dbCacheKey(name, 'c' + i));
    } catch (e0) {}
    try {
      const fresh = _readSheetFromSpreadsheet(name);
      _putScriptCacheRows(name, fresh);
      _rowsCache[name] = fresh;
    } catch (e1) {}
  });
  return { ok: true, sheets: list.length, forced: true };
}

function apiWarmCache(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: true, sheets: 0, scope: 'none' };
  try {
    Auth_current({ sid: s });
  } catch (e) {
    return { ok: true, sheets: 0, scope: 'none' };
  }
  const r = _cacheEnsureFullWarm();
  return {
    ok: true,
    sheets: DB_FULL_CACHE_SHEETS.length,
    scope: 'full',
    skipped: !!(r && r.skipped)
  };
}

/** חימום מלא ברקע — כל הגיליונות (למעט Credentials) לקאש ל-6 שעות */
function apiWarmFullCache(sid) {
  return apiWarmCache(sid);
}

function _cacheWarmTimelineSheets() {
  _cacheWarmSheetsIfNeeded(DB_TIMELINE_SHEETS);
}

/** חימום קאש ברקע לפני ניווט לדף (נקרא מהלקוח אחרי דשבורד / פתיחת תפריט) */
function apiWarmPageCache(sid, page) {
  const s = String(sid || '').trim();
  const pg = String(page || '').trim();
  if (!s || !pg) return { ok: true, sheets: 0, page: pg };
  try {
    Auth_current({ sid: s });
  } catch (e) {
    return { ok: true, sheets: 0, page: pg };
  }
  // אחרי חימום מלא — מספיק לוודא שהקאש חם; אין קריאות Sheets
  _cacheEnsureFullWarm();
  return { ok: true, sheets: DB_FULL_CACHE_SHEETS.length, page: pg };
}

function _cacheFlush() {
  _rowsCache = {};
}

function _rows(name) {
  if (_rowsCache[name]) return _rowsCache[name];

  let result = _getScriptCacheRows(name);
  if (!result) {
    // אחרי warm — נדיר; קריאת Sheets רק כשיש miss (או Credentials)
    result = _readSheetFromSpreadsheet(name);
    _putScriptCacheRows(name, result);
  }
  _rowsCache[name] = result;
  return result;
}

/**
 * ביטול קאש אחרי כתיבה.
 * כברירת מחדל: write-through — קורא את הגיליון פעם אחת ומחזיר לקאש,
 * כדי שניווט הבא לא ייפול חזרה ל-Sheets.
 */
function _cacheInvalidate(name, options) {
  options = options || {};
  delete _rowsCache[name];
  const cache = CacheService.getScriptCache();
  cache.remove(_dbCacheKey(name));
  cache.remove(_dbCacheKey(name, 'parts'));
  for (let i = 0; i < 30; i++) cache.remove(_dbCacheKey(name, 'c' + i));
  _htmlCacheBump();
  if (options.skipRewarm) {
    _cacheClearWarmFlag();
    return;
  }
  try {
    const fresh = _readSheetFromSpreadsheet(name);
    _putScriptCacheRows(name, fresh);
    _rowsCache[name] = fresh;
  } catch (e1) {
    _cacheClearWarmFlag();
  }
}

function _colIndex(sheetName, columnName) {
  const header = _rows(sheetName).header.map(String);
  return header.indexOf(columnName);
}

function _cachePatchAppend(name, rows) {
  if (!rows || !rows.length) {
    _htmlCacheBump();
    return;
  }
  let cur = _rowsCache[name];
  if (!cur || !cur.data) cur = _getScriptCacheRows(name);
  if (cur && cur.data) {
    for (let i = 0; i < rows.length; i++) cur.data.push(rows[i]);
    _rowsCache[name] = cur;
    _putScriptCacheRows(name, cur);
    _htmlCacheBump();
    return;
  }
  _cacheInvalidate(name);
}

/**
 * אחרי setValues לכמה תאים בשורה — מעדכן את הקאש בזיכרון בלי קריאת Sheets מחדש.
 * sheetRow: מספר שורה בגיליון (2 = שורת נתונים ראשונה)
 * updates: מפה { col1Based: value, ... }
 */
function _cachePatchRow(name, sheetRow, updates) {
  let cur = _rowsCache[name];
  if (!cur || !cur.data) cur = _getScriptCacheRows(name);
  if (!cur || !cur.data) {
    _cacheInvalidate(name);
    return;
  }
  const idx = sheetRow - 2;
  if (idx < 0 || idx >= cur.data.length) {
    _cacheInvalidate(name);
    return;
  }
  const row = cur.data[idx].slice();
  Object.keys(updates || {}).forEach(function(k) {
    const col = parseInt(k, 10);
    if (!isNaN(col) && col >= 1) row[col - 1] = updates[k];
  });
  cur.data[idx] = row;
  _rowsCache[name] = cur;
  _putScriptCacheRows(name, cur);
  _htmlCacheBump();
}

function _append(name, row) {
  _sheet(name).appendRow(row);
  _cachePatchAppend(name, [row]);
}

// Batch-append multiple rows at once — far faster than N appendRow() calls
function _appendBatch(name, rows) {
  if (!rows || !rows.length) return;
  const sh   = _sheet(name);
  const last = sh.getLastRow();
  sh.getRange(last + 1, 1, rows.length, rows[0].length).setValues(rows);
  _cachePatchAppend(name, rows);
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
  ensureColumn('Exercises', 'series_id');
  ensure('ExerciseDetails',  ['id','exercise_id','time','location','description']);
  ensure('Series', ['id','label','start_date','end_date','status','created_at','created_by','exercise_count','assignment_count','detail_count','battalion_config_json','build_params_json']);
  ensure('SystemLog', ['id','timestamp','user_id','action','entity_type','entity_id','details_json']);
  ensure('Assignments',      ['id','exercise_id','user_id','status','score','responsibility','feedback']);
  ensureColumn('Assignments', 'responsibility');
  ensureColumn('Assignments', 'feedback');
  ensureColumn('Assignments', 'tutor');
  ensure('FieldForces', ['id','role','commander_name','camp_location','force_type','force_name']);
  ensureColumn('FieldForces', 'force_name');
  ensure('FireZones', ['id','name','advancement','attack','defense','dry_wet_day','dry_wet_night']);
  ensure('HomeConstraints', ['id','user_id','start_date','start_time','end_date','end_time','notes','status','approval_tier','supervisor_id','approved_by','approved_at','rejection_note','created_at']);
  ensure('TimelineBlocks', ['id','label','start_date','end_date','start_time','end_time','lane','created_by']);
  ensure('UserFieldDefs', ['id','label','field_key','sort_order']);
  ensure('UserFieldValues', ['user_id','field_key','value']);
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

  Series_ensureMigrated();
  _cacheInvalidate('Exercises');
  _cacheInvalidate('Series');
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
