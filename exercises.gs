// ═══════════════════════════════════════
//  exercises.gs — exercise CRUD + duplication
//  Schema change: date → start_date (col 5) + end_date (col 6)
// ═══════════════════════════════════════

// Format a date value → e.g. "יום שלישי, 15 באפריל 2025"
// Handles both Google Sheets Date objects and plain "YYYY-MM-DD" strings.
function _fmtDate(val) {
  if (!val) return '';
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const days   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let dd, mm, yy, wd;
  if (val instanceof Date) {
    // Add 12h buffer: Sheets Date cells are UTC midnight, Israel is UTC+3
    // so midnight Israel = 21:00 previous day UTC → off by one without the shift
    const shifted = new Date(val.getTime() + 12 * 60 * 60 * 1000);
    dd = shifted.getUTCDate(); mm = shifted.getUTCMonth();
    yy = shifted.getUTCFullYear(); wd = shifted.getUTCDay();
  } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    // Plain "YYYY-MM-DD" string saved by our app — parse directly, no timezone shift
    const parts = val.trim().split('-');
    yy = +parts[0]; mm = +parts[1] - 1; dd = +parts[2];
    wd = new Date(Date.UTC(yy, mm, dd)).getUTCDay();
  } else {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    dd = d.getUTCDate(); mm = d.getUTCMonth();
    yy = d.getUTCFullYear(); wd = d.getUTCDay();
  }
  return 'יום ' + days[wd] + ', ' + dd + ' ב' + months[mm] + ' ' + yy;
}

