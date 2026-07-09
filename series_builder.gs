// series_builder.gs — automatic exercise series scheduling (admin)
// בניית סדרה לפי סוגי כוח + סוגי תרגילים מוגדרים מראש לכל כוח.

var SERIES_GAP_MS = 18 * 3600000;
var SERIES_DRY_WET_GAP_MS = 6 * 3600000;
/** מרווח בין התקדמות ליבש־רטוב באותו כוח חשן. */
var SERIES_CHASHAN_ADV_TO_DRY_MS = 4 * 3600000;
var SERIES_MAX_CONCURRENT = 3;
var SERIES_FIRST_DAY_HOUR = 6;
var SERIES_STEP_MS = 30 * 60000;
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

function _seriesIsDryWetSplit(exType, variant) {
  return exType === 'חיר' && String(variant.label || '').indexOf('יבש רטוב') !== -1;
}

function _seriesDayWindowEndMs(startMs) {
  const d = new Date(startMs);
  d.setHours(SERIES_DAY_END_H, 0, 0, 0);
  return d.getTime();
}

/** מרווח יבש–רטוב: ביום מצומצם כדי שהזוג נכנס בין 06:00–18:00. */
function _seriesDryWetGapMs(startMs, variant) {
  const halfMs = ((variant.durationH || 0) / 2) * 3600000;
  const kind = Exercise_slotKindFromName(variant.label || '') || variant.slotKind || 'day';
  if (kind !== 'day') return SERIES_DRY_WET_GAP_MS;
  const maxSpan = _seriesDayWindowEndMs(startMs) - startMs;
  const ideal = 2 * halfMs + SERIES_DRY_WET_GAP_MS;
  if (maxSpan >= ideal) return SERIES_DRY_WET_GAP_MS;
  return Math.max(0, maxSpan - 2 * halfMs);
}

function _seriesIsChirSplitPart(plan) {
  const v = String(plan.variantLabel || '');
  if (v.indexOf('יבש רטוב') !== -1) return false;
  return v === 'יבש' || v === 'רטוב' || v.indexOf('יבש ') === 0 || v.indexOf('רטוב ') === 0;
}

/** חיר יבש+רטוב: בדיקת יום/לילה על כל הבלוק (לא על כל חלק בנפרד). */
function _seriesBundleMatchesNameSlot(parentLabel, plans) {
  const kind = Exercise_slotKindFromName(parentLabel || '');
  if (!kind || !plans.length) return true;
  const start = plans[0].startMs;
  const end = plans[plans.length - 1].endMs;
  if (!Exercise_msInSlotKind(start, kind)) return false;
  if (kind === 'day' && end > _seriesDayWindowEndMs(start)) return false;
  return true;
}

/** חיר: יבש רטוב → יבש + רטוב; משך כל חלק = חצי מהמקורי. */
function _seriesDryWetPlans(startMs, variant) {
  const totalH = variant.durationH || 0;
  const halfH = totalH / 2;
  const halfMs = halfH * 3600000;
  const slotKind = variant.slotKind || 'day';
  const gapMs = _seriesDryWetGapMs(startMs, variant);
  const dryEnd = startMs + halfMs;
  const wetStart = dryEnd + gapMs;
  return [
    {
      startMs: startMs,
      endMs: dryEnd,
      slotKind: slotKind,
      variantLabel: 'יבש',
      durationH: halfH
    },
    {
      startMs: wetStart,
      endMs: wetStart + halfMs,
      slotKind: slotKind,
      variantLabel: 'רטוב',
      durationH: halfH
    }
  ];
}

