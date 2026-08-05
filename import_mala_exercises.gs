// import_mala_exercises.gs — ייבוא חד-פעמי: 8 תרגילי מאל"א + לו"ז נוה"ק
//
// הרצה מעורך Apps Script:
//   importMalaExercisesPreview()  — תצוגה מקדימה (לוג בלבד)
//   importMalaExercisesOnce()     — ייבוא לגיליונות
//   importMalaExercisesOnce(true) — dry-run (לוג בלי כתיבה)
//
// מחיקה (אם צריך להריץ שוב):
//   deleteMalaImportedExercises()

var MALA_IMPORT_YEAR = 2026;
var MALA_IMPORT_PREFIX = 'MALA-2026';
var MALA_IMPORT_TZ = 'Asia/Jerusalem';

/** שורת «זמן תרגיל» מהטבלה — מקור אמת לתאריכי התרגילים */
function MalaImport_zmanTargilTimes_() {
  return [
    '16.8|17:00-21:00', '16.8|23:00-03:00', '16.8|17:00-21:00', '16.8|23:00-03:00',
    '17.8|17:00-21:00', '17.8|23:00-03:00', '18.8|17:00-21:00', '18.8|23:00-03:00'
  ];
}

/** מפרק תא «DD.M|HH:MM-HH:MM» לחלון תרגיל */
function MalaImport_parseExerciseWindow_(raw) {
  const s = String(raw || '').trim();
  const range = s.match(/^(\d{1,2}\.\d{1,2})\s*\|\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!range) return null;
  const start = MalaImport_parseDayMonth_(range[1]);
  const startTime = range[2];
  const endTime = range[3];
  let end = start;
  if (parseInt(endTime.split(':')[0], 10) < parseInt(startTime.split(':')[0], 10)) {
    end = MalaImport_addDaysYmd_(start, 1);
  }
  return { start: start, end: end, startTime: startTime, endTime: endTime };
}

/** 8 תרגילים — אקט, סוג, ומועד מהשורה «זמן תרגיל» */
function MalaImport_exerciseDefs_() {
  const meta = [
    { act: 'א\'', type: 'מאל"א מערב' },
    { act: 'ב\'', type: 'מאל"א מערב' },
    { act: 'א\'', type: 'מאל"א צפון' },
    { act: 'ב\'', type: 'מאל"א צפון' },
    { act: 'א\'', type: 'מאל"א מערב' },
    { act: 'ב\'', type: 'מאל"א מערב' },
    { act: 'א\'', type: 'מאל"א צפון' },
    { act: 'ב\'', type: 'מאל"א צפון' }
  ];
  const zman = MalaImport_zmanTargilTimes_();
  return meta.map(function(m, i) {
    const win = MalaImport_parseExerciseWindow_(zman[i]);
    if (!win) throw new Error('תא זמן תרגיל לא תקין: ' + zman[i]);
    return {
      act: m.act,
      type: m.type,
      start: win.start,
      end: win.end,
      startTime: win.startTime,
      endTime: win.endTime,
      zmanRaw: zman[i]
    };
  });
}

/**
 * שורות נוה"ק — times[i] = תא זמן לתרגיל i (0..7)
 * פורמט: "DD.M|HH:MM", "DD.M|HH:MM-HH:MM", "DD.M", "סולן", "" (דילוג)
 */
