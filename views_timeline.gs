// views_timeline.gs — Timeline RTL (6h / day / 3d / week) + edit mode (admin)

var TIMELINE_WEEK_MIN = -12;
var TIMELINE_WEEK_MAX = 12;
var TIMELINE_6H_MS = 6 * 3600000;
var TIMELINE_6H_SLOTS_PER_WEEK = 28;

function _timelineWeekOffset(p) {
  let w = parseInt(p && p.week != null ? p.week : 0, 10);
  if (isNaN(w)) w = 0;
  if (w < TIMELINE_WEEK_MIN) w = TIMELINE_WEEK_MIN;
  if (w > TIMELINE_WEEK_MAX) w = TIMELINE_WEEK_MAX;
  return w;
}

function _timelineWeekLabel(offset) {
  if (offset === 0) return 'השבוע הנוכחי';
  if (offset > 0) return offset === 1 ? 'שבוע קדימה' : offset + ' שבועות קדימה';
  const n = -offset;
  return n === 1 ? 'שבוע אחורה' : n + ' שבועות אחורה';
}

function _timelineWeekBounds(weekOffset) {
  const nowDate = new Date();
  nowDate.setHours(0, 0, 0, 0);
  const baseWeek = new Date(nowDate);
  baseWeek.setDate(nowDate.getDate() - nowDate.getDay());
  const weekStart = new Date(baseWeek);
  weekStart.setDate(baseWeek.getDate() + weekOffset * 7);
  return {
    weekStartMs: weekStart.getTime(),
    weekStartYmd: weekStart.getFullYear() + '-' +
      String(weekStart.getMonth() + 1).padStart(2, '0') + '-' +
      String(weekStart.getDate()).padStart(2, '0')
  };
}

function _timelineRangeMode(p) {
  const r = String(p && p.range != null ? p.range : 'week').trim();
  if (r === '6h' || r === '6') return '6h';
  if (r === 'day' || r === '1d') return 'day';
  if (r === '3d' || r === '3') return '3d';
  return 'week';
}

function _timelineRangeMeta(mode) {
  const DAY_MS = 86400000;
  if (mode === '6h') {
    return {
      mode: '6h',
      label: '6 שעות',
      spanMs: TIMELINE_6H_MS,
      dayCount: 1,
      slotsPerDay: 6,
      slotMs: 3600000,
      dayWidth: 480,
      slotLabels: null
    };
  }
  if (mode === 'day') {
    return {
      mode: 'day',
      label: 'יום',
      spanMs: DAY_MS,
      dayCount: 1,
      slotsPerDay: 6,
      slotMs: 4 * 3600000,
      dayWidth: 400,
      slotLabels: ['00', '04', '08', '12', '16', '20']
    };
  }
  if (mode === '3d') {
    return {
      mode: '3d',
      label: '3 ימים',
      spanMs: 3 * DAY_MS,
      dayCount: 3,
      slotsPerDay: 6,
      slotMs: 4 * 3600000,
      dayWidth: 400,
      slotLabels: ['00', '04', '08', '12', '16', '20']
    };
  }
  return {
    mode: 'week',
    label: 'שבוע',
    spanMs: 7 * DAY_MS,
    dayCount: 7,
    slotsPerDay: 6,
    slotMs: 4 * 3600000,
    dayWidth: 400,
    slotLabels: ['00', '04', '08', '12', '16', '20']
  };
}

function _timelineDefaultPos(mode, weekOffset, nowMs, weekStartMs) {
  const DAY_MS = 86400000;
  if (weekOffset !== 0) {
    if (mode === '6h') return 0;
    if (mode === 'day') return 0;
    if (mode === '3d') return 0;
    return 0;
  }
  const rel = nowMs - weekStartMs;
  if (mode === '6h') {
    let pos = Math.floor(rel / TIMELINE_6H_MS);
    if (pos < 0) pos = 0;
    if (pos > TIMELINE_6H_SLOTS_PER_WEEK - 1) pos = TIMELINE_6H_SLOTS_PER_WEEK - 1;
    return pos;
  }
  if (mode === 'day') {
    let pos = Math.floor(rel / DAY_MS);
    if (pos < 0) pos = 0;
    if (pos > 6) pos = 6;
    return pos;
  }
  if (mode === '3d') {
    let pos = Math.floor(rel / DAY_MS);
    if (pos > 4) pos = 4;
    if (pos < 0) pos = 0;
    return pos;
  }
  return 0;
}

function _timelineViewBounds(p, nowMs) {
  const mode = _timelineRangeMode(p);
  const meta = _timelineRangeMeta(mode);
  const weekOffset = _timelineWeekOffset(p);
  const weekBounds = _timelineWeekBounds(weekOffset);
  const weekStartMs = weekBounds.weekStartMs;
  const weekEndMs = weekStartMs + 7 * 86400000;
  let pos = parseInt(p && p.pos != null ? p.pos : NaN, 10);

  if (mode !== 'week' && isNaN(pos)) {
    pos = _timelineDefaultPos(mode, weekOffset, nowMs, weekStartMs);
  }
  if (mode === 'week') {
    pos = 0;
  } else if (mode === '6h') {
    if (pos < 0) pos = 0;
    if (pos > TIMELINE_6H_SLOTS_PER_WEEK - 1) pos = TIMELINE_6H_SLOTS_PER_WEEK - 1;
  } else if (mode === 'day') {
    if (pos < 0) pos = 0;
    if (pos > 6) pos = 6;
  } else if (mode === '3d') {
    if (pos < 0) pos = 0;
    if (pos > 4) pos = 4;
  }

  let viewStartMs = weekStartMs;
  if (mode === '6h') viewStartMs = weekStartMs + pos * TIMELINE_6H_MS;
  else if (mode === 'day') viewStartMs = weekStartMs + pos * 86400000;
  else if (mode === '3d') viewStartMs = weekStartMs + pos * 86400000;

  return {
    mode: mode,
    meta: meta,
    weekOffset: weekOffset,
    pos: pos,
    weekStartMs: weekStartMs,
    weekEndMs: weekEndMs,
    viewStartMs: viewStartMs,
    viewEndMs: viewStartMs + meta.spanMs,
    viewStartYmd: _timelineMsToYmdLocal(viewStartMs)
  };
}

function _timelineSpaParams(weekOffset, range, pos, extra) {
  const o = { week: weekOffset, range: range || 'week' };
  if (range && range !== 'week' && pos != null && !isNaN(pos)) o.pos = pos;
  if (extra) {
    Object.keys(extra).forEach(function(k) { o[k] = extra[k]; });
  }
  return o;
}

