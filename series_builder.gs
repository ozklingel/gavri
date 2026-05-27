// series_builder.gs — automatic exercise series scheduling (admin)

var SERIES_PREP_NIGHT_H = 11;
var SERIES_PREP_DAY_H = 12;
var SERIES_MAIN_H = 8;
var SERIES_GAP_MS = 18 * 3600000;
var SERIES_MAX_CONCURRENT = 3;
var SERIES_BLOCK_START_HOUR = 18;
var SERIES_PREP_DAY_START_H = 6;
var SERIES_MAIN_START_H = 6;
var SERIES_SUMMER_MONTHS = [6, 7, 8, 9];
var SERIES_HEAT_START_H = 12;
var SERIES_HEAT_END_H = 16;
var SERIES_FORBIDDEN_START_H = 5;

function _seriesTypesFromParams(p) {
  const types = [];
  const nChir = Math.max(0, parseInt(p.count_chir, 10) || 0);
  const nHash = Math.max(0, parseInt(p.count_chashan, 10) || 0);
  const n900  = Math.max(0, parseInt(p.count_900, 10) || 0);
  for (let i = 0; i < nChir; i++) types.push('חיר');
  for (let i = 0; i < nHash; i++) types.push('חשן');
  for (let i = 0; i < n900; i++) types.push('900');
  return types;
}

function _seriesYmdToMs(ymd, hour, minute) {
  const parts = String(ymd).split('-').map(Number);
  if (parts.length !== 3) return NaN;
  const d = new Date(parts[0], parts[1] - 1, parts[2], hour || 0, minute || 0, 0, 0);
  return d.getTime();
}

function _seriesMsToYmd(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function _seriesMsToHm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _seriesBlockPlan(blockStartMs) {
  const prepNightStart = blockStartMs;
  const prepNightEnd = prepNightStart + SERIES_PREP_NIGHT_H * 3600000;
  const prepDayStart = _seriesAlignToHour(prepNightEnd, SERIES_PREP_DAY_START_H);
  if (prepDayStart < prepNightEnd) {
    return null;
  }
  const prepDayEnd = prepDayStart + SERIES_PREP_DAY_H * 3600000;
  const mainStart = _seriesAlignToHour(prepDayEnd, SERIES_MAIN_START_H);
  if (mainStart < prepDayEnd) {
    return null;
  }
  const mainEnd = mainStart + SERIES_MAIN_H * 3600000;
  return {
    startMs: prepNightStart,
    endMs: mainEnd,
    prepNightStart: prepNightStart,
    prepNightEnd: prepNightEnd,
    prepDayStart: prepDayStart,
    prepDayEnd: prepDayEnd,
    mainStart: mainStart,
    mainEnd: mainEnd
  };
}

function _seriesAlignToHour(afterMs, hour) {
  const d = new Date(afterMs);
  const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0).getTime();
  if (candidate >= afterMs) return candidate;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, 0, 0, 0);
  return next.getTime();
}

function _seriesIsSummerMonth(ms) {
  return SERIES_SUMMER_MONTHS.indexOf(new Date(ms).getMonth() + 1) !== -1;
}

function _seriesStartInForbiddenHour(ms) {
  const h = new Date(ms).getHours();
  const m = new Date(ms).getMinutes();
  if (h === SERIES_FORBIDDEN_START_H) return true;
  if (_seriesIsSummerMonth(ms) && h >= SERIES_HEAT_START_H && h < SERIES_HEAT_END_H) return true;
  return false;
}

