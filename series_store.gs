// series_store.gs — series versioning (active / archived), no data deletion on rebuild

var _activeSeriesIdCache = null;

function Series_invalidateCache() {
  _activeSeriesIdCache = null;
  _cacheInvalidate('Series');
}

function Series_statusColIndex_() {
  const idx = _colIndex('Series', 'status');
  return idx >= 0 ? idx : 4;
}

function Series_readFresh_() {
  return _readSheetFromSpreadsheet('Series');
}

function Series_rowFromData(r) {
  return {
    id: String(r[0]),
    label: String(r[1] || ''),
    start_date: String(r[2] || ''),
    end_date: String(r[3] || ''),
    status: String(r[Series_statusColIndex_()] || ''),
    created_at: String(r[5] || ''),
    created_by: String(r[6] || ''),
    exercise_count: parseInt(r[7], 10) || 0,
    assignment_count: parseInt(r[8], 10) || 0,
    detail_count: parseInt(r[9], 10) || 0,
    battalion_config_json: String(r[10] || ''),
    build_params_json: String(r[11] || '')
  };
}

function Series_get(seriesId) {
  const id = String(seriesId || '').trim();
  if (!id) return null;
  const rows = _rows('Series').data;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === id) return Series_rowFromData(rows[i]);
  }
  return null;
}

function Series_archivedList() {
  return Series_all(true).filter(function(s) {
    return s.status === 'archived';
  }).sort(function(a, b) {
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function Series_formatCreatedAt(iso) {
  const s = String(iso || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 16).replace('T', ' ');
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

function Series_all(includeArchived) {
  return _rows('Series').data.map(Series_rowFromData).filter(function(s) {
    if (includeArchived) return true;
    return s.status === 'active';
  });
}

function Series_getActiveRow() {
  const statusCol = Series_statusColIndex_();
  const rows = _rows('Series').data;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][statusCol] || '').trim() === 'active') {
      return Series_rowFromData(rows[i]);
    }
  }
  return null;
}

function Series_getActiveId() {
  if (_activeSeriesIdCache !== null) return _activeSeriesIdCache;
  const active = Series_getActiveRow();
  _activeSeriesIdCache = active ? active.id : '';
  return _activeSeriesIdCache;
}

function Series_exerciseColIndex() {
  const idx = _colIndex('Exercises', 'series_id');
  return idx >= 0 ? idx : 15;
}

function Series_exerciseIdsFor(seriesId) {
  const col = Series_exerciseColIndex();
  const ids = {};
  _rows('Exercises').data.forEach(function(r) {
    if (String(r[col] || '') === String(seriesId)) ids[String(r[0])] = true;
  });
  return ids;
}

function Series_countsFor(seriesId) {
  const exIds = Series_exerciseIdsFor(seriesId);
  let exercises = 0;
  Object.keys(exIds).forEach(function() { exercises++; });
  let assignments = 0;
  let details = 0;
  _rows('Assignments').data.forEach(function(r) {
    if (exIds[String(r[1])]) assignments++;
  });
  _rows('ExerciseDetails').data.forEach(function(r) {
    if (exIds[String(r[1])]) details++;
  });
  return { exercises: exercises, assignments: assignments, details: details };
}

function Series_updateCounts(seriesId) {
  const row = _findRowIndex('Series', seriesId);
  if (row < 0) return;
  const counts = Series_countsFor(seriesId);
  const sh = _sheet('Series');
  sh.getRange(row, 8, 1, 3).setValues([[
    counts.exercises,
    counts.assignments,
    counts.details
  ]]);
  Series_invalidateCache();
}

function Series_setStatus(seriesId, status) {
  const row = _findRowIndex('Series', seriesId);
  if (row < 0) throw new Error('סדרה לא נמצאה: ' + seriesId);
  _sheet('Series').getRange(row, Series_statusColIndex_() + 1).setValue(String(status || ''));
  Series_invalidateCache();
}

function Series_appendNewActive(userId, params) {
  params = params || {};
  const id = 'S' + Date.now();
  const label = String(params.label || '').trim() ||
    ('סדרה ' + String(params.start_date || '') + ' — ' + String(params.end_date || ''));
  _append('Series', [
    id,
    label,
    String(params.start_date || ''),
    String(params.end_date || ''),
    'active',
    new Date().toISOString(),
    String(userId || ''),
    0,
    0,
    0,
    JSON.stringify(params.battalion_config || Series_getBattalionConfig() || []),
    JSON.stringify(params.build_params || {})
  ]);
  Series_invalidateCache();
  SystemLog_write({
    user_id: userId,
    action: 'series.activate',
    entity_type: 'series',
    entity_id: id,
    details: {
      label: label,
      start_date: params.start_date,
      end_date: params.end_date
    }
  });
  return id;
}