function _seriesPlansForPlacement(startMs, exType, variant) {
  if (_seriesIsDryWetSplit(exType, variant)) {
    return _seriesDryWetPlans(startMs, variant);
  }
  return [_seriesSlotPlan(startMs, variant)];
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
  if (_seriesIsChirSplitPart(plan)) return true;
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
  let t = plan.startMs;
  while (t < plan.endMs) {
    if (_seriesDayBlocked(_seriesMsToYmd(t), holyDays)) return true;
    t += 86400000;
  }
  return false;
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

function _seriesCanPlace(plan, forceSlot, holyDays, ranges, slotLastEndMs, rangeEndMs, minGapMs, location, isChirSplitPart) {
  if (!plan || plan.endMs > rangeEndMs) return false;
  if (_seriesStartForbidden(plan.startMs)) return false;
  if (!isChirSplitPart) {
    if (!_seriesStartMatchesSlotKind(plan.startMs, plan.slotKind)) return false;
    if (!_seriesPlanMatchesNameSlot(plan)) return false;
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

function _seriesCanPlacePlans(plans, forceSlot, holyDays, ranges, slotLastEndMs, rangeEndMs, location, firstPlanGapMs, parentVariantLabel) {
  if (!plans.length) return false;
  const isChirBundle = parentVariantLabel && plans.length > 1 &&
    String(parentVariantLabel).indexOf('יבש רטוב') !== -1;
  if (isChirBundle && !_seriesBundleMatchesNameSlot(parentVariantLabel, plans)) {
    return false;
  }
  const simRanges = ranges.slice();
  let prevEnd = slotLastEndMs;
  const gapBetweenParts = isChirBundle && plans.length > 1
    ? _seriesDryWetGapMs(plans[0].startMs, {
      label: parentVariantLabel,
      slotKind: plans[0].slotKind,
      durationH: (plans[0].durationH || 0) * 2
    })
    : SERIES_DRY_WET_GAP_MS;
  for (let i = 0; i < plans.length; i++) {
    let gap = (i > 0) ? gapBetweenParts : firstPlanGapMs;
    if (gap === undefined) gap = null;
    const splitPart = isChirBundle && _seriesIsChirSplitPart(plans[i]);
    if (!_seriesCanPlace(plans[i], forceSlot, holyDays, simRanges, prevEnd, rangeEndMs, gap, location, splitPart)) {
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

function _seriesLabelIsDryWet(label) {
  return String(label || '').indexOf('יבש רטוב') !== -1;
}

function _seriesLabelIsAdvancement(label) {
  return String(label || '').indexOf('התקדמות') !== -1;
}

/**
 * חשן: התקדמות (נוטרה) ואז יבש־רטוב (חפר/שיפון).
 * firstPlanGapMs מאפשר 4 שעות בין השניים (לא 18).
 */
function _seriesScheduleChashanAdvThenDry(
  dryVariant, searchMs, forceSlot, locations, holyDays, ranges,
  forceSlotLastEnd, rangeEndMs, rangeStartMs
) {
  const advVariants = (SERIES_VARIANTS_BY_FORCE['חשן'] || []).filter(function(v) {
    return _seriesLabelIsAdvancement(v.label) &&
      _seriesLocationsForVariant(v.label, locations).length > 0;
  });
  const dryLocs = _seriesLocationsForVariant(dryVariant.label, locations);
  if (!advVariants.length || !dryLocs.length) return null;

  const preferKind = dryVariant.slotKind || 'day';
  advVariants.sort(function(a, b) {
    return (a.slotKind === preferKind ? 0 : 1) - (b.slotKind === preferKind ? 0 : 1);
  });

  const slotEnd = forceSlotLastEnd[forceSlot];

  for (let step = 0; step < 96; step++) {
    const probeMs = searchMs + step * SERIES_STEP_MS;
    if (probeMs >= rangeEndMs) break;

    const dryProbe = _seriesPlansForPlacement(probeMs, 'חשן', dryVariant);
    const dryStartTarget = dryProbe[0].startMs;

    for (let av = 0; av < advVariants.length; av++) {
      const advVar = advVariants[av];
      const advLocs = _seriesLocationsForVariant(advVar.label, locations);
      const advDurMs = (advVar.durationH || 0) * 3600000;
      let advStart = dryStartTarget - SERIES_CHASHAN_ADV_TO_DRY_MS - advDurMs;

      for (let back = 0; back < 64; back++) {
        if (advStart < rangeStartMs) break;

        const advPlans = [_seriesSlotPlan(advStart, advVar)];
        const dryPlans = _seriesPlansForPlacement(
          advPlans[0].endMs + SERIES_CHASHAN_ADV_TO_DRY_MS, 'חשן', dryVariant
        );

        for (let ai = 0; ai < advLocs.length; ai++) {
          for (let di = 0; di < dryLocs.length; di++) {
            if (!_seriesCanPlacePlans(
              advPlans, forceSlot, holyDays, ranges, slotEnd, rangeEndMs, advLocs[ai]
            )) continue;

            const sim = ranges.slice();
            advPlans.forEach(function(p) {
              sim.push({
                startMs: p.startMs, endMs: p.endMs, type: 'חשן',
                forceSlot: forceSlot, location: advLocs[ai]
              });
            });
            const advEnd = advPlans[advPlans.length - 1].endMs;
            if (!_seriesCanPlacePlans(
              dryPlans, forceSlot, holyDays, sim, advEnd, rangeEndMs, dryLocs[di],
              SERIES_CHASHAN_ADV_TO_DRY_MS
            )) continue;

            return {
              advVariant: advVar,
              advPlans: advPlans,
              advLocation: advLocs[ai],
              dryPlans: dryPlans,
              dryLocation: dryLocs[di]
            };
          }
        }
        advStart -= SERIES_STEP_MS;
      }
    }
  }
  return null;
}

function _seriesVariantsToTry(item, variantIdxBySlot, locations) {
  let variants = _seriesVariantsForType(item.type).filter(function(v) {
    return _seriesLocationsForVariant(v.label, locations).length > 0;
  });
  if (item.type === 'חשן') {
    variants = variants.filter(function(v) { return !_seriesLabelIsAdvancement(v.label); });
  }
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
  const parentKind = Exercise_slotKindFromName(parentVariantLabel || '');
  const nameKind = parentKind || Exercise_slotKindFromName(plan.variantLabel || '');
  const base = nameKind === 'night' ? 'לילה' : (nameKind === 'day' ? 'יום' : (plan.slotKind === 'night' ? 'לילה' : 'יום'));
  let label = plan.variantLabel || '';
  if (parentVariantLabel && (label === 'יבש' || label === 'רטוב')) {
    label = (parentVariantLabel.indexOf('יבש רטוב') !== -1 ? parentVariantLabel : label) +
      ' — ' + plan.variantLabel;
  }
  return label ? (label + ' (' + base + ')') : ('תרגיל ' + base);
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
    let steps = 0;
    const variantsToTry = _seriesVariantsToTry(item, variantIdxBySlot, locations);

    while (!found && searchMs < rangeEndMs) {
      if (!variantsToTry.length) break;
      for (let vi = 0; vi < variantsToTry.length && !found; vi++) {
        const variant = variantsToTry[vi];
        const locCandidates = _seriesSortLocationsByAvailability(
          _seriesLocationsForVariant(variant.label, locations),
          locationLastEnd
        );
        if (exType === 'חשן' && _seriesLabelIsDryWet(variant.label)) {
          const pair = _seriesScheduleChashanAdvThenDry(
            variant, searchMs, forceSlot, locations, holyDays, ranges,
            forceSlotLastEnd, rangeEndMs, rangeStartMs
          );
          if (pair) {
            const pairId = 'CP' + placed.length;
            const entries = [
              { variant: pair.advVariant, location: pair.advLocation, plans: pair.advPlans },
              { variant: variant, location: pair.dryLocation, plans: pair.dryPlans }
            ];
            for (let pe = 0; pe < entries.length; pe++) {
              const ent = entries[pe];
              placed.push({
                type: 'חשן', forceSlot: forceSlot, variant: ent.variant,
                location: ent.location, plan: ent.plans[0], plans: ent.plans, pairId: pairId,
                fieldForceId: item.fieldForceId, forceName: item.forceName
              });
              for (let pi = 0; pi < ent.plans.length; pi++) {
                ranges.push({
                  startMs: ent.plans[pi].startMs, endMs: ent.plans[pi].endMs,
                  type: 'חשן', forceSlot: forceSlot, location: ent.location
                });
              }
              forceSlotLastEnd[forceSlot] = ent.plans[ent.plans.length - 1].endMs;
              locationLastEnd[ent.location] = ent.plans[ent.plans.length - 1].endMs;
            }
            variantIdxBySlot[exType + '_' + forceSlot] =
              (variantIdxBySlot[exType + '_' + forceSlot] || 0) + 1;
            found = true;
            scheduledCount++;
          }
          continue;
        }

        for (let li = 0; li < locCandidates.length && !found; li++) {
          const location = locCandidates[li];
          const plans = _seriesPlansForPlacement(searchMs, exType, variant);
          if (_seriesCanPlacePlans(
            plans, forceSlot, holyDays, ranges, forceSlotLastEnd[forceSlot], rangeEndMs, location,
            null, variant.label
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
      searchMs += SERIES_STEP_MS;
      steps++;
      // קפיצה יומית אם נתקע — מחפש מהר יותר חלון יום/לילה מתאים
      if (!found && steps > 0 && steps % 48 === 0) {
        const d = new Date(searchMs);
        d.setDate(d.getDate() + 1);
        d.setHours(SERIES_FIRST_DAY_HOUR, 0, 0, 0);
        searchMs = d.getTime();
      }
    }
  });

  return {
    placed: placed,
    requestedCount: queue.length,
    skippedCount: queue.length - scheduledCount,
    holyDayCount: Object.keys(holyDays).length
  };
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
  s += '<li>יום/לילה לפי סוג התרגיל · חשן: התקדמות ואז יבש־רטוב</li>';
  s += '<li>ללא שבת/חג · בקיץ ללא התחלה 12:00–16:00</li>';
  s += '</ul>';
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

      const pairNote = item.pairId ? (' · pair=' + item.pairId) : '';
      exRows.push([
        id,
        type + ' — ' + slotLabel + locPart + ' ' + rowIdx,
        'נוצר בבניית סדרה (' + slotLabel + locPart + ', ' + plan.durationH + ' שעות)' + pairNote,
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

  if (exRows.length) _appendBatch('Exercises', exRows);

  const createdCount = exRows.length;
  const scheduledCount = result.requestedCount - result.skippedCount;
  let info = '✅';
  if (removedCount) info += ' נוקו ' + removedCount + ' תרגילים קיימים ·';
  info += ' שובצו ' + scheduledCount + ' מקומות בלוז · נוצרו ' + createdCount + ' רשומות תרגיל';
  if (createdCount > scheduledCount) {
    info += ' (פיצולי יבש/רטוב לחיר · זוגות התקדמות+יבש־רטוב לחשן)';
  }
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
