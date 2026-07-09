// series_builder.gs — automatic exercise series scheduling (admin)
// בניית סדרה לפי סוגי כוח + סוגי תרגילים מוגדרים מראש לכל כוח.

var SERIES_GAP_MS = 18 * 3600000;
var SERIES_MAX_CONCURRENT = 3;
var SERIES_FIRST_DAY_HOUR = 6;
var SERIES_SUMMER_MONTHS = [6, 7, 8, 9];
var SERIES_HEAT_START_H = 12;
var SERIES_HEAT_END_H = 16;
var SERIES_FORBIDDEN_START_H = 5;
var SERIES_DAY_START_H = 6;
var SERIES_DAY_END_H = 18;
var SERIES_BLOCKED_WEEKDAYS = { 0: true, 5: true, 6: true }; // Sun, Fri, Sat

/** מיקום → סוגי תרגיל מותרים (תווית וריאנט כמו ב-SERIES_VARIANTS_BY_FORCE). */
var SERIES_LOCATIONS = {
  'נוטרה': ['התקדמות לילה', 'התקדמות יום'],
  'חפר': ['יבש רטוב יום', 'יבש רטוב לילה'],
  'שיפון': ['יבש רטוב יום', 'יבש רטוב לילה'],
  'אל פוראן': ['התקפה לילה', 'התקפה יום'],
  'אודם': ['התקפה יום', 'התקפה לילה']
};

var SERIES_LOCATION_FORM_KEYS = {
  'נוטרה': 'notra',
  'חפר': 'hefer',
  'שיפון': 'shifon',
  'אל פוראן': 'poran',
  'אודם': 'odem'
};

var SERIES_VARIANTS_BY_FORCE = {
  /** סוג כוח → וריאנטים (תווית, משך שעות, יום/לילה) — מקור אמת לבניית סדרה */
  'חיר': [
    { label: 'יבש רטוב יום', durationH: 8, slotKind: 'day' },
    { label: 'יבש רטוב לילה', durationH: 12, slotKind: 'night' }
  ],
  '900': [
    { label: 'התקדמות לילה', durationH: 8, slotKind: 'night' },
    { label: 'יבש רטוב יום', durationH: 6, slotKind: 'day' },
    { label: 'התקפה יום', durationH: 6, slotKind: 'day' },
    { label: 'התקפה לילה', durationH: 6, slotKind: 'night' },
    { label: 'הגנה יום', durationH: 6, slotKind: 'day' },
    { label: 'הגנה לילה', durationH: 6, slotKind: 'night' }
  ],
  'חשן': [
    { label: 'יבש רטוב יום', durationH: 6, slotKind: 'day' },
    { label: 'יבש רטוב מועמד לילה', durationH: 12, slotKind: 'night' },
    { label: 'התקדמות לילה', durationH: 6, slotKind: 'night' },
    { label: 'התקדמות יום', durationH: 6, slotKind: 'day' }
  ]
};

function _seriesNormalizeForceType(v) {
  const s = String(v || '').trim();
  if (s === 'חיר' || s === 'חשן' || s === '900') return s;
  return '';
}

function _seriesLocationFormKey(loc) {
  return SERIES_LOCATION_FORM_KEYS[loc] || String(loc).replace(/\s+/g, '_');
}

function _seriesLocationsFromParams(p) {
  const all = Object.keys(SERIES_LOCATIONS);
  const selected = [];
  let anyParam = false;
  all.forEach(function(loc) {
    const key = 'series_loc_' + _seriesLocationFormKey(loc);
    if (p[key] != null && String(p[key]).trim() !== '') anyParam = true;
    if (p[key] === '1' || p[key] === 'on' || String(p[key]).toLowerCase() === 'true') {
      selected.push(loc);
    }
  });
  if (!selected.length) return anyParam ? [] : all.slice();
  return selected;
}

