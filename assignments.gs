// ═══════════════════════════════════════
//  assignments.gs — assign + complete
// ═══════════════════════════════════════

function Assignments_all() {
  return _rows('Assignments').data.map(r => ({
    id: String(r[0]), exercise_id: String(r[1]), user_id: String(r[2]),
    status: String(r[3] || 'pending'), score: r[4] == null ? '' : String(r[4])
  }));
}

function Assignments_byUser(userId) {
  return Assignments_all().filter(a => a.user_id === String(userId));
}

function Assignments_byExercise(exerciseId) {
  return Assignments_all().filter(a => a.exercise_id === String(exerciseId));
}

function Assignments_assign(p) {
  const u = Auth_requireRole(p, ['admin','commander']);
  const exId   = (p.exerciseId || '').trim();
  const userId = (p.userId     || '').trim();
  if (!exId || !userId) throw new Error('Missing exercise or user.');

  // Commander can only assign to trainees in their team
  if (u.role === 'commander') {
    const trainees = Users_traineesOfCommander(u.id).map(t => t.id);
    if (trainees.indexOf(userId) === -1) throw new Error('Cannot assign outside your team.');
  }

  // No duplicate
  const exists = Assignments_all().some(a => a.exercise_id === exId && a.user_id === userId);
  if (exists) return Views_dashboard({ sid: p.sid, info: 'Already assigned.' });

  const id = 'A' + _nextId('Assignments');
  _append('Assignments', [id, exId, userId, 'pending', '']);
  return Views_dashboard({ sid: p.sid, info: 'Assigned (' + id + ').' });
}

function Assignments_complete(p) {
  const u = Auth_requireRole(p, ['admin','commander']);
  const aid = (p.assignmentId || '').trim();
  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('Assignment not found.');
  const sh = _sheet('Assignments');
  // Commander scope check
  if (u.role === 'commander') {
    const userId = String(sh.getRange(row, 3).getValue());
    const trainees = Users_traineesOfCommander(u.id).map(t => t.id);
    if (trainees.indexOf(userId) === -1) throw new Error('Cannot mark outside your team.');
  }
  sh.getRange(row, 4).setValue('completed');
  if (p.score) sh.getRange(row, 5).setValue(p.score);
  return Views_dashboard({ sid: p.sid, info: 'Marked completed.' });
}
