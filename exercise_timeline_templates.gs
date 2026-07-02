// exercise_timeline_templates.gs — תבנית נוה"ק לציר זמן תרגיל

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

function ExerciseTimeline_templateRows() {
  return [
    {
      location: 'מחנה צאלים', duration: '60 דק\'',
      title: 'קפ"ק 1 תאום ציפיות ומתן דגשים ולקחים למג"ד בראשות מנהל התרגיל',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד, קמב"ץ גדוד (קמ"פ)',
      times: {
        magnet: '21.1 19:00|עם סיום אקט ראשון',
        dry_wet_day: '25.1 11:00|עם סיום אקט ראשון',
        dutz: '26.1 08:00|ע"פ לו"ז מרכז דרומי',
        dry_wet_night_organic: '27.1 08:00|ע"פ לו"ז מרכז דרומי'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\'',
      title: 'א.ת. חטיבתי למג"ד',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד',
      times: {
        magnet: '22.1 13:00|מיד לאחר מכן הגעה לתצוגת האש',
        dry_wet_day: '25.1 08:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 14:00|עם סיום אקט ראשון — במחנה ביל"ו',
        dry_wet_night_organic: '27.1 08:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\'',
      title: 'קפ"ק 1 גדודי למ"פים',
      participants: 'מנהל התרגיל, ק\' הבטיחות הראשי, מג"ד, מטה גדוד, מ"פים',
      times: {
        magnet: '25.1 09:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '25.1 10:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 11:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 09:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צאלים', duration: '2 שעות',
      title: 'חל"ז לא.ת. גדודי למ"פים — יש לקבוע דירוג בין המ"פים',
      participants: 'מג"ד, מטה גדוד, מ"פים',
      times: {
        magnet: '25.1 14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '25.1 14:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 21:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '60 דק\'',
      title: 'תדריך מ"פ למ"מים (קפ"ק 1)',
      participants: 'מ"פים, מ"פים אורגניים, מ"מים, ק\' בטיחות פלוגתי',
      times: {
        magnet: '25.1 17:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '25.1 17:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '25.1 19:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 09:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'שטח אש', duration: '2 שעות',
      title: 'סיו"ש בטיחות בראשות מנהל התרגיל — מוכוון תרגיל',
      participants: 'מנהל התרגיל, ק\' הבטיחות הראשי, ק\' בטיחות ארטילריה, מ\' אחראי, ק\' הבטיחות בכל המסגרות',
      times: {
        magnet: '25.1 14:00',
        dry_wet_day: '25.1 14:00',
        dutz: '26.1 08:00',
        dry_wet_night_organic: '27.1 11:00'
      }
    },
    {
      location: 'לשכת מפקד', duration: '30 דק\'',
      title: 'שולחן עגול בראשות מ\' המלפ"ק — עד 24 שעות לפני התרגיל | אחרי א.ת. למג"ד',
      participants: 'מנהל התרגיל, קצין הבטיחות הראשי, מפקד אחראי, מפקד מרכז דרומי, ק\' אג"ם מרכז דרומי, קבט"א',
      times: {
        magnet: '25.1 13:30',
        dry_wet_day: '25.1 14:00',
        dutz: '27.1 13:00',
        dry_wet_night_organic: '27.1 09:00'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '90 דק\'',
      title: 'קפ"ק 2',
      participants: 'מנהל התרגיל, מג"ד, מטה גדוד, מ"פים, מ"מים עם משימה גדודית, מפקדים אחראיים, מעטה חטיבתי בהובלת ארזים, כל מערך הבטיחות',
      times: {
        magnet: '25.1 20:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '25.1 20:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 15:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '90 דק\'',
      title: 'תחקיר רמה ממונה בראשות המג"ד — או מפקד שיוגדר על ידי מנהל התרגיל',
      participants: 'מג"ד, מטה גדוד, מ"פים',
      times: {
        magnet: '25.1 22:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '25.1 22:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 13:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 16:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג', duration: '45 דק\'',
      title: 'קפ"ק 3 + תדריך מנהלת + אישור תיק ירי ארטילרי — לתרג"ד באש',
      participants: 'מנהל התרגיל, ק\' הבטיחות, ק\' בטיחות ארט\' ראש מעטה החטיבה, מפקד אחראי',
      times: {
        magnet: '25.1 21:30|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '26.1 07:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 16:45|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 17:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מחנה צק"ג / שטח כינוס', duration: '60 דק\'',
      title: 'מודל ומסדר מערכות — שו"ב, מגנט, קשר, דרוריות, מיקום רק"ש, מפתוחים בהובלת מפקד אחראי',
      participants: 'כלל הכוחות הרלוונטיים כולל רכבי מתב"ת',
      times: {
        magnet: '26.1 06:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_day: '26.1 07:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dutz: '26.1 14:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל',
        dry_wet_night_organic: '27.1 18:00|לו"ז נוה"ק חפוז שיקבע ע"י מנהל התרגיל'
      }
    },
    {
      location: 'מרחב התרגיל', duration: '120 דק\'',
      title: 'שלדי מפקדים',
      participants: 'מנהל התרגיל, מפקד אחראי, קציני בטיחות, חפ"קים, מפקדים מרמת מ"כ, דגלנים, קשרים',
      times: {
        magnet: 'ללא', dry_wet_day: 'ללא', dutz: 'ללא', dry_wet_night_organic: 'ללא'
      }
    },
    {
      location: 'מרחב התרגיל', duration: 'משתנה',
      title: 'זמן תרגיל (כולל שלדי מפקדים יום ע"פ צורך)',
      participants: 'כלל הכוחות המתורגלים',
      times: {
        magnet: '26.1 08:00-15:00',
        dry_wet_day: '26.1 20:00-01:00',
        dutz: '27.1 08:00-14:00',
        dry_wet_night_organic: '28.1 22:00 עד 29.1 06:00'
      }
    },
    {
      location: 'נק\' סיום תרגיל', duration: '30 דק\'',
      title: 'סיכום פלוגתי',
      participants: 'מרמת מ"מ',
      times: {
        magnet: 'בסיום התרגיל',
        dry_wet_day: 'בסיום התרגיל',
        dutz: 'בסיום התרגיל',
        dry_wet_night_organic: 'בסיום התרגיל'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\' לשני התרגילים',
      title: 'מגירת פתיחה — קביעת מוקדי התחקיר',
      participants: 'מנהל התרגיל, ארזים, מג"דים מתרגלים',
      times: {
        magnet: '27.1 09:00',
        dry_wet_day: '27.1 15:00',
        dutz: '28.1 14:00',
        dry_wet_night_organic: '29.1 18:00'
      }
    },
    {
      location: 'מחנה צאלים', duration: '3 שעות לשני התחקירים',
      title: 'סיכום גדודי',
      participants: 'מג"דים, מטה גדוד, מ"פים',
      times: {
        magnet: '27.1 10:00-13:00',
        dry_wet_day: '27.1 15:00-18:00',
        dutz: '28.1 14:00-17:00',
        dry_wet_night_organic: '29.1 19:00-22:00'
      }
    },
    {
      location: 'מחנה צאלים', duration: '60 דק\'',
      title: 'משוב חונך — מתרגל',
      participants: 'חונך ומתרגל (אישי)',
      times: {
        magnet: '27.1 13:00',
        dry_wet_day: '27.1 18:00',
        dutz: '28.1 17:00',
        dry_wet_night_organic: '29.1 22:00'
      }
    }
  ];
}

function ExerciseTimeline_parseDayMonth(str, year) {
  const m = String(str || '').trim().match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!m) return null;
  const dd = String(m[1]).padStart(2, '0');
  const mm = String(m[2]).padStart(2, '0');
  return year + '-' + mm + '-' + dd;
}

function ExerciseTimeline_anchorYear(ex) {
  if (ex && ex.rawStartDate) return parseInt(String(ex.rawStartDate).slice(0, 4), 10);
  if (ex && ex.rawEndDate) return parseInt(String(ex.rawEndDate).slice(0, 4), 10);
  return new Date().getFullYear();
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

function ExerciseTimeline_formatResolved(ymd, hm, endHm, endYmd) {
  const start = _fmtDateTimeFull(ymd, hm);
  if (!endHm) return start;
  if (endYmd && endYmd !== ymd) return start + ' — ' + _fmtDateTimeFull(endYmd, endHm);
  return start + ' — ' + endHm;
}

function ExerciseTimeline_resolveSpec(spec, ex) {
  if (!spec || spec === 'ללא') return null;

  const raw = String(spec).trim();
  const parts = raw.split('|');
  const timePart = parts[0].trim();
  const note = parts.length > 1 ? parts.slice(1).join('|').trim() : '';

  if (timePart === 'בסיום התרגיל') {
    const ymd = ex.rawEndDate || ex.rawStartDate;
    const hm  = ex.rawEndTime || '';
    return {
      time: _fmtDateTimeFull(ymd, hm) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd, hm || '23:59')
    };
  }

  if (/לו"ז נוה"ק|ע"פ לו"ז|אורגני/i.test(timePart) && !/\d{1,2}\.\d{1,2}/.test(timePart)) {
    return {
      time: timePart + (note ? ' — ' + note : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ex.rawStartDate, ex.rawStartTime || '12:00') + 1
    };
  }

  const year = ExerciseTimeline_anchorYear(ex);

  // Cross-day range: 28.1 22:00 עד 29.1 06:00
  let cross = timePart.match(/^(\d{1,2}\.\d{1,2})\s+(\d{1,2}:\d{2})\s+עד\s+(\d{1,2}\.\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (cross) {
    const ymd1 = ExerciseTimeline_parseDayMonth(cross[1], year);
    const ymd2 = ExerciseTimeline_parseDayMonth(cross[3], year);
    return {
      time: ExerciseTimeline_formatResolved(ymd1, cross[2], cross[4], ymd2) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd1, cross[2])
    };
  }

  // Same-day range: 26.1 08:00-15:00 or 27.1 10:00-13:00
  let range = timePart.match(/^(\d{1,2}\.\d{1,2})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (range) {
    const ymd = ExerciseTimeline_parseDayMonth(range[1], year);
    return {
      time: ExerciseTimeline_formatResolved(ymd, range[2], range[3]) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd, range[2])
    };
  }

  // Date | time: 22.1 | 13:00
  let pipe = timePart.match(/^(\d{1,2}\.\d{1,2})\s*\|\s*(\d{1,2}:\d{2})$/);
  if (pipe) {
    const ymd = ExerciseTimeline_parseDayMonth(pipe[1], year);
    return {
      time: ExerciseTimeline_formatResolved(ymd, pipe[2]) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd, pipe[2])
    };
  }

  // Date time: 21.1 19:00
  let dt = timePart.match(/^(\d{1,2}\.\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (dt) {
    const ymd = ExerciseTimeline_parseDayMonth(dt[1], year);
    return {
      time: ExerciseTimeline_formatResolved(ymd, dt[2]) + (note ? ' (' + note + ')' : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd, dt[2])
    };
  }

  // Date only with note in timePart
  let dOnly = timePart.match(/^(\d{1,2}\.\d{1,2})$/);
  if (dOnly) {
    const ymd = ExerciseTimeline_parseDayMonth(dOnly[1], year);
    return {
      time: _fmtDate(ymd) + (note ? ' — ' + note : ''),
      sortMs: ExerciseTimeline_msFromYmdHm(ymd, '12:00')
    };
  }

  return {
    time: raw,
    sortMs: ExerciseTimeline_msFromYmdHm(ex.rawStartDate, ex.rawStartTime || '12:00') + 2
  };
}

function ExerciseTimeline_buildDescription(row) {
  let desc = '[' + row.duration + '] ' + row.title;
  if (row.participants) desc += ' | משתתפים: ' + row.participants;
  return desc;
}

function ExerciseTimeline_rowsForExercise(ex, profile) {
  const template = ExerciseTimeline_templateRows();
  const out = [];

  template.forEach(function(row) {
    const spec = row.times && row.times[profile];
    const resolved = ExerciseTimeline_resolveSpec(spec, ex);
    if (!resolved) return;
    out.push({
      time: resolved.time,
      sortMs: resolved.sortMs,
      location: row.location,
      description: ExerciseTimeline_buildDescription(row)
    });
  });

  out.sort(function(a, b) {
    const sa = isNaN(a.sortMs) ? 0 : a.sortMs;
    const sb = isNaN(b.sortMs) ? 0 : b.sortMs;
    return sa - sb;
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

  const profile = ExerciseTimeline_profile(ex);
  const profileLabel = ExerciseTimeline_profileLabel(profile);
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

  return Views_exercise({
    sid: p.sid,
    id: exId,
    info: 'נוצר ציר זמן (' + profileLabel + ') — ' + detailRows.length + ' רשומות.'
  });
}
