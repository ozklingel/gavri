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
  if (d.getFullYear() < 1900) return '';
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

/** תצוגת תחילת/סיום תרגיל (לא נוה"ק) — תאריך + שעה */
function _fmtExerciseStartDisplay(ex) {
  if (!ex) return '';
  return _fmtDateTimeFull(ex.rawStartDate || ex.rawDate, ex.rawStartTime);
}

function _fmtExerciseEndDisplay(ex) {
  if (!ex) return '';
  return _fmtDateTimeFull(ex.rawEndDate || ex.rawStartDate || ex.rawDate, ex.rawEndTime);
}

function _fmtExerciseScheduleRange(ex) {
  const start = _fmtExerciseStartDisplay(ex);
  const end = _fmtExerciseEndDisplay(ex);
  if (start && end && start !== end) return start + ' — ' + end;
  return start || end || '';
}

// Format ExerciseDetails time cell (Date, datetime string, or HH:MM)
function _fmtDetailTime(val) {
  if (val == null || val === '') return '—';
  if (val instanceof Date) return _fmtDateTimeFull(val, val);
  const s = String(val).trim();
  if (!s) return '—';

  const canon = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/);
  if (canon) return _fmtDateTimeFull(canon[1], canon[2]);

  const d = new Date(s);
  if (!isNaN(d.getTime()) && (/[-/T]/.test(s) || s.length > 10)) {
    return _fmtDateTimeFull(d, d);
  }
  const tp = _rawTime(s);
  return tp || s;
}

function _exerciseDetailSortMs(val) {
  if (val == null || val === '') return Number.MAX_SAFE_INTEGER;
  if (val instanceof Date) return val.getTime();

  const s = String(val).trim();
  if (!s) return Number.MAX_SAFE_INTEGER;

  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/);
  if (iso) {
    const parts = iso[1].split('-').map(Number);
    let h = 0;
    let m = 0;
    if (iso[2]) {
      const tp = iso[2].split(':').map(Number);
      h = tp[0];
      m = tp[1] || 0;
    }
    return new Date(parts[0], parts[1] - 1, parts[2], h, m, 0, 0).getTime();
  }

  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  let hmMatch = s.match(/(\d{1,2}:\d{2})/);
  const hm = hmMatch ? hmMatch[1] : '';
  for (let mi = 0; mi < months.length; mi++) {
    const re = new RegExp('(\\d{1,2})\\s+ב?' + months[mi] + '\\s+(\\d{4})');
    const m = s.match(re);
    if (m) {
      const tp = hm ? hm.split(':').map(Number) : [0, 0];
      return new Date(+m[2], mi, +m[1], tp[0], tp[1] || 0, 0, 0).getTime();
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.getTime();

  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const tp = s.split(':').map(Number);
    return tp[0] * 3600000 + (tp[1] || 0) * 60000;
  }

  return Number.MAX_SAFE_INTEGER - 1;
}

function _composeDetailTime(dateYmd, timeHm) {
  const date = String(dateYmd || '').trim();
  const hm   = String(timeHm || '').trim();
  if (!date) return '';
  if (!hm) return date;
  return date + ' ' + hm;
}

function _parseDetailDateHm(raw) {
  const s = String(raw || '').trim();
  if (!s) return { date: '', time: '' };

  const canon = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  if (canon) return { date: canon[1], time: canon[2] };

  const sortMs = _exerciseDetailSortMs(s);
  if (sortMs < Number.MAX_SAFE_INTEGER - 2) {
    const ymd = Exercise_msToYmd(sortMs);
    const d = new Date(sortMs);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return { date: ymd, time: hm };
  }
  return { date: '', time: '' };
}

function _shiftSingleDetailTimePart(part, deltaMs, anchorYmd) {
  part = String(part || '').trim();
  if (!part || !deltaMs) return part;

  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/.test(part)) {
    const sortMs = _exerciseDetailSortMs(part);
    if (sortMs >= Number.MAX_SAFE_INTEGER - 2) return part;
    const newMs = sortMs + deltaMs;
    const ymd = Exercise_msToYmd(newMs);
    const d = new Date(newMs);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return _composeDetailTime(ymd, hm);
  }

  if (/^\d{1,2}:\d{2}$/.test(part) && anchorYmd) {
    const baseMs = Exercise_msFromYmdHm(anchorYmd, part);
    if (isNaN(baseMs)) return part;
    const d = new Date(baseMs + deltaMs);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  const sortMs = _exerciseDetailSortMs(part);
  if (sortMs >= Number.MAX_SAFE_INTEGER - 2) return part;
  const newMs = sortMs + deltaMs;
  const ymd = Exercise_msToYmd(newMs);
  const d = new Date(newMs);
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return _fmtDateTimeFull(ymd, hm);
}