function _seriesFetchHolyDays(startYmd, endYmd) {
  const days = {};
  try {
    const url = 'https://www.hebcal.com/hebcal/?v=1&cfg=json&start=' + encodeURIComponent(startYmd) +
      '&end=' + encodeURIComponent(endYmd) +
      '&maj=on&min=on&mod=on&nx=on&ss=on&mf=on&c=on&geo=geoname&geonameid=281184';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) throw new Error('hebcal HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    (data.items || []).forEach(function(item) {
      const subcat = String(item.subcat || '');
      const title = String(item.title || '');
      const yomtov = item.yomtov === true || subcat === 'shabbat' || subcat === 'holiday' ||
        title.indexOf('Shabbat') !== -1 || title.indexOf('שבת') !== -1 ||
        title.indexOf('Erev') !== -1 || title.indexOf('ערב') !== -1;
      if (!yomtov && subcat !== 'shabbat' && subcat !== 'yomtov') return;
      const raw = String(item.date || '').slice(0, 10);
      if (raw) days[raw] = true;
    });
  } catch (e) {
    Logger.log('Hebcal fallback: ' + e);
  }
  let cur = _seriesYmdToMs(startYmd, 12, 0);
  const end = _seriesYmdToMs(endYmd, 12, 0);
  if (!isNaN(cur) && !isNaN(end)) {
    while (cur <= end) {
      if (new Date(cur).getDay() === 6) {
        days[_seriesMsToYmd(cur)] = true;
      }
      cur += 86400000;
    }
  }
  return days;
}

function _seriesDayBlocked(ymd, holyDays) {
  return !!holyDays[ymd];
}

function _seriesRangeTouchesHoly(plan, holyDays) {
  let t = plan.startMs;
  while (t < plan.endMs) {
    if (_seriesDayBlocked(_seriesMsToYmd(t), holyDays)) return true;
    t += 86400000;
  }
  return false;
}

function _seriesOverlapsCount(plan, ranges) {
  let n = 0;
  ranges.forEach(function(r) {
    if (r.startMs < plan.endMs && plan.startMs < r.endMs) n++;
  });
  return n;
}

function _seriesExistingRanges(rangeStartMs, rangeEndMs) {
  const out = [];
  Exercises_all().forEach(function(ex) {
    const r = _exerciseTimeRange(ex);
    if (!r) return;
    if (r.endMs < rangeStartMs || r.startMs > rangeEndMs) return;
    out.push(r);
  });
  return out;
}

function _seriesCanPlace(plan, holyDays, ranges, lastEndMs) {
  if (!plan) return false;
  if (_seriesStartInForbiddenHour(plan.startMs)) return false;
  if (_seriesStartInForbiddenHour(plan.mainStart)) return false;
  if (_seriesRangeTouchesHoly(plan, holyDays)) return false;
  if (lastEndMs && plan.startMs < lastEndMs + SERIES_GAP_MS) return false;
  if (_seriesOverlapsCount(plan, ranges) >= SERIES_MAX_CONCURRENT) return false;
  return true;
}

function _seriesBuildQueue(types) {
  const shuffled = types.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled;
}

function Series_schedule(startYmd, endYmd, types) {
  const rangeStartMs = _seriesYmdToMs(startYmd, 0, 0);
  const rangeEndMs = _seriesYmdToMs(endYmd, 23, 59) + 60000;
  if (isNaN(rangeStartMs) || isNaN(rangeEndMs) || rangeEndMs <= rangeStartMs) {
    throw new Error('טווח תאריכים לא תקין.');
  }
  if (!types.length) throw new Error('יש לציין לפחות תרגיל אחד בסדרה.');

  const holyDays = _seriesFetchHolyDays(startYmd, endYmd);
  const ranges = _seriesExistingRanges(rangeStartMs, rangeEndMs);
  const queue = _seriesBuildQueue(types);
  const placed = [];
  let cursorMs = rangeStartMs;
  let qi = 0;
  let lastPlacedEnd = 0;

  while (qi < queue.length && cursorMs < rangeEndMs) {
    const blockStart = _seriesYmdToMs(_seriesMsToYmd(cursorMs), SERIES_BLOCK_START_HOUR, 0);
    if (blockStart < rangeStartMs) {
      cursorMs += 86400000;
      continue;
    }
    if (blockStart >= rangeEndMs) break;

    const plan = _seriesBlockPlan(blockStart);
    if (plan && plan.endMs <= rangeEndMs && _seriesCanPlace(plan, holyDays, ranges, lastPlacedEnd)) {
      placed.push({ type: queue[qi], plan: plan });
      ranges.push({ startMs: plan.startMs, endMs: plan.endMs });
      lastPlacedEnd = plan.endMs;
      cursorMs = lastPlacedEnd + SERIES_GAP_MS;
      qi++;
    } else {
      cursorMs += 86400000;
    }
  }

  const skippedCount = queue.length - qi;
  return {
    placed: placed,
    skippedCount: skippedCount,
    holyDayCount: Object.keys(holyDays).length
  };
}

