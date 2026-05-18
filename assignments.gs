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

  const id = 'A' + new Date().getTime();
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
  _cacheInvalidate('Assignments');
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
  // PERF: batch-write status + score in one call
  const score = p.score || '';
  sh.getRange(row, 4, 1, 2).setValues([['completed', score]]);
  _cacheInvalidate('Assignments');
  return Views_dashboard({ sid: p.sid, info: 'התרגיל סומן כהושלם.' });
}

// ═══════════════════════════════════════
//  TEAM ASSIGN: מפקד צוות + 2 חניכים לכל תרגיל
// ═══════════════════════════════════════
function Assignments_assignTeam(exerciseId, teamId, sid) {
  if (!teamId) return { added: 0, skipped: 0, missing: [] };

  const team       = Teams_get(teamId);
  const members    = Users_byTeam(teamId);
  const existing   = Assignments_byExercise(exerciseId).map(function(a){ return a.user_id; });

  let commander = null;
  if (team && team.commander_id) {
    commander = Users_get(team.commander_id);
  }
  if (!commander) {
    commander = members.find(function(u){ return u.role === 'commander'; }) || null;
  }

  const trainees = members.filter(function(u){ return u.role === 'trainee'; }).slice(0, 2);

  const toAssign = [];
  if (commander) toAssign.push({ user: commander, resp: 'מפקד צוות' });
  trainees.forEach(function(t, i){
    toAssign.push({ user: t, resp: 'חניך ' + (i + 1) });
  });

  let added = 0, skipped = 0;
  // PERF: collect rows, then batch-append in one Sheets API call
  const newRows = [];
  toAssign.forEach(function(item){
    if (existing.indexOf(item.user.id) !== -1) { skipped++; return; }
    const aid = 'A' + new Date().getTime() + '_' + added;
    newRows.push([aid, exerciseId, item.user.id, 'pending', '', item.resp]);
    added++;
  });
  if (newRows.length) _appendBatch('Assignments', newRows);

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
// ═══════════════════════════════════════
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
}function Assignments_autoAssignAll(p) {
  Auth_requireRole(p, ['admin']);

  const exercises  = Exercises_all();
  const allUsers   = Users_all();
  const allAssigns = Assignments_all();

  // -----------------------------
  // נרמול חילות
  // -----------------------------
  function normalize(v) {
    return String(v || '')
      .replace(/״/g, '')
      .trim();
  }

  function corps(u) {
    return normalize(u.military_affiliation);
  }

  const CORPS = {
    INF: 'חיר',
    ARM: 'שריון',
    ENG: 'חהן',
    SUP: 'מסייעת',
    ADM: 'מנהלי'
  };

  // -----------------------------
  // תרגילים שכבר שובצו
  // -----------------------------
  const assigned = new Set(allAssigns.map(a => a.exercise_id));

  // -----------------------------
  // עדיפות חניכים
  // -----------------------------
  function priority(u) {
    let s = 0;
    if (u.service_type === 'מילואים') s += 100;
    if (u.target_role === 'מתמרן') s += 50;
    return s;
  }

  let trainees = allUsers.filter(u => u.role === 'trainee');
  trainees.sort((a, b) => priority(b) - priority(a));

  // -----------------------------
  // חלוקה לפי חילות
  // -----------------------------
  let infantry = trainees.filter(u => corps(u) === CORPS.INF);
  let armor    = trainees.filter(u => corps(u) === CORPS.ARM);
  let eng      = trainees.filter(u => corps(u) === CORPS.ENG);
  let support  = trainees.filter(u => corps(u) === CORPS.SUP);
  let admin    = trainees.filter(u => corps(u) === CORPS.ADM);

  let commanders = allUsers.filter(u => u.role === 'commander');

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  commanders = shuffle(commanders);

  function pick(pool, cond) {
    const i = pool.findIndex(cond);
    if (i === -1) return null;
    return pool.splice(i, 1)[0];
  }

  const allRows = [];

  let stats = {
    ex: 0,
    skipped: 0,
    trainees: 0,
    commanders: 0
  };

  // -----------------------------
  // לולאת שיבוץ
  // -----------------------------
  exercises.forEach((ex, idx) => {

    if (assigned.has(ex.id)) {
      stats.skipped++;
      return;
    }

    // -----------------------------
    // בחירת צוות מוביל לפי חי״ר
    // -----------------------------
    const teamCount = {};

    infantry.forEach(u => {
      teamCount[u.team_id] = (teamCount[u.team_id] || 0) + 1;
    });

    let preferredTeam = Object.keys(teamCount)
      .sort((a, b) => teamCount[b] - teamCount[a])[0];

    // -----------------------------
    // פונקציות צוות
    // -----------------------------
    function pickTeam(pool) {
      let i = pool.findIndex(u => u.team_id === preferredTeam);
      if (i !== -1) return pool.splice(i, 1)[0];
      return null;
    }

    function pickAny(pool) {
      return pick(pool, () => true);
    }

    const row = [];

    // מפקד
    const commander = commanders[idx % Math.max(commanders.length, 1)];
    if (commander) row.push({ u: commander, r: 'מפקד צוות' });

    // מסייעת (עדיפות צוות)
    let sup = pickTeam(support) || pickAny(support);
    if (sup) row.push({ u: sup, r: 'מסייעת' });

    // שריון
    let arm = pickTeam(armor) || pickAny(armor);
    if (arm) row.push({ u: arm, r: 'שריון' });

    // חי״ר (עד 2, מאותו צוות קודם)
    for (let i = 0; i < 2; i++) {
      let inf = pickTeam(infantry) || pickAny(infantry);
      if (!inf) break;
      row.push({ u: inf, r: 'חי״ר' });
    }

    // חה״ן
    let e = pickTeam(eng) || pickAny(eng);
    if (e) row.push({ u: e, r: 'חה״ן' });

    // מנהלי
    let ad = pickTeam(admin) || pickAny(admin);
    if (ad) row.push({ u: ad, r: 'מנהלי' });

    // -----------------------------
    // כתיבה
    // -----------------------------
    row.forEach((x, i) => {
      const id = 'A' + Date.now() + '_' + idx + '_' + i;

      allRows.push([
        id,
        ex.id,
        x.u.id,
        'pending',
        '',
        x.r
      ]);

      stats.trainees++;
      if (x.u.role === 'commander') stats.commanders++;
    });

    if (row.length) stats.ex++;
  });

  if (allRows.length) {
    _appendBatch('Assignments', allRows);
  }

  return Views_assign({
    sid: p.sid,
    info:
      '✅ שיבוץ הושלם: ' +
      stats.ex + '/' + exercises.length +
      ' תרגילים שובצו. ' +
      '(' + stats.commanders + ' מפקדים, ' +
      stats.trainees + ' חניכים). ' +
      'דולגו: ' + stats.skipped
  });
}
// פעולה: ניקוי כל השיבוצים (לפני הרצה מחדש של שיבוץ אוטומטי)
function Assignments_clearAll(p) {
  Auth_requireRole(p, ['admin']);
  const sh = _sheet('Assignments');
  const last = sh.getLastRow();
  if (last > 1) {
    sh.deleteRows(2, last - 1);
  }
  _cacheInvalidate('Assignments');
  return Views_assign({ sid: p.sid, info: '🗑 כל השיבוצים נוקו.' });
}

