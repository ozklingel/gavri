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

// ═══════════════════════════════════════
//  AUTO-ASSIGN: מפקד צוות + 2 חניכים לכל תרגיל
//  - בוחר את מפקד הצוות (commander_id) ואת 2 החניכים הראשונים מהצוות
//  - מדלג על מי שכבר רשום לתרגיל
//  - אם אין מפקד או פחות מ-2 חניכים — משבץ מה שקיים
// ═══════════════════════════════════════
function Assignments_assignTeam(exerciseId, teamId, sid) {
  if (!teamId) return { added: 0, skipped: 0, missing: [] };

  const team       = Teams_get(teamId);
  const members    = Users_byTeam(teamId);
  const existing   = Assignments_byExercise(exerciseId).map(function(a){ return a.user_id; });

  // מפקד הצוות לפי commander_id ב-Teams
  let commander = null;
  if (team && team.commander_id) {
    commander = Users_get(team.commander_id);
  }
  // אם אין commander_id — נבחר את המפקד הראשון מהצוות
  if (!commander) {
    commander = members.find(function(u){ return u.role === 'commander'; }) || null;
  }

  // 2 חניכים הראשונים בצוות
  const trainees = members.filter(function(u){ return u.role === 'trainee'; }).slice(0, 2);

  const toAssign = [];
  if (commander) toAssign.push({ user: commander, resp: 'מפקד צוות' });
  trainees.forEach(function(t, i){
    toAssign.push({ user: t, resp: 'חניך ' + (i + 1) });
  });

  let added = 0, skipped = 0;
  toAssign.forEach(function(item){
    if (existing.indexOf(item.user.id) !== -1) { skipped++; return; }
    const aid = 'A' + _nextId('Assignments');
    _append('Assignments', [aid, exerciseId, item.user.id, 'pending', '', item.resp]);
    added++;
  });

  // הודעות חוסר
  const missing = [];
  if (!commander) missing.push('מפקד צוות');
  if (trainees.length < 2) missing.push('רק ' + trainees.length + ' חניכים זמינים (נדרשים 2)');

  return { added: added, skipped: skipped, missing: missing };
}

// Action handler: assign team (admin button)
function Assignments_assignTeamAction(p) {
  Auth_requireRole(p, ['admin']);
  const exId   = (p.exerciseId || '').trim();
  const teamId = (p.teamId     || '').trim();
  if (!exId || !teamId) throw new Error('חסרים תרגיל או צוות.');
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');

  const team   = Teams_get(teamId);
  const tName  = team ? team.name : teamId;
  const result = Assignments_assignTeam(exId, teamId, p.sid);

  let msg = 'שובצו ' + result.added + ' חברים מצוות "' + tName + '" (מפקד + עד 2 חניכים).';
  if (result.skipped) msg += ' ' + result.skipped + ' כבר רשומים.';
  if (result.missing && result.missing.length) {
    msg += ' שים לב: ' + result.missing.join(', ') + '.';
  }
  return Views_exercise({ sid: p.sid, id: exId, info: msg });
}

// ═══════════════════════════════════════
//  AUTO-ASSIGN ALL: שיבוץ אוטומטי לכל התרגילים
//  לוגיקה נוכחית (פשוטה — רנדומלית):
//    - לכל תרגיל משבצים מפקד צוות + 2 חניכים
//    - חניך לא יכול להופיע ביותר מתרגיל אחד (ללא כפילויות)
//    - מפקדים יכולים לחזור על עצמם בין תרגילים
//    - תרגילים שכבר יש להם שיבוצים — מדלגים עליהם
//  ניתן להחליף את הלוגיקה בעתיד.
// ═══════════════════════════════════════
// עזר: התאמת ערך שיוך חיילי (military_affiliation) לקטגוריה
function _matchesCorps(value, corps) {
  if (!value) return false;
  const v = String(value).toLowerCase().trim();
  if (corps === 'חיר') {
    return v.indexOf('חיר') !== -1 || v.indexOf('רגל') !== -1 || v === 'infantry';
  }
  if (corps === 'שריון') {
    return v.indexOf('שריון') !== -1 || v === 'armor' || v === 'armour';
  }
  return false;
}