function _shiftExerciseDetailTime(raw, deltaMs) {
  if (!deltaMs || raw == null || raw === '') return raw;
  let s = String(raw).trim();
  let note = '';
  const noteMatch = s.match(/^(.+?)\s+\((.+)\)$/);
  if (noteMatch) {
    s = noteMatch[1].trim();
    note = noteMatch[2];
  }

  if (s.indexOf(' — ') !== -1) {
    const parts = s.split(' — ');
    const startPart = parts[0].trim();
    const startParsed = _parseDetailDateHm(startPart);
    const anchorYmd = startParsed.date || '';
    const shifted = parts.map(function(p, idx) {
      return _shiftSingleDetailTimePart(p.trim(), deltaMs, idx > 0 ? anchorYmd : '');
    });
    const out = shifted.join(' — ');
    return note ? out + ' (' + note + ')' : out;
  }

  const shifted = _shiftSingleDetailTimePart(s, deltaMs, '');
  return note ? shifted + ' (' + note + ')' : shifted;
}

function Exercises_shiftAllDetails(exerciseId, deltaMs) {
  if (!deltaMs) return 0;
  const sh = _sheet('ExerciseDetails');
  const data = _rows('ExerciseDetails').data;
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][1]) !== String(exerciseId)) continue;
    const raw = data[i][2];
    const shifted = _shiftExerciseDetailTime(raw, deltaMs);
    if (shifted !== raw) {
      sh.getRange(i + 2, 3).setValue(shifted);
      count++;
    }
  }
  if (count) _cacheInvalidate('ExerciseDetails');
  return count;
}

function Exercises_shiftDetailsForScheduleChange(exerciseId, oldEx, p) {
  const anchor = String(p.shift_anchor || 'start').trim() === 'end' ? 'end' : 'start';
  let oldMs;
  let newMs;
  if (anchor === 'end') {
    oldMs = Exercise_msFromYmdHm(oldEx.rawEndDate || oldEx.rawStartDate, oldEx.rawEndTime || '23:59');
    newMs = Exercise_msFromYmdHm(
      String(p.end_date || oldEx.rawEndDate || oldEx.rawStartDate || '').trim(),
      String(p.end_time != null ? p.end_time : oldEx.rawEndTime || '23:59').trim()
    );
  } else {
    oldMs = Exercise_msFromYmdHm(oldEx.rawStartDate, oldEx.rawStartTime || '00:00');
    newMs = Exercise_msFromYmdHm(
      String(p.start_date || '').trim(),
      String(p.start_time != null ? p.start_time : '').trim()
    );
  }
  if (isNaN(oldMs) || isNaN(newMs)) return 0;
  const deltaMs = newMs - oldMs;
  if (!deltaMs) return 0;
  return Exercises_shiftAllDetails(exerciseId, deltaMs);
}

// Returns "HH:MM" from a time string or empty
function _rawTime(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const h = String(val.getHours()).padStart(2, '0');
    const m = String(val.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }
  if (typeof val === 'number' && !isNaN(val)) {
    if (val >= 0 && val < 1) {
      const mins = Math.round(val * 24 * 60);
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    return '';
  }
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
  const tp = s.match(/^(\d{1,2}):(\d{2})/);
  if (tp) return String(+tp[1]).padStart(2, '0') + ':' + tp[2];
  return s;
}

function _ymdPlusDays(ymd, days) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3) return ymd;
  const d = new Date(parts[0], parts[1] - 1, parts[2] + (days || 0), 12, 0, 0, 0);
  return Exercise_msToYmd(d.getTime());
}

function _exerciseDurationHFromDescription(desc) {
  const m = String(desc || '').match(/(\d+)\s*שעות/);
  return m ? parseInt(m[1], 10) : 0;
}

function _hebrewMonths() {
  return ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
}