function _timelineNavStep(weekOffset, range, pos, delta) {
  let w = weekOffset;
  let p = pos || 0;
  if (range === 'week') {
    w += delta;
    if (w < TIMELINE_WEEK_MIN) w = TIMELINE_WEEK_MIN;
    if (w > TIMELINE_WEEK_MAX) w = TIMELINE_WEEK_MAX;
    return _timelineSpaParams(w, 'week', 0);
  }
  if (range === '6h') {
    p += delta;
    if (p < 0) { w--; p = TIMELINE_6H_SLOTS_PER_WEEK - 1; }
    if (p > TIMELINE_6H_SLOTS_PER_WEEK - 1) { w++; p = 0; }
    if (w < TIMELINE_WEEK_MIN) { w = TIMELINE_WEEK_MIN; p = 0; }
    if (w > TIMELINE_WEEK_MAX) { w = TIMELINE_WEEK_MAX; p = TIMELINE_6H_SLOTS_PER_WEEK - 1; }
    return _timelineSpaParams(w, '6h', p);
  }
  if (range === 'day') {
    p += delta;
    if (p < 0) { w--; p = 6; }
    if (p > 6) { w++; p = 0; }
    if (w < TIMELINE_WEEK_MIN) { w = TIMELINE_WEEK_MIN; p = 0; }
    if (w > TIMELINE_WEEK_MAX) { w = TIMELINE_WEEK_MAX; p = 6; }
    return _timelineSpaParams(w, 'day', p);
  }
  p += delta;
  if (p < 0) { w--; p = 4; }
  if (p > 4) { w++; p = 0; }
  if (w < TIMELINE_WEEK_MIN) { w = TIMELINE_WEEK_MIN; p = 0; }
  if (w > TIMELINE_WEEK_MAX) { w = TIMELINE_WEEK_MAX; p = 4; }
  return _timelineSpaParams(w, '3d', p);
}

function _timelineNavLabels(range) {
  if (range === '6h') return { prev: '6ש →', next: '← 6ש' };
  if (range === 'day') return { prev: 'יום →', next: '← יום' };
  if (range === '3d') return { prev: '3 ימים →', next: '← 3 ימים' };
  return { prev: 'שבוע →', next: '← שבוע' };
}

function _timelineRangeSegHtml(range, weekOffset, pos) {
  const modes = [
    { id: '6h', label: '6 שעות' },
    { id: 'day', label: 'יום' },
    { id: '3d', label: '3 ימים' },
    { id: 'week', label: 'שבוע' }
  ];
  let html = '<div class="timeline-range-seg" role="group" aria-label="טווח תצוגה">';
  modes.forEach(function(m) {
    const active = m.id === range ? ' active' : '';
    html += '<a href="#" class="timeline-range-btn' + active + '" data-spa-page="timeline"' +
      _spaParamsAttr(_timelineSpaParams(weekOffset, m.id, m.id === range ? pos : null)) +
      '>' + m.label + '</a>';
  });
  html += '</div>';
  return html;
}

function _timelineFormatViewClock(ms) {
  const d = new Date(ms);
  return d.getDate() + '/' + (d.getMonth() + 1) + ' · ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _timelineViewTitle(view, displayedIsoWeek) {
  if (view.mode === 'week') {
    return _timelineWeekLabel(view.weekOffset) + ' · מוצג: ' + displayedIsoWeek;
  }
  if (view.mode === '6h') {
    return _timelineFormatViewClock(view.viewStartMs) + ' – ' +
      _timelineFormatViewClock(view.viewEndMs);
  }
  const endLabel = new Date(view.viewEndMs - 1);
  return view.viewStartYmd + ' – ' +
    endLabel.getDate() + '/' + (endLabel.getMonth() + 1) +
    ' · ' + view.meta.label;
}

function _timelineViewHint(range) {
  if (range === '6h') return 'משבצות של שעה · גלול לצפייה בכל הטווח';
  if (range === 'day') return 'משבצות של 4 שעות · קו מפריד בין ימים ב-00:00';
  if (range === '3d') return '3 ימים · משבצות של 4 שעות · קו מפריד בין ימים ב-00:00';
  return 'גלול ימינה ושמאלה לצפייה בכל השבוע · משבצות של 4 שעות · קו מפריד בין ימים ב-00:00';
}

function _timelineSlotLabels(meta, viewStartMs) {
  if (meta.mode === '6h') {
    const labels = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(viewStartMs + i * meta.slotMs);
      labels.push(String(d.getHours()).padStart(2, '0'));
    }
    return labels;
  }
  return meta.slotLabels;
}

function _timelineFieldForcesTabHtml() {
  const items = FieldForces_all().slice().sort(function(a, b) {
  const na = String(a.force_name || a.role || '');
    const nb = String(b.force_name || b.role || '');
    return na.localeCompare(nb, 'he');
  });

  let list = '';
  if (!items.length) {
    list = '<p style="font-size:11px;color:var(--muted);margin:0">אין כוחות בשטח במערכת</p>';
  } else {
    list = '<ul class="timeline-forces-list">';
    items.forEach(function(item) {
      const title = item.force_name || item.role || item.id;
      list += '<li class="timeline-forces-item">' +
        '<a href="#" class="timeline-forces-name" data-spa-page="fieldForce"' +
        _spaParamsAttr({ id: item.id }) + ' title="' + _esc(title) + '">' + _esc(title) + '</a>';
      if (item.role && item.role !== title) {
        list += '<span class="timeline-forces-meta">' + _esc(item.role) + '</span>';
      }
      if (item.commander_name) {
        list += '<span class="timeline-forces-meta">מפקד: ' + _esc(item.commander_name) + '</span>';
      }
      if (item.camp_location) {
        list += '<span class="timeline-forces-meta">מחנה: ' + _esc(item.camp_location) + '</span>';
      }
      if (item.force_type) {
        list += '<span class="timeline-forces-meta">' + _esc(item.force_type) + '</span>';
      }
      list += '</li>';
    });
    list += '</ul>';
  }

  return '<div class="timeline-side-tab-panel" data-timeline-side-panel="forces" hidden>' +
    '<p style="font-size:11px;color:var(--muted);margin:0 0 10px;line-height:1.45">' +
    'כל הגדודים / כוחות השת״פ הרשומים במערכת.</p>' +
    '<a href="#" class="btn btn-ghost btn-sm btn-full" style="margin-bottom:10px" data-spa-page="fieldForces">↗ ניהול כוחות בשטח</a>' +
    list + '</div>';
}

