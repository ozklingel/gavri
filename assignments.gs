// ═══════════════════════════════════════
//  assignments.gs — assign, team-assign, remove, complete
//  Sheet "Assignments" columns:
//    A: id | B: exercise_id | C: user_id | D: status | E: score | F: responsibility
// ═══════════════════════════════════════

function Assignments_all() {
  return _rows('Assignments').data.map(r => ({
    id:             String(r[0]),
    exercise_id:    String(r[1]),
    user_id:        String(r[2]),
    status:         String(r[3] || 'pending'),
    score:          r[4] == null ? '' : String(r[4]),
    responsibility: r[5] == null ? '' : String(r[5])
  }));
}

function Assignments_byUser(userId) {
  return Assignments_all().filter(a => a.user_id === String(userId));
}

function Assignments_byExercise(exerciseId) {
  return Assignments_all().filter(a => a.exercise_id === String(exerciseId));
}

// Assign a single user to an exercise (admin only)
function Assignments_assign(p) {
  Auth_requireRole(p, ['admin']);
  const exId   = (p.exerciseId     || '').trim();
  const userId = (p.userId         || '').trim();
  const resp   = (p.responsibility || '').trim();
  if (!exId || !userId) throw new Error('חסר תרגיל או חייל.');
  if (!resp) throw new Error('יש לציין תפקיד.');

  const exists = Assignments_all().some(a => a.exercise_id === exId && a.user_id === userId);
  if (exists) return Views_exercise({ sid: p.sid, id: exId, info: 'החייל כבר משתתף בתרגיל.' });

  const id = 'A' + _nextId('Assignments');
  _append('Assignments', [id, exId, userId, 'pending', '', resp]);
  return Views_exercise({ sid: p.sid, id: exId, info: 'החייל הוקצה בהצלחה בתפקיד ' + resp + '.' });
}

// Assign an entire team to an exercise (skips already-assigned members)
function Assignments_assignTeam(exId, teamId, sid) {
  if (!teamId) return { added: 0, skipped: 0 };
  const members  = Users_byTeam(teamId);
  const existing = Assignments_byExercise(exId).map(a => a.user_id);

  let added = 0, skipped = 0;
  members.forEach(function(u) {
    if (existing.indexOf(u.id) !== -1) { skipped++; return; }
    const id = 'A' + _nextId('Assignments');
    _append('Assignments', [id, exId, u.id, 'pending', '', _roleHe(u.role)]);
    added++;
  });
  return { added: added, skipped: skipped };
}

// Remove a participant from an exercise (admin only)
function Assignments_remove(p) {
  Auth_requireRole(p, ['admin']);
  const aid    = (p.assignmentId || '').trim();
  const exId   = (p.exerciseId   || '').trim();
  if (!aid) throw new Error('חסר מזהה הקצאה.');

  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');
  _sheet('Assignments').deleteRow(row);

  return Views_exercise({ sid: p.sid, id: exId, info: 'המשתתף הוסר מהתרגיל.' });
}

// Mark assignment as complete (admin or commander)
function Assignments_complete(p) {
  const u = Auth_requireRole(p, ['admin','commander']);
  const aid = (p.assignmentId || '').trim();
  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');
  const sh = _sheet('Assignments');
  if (u.role === 'commander') {
    const userId = String(sh.getRange(row, 3).getValue());
    const trainees = Users_traineesOfCommander(u.id).map(t => t.id);
    if (trainees.indexOf(userId) === -1) throw new Error('לא ניתן לסמן הקצאה מחוץ לצוות שלך.');
  }
  sh.getRange(row, 4).setValue('completed');
  if (p.score) sh.getRange(row, 5).setValue(p.score);
  return Views_dashboard({ sid: p.sid, info: 'התרגיל סומן כהושלם.' });
}

// Remove a single assignment (admin only)
function Assignments_remove(p) {
  Auth_requireRole(p, ['admin']);
  const aid     = (p.assignmentId || '').trim();
  const exId    = (p.exerciseId   || '').trim();
  if (!aid) throw new Error('חסר מזהה הקצאה.');

  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');
  _sheet('Assignments').deleteRow(row);
  return Views_exercise({ sid: p.sid, id: exId, info: 'המשתתף הוסר מהתרגיל.' });
}

// Bulk-assign all members of a team to an exercise
// Returns { added, skipped } — used by Exercises_create and as a standalone action
function Assignments_assignTeam(exerciseId, teamId, sid) {
  const members  = Users_byTeam(teamId);
  const existing = Assignments_byExercise(exerciseId).map(function(a) { return a.user_id; });
  let added = 0, skipped = 0;
  members.forEach(function(member) {
    if (existing.indexOf(member.id) !== -1) { skipped++; return; }
    const aid  = 'A' + _nextId('Assignments');
    const resp = member.role === 'commander' ? 'מפקד' : 'לוחם';
    _append('Assignments', [aid, exerciseId, member.id, 'pending', '', resp]);
    added++;
  });
  return { added: added, skipped: skipped };
}

// Action handler: assign a whole team to an existing exercise
function Assignments_assignTeamAction(p) {
  Auth_requireRole(p, ['admin']);
  const exId   = (p.exerciseId || '').trim();
  const teamId = (p.teamId     || '').trim();
  if (!exId || !teamId) throw new Error('חסרים תרגיל או צוות.');
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');

  const team   = Teams_get(teamId);
  const tName  = team ? team.name : teamId;
  const result = Assignments_assignTeam(exId, teamId, p.sid);

  const msg = result.added + ' משתתפים מצוות "' + tName + '" נוספו.' +
    (result.skipped ? ' (' + result.skipped + ' כבר רשומים.)' : '');
  return Views_exercise({ sid: p.sid, id: exId, info: msg });
}