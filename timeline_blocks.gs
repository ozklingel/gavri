// timeline_blocks.gs — free-text slots on the weekly timeline (admin)

function _timelineBlockLaneFromRaw(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === 'all') return 'all';
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 0 && n <= 3) return String(n);
  return 'all';
}

function TimelineBlocks_all() {
  return _rows('TimelineBlocks').data.map(function(r) {
    return {
      id: String(r[0]),
      label: String(r[1] || ''),
      rawStartDate: _rawDate(r[2]),
      rawEndDate: _rawDate(r[3]),
      rawStartTime: _rawTime(r[4]),
      rawEndTime: _rawTime(r[5]),
      lane: _timelineBlockLaneFromRaw(r[6]),
      created_by: String(r[7] || '')
    };
  });
}

function TimelineBlocks_inWeek(weekStartMs, weekEndMs) {
  return TimelineBlocks_all().filter(function(b) {
    const startMs = _timelineBlockStartMs(b);
    const endMs = _timelineBlockEndMs(b);
    if (isNaN(startMs) || isNaN(endMs)) return false;
    return startMs < weekEndMs && endMs > weekStartMs;
  });
}

function _timelineBlockStartMs(block) {
  if (!block) return NaN;
  let ms = _parseRawDate(block.rawStartDate);
  if (isNaN(ms)) return NaN;
  if (block.rawStartTime) {
    const p = String(block.rawStartTime).split(':').map(Number);
    ms += (p[0] || 0) * 3600000 + (p[1] || 0) * 60000;
  }
  return ms;
}

function _timelineBlockEndMs(block) {
  if (!block) return NaN;
  let ms = _parseRawDate(block.rawEndDate || block.rawStartDate);
  if (isNaN(ms)) return NaN;
  if (block.rawEndTime) {
    const p = String(block.rawEndTime).split(':').map(Number);
    ms += (p[0] || 0) * 3600000 + (p[1] || 0) * 60000;
  } else if (block.rawStartTime) {
    ms += 3600000;
  } else {
    ms += 86400000;
  }
  if (ms <= _timelineBlockStartMs(block)) ms = _timelineBlockStartMs(block) + 3600000;
  return ms;
}

function TimelineBlocks_create(p) {
  Auth_requireRole(p, ['admin']);
  const label = String(p.block_label || p.label || '').trim();
  const startDate = String(p.block_start_date || p.start_date || '').trim();
  const endDate = String(p.block_end_date || p.end_date || startDate).trim();
  const startTime = String(p.block_start_time || p.start_time || '06:00').trim();
  const endTime = String(p.block_end_time || p.end_time || '08:00').trim();
  const lane = _timelineBlockLaneFromRaw(p.block_lane || p.lane || 'all');

  if (!label) throw new Error('חובה להזין טקסט למשבצת.');
  if (!startDate) throw new Error('חובה לבחור תאריך התחלה.');
  if (isNaN(_parseRawDate(startDate))) throw new Error('תאריך התחלה לא תקין.');

  _append('TimelineBlocks', [
    'TB' + Date.now(), label, startDate, endDate, startTime, endTime, lane, Auth_current(p).id
  ]);

  return Views_timeline({
    sid: p.sid,
    week: p.week != null ? String(p.week) : '0',
    range: p.range != null ? String(p.range) : 'week',
    pos: p.pos != null ? String(p.pos) : undefined,
    info: 'משבצת לוז נוספה ללוח.'
  });
}

function TimelineBlocks_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || p.blockId || '').trim();
  if (!id) throw new Error('חסר מזהה משבצת.');
  const row = _findRowIndex('TimelineBlocks', id);
  if (row < 0) throw new Error('המשבצת לא נמצאה.');
  _sheet('TimelineBlocks').deleteRow(row);
  _cacheInvalidate('TimelineBlocks');

  return Views_timeline({
    sid: p.sid,
    week: p.week != null ? String(p.week) : '0',
    range: p.range != null ? String(p.range) : 'week',
    pos: p.pos != null ? String(p.pos) : undefined,
    info: 'משבצת לוז נמחקה.'
  });
}