/** Normalizes sheet / display values → YYYY-MM-DD (local calendar). */
function _ymdFromCellValue(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    if (val.getFullYear() < 1900) return '';
    const y  = val.getFullYear();
    const m  = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  const s = String(val).trim();
  if (!s) return '';

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    if (+iso[1] < 1900) return '';
    return iso[1] + '-' + iso[2] + '-' + iso[3];
  }

  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    return dmy[3] + '-' + String(+dmy[2]).padStart(2, '0') + '-' + String(+dmy[1]).padStart(2, '0');
  }

  const months = _hebrewMonths();
  for (let mi = 0; mi < months.length; mi++) {
    const re = new RegExp('(\\d{1,2})\\s+ב?' + months[mi] + '\\s+(\\d{4})');
    const m = s.match(re);
    if (m) {
      return m[2] + '-' + String(mi + 1).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  return '';
}

function _rawDate(val) {
  return _ymdFromCellValue(val);
}

// Parse YYYY-MM-DD (or flexible date) → local midnight ms. Returns NaN if invalid.
function _parseRawDate(str) {
  const ymd = _ymdFromCellValue(str);
  if (!ymd) return NaN;
  return Exercise_msFromYmdHm(ymd, '00:00');
}

/** Schedule range for an exercise record (used by timeline, conflicts, series). */
function _exerciseTimeRange(ex) {
  const DAY_MS  = 86400000;
  const HOUR_MS = 3600000;
  const startYmd = ex.rawStartDate || _ymdFromCellValue(ex.date) || '';
  let endYmd = ex.rawEndDate || startYmd;
  if (!startYmd) return null;

  const startTime = ex.rawStartTime || '00:00';
  const startMs = Exercise_msFromYmdHm(startYmd, startTime);
  if (isNaN(startMs)) return null;

  let endMs;
  if (ex.rawEndTime) {
    endMs = Exercise_msFromYmdHm(endYmd, ex.rawEndTime);
    if (!isNaN(endMs) && endMs <= startMs) {
      endMs = Exercise_msFromYmdHm(_ymdPlusDays(endYmd, 1), ex.rawEndTime);
      endYmd = _ymdPlusDays(endYmd, 1);
    }
  } else {
    endMs = Exercise_msFromYmdHm(endYmd, '23:59');
    if (isNaN(endMs)) endMs = startMs + DAY_MS;
  }
  if (endMs <= startMs) {
    const durH = _exerciseDurationHFromDescription(ex.description);
    if (durH > 0) {
      endMs = startMs + durH * HOUR_MS;
    } else {
      endMs = startMs + (ex.rawStartTime ? HOUR_MS : DAY_MS);
    }
  }
  return { startMs: startMs, endMs: endMs };
}

var EXERCISE_DAY_START_H = 6;
var EXERCISE_DAY_END_H = 18;

/** 'day' | 'night' | null — לפי "יום" / "לילה" בשם התרגיל (סוג וריאנט לפני סוגריים). */
function Exercise_slotKindFromName(name) {
  const s = String(name || '');
  const dayMarkers = ['יבש רטוב יום', 'התקדמות יום', 'התקפה יום', 'הגנה יום'];
  const nightMarkers = [
    'יבש רטוב מועמד לילה', 'יבש רטוב לילה',
    'התקדמות לילה', 'התקפה לילה', 'הגנה לילה'
  ];
  let i;
  for (i = 0; i < dayMarkers.length; i++) {
    if (s.indexOf(dayMarkers[i]) !== -1) return 'day';
  }
  for (i = 0; i < nightMarkers.length; i++) {
    if (s.indexOf(nightMarkers[i]) !== -1) return 'night';
  }
  if (s.indexOf('לילה') !== -1) return 'night';
  if (s.indexOf('יום') !== -1) return 'day';
  return null;
}

function Exercise_msInSlotKind(ms, kind) {
  const h = new Date(ms).getHours();
  if (kind === 'night') {
    return h >= EXERCISE_DAY_END_H || h < EXERCISE_DAY_START_H;
  }
  if (kind === 'day') {
    return h >= EXERCISE_DAY_START_H && h < EXERCISE_DAY_END_H;
  }
  return true;
}

function Exercise_msFromYmdHm(dateYmd, timeHm) {
  const parts = String(dateYmd || '').split('-').map(Number);
  if (parts.length !== 3) return NaN;
  const tp = String(timeHm || '00:00').trim().split(':').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], tp[0] || 0, tp[1] || 0, 0, 0).getTime();
}

/** 0 = ראשון — אסור לשבץ תרגילים ביום זה. */
var EXERCISE_BLOCKED_WEEKDAYS = { 0: true };