function MalaImport_procedureRows_() {
  return [
    {
      duration: '60 דק\'',
      location: 'מחנה צאלים',
      title: 'קפ"ק 1 תאום ציפיות ומתן דגשים ולקחים למג"ד בראשות מנהל התרגיל',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד, קמב"ץ גדוד (קמ"פ)',
      times: ['30.7|15:30', '30.7|15:30', '30.7|15:30', '30.7|15:30',
        '30.7|15:30', '30.7|15:30', '30.7|15:30', '30.7|15:30']
    },
    {
      duration: 'יום שלם',
      location: 'מחנה צאלים',
      title: 'תכנון גדודי',
      participants: 'מכלול מבצעים גדודי',
      times: ['12.8', '12.8', '12.8', '12.8', '13.8', '13.8', '16.8', '16.8']
    },
    {
      duration: '60 דק\'',
      location: 'מחנה צאלים',
      title: 'א.ת. חטיבתי למג"ד',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד',
      times: ['13.8|09:00-10:00', '13.8|09:00-10:00', '13.8|09:00-10:00', '13.8|09:00-10:00',
        '16.8|09:00-10:00', '16.8|09:00-10:00', '17.8|09:00-10:00', '18.8|09:00-10:00']
    },
    {
      duration: '60 דק\'',
      location: 'מחנה צק"ג',
      title: 'קפ"ק 1 גדודי למ"פים',
      participants: 'מנהל התרגיל, ק\' הבטיחות הראשי, מג"ד, מטה גדוד, מ"פים',
      times: ['13.8|13:00-14:00', '13.8|13:00-14:00', '13.8|13:00-14:00', '13.8|13:00-14:00',
        '16.8|13:00-14:00', '16.8|13:00-14:00', '17.8|13:00-14:00', '18.8|13:00-14:00']
    },
    {
      duration: '2 שעות',
      location: 'מחנה צק"ג',
      title: 'חל"ז לא.ת. גדודי למ"פים — יש לקבוע דירוג בין המ"פים',
      participants: 'מג"ד, מטה גדוד, מ"פים',
      times: ['13.8|17:00-18:00', '13.8|17:00-18:00', '13.8|17:00-18:00', '13.8|17:00-18:00',
        '16.8|17:00-18:00', '16.8|17:00-18:00', '17.8|17:00-18:00', '18.8|17:00-18:00']
    },
    {
      duration: '60 דק\'',
      location: 'מחנה צק"ג',
      title: 'תדריך מ"פ למ"מים (קפ"ק 1)',
      participants: 'מ"פים, מ"פים אורגניים, מ"מים, ק\' בטיחות פלוגתי',
      times: ['16.8|11:30', '16.8|11:30', '16.8|11:30', '16.8|11:30',
        '17.8|11:30', '17.8|11:30', '18.8|11:30', '18.8|11:30']
    },
    {
      duration: '2 שעות',
      location: 'שטח אש',
      title: 'סיו"ש בטיחות בראשות מנהל התרגיל — מוכוון תרגיל',
      participants: 'מנהל התרגיל, ק\' הבטיחות הראשי, ק\' בטיחות ארטילריה, מ\' אחראי, ק\' הבטיחות בכל המסגרות',
      times: ['16.8|11:00', '16.8|11:00', '16.8|11:00', '16.8|11:00',
        '17.8|11:00', '17.8|11:00', '18.8|11:00', '18.8|11:00']
    },
    {
      duration: '30 דק\'',
      location: 'לשכת מפקד',
      title: 'שולחן עגול בראשות מ\' מרכז דרומי — עד 24 שעות לפני התרגיל | אחרי א.ת. למג"ד',
      participants: 'מנהל התרגיל, קצין הבטיחות הראשי, מפקד אחראי, מפקד מרכז דרומי, ק\' אג"ם מרכז דרומי, קבט"ח מ\' דרומי',
      times: ['16.8|13:00', '16.8|13:00', '17.8|13:00', '17.8|13:00',
        '18.8|13:00', '18.8|13:00', '19.8|13:00', '19.8|13:00']
    },
    {
      duration: '90 דק\'',
      location: 'מחנה צק"ג',
      title: 'קפ"ק 2',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד, מ"פים, מ"מים עם משימה גדודית, מפקדים אחראיים, מעטה חטיבתי בהובלת ארזים, כל מערך הבטיחות',
      times: ['16.8|14:00-22:00', '16.8|14:00-22:00', '16.8|14:00-22:00', '16.8|14:00-22:00',
        '17.8|14:00-22:00', '17.8|14:00-22:00', '18.8|14:00-22:00', '18.8|14:00-22:00']
    },
    {
      duration: '45 דק\'',
      location: 'מחנה צק"ג',
      title: 'קפ"ק 3 + תדריך מנהלת',
      participants: 'מנהל התרגיל, ק\' הבטיחות, ראש מעטה החטיבה, מפקד אחראי',
      times: ['16.8|16:00', '17.8|16:00', '18.8|16:00', '19.8|16:00',
        '16.8|16:00', '17.8|16:00', '18.8|16:00', '19.8|16:00']
    },
    {
      duration: '60 דק\'',
      location: 'מחנה צק"ג / שטח כינוס',
      title: 'מודל ומסדר מערכות — שו"ב, מגנט, קשר, דרוריות, מיקום רק"ש, מפתוחים בהובלת מפקד אחראי',
      participants: 'כלל הכוחות הרלוונטיים כולל רכבי מתב"ת',
      times: ['16.8|16:00', '17.8|16:00', '18.8|16:00', '19.8|16:00',
        '16.8|16:00', '17.8|16:00', '18.8|16:00', '19.8|16:00']
    },
    {
      duration: 'משתנה',
      location: 'מרחב התרגיל',
      title: 'זמן תרגיל (כולל שלדי מפקדים יום ע"פ צורך)',
      participants: 'כלל הכוחות המתורגלים',
      times: MalaImport_zmanTargilTimes_(),
      skipDetail: true
    },
    {
      duration: '30 דק\'',
      location: 'נק\' סיום תרגיל',
      title: 'סיכום פלוגתי',
      participants: 'מרמת מ"מ',
      times: ['', '', '', '', '', '', '', '']
    },
    {
      duration: '60 דק\' לשני התרגילים',
      location: 'מחנה צאלים',
      title: 'מגירת פתיחה — קביעת מוקדי התחקיר',
      participants: 'מנהל התרגיל, ארזים, מג"דים מתרגלים',
      times: ['17.8|09:00', '17.8|09:00', '18.8|09:00', '18.8|09:00',
        '19.8|09:00', '19.8|09:00', '20.8|09:00', '20.8|09:00']
    },
    {
      duration: 'שעה לסיכום',
      location: 'מחנה צאלים',
      title: 'תחקיר גדודי',
      participants: 'מג"דים, מטה גדוד, מ"פים',
      times: ['17.8|10:00-11:00', '17.8|10:00-11:00', '18.8|10:00-11:00', '18.8|10:00-11:00',
        '19.8|10:00-11:00', '19.8|10:00-11:00', '20.8|10:00-11:00', '20.8|10:00-11:00']
    },
    {
      duration: '60 דק\'',
      location: 'מחנה צאלים',
      title: 'משוב חונך — מתרגל',
      participants: 'חונך ומתרגל (אישי)',
      times: ['', '', '', '', '', '', '', '']
    }
  ];
}

