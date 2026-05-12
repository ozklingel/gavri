// ═══════════════════════════════════════
//  exercises.gs — exercise CRUD + duplication
//  Schema: start_date (col 5) + end_date (col 6)
// ═══════════════════════════════════════

function _fmtDate(val) {
  if (!val) return '';
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let d;
  if (val instanceof Date) {
    d = val;
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return String(val);
  const dd = d.getDate();
  const mm = d.getMonth();
  const yy = d.getFullYear();
  const wd = d.getDay();
  return 'יום ' + days[wd] + ', ' + dd + ' ב' + months[mm] + ' ' + yy;
}

function _rawDate(val) {
  if (!val) return '';
  const d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
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
    start_date:    _fmtDate(r[4]),
    end_date:      _fmtDate(r[5]),
    rawStartDate:  _rawDate(r[4]),
    rawEndDate:    _rawDate(r[5]),
    date:          _fmtDate(r[4]),
    rawDate:       _rawDate(r[4]),
    act:                 r[6]  == null ? '' : String(r[6]),
    exercise_type:       r[7]  == null ? '' : String(r[7]),
    partner_battalion:   r[8]  == null ? '' : String(r[8]),
    camp:                r[9]  == null ? '' : String(r[9]),
    battalion_commander: r[10] == null ? '' : String(r[10])
  }));
}

function Exercises_get(id) {
  // PERF: uses cached _rows — no extra Sheets API call
  return Exercises_all().find(e => e.id === String(id)) || null;
}

function Exercises_details(exerciseId) {
  return _rows('ExerciseDetails').data
    .filter(r => String(r[1]) === String(exerciseId))
    .map(r => ({ id: String(r[0]), time: String(r[2]), location: String(r[3]), description: String(r[4]) }));
}

function Exercises_create(p) {
  const u = Auth_requireRole(p, ['admin']);

  // ── Validation ──
  const title       = String(p.title || '').trim();
  const description = String(p.description || '').trim();
  const startDate   = String(p.start_date || '').trim();
  const endDate     = String(p.end_date || '').trim();

  if (!title)       throw new Error('חובה להזין שם תרגיל.');
  if (!description) throw new Error('חובה להזין תיאור תרגיל.');
  if (!startDate)   throw new Error('חובה לבחור תאריך התחלה.');
  if (!endDate)     throw new Error('חובה לבחור תאריך סיום.');

  const startTs = _parseRawDate(startDate);
  const endTs   = _parseRawDate(endDate);
  if (isNaN(startTs) || isNaN(endTs)) throw new Error('תאריכים לא תקינים.');
  if (endTs < startTs) throw new Error('תאריך הסיום חייב להיות אחרי תאריך ההתחלה.');

  const id     = 'E' + new Date().getTime();
  const teamId = (p.teamId || '').trim();
  const act               = String(p.act || '').trim();
  const exerciseType      = String(p.exercise_type || '').trim();
  const partnerBattalion  = String(p.partner_battalion || '').trim();
  const camp              = String(p.camp || '').trim();
  const battalionCommander = String(p.battalion_commander || '').trim();

  _append('Exercises', [
    id, title, description, u.id,
    startDate, endDate,
    act, exerciseType, partnerBattalion, camp, battalionCommander
  ]);

  let info = 'התרגיל נוצר בהצלחה (' + id + ').';

  if (teamId) {
    const result = Assignments_assignTeam(id, teamId, p.sid);
    const team   = Teams_get(teamId);
    const tName  = team ? team.name : teamId;
    if (result.added > 0)   info += ' ' + result.added + ' חיילים מצוות "' + tName + '" נוספו אוטומטית.';
    if (result.skipped > 0) info += ' (' + result.skipped + ' כבר משתתפים.)';
  }

  return Views_exercise({ sid: p.sid, id: id, info: info });
}

// PERF: write all 9 changed columns in a single setValues() call
function Exercises_edit(p) {
  Auth_requireRole(p, ['admin']);
  const row = _findRowIndex('Exercises', p.id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  const sh = _sheet('Exercises');
  // Columns 2-11 (title, description, -, start_date, end_date, act, exercise_type, partner_battalion, camp, battalion_commander)
  // We skip col 4 (created_by). Write cols 2,3 then 5-11 individually isn't much worse,
  // but we can do it in two range writes:
  sh.getRange(row, 2, 1, 2).setValues([[
    p.title       || '',
    p.description || ''
  ]]);
  sh.getRange(row, 5, 1, 7).setValues([[
    p.start_date          || '',
    p.end_date            || '',
    p.act                 || '',
    p.exercise_type       || '',
    p.partner_battalion   || '',
    p.camp                || '',
    p.battalion_commander || ''
  ]]);
  _cacheInvalidate('Exercises');
  return Views_exercise({ sid: p.sid, id: p.id, info: 'התרגיל עודכן בהצלחה.' });
}

function Exercises_duplicate(p) {
  const u    = Auth_requireRole(p, ['admin']);
  const orig = Exercises_get(p.id);
  if (!orig) throw new Error('התרגיל לא נמצא.');
  const newId = 'E' + new Date().getTime();
  _append('Exercises', [newId, orig.title + ' (copy)', orig.description, u.id,
    orig.rawStartDate, orig.rawEndDate, orig.act, orig.exercise_type,
    orig.partner_battalion, orig.camp, orig.battalion_commander]);

  // PERF: batch-append all detail rows at once
  const details = Exercises_details(orig.id);
  if (details.length) {
    const detailRows = details.map(function(d) {
      return ['D' + new Date().getTime() + '_' + d.id, newId, d.time, d.location, d.description];
    });
    _appendBatch('ExerciseDetails', detailRows);
  }

  return Views_dashboard({ sid: p.sid, info: 'התרגיל שוכפל כ-' + newId + '.' });
}

function Exercises_addDetail(p) {
  Auth_requireRole(p, ['admin']);
  const exId = p.exerciseId;
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');
  const did = 'D' + new Date().getTime();
  _append('ExerciseDetails', [did, exId, p.time || '', p.location || '', p.detailDescription || '']);
  return Views_exercise({ sid: p.sid, id: exId, info: 'רישום ציר הזמן נוסף בהצלחה.' });
}

function Exercises_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = (p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');

  // Delete related assignments
  const assignSh   = _sheet('Assignments');
  const assignData = _rows('Assignments').data;
  for (let i = assignData.length - 1; i >= 0; i--) {
    if (String(assignData[i][1]) === id) assignSh.deleteRow(i + 2);
  }
  _cacheInvalidate('Assignments');

  // Delete related details
  const detailSh   = _sheet('ExerciseDetails');
  const detailData = _rows('ExerciseDetails').data;
  for (let i = detailData.length - 1; i >= 0; i--) {
    if (String(detailData[i][1]) === id) detailSh.deleteRow(i + 2);
  }
  _cacheInvalidate('ExerciseDetails');

  const row = _findRowIndex('Exercises', id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  _sheet('Exercises').deleteRow(row);
  _cacheInvalidate('Exercises');

  return Views_dashboard({ sid: p.sid, info: 'התרגיל נמחק יחד עם כל ההקצאות ורשומות ציר הזמן.' });
}