function _seriesLocationAllowsVariant(location, variantLabel) {
  const allowed = SERIES_LOCATIONS[location];
  if (!allowed || !allowed.length) return false;
  const v = String(variantLabel || '').trim();
  return allowed.some(function(rule) {
    if (v === rule) return true;
    if (rule === 'יבש רטוב לילה' &&
        v.indexOf('יבש רטוב') !== -1 && v.indexOf('לילה') !== -1) return true;
    if (rule === 'יבש רטוב יום' &&
        v.indexOf('יבש רטוב') !== -1 && v.indexOf('יום') !== -1) return true;
    return v.indexOf(rule) !== -1;
  });
}

function _seriesLocationsForVariant(variantLabel, locations) {
  return locations.filter(function(loc) {
    return _seriesLocationAllowsVariant(loc, variantLabel);
  });
}

/** שלושה גדודים מכוחות בשטח — סוג התרגיל נגזר מ־force_type של כל גדוד. */
function Series_saveBattalionConfig(slots) {
  PropertiesService.getScriptProperties().setProperty(
    'series_battalions',
    JSON.stringify(slots || [])
  );
}

function Series_getBattalionConfig() {
  const raw = PropertiesService.getScriptProperties().getProperty('series_battalions');
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return arr && arr.length ? arr : null;
  } catch (e) {
    return null;
  }
}

function _seriesBattalionsFromParams(p) {
  const keys = ['series_ff_1', 'series_ff_2', 'series_ff_3'];
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const id = String(p[keys[i]] || '').trim();
    const ff = FieldForces_get(id);
    if (!ff) {
      throw new Error('יש לבחור 3 גדודים מכוחות בשטח (גדוד ' + (i + 1) + ').');
    }
    if (!FieldForces_isBattalion(ff)) {
      throw new Error('«' + FieldForces_displayLabel(ff) + '» אינו מסוג גדוד — בחר רשומה עם תפקיד גדוד.');
    }
    const ft = _seriesNormalizeForceType(ff.force_type);
    if (!ft) {
      throw new Error('לגדוד «' + FieldForces_displayLabel(ff) + '» חסר סוג כוח תקין (חיר / חשן / 900).');
    }
    slots.push({
      slot: i,
      fieldForceId: ff.id,
      forceName: FieldForces_displayLabel(ff),
      forceType: ft
    });
  }
  return slots;
}

/** שלושה גדודים בסדרה + סה"כ תרגילים — חלוקה שווה (±1) לכל גדוד. */
function _seriesQueueFromParams(p) {
  const battalions = _seriesBattalionsFromParams(p);
  Series_saveBattalionConfig(battalions);

  const total = Math.max(0, parseInt(p.series_total, 10) || 0);
  if (total < 3) {
    throw new Error('יש להזין לפחות 3 תרגילים בסדרה (מחולקים בין 3 הגדודים).');
  }

  const base = Math.floor(total / 3);
  const rem = total % 3;
  const perForce = [base, base, base];
  for (let i = 0; i < rem; i++) perForce[i]++;

  const queue = [];
  for (let i = 0; i < 3; i++) {
    const b = battalions[i];
    for (let j = 0; j < perForce[i]; j++) {
      queue.push({
        type: b.forceType,
        forceSlot: i,
        fieldForceId: b.fieldForceId,
        forceName: b.forceName
      });
    }
  }
  return queue;
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

function _seriesSlotPlan(startMs, variant) {
  const dur = (variant.durationH || 0) * 3600000;
  const labelKind = Exercise_slotKindFromName(variant.label || '');
  return {
    startMs: startMs,
    endMs: startMs + dur,
    slotKind: labelKind || variant.slotKind || 'day',
    variantLabel: variant.label || '',
    durationH: variant.durationH || 0
  };
}

function _seriesSlotKindForVariant(variant) {
  return Exercise_slotKindFromName(variant.label || '') || variant.slotKind || 'day';
}

function _seriesNextDayYmd(ymd) {
  const parts = String(ymd).split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + 1, 12, 0, 0, 0);
  return _seriesMsToYmd(d.getTime());
}