function _timelineSidePanelHtml(user, sid, viewCtx, bounds, weekBlocks) {
  const sidQ = encodeURIComponent(sid);
  const weekOffset = viewCtx.weekOffset;
  const range = viewCtx.mode;
  const pos = viewCtx.pos;
  weekBlocks = weekBlocks || [];

  let blockList = '';
  if (!weekBlocks.length) {
    blockList = '<p style="font-size:11px;color:var(--muted);margin:8px 0 0">אין משבצות בשבוע זה</p>';
  } else {
    blockList = '<ul class="timeline-block-list">';
    weekBlocks.forEach(function(b) {
      const laneLabel = b.lane === 'all' ? 'כל הכוחות' :
        (b.lane === '0' ? 'חי״ר' : b.lane === '1' ? 'חשן' : b.lane === '2' ? '900' : 'לוז');
      blockList += '<li class="timeline-block-item">' +
        '<div class="timeline-block-item-text"><b>' + _esc(b.label) + '</b>' +
        '<span>' + _esc(b.rawStartDate || '') + ' ' + _esc(b.rawStartTime || '') +
        ' · ' + _esc(laneLabel) + '</span></div>' +
        _confirmDelete(
          'action=deleteTimelineBlock&id=' + encodeURIComponent(b.id) +
          '&week=' + encodeURIComponent(String(weekOffset)) +
          '&range=' + encodeURIComponent(range) +
          '&pos=' + encodeURIComponent(String(pos)) +
          '&sid=' + sidQ,
          'למחוק את המשבצת "' + b.label + '"?'
        ) + '</li>';
    });
    blockList += '</ul>';
  }

  const blockTab = '<div class="timeline-side-tab-panel" data-timeline-side-panel="block">' +
    '<p style="font-size:11px;color:var(--muted);margin:0 0 10px">משבצת טקסט על הלוח — למשל <b>מסדרים ביום ראשון</b></p>' +
    _formOpen() +
    '<input type="hidden" name="action" value="createTimelineBlock">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<input type="hidden" name="week" value="' + _esc(String(weekOffset)) + '">' +
    '<input type="hidden" name="range" value="' + _esc(range) + '">' +
    '<input type="hidden" name="pos" value="' + _esc(String(pos)) + '">' +
    '<div class="form-row"><label class="form-label">טקסט</label>' +
    '<input type="text" name="block_label" class="form-input" placeholder="מסדרים ביום ראשון" required></div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">מתאריך</label>' +
    '<input type="text" name="block_start_date" class="form-input datepicker" value="' +
    _esc(bounds.weekStartYmd) + '" required></div>' +
    '<div class="form-row"><label class="form-label">שעת התחלה</label>' +
    '<input type="time" name="block_start_time" class="form-input" value="06:00"></div></div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">עד תאריך</label>' +
    '<input type="text" name="block_end_date" class="form-input datepicker" value="' +
    _esc(bounds.weekStartYmd) + '" required></div>' +
    '<div class="form-row"><label class="form-label">שעת סיום</label>' +
    '<input type="time" name="block_end_time" class="form-input" value="08:00"></div></div>' +
    '<div class="form-row"><label class="form-label">מיקום בלוח</label>' +
    _select('block_lane', [
      ['all', 'כל שורות הכוחות'],
      ['0', 'חי״ר'],
      ['1', 'חשן'],
      ['2', '900']
    ], 'all', '') + '</div>' +
    _submitBtn('הוסף משבצת', 'btn btn-primary btn-full btn-sm') +
    '</form>' +
    '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">' +
    '<div class="form-label" style="margin-bottom:6px">משבצות בשבוע</div>' + blockList + '</div></div>';

  const exerciseTab = '<div class="timeline-side-tab-panel" data-timeline-side-panel="exercise" hidden>' +
    _formOpen() +
    '<input type="hidden" name="action" value="createExercise">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<input type="hidden" name="from" value="timeline">' +
    '<input type="hidden" name="week" value="' + _esc(String(weekOffset)) + '">' +
    '<input type="hidden" name="range" value="' + _esc(range) + '">' +
    '<input type="hidden" name="pos" value="' + _esc(String(pos)) + '">' +
    '<div class="form-row"><label class="form-label">שם התרגיל</label>' +
    '<input type="text" name="title" class="form-input" required></div>' +
    '<div class="form-row"><label class="form-label">תיאור</label>' +
    '<textarea name="description" class="form-input" rows="2" required></textarea></div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">תאריך התחלה</label>' +
    '<input type="text" name="start_date" class="form-input datepicker" value="' +
    _esc(bounds.weekStartYmd) + '" required></div>' +
    '<div class="form-row"><label class="form-label">שעת התחלה</label>' +
    '<input type="time" name="start_time" class="form-input" value="06:00"></div></div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">תאריך סיום</label>' +
    '<input type="text" name="end_date" class="form-input datepicker" value="' +
    _esc(bounds.weekStartYmd) + '" required></div>' +
    '<div class="form-row"><label class="form-label">שעת סיום</label>' +
    '<input type="time" name="end_time" class="form-input" value="14:00"></div></div>' +
    '<div class="form-row"><label class="form-label">סוג תרגיל</label>' +
    _select('exercise_type', [['', '— בחר —'], ['חיר', 'חיר'], ['חשן', 'חשן'], ['900', '900']], '', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">גדוד שת״פ</label>' +
    _select('partner_battalion', _fieldForceSelectOptions(''), '', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">מחנה / מגנן</label>' +
    _select('camp', _fireZoneSelectOptions(''), '', 'required') + '</div>' +
    _submitBtn('צור תרגיל', 'btn btn-primary btn-full btn-sm') +
    '</form></div>';

  const forcesTab = _timelineFieldForcesTabHtml();

  return '<aside id="timelineToolsPanel" class="timeline-tools-panel is-minimized" aria-label="כלים לציר זמן">' +
    '<button type="button" id="timelineToolsExpand" class="timeline-tools-expand" title="פתח כלים">' +
    '<span>➕</span><span class="timeline-tools-expand-label">כלים</span></button>' +
    '<div class="timeline-tools-body">' +
    '<div class="timeline-tools-head">' +
    '<span>כלים לציר זמן</span>' +
    '<button type="button" id="timelineToolsMinimize" class="btn btn-ghost btn-sm" title="מזער">◂</button>' +
    '</div>' +
    '<div class="timeline-side-tabs">' +
    '<button type="button" class="timeline-side-tab active" data-timeline-side-tab="block">📌 משבצת</button>' +
    '<button type="button" class="timeline-side-tab" data-timeline-side-tab="exercise">➕ תרגיל</button>' +
    '<button type="button" class="timeline-side-tab" data-timeline-side-tab="forces">⚔ בשטח</button>' +
    '</div>' +
    '<div class="timeline-side-panel-body">' + blockTab + exerciseTab + forcesTab + '</div>' +
    '</div></aside>';
}

function _timelineRenderBlockBar(block, viewStartMs, viewSpanMs, layout, rowTopPx) {
  const startMs = _timelineBlockStartMs(block);
  const endMs = _timelineBlockEndMs(block);
  if (isNaN(startMs) || isNaN(endMs)) return '';
  const viewEndMs = viewStartMs + viewSpanMs;
  if (startMs >= viewEndMs || endMs <= viewStartMs) return '';

  const startPct = ((Math.max(startMs, viewStartMs) - viewStartMs) / viewSpanMs) * 100;
  const endPct = ((Math.min(endMs, viewEndMs) - viewStartMs) / viewSpanMs) * 100;
  const widthPct = Math.max(endPct - startPct, 1.5);

  let topPx = rowTopPx;
  let heightPx = layout.totalHeight - 8;
  const lane = block.lane || 'all';
  if (lane === '0' || lane === '1' || lane === '2') {
    const slot = parseInt(lane, 10);
    let band = null;
    if (layout.battalionMode && layout.bandOrder && layout.bandOrder[slot]) {
      band = layout.bandByKey[layout.bandOrder[slot].key];
    }
    if (!band) {
      const typeKey = lane === '0' ? 'חיר' : lane === '1' ? 'חשן' : '900';
      band = layout.bandByKey['type:' + typeKey];
    }
    if (band) {
      topPx = rowTopPx + band.top + 4;
      heightPx = band.height - 8;
    }
  }

  const style = 'position:absolute;top:' + topPx + 'px;right:' + startPct + '%;width:' + widthPct + '%;' +
    'height:' + heightPx + 'px;min-width:40px;box-sizing:border-box;' +
    'border:2px dashed rgba(148,163,184,0.85);border-radius:8px;background:rgba(148,163,184,0.12);' +
    'display:flex;align-items:center;justify-content:center;padding:4px 8px;overflow:hidden;' +
    'z-index:2;pointer-events:none;color:var(--text2);font-size:11px;font-weight:600;text-align:center';

  return '<div class="tl-slot-bar" data-block-id="' + _timelineAttrEsc(block.id) + '" ' +
    'style="' + style + '" title="' + _timelineAttrEsc(block.label) + '">' + _esc(block.label) + '</div>';
}

function _timelineProcedureShortLabel(desc) {
  const s = String(desc || '').trim();
  if (!s) return 'נוה"ק';
  const m = s.match(/^\[[^\]]+\]\s*(.+?)(?:\s*\||$)/);
  if (m) return m[1].trim().slice(0, 48);
  return s.slice(0, 48);
}

function _timelineParseDetailTimeRange(rawTime) {
  if (rawTime == null || rawTime === '') return null;
  let s = String(rawTime).trim();
  if (!s) return null;
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();

  let startMs;
  let endMs;
  const emDash = s.indexOf(' — ');
  const hyphen = s.indexOf(' - ');
  if (emDash !== -1) {
    startMs = _exerciseDetailSortMs(s.slice(0, emDash).trim());
    endMs = _exerciseDetailSortMs(s.slice(emDash + 3).trim());
  } else if (hyphen !== -1) {
    startMs = _exerciseDetailSortMs(s.slice(0, hyphen).trim());
    endMs = _exerciseDetailSortMs(s.slice(hyphen + 3).trim());
  } else {
    startMs = _exerciseDetailSortMs(s);
    endMs = startMs;
  }

  if (isNaN(startMs) || startMs >= Number.MAX_SAFE_INTEGER - 2) return null;
  if (isNaN(endMs) || endMs >= Number.MAX_SAFE_INTEGER - 2) endMs = startMs;
  if (endMs <= startMs) endMs = startMs + 20 * 60 * 1000;
  return { startMs: startMs, endMs: endMs };
}

function _timelineProcedureEventsForWeek(weekItems, weekStartMs, weekEndMs) {
  const allDetails = _rows('ExerciseDetails').data;
  const byExId = {};
  allDetails.forEach(function(r) {
    const exId = String(r[1]);
    if (!byExId[exId]) byExId[exId] = [];
    byExId[exId].push({
      rawTime: r[2],
      location: String(r[3] || ''),
      description: String(r[4] || '')
    });
  });

  const events = [];
  weekItems.forEach(function(item) {
    const details = byExId[String(item.ex.id)] || [];
    details.forEach(function(d) {
      const range = _timelineParseDetailTimeRange(d.rawTime);
      if (!range) return;
      if (range.startMs >= weekEndMs || range.endMs <= weekStartMs) return;
      events.push({
        exerciseId: String(item.ex.id),
        exerciseTitle: item.ex.title,
        item: item,
        startMs: range.startMs,
        endMs: range.endMs,
        location: d.location,
        description: d.description,
        label: _timelineProcedureShortLabel(d.description)
      });
    });
  });
  return events;
}

function _timelineRenderProcedureBar(ev, viewStartMs, viewSpanMs, rowTopPx) {
  const DAY_MS = 86400000;
  const item = ev.item;
  const band = item.band;
  if (!band) return '';

  const viewEndMs = viewStartMs + viewSpanMs;
  const visStart = Math.max(ev.startMs, viewStartMs);
  const visEnd = Math.min(ev.endMs, viewEndMs);
  const startPct = ((visStart - viewStartMs) / viewSpanMs) * 100;
  const widthPct = Math.max(((visEnd - visStart) / viewSpanMs) * 100, 0.35);

  const barH = band.subBarH - 8;
  const procH = Math.min(12, Math.max(8, barH - 6));
  const topPx = rowTopPx + band.top + (item.subLane || 0) * band.subBarH + 4 + barH - procH - 2;
  const tip = ev.label +
    (ev.location ? ' · ' + ev.location : '') +
    (ev.description ? ' — ' + ev.description : '');

  const style =
    'position:absolute;top:' + topPx + 'px;right:' + startPct + '%;width:' + widthPct + '%;' +
    'height:' + procH + 'px;min-width:4px;box-sizing:border-box;' +
    'z-index:' + (22 + (item.baseLane || 0) * 3 + (item.subLane || 0)) + ';';

  return '<div class="tl-procedure-bar" data-exercise-id="' + _timelineAttrEsc(ev.exerciseId) + '" ' +
    'title="' + _timelineAttrEsc(tip) + '" style="' + style + '">' +
    (widthPct > 2.5 ? '<span class="tl-procedure-label">' + _esc(ev.label) + '</span>' : '') +
    '</div>';
}

function _timelineParseExercise(ex) {
  const range = _exerciseTimeRange(ex);
  if (!range) return null;
  return { ex: ex, startMs: range.startMs, endMs: range.endMs };
}

function _timelineAttrEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function _timelineNormalizeType(ex) {
  const t = String(ex.exercise_type || '').replace(/״/g, '').trim();
  if (t === '900' || t.indexOf('900') !== -1) return '900';
  if (t.indexOf('חשן') !== -1) return 'חשן';
  if (t.indexOf('חיר') !== -1 || t.indexOf('חי') !== -1) return 'חיר';
  return 'אחר';
}

var TIMELINE_TYPE_LANES = {
  'חיר': 0,
  'חשן': 1,
  '900': 2
};

var TIMELINE_TYPE_COLORS = {
  'חיר': '#4ade80',
  'חשן': '#60a5fa',
  '900': '#fbbf24',
  'אחר': '#c084fc'
};

function _timelineMsToHmLocal(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _timelineMsToYmdLocal(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _timelineWeekTableRowsHtml(items, sidQ) {
  let s = '';
  items.forEach(function(item) {
    const ex = item.ex;
    const typeKey = item.displayType || item.typeKey || _timelineNormalizeType(ex);
    const startYmd = _timelineMsToYmdLocal(item.startMs);
    const endYmd = _timelineMsToYmdLocal(item.endMs);
    const startHm = _timelineMsToHmLocal(item.startMs);
    const endHm = _timelineMsToHmLocal(item.endMs);
    const exWeekLabel = ex.rawStartDate ? _isoWeekLabel(ex.rawStartDate) : _isoWeekLabel(startYmd);
    s += '<tr data-exercise-id="' + _timelineAttrEsc(ex.id) + '">' +
      '<td>' + _badge(typeKey, typeKey === 'חיר' ? 'green' : typeKey === 'חשן' ? 'blue' : 'yellow') + '</td>' +
      '<td>' + _exerciseLink(ex.id, ex.title) + '</td>' +
      '<td style="font-size:12px;white-space:nowrap">' + (exWeekLabel ? _esc(exWeekLabel) : '—') + '</td>' +
      '<td class="mono">' + _esc(startYmd) + '</td>' +
      '<td class="mono">' + _esc(startHm) + '</td>' +
      '<td class="mono">' + _esc(endYmd) + '</td>' +
      '<td class="mono">' + _esc(endHm) + '</td></tr>';
  });
  if (!items.length) {
    s += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">אין תרגילים בשבוע זה</td></tr>';
  }
  return s;
}

var TIMELINE_TYPE_ORDER = ['חיר', 'חשן', '900', 'אחר'];

function _timelineBandOrder() {
  const bn = typeof Series_getBattalionConfig === 'function' ? Series_getBattalionConfig() : null;
  if (bn && bn.length) {
    return bn.map(function(b) {
      return {
        key: 'ff:' + b.fieldForceId,
        label: b.forceName,
        forceType: b.forceType,
        slot: b.slot,
        fieldForceId: b.fieldForceId,
        isBattalion: true
      };
    });
  }
  return TIMELINE_TYPE_ORDER.map(function(typeKey) {
    return {
      key: 'type:' + typeKey,
      label: typeKey === 'חיר' ? 'חי״ר' : typeKey,
      forceType: typeKey,
      isBattalion: false
    };
  });
}

function _timelineResolveBandKey(ex, battalionConfig) {
  if (battalionConfig && battalionConfig.length) {
    if (ex.field_force_id) {
      for (let i = 0; i < battalionConfig.length; i++) {
        if (String(battalionConfig[i].fieldForceId) === String(ex.field_force_id)) {
          return 'ff:' + battalionConfig[i].fieldForceId;
        }
      }
    }
    const slot = parseInt(ex.series_force_slot, 10);
    if (!isNaN(slot) && slot >= 0 && slot < battalionConfig.length) {
      return 'ff:' + battalionConfig[slot].fieldForceId;
    }
    if (ex.partner_battalion) {
      for (let j = 0; j < battalionConfig.length; j++) {
        if (String(ex.partner_battalion).trim() === String(battalionConfig[j].forceName).trim()) {
          return 'ff:' + battalionConfig[j].fieldForceId;
        }
      }
    }
  }
  return 'type:' + _timelineNormalizeType(ex);
}

function _timelineRangesOverlap(a, b) {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}

/** Assign band (גדוד או סוג כוח) + sub-lane when exercises overlap in time. */
function _timelineAssignStackedLanes(items) {
  const SUB_BAR_H = 46;
  const MIN_BAND_H = 58;
  const battalionConfig = typeof Series_getBattalionConfig === 'function'
    ? Series_getBattalionConfig() : null;
  const bandOrder = _timelineBandOrder();
  const bandByKey = {};
  const byBand = {};

  bandOrder.forEach(function(bandDef) {
    bandByKey[bandDef.key] = {
      top: 0,
      height: MIN_BAND_H,
      maxSub: 1,
      subBarH: SUB_BAR_H,
      def: bandDef
    };
  });

  items.forEach(function(item) {
    item.typeKey = _timelineNormalizeType(item.ex);
    item.bandKey = _timelineResolveBandKey(item.ex, battalionConfig);
    if (!bandByKey[item.bandKey]) {
      bandByKey[item.bandKey] = {
        top: 0,
        height: MIN_BAND_H,
        maxSub: 1,
        subBarH: SUB_BAR_H,
        def: { key: item.bandKey, label: item.typeKey, forceType: item.typeKey, isBattalion: false }
      };
    }
    if (!byBand[item.bandKey]) byBand[item.bandKey] = [];
    byBand[item.bandKey].push(item);
  });

  Object.keys(byBand).forEach(function(key) {
    const group = byBand[key];
    group.sort(function(a, b) { return a.startMs - b.startMs; });
    const subLanes = [];
    group.forEach(function(item) {
      let sub = -1;
      for (let s = 0; s < subLanes.length; s++) {
        const free = !subLanes[s].some(function(other) {
          return _timelineRangesOverlap(item, other);
        });
        if (free) { sub = s; break; }
      }
      if (sub < 0) {
        sub = subLanes.length;
        subLanes.push([]);
      }
      item.subLane = sub;
      subLanes[sub].push(item);
    });
    const maxSub = Math.max(1, subLanes.length);
    const band = bandByKey[key];
    band.maxSub = maxSub;
    band.height = Math.max(MIN_BAND_H, maxSub * SUB_BAR_H);
  });

  const orderedKeys = bandOrder.map(function(b) { return b.key; });
  Object.keys(bandByKey).forEach(function(k) {
    if (orderedKeys.indexOf(k) === -1) orderedKeys.push(k);
  });
  let offset = 0;
  orderedKeys.forEach(function(key) {
    const band = bandByKey[key];
    if (!band) return;
    band.top = offset;
    offset += band.height;
  });

  items.forEach(function(item) {
    item.band = bandByKey[item.bandKey];
    item.baseLane = item.band && item.band.def ? item.band.def.slot : 0;
    item.displayType = (item.band && item.band.def && item.band.def.forceType)
      ? item.band.def.forceType : item.typeKey;
    item.lane = item.baseLane || 0;
  });

  return {
    totalHeight: offset,
    bandByKey: bandByKey,
    bandOrder: bandOrder,
    maxLane: 2,
    subBarH: SUB_BAR_H,
    battalionMode: !!(battalionConfig && battalionConfig.length)
  };
}

function Views_timeline(p) {

  const user = Auth_current(p);

  if (!user) {
    return Views_login({ error: 'נדרשת התחברות.' });
  }
 
  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);

  let exercises = Exercises_all();

  // ─────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────

  if (Roles_isCompanyCommander(user.role)) {

    const traineeIds = Users_traineesOfCommander(user.id).map(function(t) {
      return t.id;
    });
    const teamExerciseIds = {};
    (Assignments_all ? Assignments_all() : []).forEach(function(a) {
      if (traineeIds.indexOf(a.user_id) !== -1) {
        teamExerciseIds[a.exercise_id] = true;
      }
    });
    exercises = exercises.filter(function(ex) {
      return !!teamExerciseIds[ex.id];
    });

  } else if (Roles_isTutor(user.role)) {

    const tutoredExIds = {};
    (Assignments_byTutor ? Assignments_byTutor(user.id) : []).forEach(function(a) {
      tutoredExIds[a.exercise_id] = true;
    });

    exercises = exercises.filter(function(ex) {
      return !!tutoredExIds[ex.id];
    });

  } else if (Roles_isTrainee(user.role)) {

    const myAssigns =
      Assignments_byUser
      ? Assignments_byUser(user.id)
      : [];

    const myExIds =
      myAssigns.map(a => a.exercise_id);

    exercises = exercises.filter(ex =>
      myExIds.indexOf(ex.id) !== -1
    );
  }

  const weekOffset = _timelineWeekOffset(p);
  const canEdit = Roles_hasAdminAccess(user.role);
  const nowMs = Date.now();
  const DAY_MS = 86400000;
  const view = _timelineViewBounds(p, nowMs);
  const rangeMode = view.mode;
  const rangeMeta = view.meta;
  const viewStartMs = view.viewStartMs;
  const viewEndMs = view.viewEndMs;
  const viewSpanMs = viewEndMs - viewStartMs;
  const weekStartMs = view.weekStartMs;
  const weekEndMs = view.weekEndMs;
  const displayedIsoWeek = _isoWeekLabel(_timelineWeekBounds(weekOffset).weekStartYmd);
  const navLabels = _timelineNavLabels(rangeMode);
  const navPrev = _timelineNavStep(weekOffset, rangeMode, view.pos, -1);
  const navNext = _timelineNavStep(weekOffset, rangeMode, view.pos, 1);
  const jumpParams = _timelineSpaParams(0, rangeMode, null);

  const parsed = exercises.map(_timelineParseExercise).filter(Boolean);
  const unparsedCount = exercises.length - parsed.length;

  const viewItems = parsed.filter(function(item) {
    return item.startMs < viewEndMs && item.endMs > viewStartMs;
  });

  const layout = _timelineAssignStackedLanes(viewItems);
  viewItems.sort(function(a, b) {
    if (a.baseLane !== b.baseLane) return a.baseLane - b.baseLane;
    if ((a.subLane || 0) !== (b.subLane || 0)) return (a.subLane || 0) - (b.subLane || 0);
    return a.startMs - b.startMs;
  });

  // ─────────────────────────────────────
  // UI
  // ─────────────────────────────────────

  const DAY_LABELS = [
    'א׳',
    'ב׳',
    'ג׳',
    'ד׳',
    'ה׳',
    'ו׳',
    'ש׳'
  ];

  const COLORS = [
    '#4ade80',
    '#22c55e',
    '#60a5fa',
    '#fbbf24',
    '#f87171',
    '#c084fc',
    '#fb923c',
    '#a78bfa'
  ];

  // ─────────────────────────────────────
  // Page
  // ─────────────────────────────────────

  let s = _topbar(user, sid);

  s += '<div class="page">';

  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">';

  s += '<div class="page-title" style="margin:0">📅 ציר זמן — ' +
    _esc(_timelineViewTitle(view, displayedIsoWeek)) + '</div>';

  s += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';

  s += _timelineRangeSegHtml(rangeMode, weekOffset, view.pos);

  const canPrev = rangeMode === 'week'
    ? weekOffset > TIMELINE_WEEK_MIN
    : (weekOffset > TIMELINE_WEEK_MIN || view.pos > 0);
  const canNext = rangeMode === 'week'
    ? weekOffset < TIMELINE_WEEK_MAX
    : (weekOffset < TIMELINE_WEEK_MAX ||
      (rangeMode === '6h' && view.pos < TIMELINE_6H_SLOTS_PER_WEEK - 1) ||
      (rangeMode === 'day' && view.pos < 6) ||
      (rangeMode === '3d' && view.pos < 4));

  if (canPrev) {
    s += '<a href="#" class="btn btn-secondary btn-sm" data-spa-page="timeline"' +
      _spaParamsAttr(navPrev) + '>' + navLabels.prev + '</a>';
  }
  if (canNext) {
    s += '<a href="#" class="btn btn-secondary btn-sm" data-spa-page="timeline"' +
      _spaParamsAttr(navNext) + '>' + navLabels.next + '</a>';
  }
  if (weekOffset !== 0 || (rangeMode !== 'week' && view.pos !== _timelineDefaultPos(rangeMode, 0, nowMs, weekStartMs))) {
    s += '<a href="#" class="btn btn-ghost btn-sm" data-spa-page="timeline"' +
      _spaParamsAttr(jumpParams) + '>עכשיו</a>';
  }

  s += '<select id="timelineWeekSelect" class="form-select" style="width:auto;min-width:200px;font-size:12px">';
  for (let w = TIMELINE_WEEK_MIN; w <= TIMELINE_WEEK_MAX; w++) {
    const wIso = _isoWeekLabel(_timelineWeekBounds(w).weekStartYmd);
    s += '<option value="' + w + '"' + (w === weekOffset ? ' selected' : '') + '>' +
      _esc(_timelineWeekLabel(w) + ' · ' + wIso) + '</option>';
  }
  s += '</select>';

  s += '<button type="button" id="timelineProcedureToggle" class="btn btn-ghost btn-sm">📋 הצג נוה"ק</button>';

  if (canEdit) {
    s += '<button type="button" id="timelineEditToggle" class="btn btn-ghost btn-sm">✏ מצב עריכה</button>';
  }

  s += '</div>';
  s += '</div>';

  if (unparsedCount > 0) {
    s += '<div class="flash flash-error" style="margin-bottom:12px">⚠ ' +
      unparsedCount + ' תרגילים ללא תאריך תקין — לא ניתן להציג בלוח. עדכן תאריכי התחלה/סיום.</div>';
  } else if (exercises.length && !viewItems.length) {
    s += '<div class="flash flash-info" style="margin-bottom:12px">ℹ יש ' + exercises.length +
      ' תרגילים במערכת, אך אין תרגילים בטווח ' + _esc(rangeMeta.label) + ' זה. ' +
      'השתמש בכפתורי הניווט או בבורר השבועות.</div>';
  }

  const bounds = _timelineWeekBounds(weekOffset);
  const weekBlocks = canEdit && typeof TimelineBlocks_inWeek === 'function'
    ? TimelineBlocks_inWeek(bounds.weekStartMs, weekEndMs)
    : [];

  if (canEdit) {
    s += '<div class="timeline-page-row">';
  }
  s += '<div class="timeline-main-col">';

  // ─────────────────────────────────────
  // Timeline card
  // ─────────────────────────────────────

  s += '<div class="card" style="margin-bottom:20px" id="timelineWeekCard">';

  const viewStartDate = new Date(viewStartMs);
  const viewEndDate = new Date(viewEndMs - 1);
  const wStartFmt = viewStartDate.getDate() + '/' + (viewStartDate.getMonth() + 1);
  const wEndFmt = viewEndDate.getDate() + '/' + (viewEndDate.getMonth() + 1);

  s += '<div style="padding:10px 14px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:12px;color:var(--text2)">';

  s += '📅 ' + wStartFmt + ' – ' + wEndFmt +
    ' &nbsp;|&nbsp; ' + _esc(rangeMeta.label) +
    (rangeMode === 'week' ? ' &nbsp;|&nbsp; ' + _esc(displayedIsoWeek) : '') +
    ' &nbsp;|&nbsp; ' + viewItems.length + ' תרגילים';

  s += '</div>';

  s += '<div style="padding:6px 14px;font-size:10px;color:var(--muted);border-bottom:1px solid var(--border)">' +
    _esc(_timelineViewHint(rangeMode)) + '</div>';

  // ─────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────

  const slotsPerDay = rangeMeta.slotsPerDay;
  const slotLabels = _timelineSlotLabels(rangeMeta, viewStartMs);
  const dayCount = rangeMeta.dayCount;
  const totalSlots = dayCount * slotsPerDay;
  const timelineMinWidth = dayCount * rangeMeta.dayWidth;
  const timelineHeaderH = 54;
  const rowTopPx = timelineHeaderH;
  const barMinH = 44;
  const trackH = Math.max(280, rowTopPx + layout.totalHeight + 12);

  const labelPad = layout.battalionMode ? 92 : 48;
  s += '<div class="timeline-scroll" id="timelineScroll">';
  s += '<div id="timelineTrack" class="timeline-track" style="position:relative;height:' +
       trackH + 'px;min-width:' + timelineMinWidth + 'px;padding-right:' + labelPad + 'px;' +
       '--tl-lane-h:' + layout.subBarH + 'px;--tl-bar-min-h:' + barMinH + 'px"' +
       ' data-view-start="' + viewStartMs + '"' +
       ' data-view-end="' + viewEndMs + '"' +
       ' data-week-start="' + weekStartMs + '"' +
       ' data-week-end="' + weekEndMs + '"' +
       ' data-week-offset="' + weekOffset + '"' +
       ' data-range="' + _timelineAttrEsc(rangeMode) + '"' +
       ' data-pos="' + view.pos + '"' +
       ' data-sid-q="' + _timelineAttrEsc(sidQ) + '"' +
       ' data-can-edit="' + (canEdit ? '1' : '0') + '">';

  const rowLabels = layout.bandOrder;
  rowLabels.forEach(function(row) {
    const band = layout.bandByKey[row.key];
    if (!band) return;
    const labelTop = rowTopPx + band.top + Math.round(band.height / 2) - 8;
    const labelW = layout.battalionMode ? 84 : 42;
    const typeHint = row.forceType && layout.battalionMode
      ? '<span style="display:block;font-size:9px;opacity:.7">' + _esc(row.forceType) + '</span>' : '';
    s += '<div class="timeline-row-label" style="position:absolute;right:4px;top:' +
      labelTop + 'px;font-family:var(--mono);font-size:10px;color:var(--muted);' +
      'z-index:15;pointer-events:none;max-width:' + labelW + 'px;line-height:1.25;text-align:center">' +
      _esc(row.label) + typeHint + '</div>';
  });

  for (let i = 0; i <= totalSlots; i++) {
    const rightPct = (i / totalSlots) * 100;
    const isDayLine = (i % slotsPerDay === 0);
    s += '<div class="timeline-grid-line' + (isDayLine ? ' timeline-grid-day' : '') + '" style="' +
         'position:absolute;top:' + timelineHeaderH + 'px;bottom:0;right:' + rightPct + '%;width:1px;' +
         (isDayLine ? 'background:var(--border);opacity:1' : 'background:var(--border2);opacity:0.55') +
         ';z-index:1;pointer-events:none"></div>';
  }

  for (let d = 0; d < dayCount; d++) {
    const dayStart = viewStartMs + d * DAY_MS;
    const dayDate = new Date(dayStart);
    const dayMs = dayStart;
    const isTodayDay = nowMs >= dayMs && nowMs < dayMs + DAY_MS;
    const dayRight = (d / dayCount) * 100;
    const dayWidth = (100 / dayCount);
    const dayLabel = DAY_LABELS[dayDate.getDay()];

    s += '<div class="timeline-day-head" style="' +
         'position:absolute;top:0;right:' + dayRight + '%;width:' + dayWidth + '%;height:' + timelineHeaderH + 'px;' +
         'border-bottom:1px solid var(--border);box-sizing:border-box;' +
         (isTodayDay ? 'background:rgba(74,222,128,0.06);' : '') + '">' +
         '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px 0 0">' +
         '<div style="font-family:var(--mono);font-size:12px;font-weight:bold;color:' +
         (isTodayDay ? 'var(--green)' : 'var(--text2)') + '">' + dayLabel + '</div>' +
         '<div style="font-family:var(--mono);font-size:10px;color:var(--muted)">' +
         dayDate.getDate() + '/' + (dayDate.getMonth() + 1) + '</div></div>' +
         '<div class="timeline-day-slots" style="display:flex;width:100%;margin-top:2px;border-top:1px solid var(--border2)">';

    for (let sl = 0; sl < slotsPerDay; sl++) {
      s += '<span style="flex:1;text-align:center;font-family:var(--mono);font-size:8px;color:var(--muted);' +
           'line-height:1.1;padding:1px 0">' + slotLabels[sl] + '</span>';
    }
    s += '</div></div>';
  }

  if (nowMs >= viewStartMs && nowMs < viewEndMs) {
    const nowOffset = ((nowMs - viewStartMs) / viewSpanMs) * 100;
    s += '<div class="timeline-now" style="' +
         'position:absolute;top:' + timelineHeaderH + 'px;bottom:0;right:' + nowOffset + '%;width:2px;' +
         'background:var(--green);z-index:30"></div>';
  }

  weekBlocks.forEach(function(block) {
    s += _timelineRenderBlockBar(block, viewStartMs, viewSpanMs, layout, rowTopPx);
  });

  const procedureEvents = _timelineProcedureEventsForWeek(viewItems, viewStartMs, viewEndMs);

  const procCountByEx = {};
  _rows('ExerciseDetails').data.forEach(function(r) {
    const exId = String(r[1]);
    procCountByEx[exId] = (procCountByEx[exId] || 0) + 1;
  });

  viewItems.forEach(function(item, idx) {
    const startPct = ((item.startMs - viewStartMs) / viewSpanMs) * 100;
    const widthPct = ((item.endMs - item.startMs) / viewSpanMs) * 100;
    const band = item.band;
    const barH = band.subBarH - 8;
    const topPx = rowTopPx + band.top + (item.subLane || 0) * band.subBarH + 4;
    const color = TIMELINE_TYPE_COLORS[item.displayType || item.typeKey] || COLORS[idx % COLORS.length];
    const isPast = item.endMs < nowMs;
    const exId = String(item.ex.id);
    const barDomId = 'tl-bar-' + exId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const barStyle =
      'position:absolute;top:' + topPx + 'px;right:' + startPct + '%;' +
      'width:' + Math.max(widthPct, 1.5) + '%;' +
      'height:' + barH + 'px;min-height:' + barH + 'px;' +
      'background:' + color + '55;border:1px solid ' + color + ';border-radius:8px;' +
      'padding:4px 6px;overflow:hidden;color:#1a2e22;font-weight:600;opacity:' + (isPast ? '0.72' : '1') + ';' +
      'z-index:' + (10 + (item.baseLane || 0) * 3 + (item.subLane || 0)) + ';display:flex;align-items:stretch;box-sizing:border-box';

    const dataAttrs =
      ' id="' + _timelineAttrEsc(barDomId) + '"' +
      ' data-tl-bar="1" data-exercise-id="' + _timelineAttrEsc(exId) + '"' +
      ' data-exercise-type="' + _timelineAttrEsc(item.displayType || item.typeKey || '') + '"' +
      ' data-procedure-count="' + (procCountByEx[exId] || 0) + '"' +
      ' data-lane="' + (item.baseLane || 0) + '"' +
      ' data-sub-lane="' + (item.subLane || 0) + '"' +
      ' data-start-ms="' + item.startMs + '" data-end-ms="' + item.endMs + '"';

    const exWeekLabel = item.ex.rawStartDate
      ? _isoWeekLabel(item.ex.rawStartDate)
      : _isoWeekLabel(_timelineMsToYmdLocal(item.startMs));
    const barTitle = item.ex.title + (exWeekLabel ? ' · ' + exWeekLabel : '');

    if (canEdit) {
      s += '<div class="tl-bar"' + dataAttrs + ' style="' + barStyle + '">' +
        '<span class="tl-bar-label" title="' + _timelineAttrEsc(barTitle) + '">' +
        _exerciseLink(item.ex.id, item.ex.title) + '</span></div>';
    } else {
      s += '<a class="tl-bar tl-bar-link"' + dataAttrs + ' ' + _spaBarLink('exercise', { id: item.ex.id }) +
        ' style="' + barStyle + 'text-decoration:none">' +
        '<span class="tl-bar-label" title="' + _timelineAttrEsc(barTitle) + '">' +
        _esc(item.ex.title) + '</span></a>';
    }
  });

  procedureEvents.forEach(function(ev) {
    s += _timelineRenderProcedureBar(ev, viewStartMs, viewSpanMs, rowTopPx);
  });

  s += '</div></div>';

  if (canEdit) {
    s += '<div id="timelineEditHint" style="display:none;padding:8px 14px;border-top:1px solid var(--border);' +
      'font-size:11px;color:var(--muted);font-family:var(--mono)">' +
      'מצב עריכה: גרור להזזה · ידית ימין = התחלה · ידית שמאל = סיום (RTL)</div>';
  }

  s += '</div>';

  s += '</div>';
  if (canEdit) {
    s += _timelineSidePanelHtml(user, sid, view, bounds, weekBlocks);
    s += '</div>';
  }

  const tableTitle = rangeMode === 'week'
    ? '📋 תרגילים בשבוע זה · ' + displayedIsoWeek
    : '📋 תרגילים בטווח · ' + rangeMeta.label;
  s += '<div class="page-title" style="margin-top:10px">' + _esc(tableTitle) + '</div>';

  s += '<div class="card" style="padding:0" id="timelineWeekTableCard">';

  s += '<table class="tbl" id="timelineWeekTable">';

  s += '<thead><tr>';

  s += '<th>סוג</th>';
  s += '<th>שם</th>';
  s += '<th>שבוע לועזי</th>';
  s += '<th>התחלה</th>';
  s += '<th>שעה</th>';
  s += '<th>סיום</th>';
  s += '<th>שעה</th>';

  s += '</tr></thead><tbody id="timelineWeekTableBody">';

  s += _timelineWeekTableRowsHtml(viewItems, sidQ);

  s += '</tbody></table>';

  s += '</div>';

  s += '</div>';

  return _wrapPage(s, 'ציר זמן');
}