function Assignments_autoAssignAll(p) {
  Auth_requireRole(p, ['admin']);

  const exercises  = Exercises_all();
  const allUsers   = Users_all();
  const allAssigns = Assignments_all();

  // חניכים שכבר משובצים בתרגיל כלשהו — לא נשתמש בהם שוב
  const usedTrainees = {};
  allAssigns.forEach(function(a){
    const u = allUsers.find(function(x){ return x.id === a.user_id; });
    if (u && u.role === 'trainee') usedTrainees[u.id] = true;
  });

  // בריכות נפרדות לפי שיוך חיילי: חיר ושריון
  let infantryPool = allUsers.filter(function(u){
    return u.role === 'trainee' && !usedTrainees[u.id] && _matchesCorps(u.military_affiliation, 'חיר');
  });
  let armorPool = allUsers.filter(function(u){
    return u.role === 'trainee' && !usedTrainees[u.id] && _matchesCorps(u.military_affiliation, 'שריון');
  });

  // בריכת מפקדים
  const commanderPool = allUsers.filter(function(u){ return u.role === 'commander'; });

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  infantryPool = shuffle(infantryPool);
  armorPool    = shuffle(armorPool);
  const commandersShuffled = shuffle(commanderPool);

  let totalExercises     = 0;
  let exercisesAssigned  = 0;
  let traineesAssigned   = 0;
  let commandersAssigned = 0;
  const skipped      = [];
  const insufficient = [];
  const missingCorps = [];

  exercises.forEach(function(ex, idx){
    totalExercises++;
    const existing = allAssigns.filter(function(a){ return a.exercise_id === ex.id; });
    if (existing.length > 0) {
      skipped.push(ex.title || ex.id);
      return;
    }

    // מפקד (חוזר על עצמו בין תרגילים)
    let commander = null;
    if (commandersShuffled.length) {
      commander = commandersShuffled[idx % commandersShuffled.length];
    }

    // 2 חניכים: אחד חיר, אחד שריון
    const tInf = infantryPool.shift();
    const tArm = armorPool.shift();

    const toAdd = [];
    if (commander) toAdd.push({ user: commander, resp: 'מפקד צוות' });
    if (tInf)      toAdd.push({ user: tInf,      resp: 'חניך חיר' });
    if (tArm)      toAdd.push({ user: tArm,      resp: 'חניך שריון' });

    if (toAdd.length === 0) return;
    if (!commander || !tInf || !tArm) {
      insufficient.push(ex.title || ex.id);
      const m = [];
      if (!tInf) m.push('חיר');
      if (!tArm) m.push('שריון');
      if (m.length) missingCorps.push((ex.title || ex.id) + ' (חסר: ' + m.join(', ') + ')');
    }

    toAdd.forEach(function(item){
      const aid = 'A' + _nextId('Assignments');
      _append('Assignments', [aid, ex.id, item.user.id, 'pending', '', item.resp]);
      if (item.user.role === 'trainee') traineesAssigned++;
      else if (item.user.role === 'commander') commandersAssigned++;
    });
    exercisesAssigned++;
  });

  let msg = '✅ שיבוץ אוטומטי הושלם: ' + exercisesAssigned + '/' + totalExercises + ' תרגילים שובצו.';
  msg += ' (' + commandersAssigned + ' מפקדים, ' + traineesAssigned + ' חניכים — חיר+שריון).';
  if (skipped.length) msg += ' דולגו ' + skipped.length + ' תרגילים עם שיבוצים קיימים.';
  if (insufficient.length) msg += ' ⚠ ' + insufficient.length + ' תרגילים שובצו חלקית.';
  if (missingCorps.length) msg += ' פירוט חוסרים: ' + missingCorps.join('; ') + '.';
  if (infantryPool.length === 0 && armorPool.length === 0 && exercises.length > exercisesAssigned + skipped.length) {
    msg += ' אין יותר חניכים פנויים.';
  }

  return Views_dashboard({ sid: p.sid, info: msg });
}

// פעולה: ניקוי כל השיבוצים (לפני הרצה מחדש של שיבוץ אוטומטי)
function Assignments_clearAll(p) {
  Auth_requireRole(p, ['admin']);
  const sh = _sheet('Assignments');
  const last = sh.getLastRow();
  if (last > 1) {
    sh.deleteRows(2, last - 1);
  }
  return Views_dashboard({ sid: p.sid, info: '🗑 כל השיבוצים נוקו.' });
}

// ═══════════════════════════════════════
//  Board API — called via google.script.run from assign page
// ═══════════════════════════════════════

// Add assignment from drag-and-drop board
function assignFromBoard(sid, exId, userId, resp) {
  var p = { sid: sid };
  Auth_requireRole(p, ['admin']);
  if (!exId || !userId) throw new Error('חסר מזהה תרגיל או חייל.');

  // Check not already assigned
  var existing = Assignments_byExercise(exId).filter(function(a) { return a.user_id === userId; });
  if (existing.length) throw new Error('החייל כבר משובץ לתרגיל זה.');

  var id = 'A' + new Date().getTime();
  _append('Assignments', [id, exId, userId, 'pending', '', resp || '']);
  return { id: id, exercise_id: exId, user_id: userId, status: 'pending', responsibility: resp || '' };
}

// Remove a single assignment by ID
function removeAssignmentById(sid, assignId) {
  var p = { sid: sid };
  Auth_requireRole(p, ['admin']);
  if (!assignId) throw new Error('חסר מזהה הקצאה.');
  var row = _findRowIndex('Assignments', assignId);
  if (row < 0) throw new Error('ההקצאה לא נמצאה: ' + assignId);
  _sheet('Assignments').deleteRow(row);
  return { ok: true };
}

// Move assignment to a different exercise
function moveAssignmentById(sid, assignId, toExId) {
  var p = { sid: sid };
  Auth_requireRole(p, ['admin']);
  if (!assignId || !toExId) throw new Error('חסר מזהה הקצאה או תרגיל יעד.');
  var row = _findRowIndex('Assignments', assignId);
  if (row < 0) throw new Error('ההקצאה לא נמצאה: ' + assignId);
  _sheet('Assignments').getRange(row, 2).setValue(toExId);
  return { ok: true };
}