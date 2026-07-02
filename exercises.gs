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

// Format a date value → "יום שלישי, 15 באפריל 2025"
function _fmtDateTime(dateVal) {
  return _fmtDate(dateVal) || '';
}

// Format date + time → "יום שלישי, 15 באפריל 2025 · 08:00"
function _fmtDateTimeFull(dateVal, timeVal) {
  const datePart = dateVal ? _fmtDate(dateVal) : '';
  const timePart = timeVal != null && timeVal !== '' ? _rawTime(timeVal) : '';
  if (datePart && timePart) return datePart + ' · ' + timePart;
  return datePart || timePart || '';
}

// Format ExerciseDetails time cell (Date, datetime string, or HH:MM)
function _fmtDetailTime(val) {
  if (val == null || val === '') return '—';
  if (val instanceof Date) return _fmtDateTimeFull(val, val);
  const s = String(val).trim();
  if (!s) return '—';
  const d = new Date(s);
  if (!isNaN(d.getTime()) && (/[-/T]/.test(s) || s.length > 10)) {
    return _fmtDateTimeFull(d, d);
  }
  const tp = _rawTime(s);
  return tp || s;
}

// Returns "HH:MM" from a time string or empty
function _rawTime(val) {
  if (!val) return '';
  const s = String(val).trim();
  // Already HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
  // Date object from Sheets time column (fraction of day)
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2,'0');
    const m = String(val.getMinutes()).padStart(2,'0');
    return h + ':' + m;
  }
  return s;
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
    start_date:    _fmtDateTime(r[4], r[11]),
    end_date:      _fmtDateTime(r[5], r[12]),
    rawStartDate:  _rawDate(r[4]),
    rawEndDate:    _rawDate(r[5]),
    rawStartTime:  _rawTime(r[11]),
    rawEndTime:    _rawTime(r[12]),
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
    .map(r => ({
      id: String(r[0]),
      time: _fmtDetailTime(r[2]),
      location: String(r[3] || ''),
      description: String(r[4] || '')
    }));
}

function Exercises_validateCampAndPartner(p) {
  const camp = String(p.camp || '').trim();
  const partner = String(p.partner_battalion || '').trim();

  const zoneNames = FireZones_names();
  const forceLabels = FieldForces_displayLabels();

  if (!zoneNames.length) {
    throw new Error('אין שטחי אש במערכת. הוסף שטחי אש לפני שמירת תרגיל.');
  }
  if (!forceLabels.length) {
    throw new Error('אין כוחות בשטח במערכת. הוסף כוחות בשטח לפני שמירת תרגיל.');
  }
  if (!camp) {
    throw new Error('חובה לבחור מחנה / מגנן משטחי האש.');
  }
  if (!partner) {
    throw new Error('חובה לבחור גדוד שת״פ מכוחות בשטח.');
  }
  if (zoneNames.indexOf(camp) === -1) {
    throw new Error('מחנה / מגנן חייב להיות אחד משטחי האש שהוזנו.');
  }
  if (forceLabels.indexOf(partner) === -1) {
    throw new Error('גדוד שת״פ חייב להיות אחד מכוחות בשטח שהוזנו.');
  }
  return { camp: camp, partner_battalion: partner };
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
  const validated         = Exercises_validateCampAndPartner(p);
  const partnerBattalion  = validated.partner_battalion;
  const camp              = validated.camp;
  const battalionCommander = String(p.battalion_commander || '').trim();

  const startTime = String(p.start_time || '').trim();
  const endTime   = String(p.end_time   || '').trim();

  _append('Exercises', [
    id, title, description, u.id,
    startDate, endDate,
    act, exerciseType, partnerBattalion, camp, battalionCommander,
    startTime, endTime
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

  const validated = Exercises_validateCampAndPartner(p);

  const sh = _sheet('Exercises');
  // Columns 2-11 (title, description, -, start_date, end_date, act, exercise_type, partner_battalion, camp, battalion_commander)
  // We skip col 4 (created_by). Write cols 2,3 then 5-11 individually isn't much worse,
  // but we can do it in two range writes:
  sh.getRange(row, 2, 1, 2).setValues([[
    p.title       || '',
    p.description || ''
  ]]);
  sh.getRange(row, 5, 1, 9).setValues([[
    p.start_date          || '',
    p.end_date            || '',
    p.act                 || '',
    p.exercise_type       || '',
    validated.partner_battalion,
    validated.camp,
    p.battalion_commander || '',
    p.start_time          || '',
    p.end_time            || ''
  ]]);
  _cacheInvalidate('Exercises');
  return Views_exercise({ sid: p.sid, id: p.id, info: 'התרגיל עודכן בהצלחה.' });
}

// Update only schedule fields (timeline drag / resize)
function Exercises_updateTimes(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');
  const row = _findRowIndex('Exercises', id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');

  const sh = _sheet('Exercises');
  sh.getRange(row, 5).setValue(String(p.start_date || '').trim());
  sh.getRange(row, 6).setValue(String(p.end_date || '').trim());
  sh.getRange(row, 12).setValue(String(p.start_time != null ? p.start_time : '').trim());
  sh.getRange(row, 13).setValue(String(p.end_time != null ? p.end_time : '').trim());
  _cacheInvalidate('Exercises');

  if (p.timelineInline) {
    return { ok: true, info: 'זמני התרגיל עודכנו.' };
  }

  const week = p.week != null ? String(p.week) : '0';
  return Views_timeline({
    sid: p.sid,
    week: week,
    info: 'זמני התרגיל עודכנו.'
  });
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
// (החלף את הפונקציה Exercises_delete בקובץ exercises.gs בגרסה הזו)

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

  const msg = 'התרגיל נמחק יחד עם כל ההקצאות ורשומות ציר הזמן.';
  const from = (p.from || '').trim();

  // השאר את המשתמש באותו עמוד שממנו הגיעה המחיקה
  if (from === 'dashboard')  return Views_dashboard({ sid: p.sid, info: msg });
  if (from === 'exercise')   return Views_exercises ? Views_exercises({ sid: p.sid, info: msg })
                                                    : Views_dashboard({ sid: p.sid, info: msg });
  // ברירת מחדל: עמוד ניהול התרגילים
  if (typeof Views_exercises === 'function') return Views_exercises({ sid: p.sid, info: msg });
  return Views_dashboard({ sid: p.sid, info: msg });
}