// Update assignment fields (score, status, responsibility) — admin only
// PERF: batch-write all changed cells in one setValues call
function Assignments_update(p) {
  Auth_requireRole(p, ['admin']);
  const aid  = (p.assignmentId || '').trim();
  const exId = (p.exerciseId   || '').trim();
  if (!aid) throw new Error('חסר מזהה הקצאה.');

  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');

  const sh = _sheet('Assignments');
  // Read current row values so we can write all 3 cols in one call
  const current = sh.getRange(row, 4, 1, 3).getValues()[0];
  const newStatus = (p.status !== undefined && p.status !== '') ? p.status : current[0];
  const newScore  = (p.score  !== undefined)                    ? p.score  : current[1];
  const newResp   = (p.responsibility !== undefined && p.responsibility !== '') ? p.responsibility : current[2];

  sh.getRange(row, 4, 1, 3).setValues([[newStatus, newScore, newResp]]);
  _cacheInvalidate('Assignments');

  return Views_exercise({ sid: p.sid, id: exId, info: 'פרטי המשתתף עודכנו בהצלחה.' });
}

// ═══════════════════════════════════════
//  Board API — called via google.script.run from assign page
// ═══════════════════════════════════════

// Add assignment from drag-and-drop board
function assignFromBoard(sid, exId, userId, resp) {
  var p = { sid: sid };
  Auth_requireRole(p, ['admin']);
  if (!exId || !userId) throw new Error('חסר מזהה תרגיל או חייל.');

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
  _cacheInvalidate('Assignments');
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
  _cacheInvalidate('Assignments');
  return { ok: true };
}