/** שעת התחלה קנונית (>= ms): תרגיל יום → 06:00, תרגיל לילה → 18:00 */
function _seriesSnapToSlotStart(ms, slotKind) {
  if (isNaN(ms)) return ms;
  let guard = 0;
  while (guard++ < 400) {
    const ymd = _seriesMsToYmd(ms);
    if (slotKind === 'day') {
      const dayStart = _seriesYmdToMs(ymd, SERIES_DAY_START_H, 0);
      const dayEnd = _seriesYmdToMs(ymd, SERIES_DAY_END_H, 0);
      if (ms <= dayStart) return dayStart;
      if (ms >= dayEnd) {
        ms = _seriesYmdToMs(_seriesNextDayYmd(ymd), SERIES_DAY_START_H, 0);
        continue;
      }
      const d = new Date(ms);
      if (d.getMinutes() > 0 || d.getSeconds() > 0 || d.getMilliseconds() > 0) {
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + 1);
        ms = d.getTime();
        if (ms >= dayEnd) {
          ms = _seriesYmdToMs(_seriesNextDayYmd(ymd), SERIES_DAY_START_H, 0);
          continue;
        }
      }
      return ms;
    }
    if (slotKind === 'night') {
      const evening = _seriesYmdToMs(ymd, SERIES_DAY_END_H, 0);
      const morning = _seriesYmdToMs(ymd, SERIES_DAY_START_H, 0);
      if (ms < morning) {
        if (ms <= evening) return evening;
      } else if (ms < evening) {
        return evening;
      }
      ms = _seriesYmdToMs(_seriesNextDayYmd(ymd), SERIES_DAY_END_H, 0);
      continue;
    }
    return ms;
  }
  return ms;
}

function _seriesPlansForPlacement(startMs, exType, variant) {
  const kind = _seriesSlotKindForVariant(variant);
  const snapped = _seriesSnapToSlotStart(startMs, kind);
  return [_seriesSlotPlan(snapped, variant)];
}

function _seriesIsSummerMonth(ms) {
  return SERIES_SUMMER_MONTHS.indexOf(new Date(ms).getMonth() + 1) !== -1;
}

function _seriesStartForbidden(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === SERIES_FORBIDDEN_START_H && m === 0) return true;
  if (_seriesIsSummerMonth(ms) && h >= SERIES_HEAT_START_H && h < SERIES_HEAT_END_H) return true;
  return false;
}

function _seriesStartMatchesSlotKind(ms, slotKind) {
  return Exercise_msInSlotKind(ms, slotKind);
}

function _seriesPlanMatchesNameSlot(plan) {
  const kind = Exercise_slotKindFromName(plan.variantLabel || '');
  if (!kind) return true;
  if (!Exercise_msInSlotKind(plan.startMs, kind)) return false;
  if (kind === 'day') {
    const endH = new Date(plan.endMs).getHours();
    const endM = new Date(plan.endMs).getMinutes();
    if (endH > SERIES_DAY_END_H || (endH === SERIES_DAY_END_H && endM > 0)) return false;
  }
  return true;
}

function _seriesIsBlockedWeekday(ms) {
  return !!SERIES_BLOCKED_WEEKDAYS[new Date(ms).getDay()];
}

function _seriesDateYmdFromHebcalItem(item) {
  return String(item.date || '').slice(0, 10);
}

function _seriesIsBlockedHebcalItem(item) {
  const subcat = String(item.subcat || '');
  const title = String(item.title || '');
  return item.yomtov === true || subcat === 'holiday' || subcat === 'yomtov' ||
    title.indexOf('Erev') !== -1 || title.indexOf('ערב') !== -1;
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
      if (!_seriesIsBlockedHebcalItem(item)) return;
      const raw = _seriesDateYmdFromHebcalItem(item);
      if (raw) days[raw] = true;
    });
  } catch (e) {
    Logger.log('Hebcal fallback: ' + e);
  }
  return days;
}

function _seriesDayBlocked(ymd, holyDays) {
  const noonMs = _seriesYmdToMs(ymd, 12, 0);
  if (isNaN(noonMs)) return true;
  if (_seriesIsBlockedWeekday(noonMs)) return true;
  return !!holyDays[ymd];
}

