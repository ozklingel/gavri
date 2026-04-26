// ═══════════════════════════════════════
//  assignments.gs — assign + complete
//  Sheet "Assignments" columns:
//    A: id | B: exercise_id | C: user_id | D: status | E: score | F: responsibility
// ═══════════════════════════════════════

function Assignments_all() {
  return _rows('Assignments').data.map(r => ({
    id: String(r[0]),
    exercise_id: String(r[1]),
    user_id: String(r[2]),
    status: String(r[3] || 'pending'),
    score: r[4] == null ? '' : String(r[4]),
    responsibility: r[5] == null ? '' : String(r[5])
  }));
}

function Assignments_byUser(userId) {
  return Assignments_all().filter(a => a.user_id === String(userId));
}

function Assignments_byExercise(exerciseId) {
  return Assignments_all().filter(a => a.exercise_id === String(exerciseId));
}

function Assignments_assign(p) {
  // הקצאה מותרת למפקדי קורס (admin) בלבד
  Auth_requireRole(p, ['admin']);
  const exId   = (p.exerciseId    || '').trim();
  const userId = (p.userId        || '').trim();
  const resp   = (p.responsibility|| '').trim();
  if (!exId || !userId) throw new Error('חסר תרגיל או חייל.');
  if (!resp) throw new Error('יש לציין תפקיד.');

  // No duplicate
  const exists = Assignments_all().some(a => a.exercise_id === exId && a.user_id === userId);
  if (exists) return Views_exercise({ sid: p.sid, id: exId, info: 'התרגיל כבר הוקצה לחייל זה.' });

  const id = 'A' + _nextId('Assignments');
  _append('Assignments', [id, exId, userId, 'pending', '', resp]);
  return Views_exercise({ sid: p.sid, id: exId, info: 'הוקצה בהצלחה (' + id + ') בתפקיד ' + resp + '.' });
}

function Assignments_complete(p) {
  const u = Auth_requireRole(p, ['admin','commander']);
  const aid = (p.assignmentId || '').trim();
  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');
  const sh = _sheet('Assignments');
  // Commander scope check
  if (u.role === 'commander') {
    const userId = String(sh.getRange(row, 3).getValue());
    const trainees = Users_traineesOfCommander(u.id).map(t => t.id);
    if (trainees.indexOf(userId) === -1) throw new Error('לא ניתן לסמן הקצאה מחוץ לצוות שלך.');
  }
  sh.getRange(row, 4).setValue('completed');
  if (p.score) sh.getRange(row, 5).setValue(p.score);
  return Views_dashboard({ sid: p.sid, info: 'התרגיל סומן כהושלם.' });
}