function Series_createActive(userId, params) {
  params = params || {};
  const active = Series_getActiveRow();
  if (active) throw new Error('יש כבר סדרה פעילה — יש לארכב לפני יצירת סדרה חדשה.');
  return Series_appendNewActive(userId, params);
}

function Series_archiveActive(userId, meta) {
  const fresh = Series_readFresh_();
  const statusCol = Series_statusColIndex_();
  const sh = _sheet('Series');
  let lastArchived = null;

  for (let i = 0; i < fresh.data.length; i++) {
    if (String(fresh.data[i][statusCol] || '').trim() !== 'active') continue;
    const active = Series_rowFromData(fresh.data[i]);
    const counts = Series_countsFor(active.id);
    sh.getRange(i + 2, statusCol + 1).setValue('archived');
    Series_updateCounts(active.id);

    SystemLog_write({
      user_id: userId,
      action: 'series.archive',
      entity_type: 'series',
      entity_id: active.id,
      details: Object.assign({
        label: active.label,
        counts: counts
      }, meta || {})
    });

    lastArchived = {
      seriesId: active.id,
      label: active.label,
      counts: counts
    };
  }

  Series_invalidateCache();
  return lastArchived;
}

function Series_assignExercisesToSeries(exerciseIds, seriesId) {
  if (!exerciseIds || !exerciseIds.length || !seriesId) return;
  const col = Series_exerciseColIndex() + 1;
  if (col < 1) return;
  const sh = _sheet('Exercises');
  exerciseIds.forEach(function(exId) {
    const row = _findRowIndex('Exercises', exId);
    if (row >= 0) sh.getRange(row, col).setValue(String(seriesId));
  });
  _cacheInvalidate('Exercises');
  _exercisesClearDerived();
}

function Series_backfillExerciseSeriesIds(seriesId) {
  const col = Series_exerciseColIndex() + 1;
  if (col < 1) return 0;
  const sh = _sheet('Exercises');
  const data = _rows('Exercises').data;
  let updated = 0;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][col - 1] || '').trim()) continue;
    sh.getRange(i + 2, col).setValue(String(seriesId));
    updated++;
  }
  if (updated) {
    _cacheInvalidate('Exercises');
    _exercisesClearDerived();
  }
  return updated;
}

/** One-time / setup migration: attach legacy exercises to an active series record. */
function Series_ensureMigrated() {
  if (_rows('Series').data.length === 0 && _rows('Exercises').data.length === 0) return;

  const statusCol = Series_statusColIndex_();
  let active = null;
  _rows('Series').data.forEach(function(r) {
    if (String(r[statusCol] || '').trim() === 'active') active = Series_rowFromData(r);
  });

  const exData = _rows('Exercises').data;
  const col = Series_exerciseColIndex();
  let missingSeries = false;
  for (let i = 0; i < exData.length; i++) {
    if (!String(exData[i][col] || '').trim()) {
      missingSeries = true;
      break;
    }
  }

  if (!active && missingSeries && _rows('Series').data.length === 0) {
    const id = 'S' + Date.now();
    _append('Series', [
      id,
      'סדרה קיימת (מigrated)',
      '',
      '',
      'active',
      new Date().toISOString(),
      '',
      0,
      0,
      0,
      JSON.stringify(Series_getBattalionConfig() || []),
      JSON.stringify({ migrated: true })
    ]);
    Series_invalidateCache();
    active = Series_getActiveRow();
    SystemLog_write({
      user_id: '',
      action: 'series.migrate',
      entity_type: 'series',
      entity_id: id,
      details: { reason: 'legacy_exercises_without_series' }
    });
  } else if (!active && missingSeries) {
    Series_backfillOrphanExercises_();
    return;
  }

  if (active && missingSeries) {
    Series_backfillExerciseSeriesIds(active.id);
    Series_updateCounts(active.id);
  }
}

function Series_backfillOrphanExercises_() {
  const col = Series_exerciseColIndex();
  let targetSeriesId = '';
  const rows = _rows('Series').data;
  for (let i = rows.length - 1; i >= 0; i--) {
    targetSeriesId = String(rows[i][0] || '').trim();
    if (targetSeriesId) break;
  }
  if (!targetSeriesId) return;
  Series_backfillExerciseSeriesIds(targetSeriesId);
}

function Series_prepareNewBuild(userId, buildMeta) {
  Series_ensureMigrated();
  const archived = Series_archiveActive(userId, buildMeta);
  _cacheFlush();
  const seriesId = Series_appendNewActive(userId, buildMeta);
  return {
    seriesId: seriesId,
    archived: archived
  };
}

function Series_finalizeBuild(seriesId, createdExerciseIds) {
  if (seriesId && createdExerciseIds && createdExerciseIds.length) {
    Series_assignExercisesToSeries(createdExerciseIds, seriesId);
  }
  if (seriesId) Series_updateCounts(seriesId);
}