function Exercise_msToYmd(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** מעבר על כל ימי הלוח שבין startMs ל-endMs (end בלעדי). */
function Exercise_eachDayYmdInRange(startMs, endMs, fn) {
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return;
  let cur = Exercise_msToYmd(startMs);
  const last = Exercise_msToYmd(endMs - 1);
  while (cur <= last) {
    fn(cur);
    const parts = cur.split('-').map(Number);
    const next = new Date(parts[0], parts[1] - 1, parts[2] + 1, 12, 0, 0, 0);
    cur = Exercise_msToYmd(next.getTime());
  }
}

/** null = תקין; אחרת הודעת שגיאה בעברית. */
function Exercise_validateBlockedWeekdays(startMs, endMs) {
  if (isNaN(startMs) || isNaN(endMs)) return null;
  let blocked = false;
  Exercise_eachDayYmdInRange(startMs, endMs, function(ymd) {
    const wd = new Date(Exercise_msFromYmdHm(ymd, '12:00')).getDay();
    if (EXERCISE_BLOCKED_WEEKDAYS[wd]) blocked = true;
  });
  if (blocked) {
    return 'אסור לקבוע תרגיל ביום ראשון (כולל תרגיל שנמשך אליו).';
  }
  return null;
}

/** חיר: חלק יבש/רטוב מתוך יבש־רטוב — נבדק כבלוק בבניית סדרה, לא לפי שעת החלק. */
function Exercise_isChirSplitPartTitle(title) {
  const s = String(title || '');
  return s.indexOf('יבש רטוב') !== -1 &&
    (s.indexOf('— יבש') !== -1 || s.indexOf('— רטוב') !== -1);
}

/** null = תקין; אחרת הודעת שגיאה בעברית. */
function Exercise_validateNameAgainstTimes(title, startMs, endMs) {
  if (Exercise_isChirSplitPartTitle(title)) return null;
  const kind = Exercise_slotKindFromName(title);
  if (!kind || isNaN(startMs) || isNaN(endMs)) return null;

  if (!Exercise_msInSlotKind(startMs, kind)) {
    if (kind === 'day') {
      return 'תרגיל עם "יום" בשם חייב להתחיל בשעות היום (06:00–18:00).';
    }
    return 'תרגיל עם "לילה" בשם חייב להתחיל בשעות הלילה (18:00–06:00).';
  }

  if (kind === 'day') {
    const endH = new Date(endMs).getHours();
    const endM = new Date(endMs).getMinutes();
    if (endH > EXERCISE_DAY_END_H || (endH === EXERCISE_DAY_END_H && endM > 0)) {
      return 'תרגיל עם "יום" בשם לא יכול להימשך לשעות הלילה (סיום עד 18:00).';
    }
  }

  return null;
}

function Exercises_appendRows(rows) {
  if (!rows || !rows.length) return;
  const sh = _sheet('Exercises');
  const last = sh.getLastRow();
  sh.getRange(last + 1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(last + 1, 5, rows.length, 2).setNumberFormat('@');
  sh.getRange(last + 1, 12, rows.length, 2).setNumberFormat('@');
  _cacheInvalidate('Exercises');
}

function Exercises_activeIdSet() {
  const activeSid = Series_getActiveId();
  const col = Series_exerciseColIndex();
  const set = {};
  _rows('Exercises').data.forEach(function(r) {
    const exId = String(r[0]);
    const sid = String(r[col] || '').trim();
    if (activeSid) {
      if (sid === activeSid) set[exId] = true;
    } else if (!sid) {
      set[exId] = true;
    }
  });
  return set;
}

function Exercises_all(includeArchived) {
  const activeSid = includeArchived ? null : Series_getActiveId();
  const seriesCol = Series_exerciseColIndex();
  return _rows('Exercises').data.map(r => ({
    id:          String(r[0]),
    title:       String(r[1]),
    description: String(r[2]),
    created_by:  String(r[3]),
    start_date:    _fmtExerciseStartDisplay({ rawStartDate: _rawDate(r[4]), rawDate: _rawDate(r[4]), rawStartTime: r[11] }),
    end_date:      _fmtExerciseEndDisplay({ rawEndDate: _rawDate(r[5]), rawStartDate: _rawDate(r[4]), rawDate: _rawDate(r[4]), rawEndTime: r[12] }),
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
    battalion_commander: r[10] == null ? '' : String(r[10]),
    series_force_slot:   r[13] == null ? '' : String(r[13]),
    field_force_id:      r[14] == null ? '' : String(r[14]),
    series_id:           r[seriesCol] == null ? '' : String(r[seriesCol])
  })).filter(function(e) {
    if (includeArchived) return true;
    if (!activeSid) return !e.series_id;
    return e.series_id === activeSid;
  });
}

var _exercisesById = null;
var _exerciseDetailsByExId = null;

function _exercisesClearDerived() {
  _exercisesById = null;
  _exerciseDetailsByExId = null;
}

function Exercises_byIdMap() {
  if (!_rowsCache['Exercises']) _exercisesClearDerived();
  if (_exercisesById) return _exercisesById;
  _exercisesById = {};
  Exercises_all().forEach(function(e) { _exercisesById[e.id] = e; });
  return _exercisesById;
}

function Exercises_get(id) {
  return Exercises_byIdMap()[String(id)] || null;
}

function _exerciseDetailFromRow(r) {
  return {
    id: String(r[0]),
    rawTime: r[2],
    time: _fmtDetailTime(r[2]),
    location: String(r[3] || ''),
    description: String(r[4] || '')
  };
}

function Exercises_detailsIndex() {
  if (!_rowsCache['ExerciseDetails']) _exercisesClearDerived();
  if (_exerciseDetailsByExId) return _exerciseDetailsByExId;
  _exerciseDetailsByExId = {};
  const activeIds = Exercises_activeIdSet();
  _rows('ExerciseDetails').data.forEach(function(r) {
    const exId = String(r[1]);
    if (!activeIds[exId]) return;
    if (!_exerciseDetailsByExId[exId]) _exerciseDetailsByExId[exId] = [];
    _exerciseDetailsByExId[exId].push(_exerciseDetailFromRow(r));
  });
  Object.keys(_exerciseDetailsByExId).forEach(function(exId) {
    _exerciseDetailsByExId[exId].sort(function(a, b) {
      return _exerciseDetailSortMs(a.rawTime) - _exerciseDetailSortMs(b.rawTime);
    });
  });
  return _exerciseDetailsByExId;
}

function Exercises_details(exerciseId) {
  const list = Exercises_detailsIndex()[String(exerciseId)];
  return list ? list.slice() : [];
}

function _exerciseDetailsInsertSorted(exId, row) {
  const sh = _sheet('ExerciseDetails');
  const data = _rows('ExerciseDetails').data;
  const newMs = _exerciseDetailSortMs(row[2]);
  let insertRow = null;

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][1]) !== String(exId)) continue;
    if (_exerciseDetailSortMs(data[i][2]) > newMs) {
      insertRow = i + 2;
      break;
    }
  }

  if (insertRow === null) {
    let last = null;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][1]) === String(exId)) last = i + 2;
    }
    insertRow = last ? last + 1 : sh.getLastRow() + 1;
  }

  if (insertRow > sh.getLastRow()) {
    sh.appendRow(row);
  } else {
    sh.insertRowBefore(insertRow);
    sh.getRange(insertRow, 1, 1, row.length).setValues([row]);
  }
  _cacheInvalidate('ExerciseDetails');
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

  const startMs = Exercise_msFromYmdHm(startDate, startTime);
  const endMs = Exercise_msFromYmdHm(endDate, endTime);
  const slotErr = Exercise_validateNameAgainstTimes(title, startMs, endMs);
  if (slotErr) throw new Error(slotErr);
  const dayErr = Exercise_validateBlockedWeekdays(startMs, endMs);
  if (dayErr) throw new Error(dayErr);

  _append('Exercises', [
    id, title, description, u.id,
    startDate, endDate,
    act, exerciseType, partnerBattalion, camp, battalionCommander,
    startTime, endTime
  ]);

  Series_ensureMigrated();
  const seriesId = Series_getActiveId();
  if (seriesId) Series_assignExercisesToSeries([id], seriesId);

  SystemLog_write({
    user_id: u.id,
    action: 'exercise.create',
    entity_type: 'exercise',
    entity_id: id,
    details: { title: title, series_id: seriesId }
  });

  let info = 'התרגיל נוצר בהצלחה (' + id + ').';

  if (teamId) {
    const result = Assignments_assignTeam(id, teamId, p.sid);
    const team   = Teams_get(teamId);
    const tName  = team ? team.name : teamId;
    if (result.added > 0)   info += ' ' + result.added + ' חיילים מצוות "' + tName + '" נוספו אוטומטית.';
    if (result.skipped > 0) info += ' (' + result.skipped + ' כבר משתתפים.)';
  }

  if (String(p.from || '').trim() === 'timeline') {
    const week = p.week != null ? String(p.week) : '0';
    return Views_timeline({
      sid: p.sid,
      week: week,
      range: p.range != null ? String(p.range) : 'week',
      pos: p.pos != null ? String(p.pos) : undefined,
      info: info
    });
  }

  return Views_exercise({ sid: p.sid, id: id, info: info });
}

