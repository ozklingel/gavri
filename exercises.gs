// ═══════════════════════════════════════
//  exercises.gs — exercise CRUD + duplication
// ═══════════════════════════════════════

function Exercises_all() {
  return _rows('Exercises').data.map(r => ({
    id: String(r[0]), title: String(r[1]), description: String(r[2]),
    created_by: String(r[3]), date: r[4] ? String(r[4]) : ''
  }));
}

function Exercises_get(id) {
  return Exercises_all().find(e => e.id === String(id)) || null;
}

function Exercises_details(exerciseId) {
  return _rows('ExerciseDetails').data
    .filter(r => String(r[1]) === String(exerciseId))
    .map(r => ({ id: String(r[0]), time: String(r[2]), location: String(r[3]), description: String(r[4]) }));
}

function Exercises_create(p) {
  const u = Auth_requireRole(p, ['admin']);
  const id = 'E' + _nextId('Exercises');
  _append('Exercises', [id, p.title || '', p.description || '', u.id, p.date || '']);
  return Views_dashboard({ sid: p.sid, info: 'Exercise created (' + id + ').' });
}

function Exercises_edit(p) {
  Auth_requireRole(p, ['admin']);
  const row = _findRowIndex('Exercises', p.id);
  if (row < 0) throw new Error('Exercise not found.');
  const sh = _sheet('Exercises');
  sh.getRange(row, 2).setValue(p.title || '');
  sh.getRange(row, 3).setValue(p.description || '');
  sh.getRange(row, 5).setValue(p.date || '');
  return Views_exercise({ sid: p.sid, id: p.id, info: 'Exercise updated.' });
}

function Exercises_duplicate(p) {
  const u = Auth_requireRole(p, ['admin']);
  const orig = Exercises_get(p.id);
  if (!orig) throw new Error('Exercise not found.');
  const newId = 'E' + _nextId('Exercises');
  _append('Exercises', [newId, orig.title + ' (copy)', orig.description, u.id, orig.date]);
  // Copy details
  Exercises_details(orig.id).forEach(d => {
    const did = 'D' + _nextId('ExerciseDetails');
    _append('ExerciseDetails', [did, newId, d.time, d.location, d.description]);
  });
  return Views_dashboard({ sid: p.sid, info: 'Duplicated as ' + newId + '.' });
}

function Exercises_addDetail(p) {
  Auth_requireRole(p, ['admin']);
  const exId = p.exerciseId;
  if (!Exercises_get(exId)) throw new Error('Exercise not found.');
  const did = 'D' + _nextId('ExerciseDetails');
  _append('ExerciseDetails', [did, exId, p.time || '', p.location || '', p.detailDescription || '']);
  return Views_exercise({ sid: p.sid, id: exId, info: 'Timeline entry added.' });
}
