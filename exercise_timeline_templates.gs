// exercise_timeline_templates.gs — תבנית נוה"ק לציר זמן תרגיל
// טווח נוה"ק: יום לפני התרגיל (start-1) עד יום אחרי (end+1)

function ExerciseTimeline_profile(ex) {
  const act  = String(ex && ex.act || '').replace(/״/g, '"');
  const type = String(ex && ex.exercise_type || '').replace(/״/g, '"');
  const combo = (act + ' ' + type).toLowerCase();

  if (combo.indexOf('מגנט') !== -1) return 'magnet';
  if (combo.indexOf('יבש') !== -1 && combo.indexOf('רטוב') !== -1 && combo.indexOf('לילה') !== -1) {
    return 'dry_wet_night_organic';
  }
  if (combo.indexOf('יבש') !== -1 && combo.indexOf('רטוב') !== -1 && combo.indexOf('יום') !== -1) {
    return 'dry_wet_day';
  }
  if (combo.indexOf('דו"ץ') !== -1 || combo.indexOf('דוץ') !== -1) return 'dutz';
  if (combo.indexOf('יבש') !== -1 && combo.indexOf('רטוב') !== -1) return 'dry_wet_day';
  return 'dutz';
}

function ExerciseTimeline_profileLabel(profile) {
  const map = {
    magnet: 'דו"ץ - מגנט',
    dry_wet_day: 'יבש רטוב יום',
    dutz: 'דו"ץ',
    dry_wet_night_organic: 'יבש רטוב לילה אורגני'
  };
  return map[profile] || profile;
}