function _seriesTouchesBlockedDay(plan, holyDays) {
  let blocked = false;
  Exercise_eachDayYmdInRange(plan.startMs, plan.endMs, function(ymd) {
    if (_seriesDayBlocked(ymd, holyDays)) blocked = true;
  });
  return blocked;
}

function _seriesForceSlotNum(ex) {
  const s = parseInt(ex && ex.series_force_slot, 10);
  if (isNaN(s) || s < 0 || s > 2) return -1;
  return s;
}

function _seriesExistingRanges(rangeStartMs, rangeEndMs) {
  const out = [];
  Exercises_all().forEach(function(ex) {
    const r = _exerciseTimeRange(ex);
    if (!r) return;
    if (r.endMs < rangeStartMs || r.startMs > rangeEndMs) return;
    const loc = String(ex.camp || '').trim();
    out.push({
      startMs: r.startMs,
      endMs: r.endMs,
      type: String(ex.exercise_type || '').trim(),
      forceSlot: _seriesForceSlotNum(ex),
      location: loc || undefined
    });
  });
  return out;
}

function _seriesOverlapInfo(plan, forceSlot, ranges, location) {
  let count = 0;
  let sameForceSlot = false;
  let sameLocation = false;
  ranges.forEach(function(r) {
    if (r.startMs < plan.endMs && plan.startMs < r.endMs) {
      count++;
      if (forceSlot >= 0 && r.forceSlot === forceSlot) sameForceSlot = true;
      if (location && r.location && r.location === location) sameLocation = true;
    }
  });
  return { count: count, sameForceSlot: sameForceSlot, sameLocation: sameLocation };
}

function _seriesCanPlace(plan, forceSlot, holyDays, ranges, slotLastEndMs, rangeEndMs, minGapMs, location) {
  if (!plan || plan.endMs > rangeEndMs) return false;
  if (_seriesStartForbidden(plan.startMs)) return false;
  if (!_seriesStartMatchesSlotKind(plan.startMs, plan.slotKind)) return false;
  if (!_seriesPlanMatchesNameSlot(plan)) return false;
  const startD = new Date(plan.startMs);
  if (plan.slotKind === 'day') {
    if (startD.getMinutes() !== 0 || startD.getSeconds() !== 0) return false;
    if (startD.getHours() < SERIES_DAY_START_H || startD.getHours() >= SERIES_DAY_END_H) return false;
  } else if (plan.slotKind === 'night') {
    if (startD.getMinutes() !== 0 || startD.getSeconds() !== 0) return false;
    if (startD.getHours() !== SERIES_DAY_END_H) return false;
  }
  if (_seriesTouchesBlockedDay(plan, holyDays)) return false;
  if (slotLastEndMs != null) {
    const gap = minGapMs != null ? minGapMs : SERIES_GAP_MS;
    if (plan.startMs < slotLastEndMs + gap) return false;
  }

  const ov = _seriesOverlapInfo(plan, forceSlot, ranges, location);
  if (ov.sameForceSlot) return false;
  if (ov.sameLocation) return false;
  if (ov.count >= SERIES_MAX_CONCURRENT) return false;
  return true;
}

function _seriesCanPlacePlans(plans, forceSlot, holyDays, ranges, slotLastEndMs, rangeEndMs, location, firstPlanGapMs) {
  if (!plans.length) return false;
  const simRanges = ranges.slice();
  let prevEnd = slotLastEndMs;
  for (let i = 0; i < plans.length; i++) {
    const gap = (i > 0) ? SERIES_GAP_MS : firstPlanGapMs;
    if (!_seriesCanPlace(plans[i], forceSlot, holyDays, simRanges, prevEnd, rangeEndMs, gap, location)) {
      return false;
    }
    simRanges.push({
      startMs: plans[i].startMs,
      endMs: plans[i].endMs,
      type: '',
      forceSlot: forceSlot,
      location: location
    });
    prevEnd = plans[i].endMs;
  }
  return true;
}

