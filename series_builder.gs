// series_builder.gs — automatic exercise series scheduling (admin)
// סדרה = כל התרגילים במערכת; כל רשומה = תרגיל יום (6ש) או תרגיל לילה (9ש), ללא ציר זמן פנימי.

var SERIES_NIGHT_H = 9;
var SERIES_DAY_H = 6;
var SERIES_GAP_MS = 18 * 3600000;
var SERIES_MAX_CONCURRENT = 3;
var SERIES_FIRST_DAY_HOUR = 6;
var SERIES_STEP_MS = 30 * 60000;
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
  return new Date(parts[0], parts[1] - 1, parts[2], hour || 0, minute || 0, 0, 0).getTime();
}

function _seriesMsToYmd(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _seriesMsToHm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _seriesSlotDurationH(slotKind) {
  return slotKind === 'night' ? SERIES_NIGHT_H : SERIES_DAY_H;
}

function _seriesSlotPlan(startMs, slotKind) {
  const dur = _seriesSlotDurationH(slotKind) * 3600000;
  return {
    startMs: startMs,
    endMs: startMs + dur,
    slotKind: slotKind
  };
}

function _seriesIsSummerMonth(ms) {
  return SERIES_SUMMER_MONTHS.indexOf(new Date(ms).getMonth() + 1) !== -1;
}

function _seriesStartForbidden(ms) {
  const h = new Date(ms).getHours();
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
      const blocked = item.yomtov === true || subcat === 'shabbat' || subcat === 'holiday' ||
        title.indexOf('Shabbat') !== -1 || title.indexOf('שבת') !== -1 ||
        title.indexOf('Erev') !== -1 || title.indexOf('ערב') !== -1;
      if (!blocked && subcat !== 'shabbat' && subcat !== 'yomtov') return;
      const raw = String(item.date || '').slice(0, 10);
      if (raw) days[raw] = true;
    });
  } catch (e) {
    Logger.log('Hebcal fallback: ' + e);
  }
  let cur = _seriesYmdToMs(startYmd, 12, 0);
  const end = _seriesYmdToMs(endYmd, 12, 0);
  while (!isNaN(cur) && !isNaN(end) && cur <= end) {
    if (new Date(cur).getDay() === 6) days[_seriesMsToYmd(cur)] = true;
    cur += 86400000;
  }
  return days;
}

function _seriesDayBlocked(ymd, holyDays) {
  return !!holyDays[ymd];
}

function _seriesTouchesHoly(plan, holyDays) {
  let t = plan.startMs;
  while (t < plan.endMs) {
    if (_seriesDayBlocked(_seriesMsToYmd(t), holyDays)) return true;
    t += 86400000;
  }
  return false;
}

function _seriesExistingRanges(rangeStartMs, rangeEndMs) {
  const out = [];
  Exercises_all().forEach(function(ex) {
    const r = _exerciseTimeRange(ex);
    if (!r) return;
    if (r.endMs < rangeStartMs || r.startMs > rangeEndMs) return;
    out.push({
      startMs: r.startMs,
      endMs: r.endMs,
      type: String(ex.exercise_type || '').trim()
    });
  });
  return out;
}

function _seriesOverlapInfo(plan, exType, ranges) {
  let count = 0;
  let sameType = false;
  ranges.forEach(function(r) {
    if (r.startMs < plan.endMs && plan.startMs < r.endMs) {
      count++;
      if (r.type && exType && r.type === exType) sameType = true;
    }
  });
  return { count: count, sameType: sameType };
}

function _seriesCanPlace(plan, exType, holyDays, ranges, typeLastEndMs, rangeEndMs) {
  if (!plan || plan.endMs > rangeEndMs) return false;
  if (_seriesStartForbidden(plan.startMs)) return false;
  if (_seriesTouchesHoly(plan, holyDays)) return false;
  if (typeLastEndMs && plan.startMs < typeLastEndMs + SERIES_GAP_MS) return false;

  const ov = _seriesOverlapInfo(plan, exType, ranges);
  if (ov.sameType) return false;
  if (ov.count >= SERIES_MAX_CONCURRENT) return false;
  return true;
}

function _seriesSeriesStartMs(startYmd, holyDays) {
  let ms = _seriesYmdToMs(startYmd, SERIES_FIRST_DAY_HOUR, 0);
  const endGuard = ms + 400 * 86400000;
  while (ms < endGuard && _seriesDayBlocked(_seriesMsToYmd(ms), holyDays)) {
    ms += 86400000;
    ms = _seriesYmdToMs(_seriesMsToYmd(ms), SERIES_FIRST_DAY_HOUR, 0);
  }
  return ms;
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

function _seriesSlotLabel(slotKind) {
  return slotKind === 'night' ? 'תרגיל לילה' : 'תרגיל יום';
}

function Series_schedule(startYmd, endYmd, types) {
  const rangeEndMs = _seriesYmdToMs(endYmd, 23, 59) + 60000;
  if (isNaN(_parseRawDate(startYmd)) || isNaN(_parseRawDate(endYmd))) {
    throw new Error('טווח תאריכים לא תקין.');
  }
  if (!types.length) throw new Error('יש לציין לפחות תרגיל אחד בסדרה.');

  const holyDays = _seriesFetchHolyDays(startYmd, endYmd);
  const rangeStartMs = _seriesSeriesStartMs(startYmd, holyDays);
  if (isNaN(rangeStartMs) || rangeStartMs >= rangeEndMs) {
    throw new Error('טווח תאריכים לא תקין.');
  }

  const ranges = _seriesExistingRanges(rangeStartMs, rangeEndMs);
  const queue = _seriesBuildQueue(types);
  const placed = [];
  const typeLastEnd = {};
  const slotKinds = ['day', 'night'];

  queue.forEach(function(exType) {
    let searchMs = rangeStartMs;
    if (typeLastEnd[exType]) {
      searchMs = Math.max(searchMs, typeLastEnd[exType] + SERIES_GAP_MS);
    }

    let found = false;
    while (!found && searchMs < rangeEndMs) {
      for (let k = 0; k < slotKinds.length; k++) {
        const plan = _seriesSlotPlan(searchMs, slotKinds[k]);
        if (_seriesCanPlace(plan, exType, holyDays, ranges, typeLastEnd[exType], rangeEndMs)) {
          placed.push({ type: exType, plan: plan });
          ranges.push({
            startMs: plan.startMs,
            endMs: plan.endMs,
            type: exType
          });
          typeLastEnd[exType] = plan.endMs;
          found = true;
          break;
        }
      }
      if (!found) searchMs += SERIES_STEP_MS;
    }
  });

  return {
    placed: placed,
    skippedCount: queue.length - placed.length,
    holyDayCount: Object.keys(holyDays).length
  };
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
  const baseTs = Date.now();

  result.placed.forEach(function(item, idx) {
    const plan = item.plan;
    const type = item.type;
    const slotLabel = _seriesSlotLabel(plan.slotKind);
    const id = 'E' + baseTs + '_' + idx;

    exRows.push([
      id,
      type + ' — ' + slotLabel + ' ' + (idx + 1),
      'נוצר בבניית סדרה (' + slotLabel + ', ' + _seriesSlotDurationH(plan.slotKind) + ' שעות)',
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
  });

  if (exRows.length) _appendBatch('Exercises', exRows);

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