// Returns "YYYY-MM-DD" for the date picker value attribute.
// KEY FIX: Google Sheets stores dates as UTC midnight, but Israel is UTC+3.
// So "2026-05-04" stored as a Date cell = 2026-05-03T21:00:00Z in UTC.
// getUTCDate() → 3 ❌.  Fix: add 12 hours before extracting → always lands on correct day.
function _rawDate(val) {
  if (!val) return '';
  // Already a plain YYYY-MM-DD string — return directly, no conversion needed
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  // Google Sheets Date object — add 12h buffer to survive any UTC offset
  let d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const shifted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  const y  = shifted.getUTCFullYear();
  const m  = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

// Parse a raw "YYYY-MM-DD" string → UTC timestamp (ms). Returns NaN if invalid.
function _parseRawDate(str) {
  if (!str) return NaN;
  const parts = String(str).split('-');
  if (parts.length !== 3) return NaN;
  return Date.UTC(+parts[0], +parts[1]-1, +parts[2]);
}

function Exercises_all() {
  return _rows('Exercises').data.map(r => ({
    id:          String(r[0]),
    title:       String(r[1]),
    description: String(r[2]),
    created_by:  String(r[3]),
    // col 5 = start_date, col 6 = end_date
    start_date:   _fmtDate(r[4]),
    end_date:     _fmtDate(r[5]),
    rawStartDate: _rawDate(r[4]),
    rawEndDate:   _rawDate(r[5]),
    // backwards compat alias
    date:         _fmtDate(r[4]),
    rawDate:      _rawDate(r[4])
  }));
}

function Exercises_get(id) {
  return Exercises_all().find(e => e.id === String(id)) || null;
}

function Exercises_details(exerciseId) {
  return _rows('ExerciseDetails').data
    .filter(r => String(r[1]) === String(exerciseId))
    .map(r => ({ id: String(r[0]), time: String(r[2]), location: String(r[3]), description: String(r[4]) }));
}

function Exercises_create(p) {
  const u      = Auth_requireRole(p, ['admin']);
  const id     = 'E' + new Date().getTime();
  const teamId = (p.teamId || '').trim();

  _append('Exercises', [id, p.title || '', p.description || '', u.id,
    p.start_date || '', p.end_date || '']);

  let info = 'התרגיל נוצר בהצלחה (' + id + ').';

  if (teamId) {
    const result = Assignments_assignTeam(id, teamId, p.sid);
    const team   = Teams_get(teamId);
    const tName  = team ? team.name : teamId;
    if (result.added > 0)   info += ' ' + result.added + ' חיילים מצוות "' + tName + '" נוספו אוטומטית.';
    if (result.skipped > 0) info += ' (' + result.skipped + ' כבר משתתפים.)';
    return Views_exercise({ sid: p.sid, id: id, info: info });
  }

  return Views_dashboard({ sid: p.sid, info: info });
}

function Exercises_edit(p) {
  Auth_requireRole(p, ['admin']);
  const row = _findRowIndex('Exercises', p.id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  const sh = _sheet('Exercises');
  sh.getRange(row, 2).setValue(p.title       || '');
  sh.getRange(row, 3).setValue(p.description || '');
  sh.getRange(row, 5).setValue(p.start_date  || '');
  sh.getRange(row, 6).setValue(p.end_date    || '');
  return Views_exercise({ sid: p.sid, id: p.id, info: 'התרגיל עודכן בהצלחה.' });
}

function Exercises_duplicate(p) {
  const u    = Auth_requireRole(p, ['admin']);
  const orig = Exercises_get(p.id);
  if (!orig) throw new Error('התרגיל לא נמצא.');
  const newId = 'E' + _nextId('Exercises');
  _append('Exercises', [newId, orig.title + ' (copy)', orig.description, u.id,
    orig.rawStartDate, orig.rawEndDate]);
  Exercises_details(orig.id).forEach(d => {
    const did = 'D' + _nextId('ExerciseDetails');
    _append('ExerciseDetails', [did, newId, d.time, d.location, d.description]);
  });
  return Views_dashboard({ sid: p.sid, info: 'התרגיל שוכפל כ-' + newId + '.' });
}

function Exercises_addDetail(p) {
  Auth_requireRole(p, ['admin']);
  const exId = p.exerciseId;
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');
  const did = 'D' + _nextId('ExerciseDetails');
  _append('ExerciseDetails', [did, exId, p.time || '', p.location || '', p.detailDescription || '']);
  return Views_exercise({ sid: p.sid, id: exId, info: 'רישום ציר הזמן נוסף בהצלחה.' });
}

function Exercises_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = (p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');

  const assignSh   = _sheet('Assignments');
  const assignData = _rows('Assignments').data;
  for (let i = assignData.length - 1; i >= 0; i--) {
    if (String(assignData[i][1]) === id) assignSh.deleteRow(i + 2);
  }

  const detailSh   = _sheet('ExerciseDetails');
  const detailData = _rows('ExerciseDetails').data;
  for (let i = detailData.length - 1; i >= 0; i--) {
    if (String(detailData[i][1]) === id) detailSh.deleteRow(i + 2);
  }

  const row = _findRowIndex('Exercises', id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  _sheet('Exercises').deleteRow(row);

  return Views_dashboard({ sid: p.sid, info: 'התרגיל נמחק יחד עם כל ההקצאות ורשומות ציר הזמן.' });
}// ═══════════════════════════════════════
//  exercises.gs — exercise CRUD + duplication
//  Schema change: date → start_date (col 5) + end_date (col 6)
// ═══════════════════════════════════════

// Format a date value → e.g. "יום שלישי, 15 באפריל 2025"
// Handles both Google Sheets Date objects and plain "YYYY-MM-DD" strings.
function _fmtDate(val) {
  if (!val) return '';
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const days   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let dd, mm, yy, wd;
  if (val instanceof Date) {
    // Add 12h buffer: Sheets Date cells are UTC midnight, Israel is UTC+3
    // so midnight Israel = 21:00 previous day UTC → off by one without the shift
    const shifted = new Date(val.getTime() + 12 * 60 * 60 * 1000);
    dd = shifted.getUTCDate(); mm = shifted.getUTCMonth();
    yy = shifted.getUTCFullYear(); wd = shifted.getUTCDay();
  } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    // Plain "YYYY-MM-DD" string saved by our app — parse directly, no timezone shift
    const parts = val.trim().split('-');
    yy = +parts[0]; mm = +parts[1] - 1; dd = +parts[2];
    wd = new Date(Date.UTC(yy, mm, dd)).getUTCDay();
  } else {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    dd = d.getUTCDate(); mm = d.getUTCMonth();
    yy = d.getUTCFullYear(); wd = d.getUTCDay();
  }
  return 'יום ' + days[wd] + ', ' + dd + ' ב' + months[mm] + ' ' + yy;
}

// Returns "YYYY-MM-DD" for the date picker value attribute.
// KEY FIX: Google Sheets stores dates as UTC midnight, but Israel is UTC+3.
// So "2026-05-04" stored as a Date cell = 2026-05-03T21:00:00Z in UTC.
// getUTCDate() → 3 ❌.  Fix: add 12 hours before extracting → always lands on correct day.
function _rawDate(val) {
  if (!val) return '';
  // Already a plain YYYY-MM-DD string — return directly, no conversion needed
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  // Google Sheets Date object — add 12h buffer to survive any UTC offset
  let d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const shifted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  const y  = shifted.getUTCFullYear();
  const m  = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

// Parse a raw "YYYY-MM-DD" string → UTC timestamp (ms). Returns NaN if invalid.
function _parseRawDate(str) {
  if (!str) return NaN;
  const parts = String(str).split('-');
  if (parts.length !== 3) return NaN;
  return Date.UTC(+parts[0], +parts[1]-1, +parts[2]);
}

function Exercises_all() {
  return _rows('Exercises').data.map(r => ({
    id:          String(r[0]),
    title:       String(r[1]),
    description: String(r[2]),
    created_by:  String(r[3]),
    // col 5 = start_date, col 6 = end_date
    start_date:   _fmtDate(r[4]),
    end_date:     _fmtDate(r[5]),
    rawStartDate: _rawDate(r[4]),
    rawEndDate:   _rawDate(r[5]),
    // backwards compat alias
    date:         _fmtDate(r[4]),
    rawDate:      _rawDate(r[4])
  }));
}

function Exercises_get(id) {
  return Exercises_all().find(e => e.id === String(id)) || null;
}

function Exercises_details(exerciseId) {
  return _rows('ExerciseDetails').data
    .filter(r => String(r[1]) === String(exerciseId))
    .map(r => ({ id: String(r[0]), time: String(r[2]), location: String(r[3]), description: String(r[4]) }));
}

function Exercises_create(p) {
  const u      = Auth_requireRole(p, ['admin']);
  const id     = 'E' + new Date().getTime();
  const teamId = (p.teamId || '').trim();

  _append('Exercises', [id, p.title || '', p.description || '', u.id,
    p.start_date || '', p.end_date || '']);

  let info = 'התרגיל נוצר בהצלחה (' + id + ').';

  if (teamId) {
    const result = Assignments_assignTeam(id, teamId, p.sid);
    const team   = Teams_get(teamId);
    const tName  = team ? team.name : teamId;
    if (result.added > 0)   info += ' ' + result.added + ' חיילים מצוות "' + tName + '" נוספו אוטומטית.';
    if (result.skipped > 0) info += ' (' + result.skipped + ' כבר משתתפים.)';
    return Views_exercise({ sid: p.sid, id: id, info: info });
  }

  return Views_dashboard({ sid: p.sid, info: info });
}

function Exercises_edit(p) {
  Auth_requireRole(p, ['admin']);
  const row = _findRowIndex('Exercises', p.id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  const sh = _sheet('Exercises');
  sh.getRange(row, 2).setValue(p.title       || '');
  sh.getRange(row, 3).setValue(p.description || '');
  sh.getRange(row, 5).setValue(p.start_date  || '');
  sh.getRange(row, 6).setValue(p.end_date    || '');
  return Views_exercise({ sid: p.sid, id: p.id, info: 'התרגיל עודכן בהצלחה.' });
}

function Exercises_duplicate(p) {
  const u    = Auth_requireRole(p, ['admin']);
  const orig = Exercises_get(p.id);
  if (!orig) throw new Error('התרגיל לא נמצא.');
  const newId = 'E' + _nextId('Exercises');
  _append('Exercises', [newId, orig.title + ' (copy)', orig.description, u.id,
    orig.rawStartDate, orig.rawEndDate]);
  Exercises_details(orig.id).forEach(d => {
    const did = 'D' + _nextId('ExerciseDetails');
    _append('ExerciseDetails', [did, newId, d.time, d.location, d.description]);
  });
  return Views_dashboard({ sid: p.sid, info: 'התרגיל שוכפל כ-' + newId + '.' });
}

function Exercises_addDetail(p) {
  Auth_requireRole(p, ['admin']);
  const exId = p.exerciseId;
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');
  const did = 'D' + _nextId('ExerciseDetails');
  _append('ExerciseDetails', [did, exId, p.time || '', p.location || '', p.detailDescription || '']);
  return Views_exercise({ sid: p.sid, id: exId, info: 'רישום ציר הזמן נוסף בהצלחה.' });
}

function Exercises_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = (p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');

  const assignSh   = _sheet('Assignments');
  const assignData = _rows('Assignments').data;
  for (let i = assignData.length - 1; i >= 0; i--) {
    if (String(assignData[i][1]) === id) assignSh.deleteRow(i + 2);
  }

  const detailSh   = _sheet('ExerciseDetails');
  const detailData = _rows('ExerciseDetails').data;
  for (let i = detailData.length - 1; i >= 0; i--) {
    if (String(detailData[i][1]) === id) detailSh.deleteRow(i + 2);
  }

  const row = _findRowIndex('Exercises', id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  _sheet('Exercises').deleteRow(row);

  return Views_dashboard({ sid: p.sid, info: 'התרגיל נמחק יחד עם כל ההקצאות ורשומות ציר הזמן.' });
}