function _seriesFirstMondayMs(startYmd) {
  let ms = _seriesYmdToMs(startYmd, SERIES_FIRST_DAY_HOUR, 0);
  const endGuard = ms + 400 * 86400000;
  while (ms < endGuard && new Date(ms).getDay() !== 1) {
    ms += 86400000;
    ms = _seriesYmdToMs(_seriesMsToYmd(ms), SERIES_FIRST_DAY_HOUR, 0);
  }
  return ms;
}

function _seriesSeriesStartMs(startYmd, holyDays) {
  let ms = _seriesFirstMondayMs(startYmd);
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

function _seriesVariantsForType(exType) {
  return SERIES_VARIANTS_BY_FORCE[exType] || [
    { label: 'תרגיל', durationH: 6, slotKind: 'day' }
  ];
}

function _seriesVariantsToTry(item, variantIdxBySlot, locations) {
  const variants = _seriesVariantsForType(item.type).filter(function(v) {
    return _seriesLocationsForVariant(v.label, locations).length > 0;
  });
  const key = item.type + '_' + item.forceSlot;
  const start = variantIdxBySlot[key] || 0;
  const ordered = [];
  for (let i = 0; i < variants.length; i++) {
    ordered.push(variants[(start + i) % variants.length]);
  }
  return ordered;
}

function _seriesSortLocationsByAvailability(locs, locationLastEnd) {
  return locs.slice().sort(function(a, b) {
    const ea = locationLastEnd[a] != null ? locationLastEnd[a] : 0;
    const eb = locationLastEnd[b] != null ? locationLastEnd[b] : 0;
    return ea - eb;
  });
}

function _seriesSlotLabel(plan, parentVariantLabel) {
  return plan.variantLabel || parentVariantLabel || 'תרגיל';
}

function Series_schedule(startYmd, endYmd, queue, locations, opts) {
  opts = opts || {};
  const rangeEndMs = _seriesYmdToMs(endYmd, 23, 59) + 60000;
  if (isNaN(_parseRawDate(startYmd)) || isNaN(_parseRawDate(endYmd))) {
    throw new Error('טווח תאריכים לא תקין.');
  }
  if (!queue.length) throw new Error('יש לציין לפחות תרגיל אחד בסדרה.');
  locations = locations && locations.length ? locations : Object.keys(SERIES_LOCATIONS);
  if (!locations.length) {
    throw new Error('יש לבחור לפחות מיקום אחד לסדרה.');
  }

  const holyDays = _seriesFetchHolyDays(startYmd, endYmd);
  const rangeStartMs = _seriesSeriesStartMs(startYmd, holyDays);
  if (isNaN(rangeStartMs) || rangeStartMs >= rangeEndMs) {
    throw new Error('טווח תאריכים לא תקין.');
  }

  const ranges = opts.ignoreExisting
    ? []
    : _seriesExistingRanges(rangeStartMs, rangeEndMs);
  const workQueue = _seriesBuildQueue(queue);
  const placed = [];
  const forceSlotLastEnd = {};
  const locationLastEnd = {};
  const variantIdxBySlot = {};
  let scheduledCount = 0;

  workQueue.forEach(function(item) {
    const exType = item.type;
    const forceSlot = item.forceSlot;
    let searchMs = rangeStartMs;
    if (forceSlotLastEnd[forceSlot] != null) {
      searchMs = Math.max(searchMs, forceSlotLastEnd[forceSlot] + SERIES_GAP_MS);
    }

    let found = false;
    const variantsToTry = _seriesVariantsToTry(item, variantIdxBySlot, locations);

    while (!found && searchMs < rangeEndMs) {
      if (!variantsToTry.length) break;
      for (let vi = 0; vi < variantsToTry.length && !found; vi++) {
        const variant = variantsToTry[vi];
        const kind = _seriesSlotKindForVariant(variant);
        const probeMs = _seriesSnapToSlotStart(searchMs, kind);
        if (probeMs >= rangeEndMs) continue;
        const locCandidates = _seriesSortLocationsByAvailability(
          _seriesLocationsForVariant(variant.label, locations),
          locationLastEnd
        );
        if (!locCandidates.length) continue;
        for (let li = 0; li < locCandidates.length && !found; li++) {
          const location = locCandidates[li];
          const plans = _seriesPlansForPlacement(probeMs, exType, variant);
          if (_seriesCanPlacePlans(
            plans, forceSlot, holyDays, ranges, forceSlotLastEnd[forceSlot], rangeEndMs, location
          )) {
            placed.push({
              type: exType,
              forceSlot: forceSlot,
              variant: variant,
              location: location,
              plan: plans[0],
              plans: plans,
              fieldForceId: item.fieldForceId,
              forceName: item.forceName
            });
            plans.forEach(function(plan) {
              ranges.push({
                startMs: plan.startMs,
                endMs: plan.endMs,
                type: exType,
                forceSlot: forceSlot,
                location: location
              });
            });
            forceSlotLastEnd[forceSlot] = plans[plans.length - 1].endMs;
            locationLastEnd[location] = plans[plans.length - 1].endMs;
            const key = exType + '_' + forceSlot;
            variantIdxBySlot[key] = (variantIdxBySlot[key] || 0) + 1;
            found = true;
            scheduledCount++;
          }
        }
      }
      const ymd = _seriesMsToYmd(searchMs);
      searchMs = _seriesYmdToMs(_seriesNextDayYmd(ymd), SERIES_FIRST_DAY_HOUR, 0);
    }
  });

  return {
    placed: placed,
    requestedCount: queue.length,
    skippedCount: queue.length - scheduledCount,
    holyDayCount: Object.keys(holyDays).length
  };
}

function Series_variantsRulesHtml() {
  const forceOrder = ['חיר', '900', 'חשן'];
  let s = '<p style="font-size:11px;color:var(--muted);margin:0 0 6px"><b>סוגי תרגיל ומשך</b> (לפי סוג כוח של הגדוד)</p>';
  s += '<table class="tbl" style="font-size:11px;margin:0 0 12px"><thead><tr>' +
    '<th>סוג כוח</th><th>תרגיל</th><th style="text-align:left">משך</th></tr></thead><tbody>';
  forceOrder.forEach(function(ft) {
    const variants = SERIES_VARIANTS_BY_FORCE[ft] || [];
    variants.forEach(function(v, i) {
      s += '<tr><td>' + (i === 0 ? '<b>' + ft + '</b>' : '') + '</td><td>' +
        _esc(v.label) + '</td><td class="mono" style="text-align:left">' +
        v.durationH + ' שעות</td></tr>';
    });
  });
  s += '</tbody></table>';
  return s;
}

function Series_locationRulesHtml() {
  let s = '<table class="tbl" style="font-size:11px;margin:0 0 12px"><thead><tr>' +
    '<th>מיקום</th><th>סוגי תרגיל</th></tr></thead><tbody>';
  Object.keys(SERIES_LOCATIONS).forEach(function(loc) {
    s += '<tr><td><b>' + loc + '</b></td><td>' +
      SERIES_LOCATIONS[loc].join(' · ') + '</td></tr>';
  });
  s += '</tbody></table>';
  return s;
}

function Series_locationCheckboxesHtml() {
  let s = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">';
  Object.keys(SERIES_LOCATIONS).forEach(function(loc) {
    const key = _seriesLocationFormKey(loc);
    s += '<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">' +
      '<input type="checkbox" name="series_loc_' + key + '" value="1" checked> ' +
      '<span>' + loc + '</span></label>';
  });
  s += '</div>';
  return s;
}

function Series_battalionSelectOptions() {
  return FieldForces_battalionSelectOptions();
}

function Series_buildFormHtml(sid) {
  const ffOpts = Series_battalionSelectOptions();
  const battalionCount = FieldForces_battalions().length;
  const saved = Series_getBattalionConfig() || [];
  let s = '<p style="font-size:12px;color:var(--muted);margin-bottom:12px">' +
    'תזמון אוטומטי: בוחרים <b>3 גדודים</b> מכוחות בשטח — סוג התרגיל (חיר / חשן / 900) נלקח משדה «סוג כוח» של כל גדוד. ' +
    'התרגילים מתחלקים בערך שווה בין שלושת הגדודים.</p>';
  if (battalionCount < 3) {
    s += '<p style="font-size:12px;color:#d97706;margin:0 0 12px;font-weight:600">' +
      '⚠ יש רק ' + battalionCount + ' גדודים במערכת — הוסף גדודים ב<a href="#" data-spa-page="fieldForces">כוחות בשטח</a> (תפקיד: גדוד).</p>';
  }
  s += '<p style="font-size:12px;color:#d97706;margin:0 0 12px;font-weight:600">' +
    '⚠ בניית סדרה מוחקת את כל התרגילים, השיבוצים וצירי הזמן הקיימים במערכת.</p>';
  s += '<ul style="font-size:11px;color:var(--muted);margin:0 0 14px 18px;line-height:1.6">';
  s += '<li>התחלה ביום שני הראשון בטווח, בשעה 06:00</li>';
  s += '<li>מרווח 18 שעות בין תרגילים באותו כוח (מסלול)</li>';
  s += '<li>עד 3 תרגילים במקביל (גדודים שונים יכולים להיות מאותו סוג כוח)</li>';
  s += '<li>תרגילי יום מתחילים ב־06:00 · תרגילי לילה ב־18:00</li>';
  s += '<li>ללא שבת/חג/יום ראשון · בקיץ ללא התחלה 12:00–16:00</li>';
  s += '</ul>';
  s += Series_variantsRulesHtml();
  s += '<p style="font-size:11px;color:var(--muted);margin:0 0 6px"><b>מיקומים מותרים</b></p>';
  s += Series_locationRulesHtml();
  s += _formOpen();
  s += '<input type="hidden" name="action" value="buildSeries">';
  s += '<input type="hidden" name="sid" value="' + _esc(sid) + '">';
  s += '<div class="form-grid">';
  s += '<div class="form-row"><label class="form-label">מתאריך</label>';
  s += '<input type="text" name="series_start" class="form-input datepicker" required></div>';
  s += '<div class="form-row"><label class="form-label">עד תאריך</label>';
  s += '<input type="text" name="series_end" class="form-input datepicker" required></div>';
  s += '</div>';
  s += '<div class="form-row" style="margin-top:8px"><label class="form-label">סה״כ תרגילים בסדרה</label>';
  s += '<input type="number" name="series_total" class="form-input" min="3" value="9" required></div>';
  s += '<div class="form-grid" style="margin-top:8px">';
  s += '<div class="form-row"><label class="form-label">גדוד 1</label>' +
    _select('series_ff_1', ffOpts, saved[0] ? saved[0].fieldForceId : '', 'required') + '</div>';
  s += '<div class="form-row"><label class="form-label">גדוד 2</label>' +
    _select('series_ff_2', ffOpts, saved[1] ? saved[1].fieldForceId : '', 'required') + '</div>';
  s += '<div class="form-row"><label class="form-label">גדוד 3</label>' +
    _select('series_ff_3', ffOpts, saved[2] ? saved[2].fieldForceId : '', 'required') + '</div>';
  s += '</div>';
  s += '<div class="form-row" style="margin-top:12px"><label class="form-label">מיקומים לשיבוץ</label>';
  s += Series_locationCheckboxesHtml() + '</div>';
  s += '<p style="font-size:11px;color:var(--muted);margin-top:8px">' +
    'דוגמה: 9 תרגילים, 3 גדודים (חיר + חשן + 900) → 3 תרגילים לכל גדוד. בציר הזמן — שורה לכל גדוד.</p>';
  s += '<button type="submit" class="btn btn-primary btn-full" ' +
    'onclick="return confirm(\'בניית סדרה תמחק את כל התרגילים, השיבוצים וצירי הזמן הקיימים. להמשיך?\')">' +
    '► בנה סדרה</button>';
  s += '</form>';
  return s;
}

function Exercises_buildSeries(p) {
  const u = Auth_requireRole(p, ['admin']);
  const startYmd = String(p.series_start || p.series_start_date || '').trim();
  const endYmd   = String(p.series_end || p.series_end_date || '').trim();
  const queue = _seriesQueueFromParams(p);
  const locations = _seriesLocationsFromParams(p);

  if (!startYmd || !endYmd) throw new Error('חובה לבחור תאריך התחלה וסיום לסדרה.');
  if (!locations.length) {
    throw new Error('יש לבחור לפחות מיקום אחד לסדרה.');
  }
  const startTs = _parseRawDate(startYmd);
  const endTs   = _parseRawDate(endYmd);
  if (isNaN(startTs) || isNaN(endTs) || endTs < startTs) {
    throw new Error('טווח תאריכים לא תקין.');
  }

  const result = Series_schedule(startYmd, endYmd, queue, locations, { ignoreExisting: true });
  if (!result.placed.length) {
    return Views_exercises({
      sid: p.sid,
      error: 'לא נמצא מקום לתרגילים בטווח הנתון. נסה להרחיב טווח או להפחית כמות.'
    });
  }

  const removedCount = Exercises_clearAllBeforeSeries();

  const exRows = [];
  const baseTs = Date.now();

  const battalionConfig = Series_getBattalionConfig() || [];

  let rowIdx = 0;
  result.placed.forEach(function(item) {
    const type = item.type;
    const plans = item.plans || [item.plan];
    const location = item.location || '';
    const slotBn = battalionConfig[item.forceSlot] || {};
    const forceName = item.forceName || slotBn.forceName || '';
    const fieldForceId = item.fieldForceId || slotBn.fieldForceId || '';
    plans.forEach(function(plan) {
      const slotLabel = _seriesSlotLabel(plan, item.variant ? item.variant.label : '');
      const id = 'E' + baseTs + '_' + rowIdx;
      rowIdx++;
      const locPart = location ? (' · ' + location) : '';

      exRows.push([
        id,
        type + ' — ' + slotLabel + locPart + ' ' + rowIdx,
        'נוצר בבניית סדרה (' + slotLabel + locPart + ', ' + plan.durationH + ' שעות)',
        u.id,
        _seriesMsToYmd(plan.startMs),
        _seriesMsToYmd(plan.endMs),
        'סדרה',
        type,
        forceName,
        location,
        '',
        _seriesMsToHm(plan.startMs),
        _seriesMsToHm(plan.endMs),
        String(item.forceSlot),
        fieldForceId
      ]);
    });
  });

  if (exRows.length) Exercises_appendRows(exRows);

  const createdCount = exRows.length;
  const scheduledCount = result.requestedCount - result.skippedCount;
  let info = '✅';
  if (removedCount) info += ' נוקו ' + removedCount + ' תרגילים קיימים ·';
  info += ' שובצו ' + scheduledCount + ' מקומות בלוז · נוצרו ' + createdCount + ' תרגילים';
  const byType = {};
  exRows.forEach(function(row) {
    const t = row[7];
    byType[t] = (byType[t] || 0) + 1;
  });
  Object.keys(byType).forEach(function(t) {
    info += ' · ' + t + ': ' + byType[t];
  });
  if (battalionConfig.length) {
    info += '. גדודים: ' + battalionConfig.map(function(b) {
      return b.forceName + ' (' + b.forceType + ')';
    }).join(', ');
  }
  if (result.skippedCount) {
    info += '. לא נמצא מקום ל-' + result.skippedCount +
      ' (הרחב טווח, הוסף מיקומים, או הקטן כמות)';
  }
  info += '. מיקומים: ' + locations.join(', ');
  info += '. (ימי חסימה בטווח: ' + result.holyDayCount + ')';

  return Views_exercises({ sid: p.sid, info: info });
}