// ── Parsing helpers ──

function MalaImport_parseDayMonth_(token, year) {
  const m = String(token || '').trim().match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!m) return '';
  year = year || MALA_IMPORT_YEAR;
  return year + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
}

function MalaImport_addDaysYmd_(ymd, days) {
  if (!ymd) return ymd;
  const p = String(ymd).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + days, 12, 0, 0, 0);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** תאריך לגיליון — צהריים מקומיים, מונע היסט UTC (16.8 → 15.8 שבת) */
function MalaImport_sheetDate_(ymd) {
  if (!ymd) return '';
  const p = String(ymd).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
}

function MalaImport_weekdayHe_(ymd) {
  const d = MalaImport_sheetDate_(ymd);
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[d.getDay()];
}

/** ממיר תא זמן מהטבלה לשדה time ב-ExerciseDetails */
function MalaImport_formatTimeCell_(raw, year) {
  const s = String(raw || '').trim();
  if (!s || s === 'סולן' || s === 'ללא') return '';

  const range = s.match(/^(\d{1,2}\.\d{1,2})\s*\|\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (range) {
    const ymd = MalaImport_parseDayMonth_(range[1], year);
    const endHm = range[3];
    let endYmd = ymd;
    if (parseInt(endHm.split(':')[0], 10) < parseInt(range[2].split(':')[0], 10)) {
      endYmd = MalaImport_addDaysYmd_(ymd, 1);
    }
    return _fmtDateTimeFull(ymd, range[2]) + ' — ' + _fmtDateTimeFull(endYmd, endHm);
  }

  const point = s.match(/^(\d{1,2}\.\d{1,2})\s*\|\s*(\d{1,2}:\d{2})$/);
  if (point) {
    const ymd = MalaImport_parseDayMonth_(point[1], year);
    return _composeDetailTime(ymd, point[2]);
  }

  const dayOnly = s.match(/^(\d{1,2}\.\d{1,2})$/);
  if (dayOnly) {
    return MalaImport_parseDayMonth_(dayOnly[1], year);
  }

  return s;
}

function MalaImport_buildDescription_(row) {
  let desc = '[' + row.duration + '] ' + row.title;
  if (row.participants) desc += ' | משתתפים: ' + row.participants;
  return desc;
}

function MalaImport_exerciseTitle_(idx, def) {
  return MALA_IMPORT_PREFIX + ' #' + (idx + 1) + ' — ' + def.type + ' ' + def.act;
}

function MalaImport_findExistingIds_() {
  const out = [];
  _rows('Exercises').data.forEach(function(r) {
    const title = String(r[1] || '');
    if (title.indexOf(MALA_IMPORT_PREFIX) === 0) out.push(String(r[0]));
  });
  return out;
}

function MalaImport_resolveCreatedBy_() {
  const admins = Users_all().filter(function(u) { return Roles_isAdmin(u.role); });
  if (admins.length) return admins[0].id;
  return 'IMPORT';
}

// ── Main entry points ──

function importMalaExercisesPreview() {
  return importMalaExercisesOnce(true);
}

/**
 * @param {boolean} dryRun — true = לוג בלבד, ללא כתיבה
 */
function importMalaExercisesOnce(dryRun) {
  dryRun = !!dryRun;
  const existing = MalaImport_findExistingIds_();
  if (existing.length) {
    const msg = 'כבר קיימים ' + existing.length + ' תרגילי ' + MALA_IMPORT_PREFIX +
      '. הרץ deleteMalaImportedExercises() לפני ייבוא חוזר.';
    Logger.log(msg);
    return { ok: false, error: msg, existing: existing };
  }

  const exDefs = MalaImport_exerciseDefs_();
  const procRows = MalaImport_procedureRows_();
  const createdBy = MalaImport_resolveCreatedBy_();
  const baseTs = Date.now();
  const plan = { exercises: [], details: [] };

  exDefs.forEach(function(def, idx) {
    const exId = 'E' + baseTs + '_' + (idx + 1);
    const title = MalaImport_exerciseTitle_(idx, def);
    plan.exercises.push({
      id: exId,
      title: title,
      description: 'ייבוא חד-פעמי מלו"ז מאל"א',
      createdBy: createdBy,
      start: def.start,
      end: def.end,
      act: def.act,
      type: def.type,
      startTime: def.startTime,
      endTime: def.endTime,
      zmanRaw: def.zmanRaw
    });

    procRows.forEach(function(prow, pIdx) {
      if (prow.skipDetail) return;
      const rawTime = (prow.times && prow.times[idx]) || '';
      const timeCell = MalaImport_formatTimeCell_(rawTime);
      if (!timeCell) return;
      plan.details.push({
        id: 'D' + baseTs + '_' + idx + '_' + pIdx,
        exerciseId: exId,
        time: timeCell,
        location: prow.location || '',
        description: MalaImport_buildDescription_(prow)
      });
    });
  });

  Logger.log('=== MALA import plan ===');
  Logger.log('Exercises: ' + plan.exercises.length);
  Logger.log('Details:   ' + plan.details.length);
  plan.exercises.forEach(function(ex) {
    Logger.log('  ' + ex.id + ' | ' + ex.title + ' | ' + ex.start + ' (' + MalaImport_weekdayHe_(ex.start) + ') ' +
      ex.startTime + ' — ' + ex.end + ' ' + ex.endTime + ' | מקור: ' + ex.zmanRaw);
  });

  if (dryRun) {
    Logger.log('(dry-run — לא נכתב לגיליונות)');
    return { ok: true, dryRun: true, plan: plan };
  }

  _cacheBeginBatch();
  try {
    const exSheetRows = plan.exercises.map(function(ex) {
      return [
        ex.id, ex.title, ex.description, ex.createdBy,
        MalaImport_sheetDate_(ex.start), MalaImport_sheetDate_(ex.end),
        ex.act, ex.type, '', '', '',
        ex.startTime, ex.endTime
      ];
    });
    _appendBatch('Exercises', exSheetRows);

    const exSh = _sheet('Exercises');
    const startRow = exSh.getLastRow() - exSheetRows.length + 1;
    if (exSheetRows.length > 0) {
      exSh.getRange(startRow, 12, exSheetRows.length, 2).setNumberFormat('@STRING@');
      exSh.getRange(startRow, 12, exSheetRows.length, 2).setValues(
        plan.exercises.map(function(ex) {
          return [String(ex.startTime || ''), String(ex.endTime || '')];
        })
      );
    }

    const detailSheetRows = plan.details.map(function(d) {
      return [d.id, d.exerciseId, d.time, d.location, d.description];
    });
    if (detailSheetRows.length) _appendBatch('ExerciseDetails', detailSheetRows);

    if (typeof Series_getActiveId === 'function') {
      const seriesId = Series_getActiveId();
      if (seriesId && typeof Series_assignExercisesToSeries === 'function') {
        Series_assignExercisesToSeries(plan.exercises.map(function(e) { return e.id; }), seriesId);
      }
    }

    if (typeof SystemLog_write === 'function') {
      SystemLog_write({
        user_id: createdBy,
        action: 'import.mala',
        entity_type: 'exercise',
        entity_id: plan.exercises[0].id,
        details: { count: plan.exercises.length, details: plan.details.length }
      });
    }
  } finally {
    _cacheEndBatch();
  }

  SpreadsheetApp.flush();
  _cacheInvalidate('Exercises');
  _cacheInvalidate('ExerciseDetails');

  const summary = 'יובאו ' + plan.exercises.length + ' תרגילים ו-' + plan.details.length + ' רשומות נוה"ק.';
  Logger.log(summary);
  return { ok: true, info: summary, exercises: plan.exercises.length, details: plan.details.length };
}

/** מוחק תרגילים שיובאו ע"י סקריפט זה (כולל נוה"ק והקצאות) */
function deleteMalaImportedExercises() {
  const ids = MalaImport_findExistingIds_();
  if (!ids.length) {
    Logger.log('לא נמצאו תרגילי ' + MALA_IMPORT_PREFIX);
    return { ok: true, deleted: 0 };
  }
  if (typeof Exercises_deleteCore_ === 'function') {
    Exercises_deleteCore_(ids, MalaImport_resolveCreatedBy_());
  } else {
    ids.forEach(function(id) {
      const row = _findRowIndex('Exercises', id);
      if (row >= 0) _sheet('Exercises').deleteRow(row);
    });
    _cacheInvalidate('Exercises');
    _cacheInvalidate('ExerciseDetails');
    _cacheInvalidate('Assignments');
  }
  SpreadsheetApp.flush();
  Logger.log('נמחקו ' + ids.length + ' תרגילי ' + MALA_IMPORT_PREFIX);
  return { ok: true, deleted: ids.length };
}