/** phase: dayBefore | startDay | during | atEnd | dayAfter */
function ExerciseTimeline_templateRows() {
  return [
    {
      location: 'מחנה צאלים', duration: '60 דק\'', phase: 'dayBefore',
      title: 'קפ"ק 1 תאום ציפיות ומתן דגשים ולקחים למג"ד בראשות מנהל התרגיל',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד, קמב"ץ גדוד (קמ"פ)',
      clocks: {
        magnet: '19:00|עם סיום אקט ראשון',
        dry_wet_day: '11:00|עם סיום אקט ראשון',
        dutz: '08:00|ע"פ לו"ז מרכז דרומי',
        dry_wet_night_organic: '08:00|ע"פ לו"ז מרכז דרומי'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\'', phase: 'dayBefore',
      title: 'א.ת. חטיבתי למג"ד',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד',
      clocks: {
        magnet: '13:00|מיד לאחר מכן הגעה לתצוגת האש',
        dry_wet_day: '08:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '14:00|עם סיום אקט ראשון — במחנה ביל"ו',
        dry_wet_night_organic: '08:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\'', phase: 'dayBefore',
      title: 'קפ"ק 1 גדודי למ"פים',
      participants: 'מנהל התרגיל, ק\' הבטיחות הראשי, מג"ד, מטה גדוד, מ"פים',
      clocks: {
        magnet: '09:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '10:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '11:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '09:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צאלים', duration: '2 שעות', phase: 'dayBefore',
      title: 'חל"ז לא.ת. גדודי למ"פים — יש לקבוע דירוג בין המ"פים',
      participants: 'מג"ד, מטה גדוד, מ"פים',
      clocks: {
        magnet: '14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '14:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '21:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '60 דק\'', phase: 'dayBefore',
      title: 'תדריך מ"פ למ"מים (קפ"ק 1)',
      participants: 'מ"פים, מ"פים אורגניים, מ"מים, ק\' בטיחות פלוגתי',
      clocks: {
        magnet: '17:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '17:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '19:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '09:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'שטח אש', duration: '2 שעות', phase: 'dayBefore',
      title: 'סיו"ש בטיחות בראשות מנהל התרגיל — מוכוון תרגיל',
      participants: 'מנהל התרגיל, ק\' הבטיחות הראשי, ק\' בטיחות ארטילריה, מ\' אחראי, ק\' הבטיחות בכל המסגרות',
      clocks: { magnet: '14:00', dry_wet_day: '14:00', dutz: '08:00', dry_wet_night_organic: '11:00' }
    },
    {
      location: 'לשכת מפקד', duration: '30 דק\'', phase: 'dayBefore',
      title: 'שולחן עגול בראשות מ\' המלפ"ק — עד 24 שעות לפני התרגיל | אחרי א.ת. למג"ד',
      participants: 'מנהל התרגיל, קצין הבטיחות הראשי, מפקד אחראי, מפקד מרכז דרומי, ק\' אג"ם מרכז דרומי, קבט"א',
      clocks: { magnet: '13:30', dry_wet_day: '14:00', dutz: '13:00', dry_wet_night_organic: '09:00' }
    },
    {
      location: 'מחנה צק"ג', duration: '90 דק\'', phase: 'dayBefore',
      title: 'קפ"ק 2',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד, מ"פים, מ"מים עם משימה גדודית, מפקדים אחראיים, מעטה חטיבתי בהובלת ארזים, כל מערך הבטיחות',
      clocks: {
        magnet: '20:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '20:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '15:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '90 דק\'', phase: 'dayBefore',
      title: 'תחקיר רמה ממונה בראשות המג"ד — או מפקד שיוגדר על ידי מנהל התרגיל',
      participants: 'מג"ד, מטה גדוד, מ"פים',
      clocks: {
        magnet: '22:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '22:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '13:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '16:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '45 דק\'', phase: 'dayBefore',
      title: 'קפ"ק 3 + תדריך מנהלת + אישור תיק ירי ארטילרי — לתרג"ד באש',
      participants: 'מנהל התרגיל, ק\' הבטיחות, ק\' בטיחות ארט\' ראש מעטה החטיבה, מפקד אחראי',
      clocks: {
        magnet: '21:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '07:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '16:45|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '17:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג / שטח כינוס', duration: '60 דק\'', phase: 'startDay',
      title: 'מודל ומסדר מערכות — שו"ב, מגנט, קשר, דרוריות, מיקום רק"ש, מפתוחים בהובלת מפקד אחראי',
      participants: 'כלל הכוחות הרלוונטיים כולל רכבי מתב"ת',
      clocks: {
        magnet: '06:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '07:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '18:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מרחב התרגיל', duration: '120 דק\'', phase: 'skip',
      title: 'שלדי מפקדים',
      participants: 'מנהל התרגיל, מפקד אחראי, קציני בטיחות, חפ"קים, מפקדים מרמת מ"כ, דגלנים, קשרים',
      clocks: { magnet: 'skip', dry_wet_day: 'skip', dutz: 'skip', dry_wet_night_organic: 'skip' }
    },
    {
      location: 'מרחב התרגיל', duration: 'משתנה', phase: 'during',
      title: 'זמן תרגיל (כולל שלדי מפקדים יום ע"פ צורך)',
      participants: 'כלל הכוחות המתורגלים',
      clocks: {
        magnet: 'exercise',
        dry_wet_day: '20:00-01:00|overnight',
        dutz: 'exercise',
        dry_wet_night_organic: '22:00-06:00|overnight'
      }
    },
    {
      location: 'נק\' סיום תרגיל', duration: '30 דק\'', phase: 'atEnd',
      title: 'סיכום פלוגתי',
      participants: 'מרמת מ"מ',
      clocks: { magnet: 'atEnd', dry_wet_day: 'atEnd', dutz: 'atEnd', dry_wet_night_organic: 'atEnd' }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\' לשני התרגילים', phase: 'dayAfter',
      title: 'מגירת פתיחה — קביעת מוקדי התחקיר',
      participants: 'מנהל התרגיל, ארזים, מג"דים מתרגלים',
      clocks: { magnet: '09:00', dry_wet_day: '15:00', dutz: '14:00', dry_wet_night_organic: '18:00' }
    },
    {
      location: 'מחנה צאלים', duration: '3 שעות לשני התחקירים', phase: 'dayAfter',
      title: 'סיכום גדודי',
      participants: 'מג"דים, מטה גדוד, מ"פים',
      clocks: {
        magnet: '10:00-13:00',
        dry_wet_day: '15:00-18:00',
        dutz: '14:00-17:00',
        dry_wet_night_organic: '19:00-22:00'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\'', phase: 'dayAfter',
      title: 'משוב חונך — מתרגל',
      participants: 'חונך ומתרגל (אישי)',
      clocks: { magnet: '13:00', dry_wet_day: '18:00', dutz: '17:00', dry_wet_night_organic: '22:00' }
    }
  ];
}

function ExerciseTimeline_addDays(ymd, days) {
  if (!ymd) return '';
  const ms = _parseRawDate(ymd);
  if (isNaN(ms)) return ymd;
  const d = new Date(ms + days * 86400000);
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

function ExerciseTimeline_window(ex) {
  const startYmd = ex.rawStartDate;
  const endYmd   = ex.rawEndDate || ex.rawStartDate;
  if (!startYmd) throw new Error('חובה להגדיר תאריך התחלה לתרגיל.');
  return {
    dayBefore: ExerciseTimeline_addDays(startYmd, -1),
    startYmd:  startYmd,
    endYmd:    endYmd,
    dayAfter:  ExerciseTimeline_addDays(endYmd, 1)
  };
}

function ExerciseTimeline_msFromYmdHm(ymd, hm) {
  if (!ymd) return NaN;
  const parts = String(ymd).split('-').map(Number);
  let h = 0;
  let m = 0;
  if (hm) {
    const tp = String(hm).split(':').map(Number);
    h = tp[0] || 0;
    m = tp[1] || 0;
  }
  return new Date(parts[0], parts[1] - 1, parts[2], h, m, 0, 0).getTime();
}

function ExerciseTimeline_formatRange(ymdStart, hmStart, ymdEnd, hmEnd) {
  const start = _fmtDateTimeFull(ymdStart, hmStart);
  if (!hmEnd) return start;
  const endYmd = ymdEnd || ymdStart;
  if (endYmd !== ymdStart) return start + ' — ' + _fmtDateTimeFull(endYmd, hmEnd);
  return start + ' — ' + hmEnd;
}

function ExerciseTimeline_parseClockSpec(spec) {
  if (!spec || spec === 'skip' || spec === 'ללא') return null;

  const raw = String(spec).trim();
  const parts = raw.split('|');
  const clock = parts[0].trim();
  const note  = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
  const overnight = note === 'overnight' || clock.indexOf('overnight') !== -1;

  if (clock === 'exercise' || clock === 'atEnd') {
    return { kind: clock, note: note === 'overnight' ? '' : note };
  }

  let range = clock.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (range) {
    return {
      kind: 'range',
      startHm: range[1],
      endHm: range[2],
      overnight: overnight || parseInt(range[2].split(':')[0], 10) < parseInt(range[1].split(':')[0], 10),
      note: note
    };
  }

  let hm = clock.match(/^(\d{1,2}:\d{2})$/);
  if (hm) return { kind: 'point', startHm: hm[1], note: note };

  return { kind: 'text', text: raw, note: note };
}

function ExerciseTimeline_resolveRow(row, clockSpec, ex, win) {
  if (row.phase === 'skip') return null;

  const parsed = ExerciseTimeline_parseClockSpec(clockSpec);
  if (!parsed) return null;

  let ymd = win.startYmd;
  let note = parsed.note || '';

  if (parsed.kind === 'exercise') {
    const startHm = ex.rawStartTime || '';
    const endHm   = ex.rawEndTime || '';
    return {
      time: ExerciseTimeline_formatRange(win.startYmd, startHm, win.endYmd, endHm) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(win.startYmd, startHm || '00:00')
    };
  }

  if (parsed.kind === 'atEnd') {
    const endYmd = win.endYmd;
    const endHm  = ex.rawEndTime || '23:59';
    return {
      time: _fmtDateTimeFull(endYmd, endHm) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(endYmd, endHm)
    };
  }

  if (parsed.kind === 'text') {
    return {
      time: parsed.text + (note ? ' — ' + note : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(win.dayBefore, '12:00')
    };
  }

  if (row.phase === 'dayBefore') ymd = win.dayBefore;
  else if (row.phase === 'startDay') ymd = win.startYmd;
  else if (row.phase === 'dayAfter') ymd = win.dayAfter;
  else if (row.phase === 'during') ymd = win.startYmd;

  if (parsed.kind === 'range') {
    let endYmd = ymd;
    if (parsed.overnight) endYmd = ExerciseTimeline_addDays(ymd, 1);
    return {
      time: ExerciseTimeline_formatRange(ymd, parsed.startHm, endYmd, parsed.endHm) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd, parsed.startHm)
    };
  }

  return {
    time: _fmtDateTimeFull(ymd, parsed.startHm) + (note ? ' (' + note + ')' : ''),
    sortMs: ExerciseTimeline_msFromYmdHm(ymd, parsed.startHm)
  };
}

function ExerciseTimeline_buildDescription(row) {
  let desc = '[' + row.duration + '] ' + row.title;
  if (row.participants) desc += ' | משתתפים: ' + row.participants;
  return desc;
}

function ExerciseTimeline_rowsForExercise(ex, profile) {
  const win = ExerciseTimeline_window(ex);
  const template = ExerciseTimeline_templateRows();
  const out = [];

  template.forEach(function(row) {
    const clockSpec = row.clocks && row.clocks[profile];
    const resolved = ExerciseTimeline_resolveRow(row, clockSpec, ex, win);
    if (!resolved) return;
    out.push({
      time: resolved.time,
      sortMs: resolved.sortMs,
      location: row.location,
      description: ExerciseTimeline_buildDescription(row)
    });
  });

  out.sort(function(a, b) {
    return (isNaN(a.sortMs) ? 0 : a.sortMs) - (isNaN(b.sortMs) ? 0 : b.sortMs);
  });
  return out;
}

function Exercises_clearDetails(exerciseId) {
  const sh = _sheet('ExerciseDetails');
  const data = _rows('ExerciseDetails').data;
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][1]) === String(exerciseId)) sh.deleteRow(i + 2);
  }
  _cacheInvalidate('ExerciseDetails');
}

function Exercises_generateTimeline(p) {
  Auth_requireRole(p, ['admin']);
  const exId = String(p.id || p.exerciseId || '').trim();
  const ex = Exercises_get(exId);
  if (!ex) throw new Error('התרגיל לא נמצא.');
  if (!ex.rawStartDate) throw new Error('חובה להגדיר תאריך התחלה לתרגיל.');

  const profile = ExerciseTimeline_profile(ex);
  const profileLabel = ExerciseTimeline_profileLabel(profile);
  const win = ExerciseTimeline_window(ex);
  const rows = ExerciseTimeline_rowsForExercise(ex, profile);
  if (!rows.length) {
    throw new Error('לא נמצאה תבנית ציר זמן לסוג תרגיל זה.');
  }

  const existing = Exercises_details(exId);
  const replace = _parseBool(p.replace);
  if (existing.length && !replace) {
    throw new Error('יש כבר ' + existing.length + ' רשומות בציר הזמן. סמן "החלף" כדי ליצור מחדש.');
  }
  if (replace && existing.length) Exercises_clearDetails(exId);

  const baseTs = Date.now();
  const detailRows = rows.map(function(r, idx) {
    return ['D' + baseTs + '_' + idx, exId, r.time, r.location, r.description];
  });
  _appendBatch('ExerciseDetails', detailRows);

  const rangeLabel = _fmtDate(win.dayBefore) + ' — ' + _fmtDate(win.dayAfter);
  return Views_exercise({
    sid: p.sid,
    id: exId,
    info: 'נוצר ציר זמן (' + profileLabel + ') — ' + detailRows.length +
      ' רשומות. טווח נוה"ק: ' + rangeLabel + '.'
  });
}