function _seriesDetailRows(exId, plan, typeLabel, stamp) {
  const s = String(stamp);
  return [
    ['D' + s + '_n', exId, _seriesMsToHm(plan.prepNightStart), '', 'יבש רטוב לילה'],
    ['D' + s + '_d', exId, _seriesMsToHm(plan.prepDayStart), '', 'יבש רטוב יום'],
    ['D' + s + '_m', exId, _seriesMsToHm(plan.mainStart), '', 'תרגיל ' + typeLabel]
  ];
}

function Exercises_buildSeries(p) {
  const u = Auth_requireRole(p, ['admin']);
  const startYmd = String(p.series_start || p.series_start_date || '').trim();
  const endYmd   = String(p.series_end || p.series_end_date || '').trim();
  const types = _seriesTypesFromParams(p);

  if (!startYmd || !endYmd) throw new Error('חובה לבחור תאריך התחלה וסיום לסדרה.');
  const startTs = _parseRawDate(startYmd);
  const endTs   = _parseRawDate(endYmd);
  if (isNaN(startTs) || isNaN(endTs) || endTs < startTs) {
    throw new Error('טווח תאריכים לא תקין.');
  }

  const result = Series_schedule(startYmd, endYmd, types);
  if (!result.placed.length) {
    return Views_exercises({
      sid: p.sid,
      error: 'לא ניתן לשבץ תרגילים בטווח הנתון (מגבלות לוח / חגים / מקביליות). נסה להרחיב טווח או להפחית כמות.'
    });
  }

  const exRows = [];
  const detailRows = [];
  const baseTs = Date.now();

  result.placed.forEach(function(item, idx) {
    const plan = item.plan;
    const type = item.type;
    const id = 'E' + baseTs + '_' + idx;
    const title = type + ' — סדרה ' + (idx + 1);
    const desc = 'נוצר בבניית סדרה. שלבים: יבש רטוב לילה → יבש רטוב יום → תרגיל ' + type;

    exRows.push([
      id,
      title,
      desc,
      u.id,
      _seriesMsToYmd(plan.startMs),
      _seriesMsToYmd(plan.endMs),
      'סדרה',
      type,
      '',
      '',
      '',
      _seriesMsToHm(plan.startMs),
      _seriesMsToHm(plan.endMs)
    ]);
    _seriesDetailRows(id, plan, type, baseTs + '_' + idx).forEach(function(r) {
      detailRows.push(r);
    });
  });

  if (exRows.length) _appendBatch('Exercises', exRows);
  if (detailRows.length) _appendBatch('ExerciseDetails', detailRows);

  let info = '✅ נוצרו ' + result.placed.length + ' תרגילים בסדרה';
  const byType = {};
  result.placed.forEach(function(x) {
    byType[x.type] = (byType[x.type] || 0) + 1;
  });
  Object.keys(byType).forEach(function(t) {
    info += ' · ' + t + ': ' + byType[t];
  });
  if (result.skippedCount) {
    info += '. לא שובצו: ' + result.skippedCount;
  }
  info += '. (חגים/שבת: ' + result.holyDayCount + ' ימים חסומים בטווח)';

  return Views_exercises({ sid: p.sid, info: info });
}