// PERF: write all 9 changed columns in a single setValues() call
function Exercises_edit(p) {
  Auth_requireRole(p, ['admin']);
  const row = _findRowIndex('Exercises', p.id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  const ex = Exercises_get(p.id);

  const title = String(p.title || '').trim();
  const startMs = Exercise_msFromYmdHm(p.start_date, p.start_time);
  const endMs = Exercise_msFromYmdHm(p.end_date, p.end_time);
  const slotErr = Exercise_validateNameAgainstTimes(title, startMs, endMs);
  if (slotErr) throw new Error(slotErr);
  const dayErr = Exercise_validateBlockedWeekdays(startMs, endMs);
  if (dayErr) throw new Error(dayErr);

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

  let info = 'התרגיל עודכן בהצלחה.';
  if (_parseBool(p.shift_procedure) && ex) {
    const shifted = Exercises_shiftDetailsForScheduleChange(p.id, ex, p);
    if (shifted) info += ' לוז נוה"ק עודכן (' + shifted + ' רשומות).';
  }

  return Views_exercise({ sid: p.sid, id: p.id, info: info });
}

// Update only schedule fields (timeline drag / resize)
function Exercises_updateTimes(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');
  const row = _findRowIndex('Exercises', id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');

  const ex = Exercises_get(id);
  const startMs = Exercise_msFromYmdHm(p.start_date, p.start_time);
  const endMs = Exercise_msFromYmdHm(p.end_date, p.end_time);
  const slotErr = Exercise_validateNameAgainstTimes(ex ? ex.title : '', startMs, endMs);
  if (slotErr) throw new Error(slotErr);
  const dayErr = Exercise_validateBlockedWeekdays(startMs, endMs);
  if (dayErr) throw new Error(dayErr);

  const sh = _sheet('Exercises');
  sh.getRange(row, 5).setValue(String(p.start_date || '').trim());
  sh.getRange(row, 6).setValue(String(p.end_date || '').trim());
  sh.getRange(row, 12).setValue(String(p.start_time != null ? p.start_time : '').trim());
  sh.getRange(row, 13).setValue(String(p.end_time != null ? p.end_time : '').trim());
  _cacheInvalidate('Exercises');

  let shiftInfo = '';
  if (_parseBool(p.shift_procedure) && ex) {
    const shifted = Exercises_shiftDetailsForScheduleChange(id, ex, p);
    if (shifted) shiftInfo = ' לוז נוה"ק עודכן (' + shifted + ' רשומות).';
  }

  if (p.timelineInline) {
    return { ok: true, info: 'זמני התרגיל עודכנו.' + shiftInfo };
  }

  const week = p.week != null ? String(p.week) : '0';
  return Views_timeline({
    sid: p.sid,
    week: week,
    range: p.range != null ? String(p.range) : 'week',
    pos: p.pos != null ? String(p.pos) : undefined,
    info: 'זמני התרגיל עודכנו.' + shiftInfo
  });
}

function Exercises_duplicate(p) {
  const u    = Auth_requireRole(p, ['admin']);
  const orig = Exercises_get(p.id);
  if (!orig) throw new Error('התרגיל לא נמצא.');
  const newId = 'E' + new Date().getTime();
  _append('Exercises', [newId, orig.title + ' (עותק)', orig.description, u.id,
    orig.rawStartDate, orig.rawEndDate, orig.act, orig.exercise_type,
    orig.partner_battalion, orig.camp, orig.battalion_commander,
    orig.rawStartTime || '', orig.rawEndTime || '',
    orig.series_force_slot || '', orig.field_force_id || '']);

  // PERF: batch-append all detail rows at once
  const details = Exercises_details(orig.id);
  if (details.length) {
    const detailRows = details.map(function(d) {
      return ['D' + new Date().getTime() + '_' + d.id, newId, d.time, d.location, d.description];
    });
    _appendBatch('ExerciseDetails', detailRows);
  }

  return Views_exercise({
    sid: p.sid,
    id: newId,
    info: 'התרגיל «' + orig.title + '» שוכפל בהצלחה.'
  });
}

function Exercises_addDetail(p) {
  Auth_requireRole(p, ['admin']);
  const exId = p.exerciseId;
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');

  const dateYmd = String(p.detail_date || p.date || '').trim();
  const timeHm  = _rawTime(String(p.detail_time || p.time || '').trim());
  const location = String(p.location || '').trim();
  const description = String(p.detailDescription || p.description || '').trim();

  if (!dateYmd) throw new Error('חובה לבחור תאריך.');
  if (isNaN(_parseRawDate(dateYmd))) throw new Error('תאריך לא תקין.');
  if (!timeHm) throw new Error('חובה לבחור שעה.');

  const timeStored = _composeDetailTime(dateYmd, timeHm);
  const did = 'D' + new Date().getTime();
  _exerciseDetailsInsertSorted(exId, [did, exId, timeStored, location, description]);
  return Views_exercise({ sid: p.sid, id: exId, info: 'רישום ציר הזמן נוסף וסודר לפי תאריך ושעה.' });
}

function Exercises_updateDetail(p) {
  Auth_requireRole(p, ['admin']);
  const detailId = String(p.detailId || '').trim();
  const exId = String(p.exerciseId || '').trim();
  if (!detailId) throw new Error('חסר מזהה רישום.');
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');

  const dateYmd = String(p.detail_date || p.date || '').trim();
  const timeHm  = _rawTime(String(p.detail_time || p.time || '').trim());
  const location = String(p.location || '').trim();
  const description = String(p.detailDescription || p.description || '').trim();

  if (!dateYmd) throw new Error('חובה לבחור תאריך.');
  if (isNaN(_parseRawDate(dateYmd))) throw new Error('תאריך לא תקין.');
  if (!timeHm) throw new Error('חובה לבחור שעה.');

  const rowIdx = _findRowIndex('ExerciseDetails', detailId);
  if (rowIdx < 0) throw new Error('רישום לא נמצא.');

  const sh = _sheet('ExerciseDetails');
  const rowData = sh.getRange(rowIdx, 1, 1, 5).getValues()[0];
  if (String(rowData[1]) !== String(exId)) throw new Error('רישום לא שייך לתרגיל.');

  const timeStored = _composeDetailTime(dateYmd, timeHm);
  sh.deleteRow(rowIdx);
  _cacheInvalidate('ExerciseDetails');
  _exerciseDetailsInsertSorted(exId, [detailId, exId, timeStored, location, description]);
  return Views_exercise({ sid: p.sid, id: exId, info: 'רישום נוה"ק עודכן.' });
}

function Exercises_deleteDetail(p) {
  Auth_requireRole(p, ['admin']);
  const detailId = String(p.detailId || '').trim();
  const exId = String(p.exerciseId || '').trim();
  if (!detailId) throw new Error('חסר מזהה רישום.');

  const rowIdx = _findRowIndex('ExerciseDetails', detailId);
  if (rowIdx < 0) throw new Error('רישום לא נמצא.');

  const sh = _sheet('ExerciseDetails');
  const rowData = sh.getRange(rowIdx, 1, 1, 5).getValues()[0];
  if (exId && String(rowData[1]) !== String(exId)) throw new Error('רישום לא שייך לתרגיל.');

  sh.deleteRow(rowIdx);
  _cacheInvalidate('ExerciseDetails');
  return Views_exercise({
    sid: p.sid,
    id: exId || String(rowData[1]),
    info: 'רישום נמחק מנוהל הקרב.'
  });
}

/** @deprecated — בניית סדרה משתמשת ב-Series_prepareNewBuild (ארכוב, לא מחיקה). */
function Exercises_clearAllBeforeSeries() {
  return 0;
}

// (החלף את הפונקציה Exercises_delete בקובץ exercises.gs בגרסה הזו)

function Exercises_delete(p) {
  const u = Auth_requireRole(p, ['admin']);
  const id = (p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');

  const ex = Exercises_get(id);
  SystemLog_write({
    user_id: u.id,
    action: 'exercise.delete',
    entity_type: 'exercise',
    entity_id: id,
    details: {
      title: ex ? ex.title : '',
      series_id: ex ? ex.series_id : ''
    }
  });

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