// ═══════════════════════════════════════
//  assignments.gs — assign, team-assign, remove, complete
//  Sheet "Assignments" columns:
//    A: id | B: exercise_id | C: user_id | D: status | E: score | F: responsibility | G: feedback | H: tutor
// ═══════════════════════════════════════

function _assignmentRow(id, exId, userId, status, score, resp, feedback, tutor) {
  return [
    id, exId, userId,
    status || 'pending',
    score || '',
    resp || '',
    feedback || '',
    tutor || ''
  ];
}

function Assignments_all() {
  return _rows('Assignments').data.map(r => ({
    id:             String(r[0]),
    exercise_id:    String(r[1]),
    user_id:        String(r[2]),
    status:         String(r[3] || 'pending'),
    score:          r[4] == null ? '' : String(r[4]),
    responsibility: r[5] == null ? '' : String(r[5]),
    feedback:       r[6] == null ? '' : String(r[6]),
    tutor:          r[7] == null ? '' : String(r[7])
  }));
}

function Assignments_get(id) {
  return Assignments_all().find(function(a) { return a.id === String(id); }) || null;
}

/** תפקיד מ״פ בתרגיל (מפ חיר, מפ חשן וכו׳) */
function Assignments_isMpRole(resp) {
  const r = String(resp || '').trim();
  return /^מפ /.test(r);
}

function Assignments_mpCountByExercise() {
  const counts = {};
  Assignments_all().forEach(function(a) {
    if (!Assignments_isMpRole(a.responsibility)) return;
    counts[a.exercise_id] = (counts[a.exercise_id] || 0) + 1;
  });
  return counts;
}

function Assignments_isTuteeOf(user, assignment) {
  if (!user || !assignment || !Roles_isTutor(user.role)) return false;
  if (String(assignment.tutor) !== String(user.id)) return false;
  const u = Users_get(assignment.user_id);
  return !!(u && Roles_isTrainee(u.role));
}

function Assignments_canEditFeedback(user, assignment) {
  if (!user || !assignment) return false;
  if (Roles_hasAdminAccess(user.role)) return true;
  if (Roles_isCompanyCommander(user.role)) {
    const traineeIds = Users_traineesOfCommander(user.id).map(function(t) { return t.id; });
    return traineeIds.indexOf(assignment.user_id) !== -1;
  }
  if (Roles_isTutor(user.role)) return Assignments_isTuteeOf(user, assignment);
  return false;
}

function Assignments_canEditScore(user, assignment) {
  if (!user || !assignment) return false;
  if (Roles_hasAdminAccess(user.role)) return true;
  if (Roles_isTutor(user.role)) return Assignments_isTuteeOf(user, assignment);
  return false;
}

function Assignments_byTutor(tutorId) {
  return Assignments_all().filter(function(a) {
    return String(a.tutor) === String(tutorId);
  });
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

  HomeConstraints_assertCanAssign(userId, exId);

  const conflictWarnings = AssignmentConflicts_checkNewAssignment(userId, exId);
  conflictWarnings.forEach(function(w) {
    if (w.type === 'time') throw new Error('התנגשות תרגיל: ' + w.message);
  });

  const id = 'A' + new Date().getTime();
  _append('Assignments', _assignmentRow(id, exId, userId, 'pending', '', resp, '', ''));
  let info = 'החייל הוקצה בהצלחה בתפקיד ' + resp + '.';
  const procWarn = conflictWarnings.filter(function(w) { return w.type === 'procedure'; });
  if (procWarn.length) info += ' ⚠ ' + procWarn[0].message;
  return Views_exercise({ sid: p.sid, id: exId, info: info });
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
  const u = Auth_requireRole(p, ['admin', 'companyCommander', 'commander']);
  const aid = (p.assignmentId || '').trim();
  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');
  const sh = _sheet('Assignments');
  if (Roles_isCompanyCommander(u.role)) {
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
    commander = members.find(function(u) { return Roles_isCompanyCommander(u.role); }) || null;
  }

  const trainees = members.filter(function(u) { return Roles_isTrainee(u.role); }).slice(0, 2);

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
    if (HomeConstraints_checkAssignment(item.user.id, exerciseId)) { skipped++; return; }
    const aid = 'A' + new Date().getTime() + '_' + added;
    newRows.push(_assignmentRow(aid, exerciseId, item.user.id, 'pending', '', item.resp, '', ''));
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
  if (corps === 'חשן') {
    return v.indexOf('חשן') !== -1 || v === 'armor' || v === 'armour';
  }
  return false;
}

function _exerciseTimeRange(ex) {
  const DAY_MS  = 86400000;
  const HOUR_MS = 3600000;

  let startMs = _parseRawDate(ex.rawStartDate);
  let endMs   = _parseRawDate(ex.rawEndDate || ex.rawStartDate);
  if (isNaN(startMs)) return null;
  if (isNaN(endMs)) endMs = startMs + DAY_MS;

  if (ex.rawStartTime) {
    const parts = ex.rawStartTime.split(':').map(Number);
    startMs += parts[0] * HOUR_MS + (parts[1] || 0) * 60000;
  }
  if (ex.rawEndTime) {
    const parts = ex.rawEndTime.split(':').map(Number);
    endMs = _parseRawDate(ex.rawEndDate || ex.rawStartDate) +
      parts[0] * HOUR_MS + (parts[1] || 0) * 60000;
  }
  if (endMs <= startMs) endMs = startMs + DAY_MS;
  return { startMs: startMs, endMs: endMs };
}

function _timesOverlap(r1, r2) {
  if (!r1 || !r2) return false;
  return r1.startMs < r2.endMs && r2.startMs < r1.endMs;
}

function _buildUserExerciseMap(assigns) {
  const map = {};
  assigns.forEach(function(a) {
    if (!map[a.user_id]) map[a.user_id] = [];
    if (map[a.user_id].indexOf(a.exercise_id) === -1) {
      map[a.user_id].push(a.exercise_id);
    }
  });
  return map;
}

function _userTimeConflict(userId, targetExId, exRanges, userExMap) {
  const targetRange = exRanges[targetExId];
  const exIds = userExMap[userId] || [];
  for (let i = 0; i < exIds.length; i++) {
    if (exIds[i] === targetExId) return true;
    if (_timesOverlap(targetRange, exRanges[exIds[i]])) return true;
  }
  return false;
}

function _addUserToExerciseMap(userExMap, userId, exId) {
  if (!userExMap[userId]) userExMap[userId] = [];
  if (userExMap[userId].indexOf(exId) === -1) userExMap[userId].push(exId);
}

function Assignments_autoAssignAll(p) {
  Auth_requireRole(p, ['admin']);

  const exercises  = Exercises_all();
  const allUsers   = Users_all();
  const allAssigns = Assignments_all();

  function normalize(v) {
    return String(v || '').replace(/״/g, '').trim();
  }

  function corps(u) {
    return normalize(u.military_affiliation);
  }

  const CORPS = {
    INF: 'חיר',
    ARM: 'חשן',
    ENG: 'חהן',
    SUP: 'מסייעת',
    ADM: 'מנהלי'
  };

  const SLOTS = [
    { kind: 'commander', resp: 'מפקד צוות', count: 1 },
    { kind: 'corps', corpsKey: CORPS.SUP, resp: 'מפ מסייעת', count: 1 },
    { kind: 'corps', corpsKey: CORPS.ARM, resp: 'מפ חשן', count: 1 },
    { kind: 'corps', corpsKey: CORPS.INF, resp: 'מפ חי״ר', count: 2 },
    { kind: 'corps', corpsKey: CORPS.ENG, resp: 'מפ חה״ן', count: 1 },
    { kind: 'corps', corpsKey: CORPS.ADM, resp: 'מפ מנהלי', count: 1 }
  ];

  function priority(u) {
    let s = 0;
    if (u.service_type === 'מילואים') s += 100;
    if (u.target_role === 'מתמרן') s += 50;
    return s;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  const exRanges = {};
  exercises.forEach(function(ex) {
    exRanges[ex.id] = _exerciseTimeRange(ex);
  });

  const userExMap = _buildUserExerciseMap(allAssigns);

  const userById = {};
  allUsers.forEach(function(u) { userById[u.id] = u; });

  const teamCommanderId = {};
  Teams_all().forEach(function(t) {
    if (t.id && t.commander_id) teamCommanderId[String(t.id)] = String(t.commander_id);
  });

  const trainees = allUsers
    .filter(function(u) { return Roles_isTrainee(u.role); })
    .sort(function(a, b) { return priority(b) - priority(a); });

  const corpsPools = {
    [CORPS.INF]: trainees.filter(function(u) { return corps(u) === CORPS.INF; }),
    [CORPS.ARM]: trainees.filter(function(u) { return corps(u) === CORPS.ARM; }),
    [CORPS.ENG]: trainees.filter(function(u) { return corps(u) === CORPS.ENG; }),
    [CORPS.SUP]: trainees.filter(function(u) { return corps(u) === CORPS.SUP; }),
    [CORPS.ADM]: trainees.filter(function(u) { return corps(u) === CORPS.ADM; })
  };

  const commanders = shuffle(allUsers.filter(function(u) { return Roles_isCompanyCommander(u.role); }));

  const sortedExercises = exercises.slice().sort(function(a, b) {
    const ra = exRanges[a.id];
    const rb = exRanges[b.id];
    if (ra && rb) return ra.startMs - rb.startMs;
    if (ra) return -1;
    if (rb) return 1;
    return a.id.localeCompare(b.id);
  });

  function respCount(exId, resp, pendingRows) {
    let n = allAssigns.filter(function(a) {
      return a.exercise_id === exId && a.responsibility === resp;
    }).length;
    pendingRows.forEach(function(r) {
      if (r[1] === exId && r[5] === resp) n++;
    });
    return n;
  }

  function onExercise(exId, pendingRows) {
    const ids = {};
    allAssigns.forEach(function(a) {
      if (a.exercise_id === exId) ids[a.user_id] = true;
    });
    pendingRows.forEach(function(r) {
      if (r[1] === exId) ids[r[2]] = true;
    });
    return ids;
  }

  function isMiluaim(u) {
    return normalize(u.service_type) === 'מילואים';
  }

  function isSadir(u) {
    return normalize(u.service_type) === 'סדיר';
  }

  function assignCount(userId, pendingRows) {
    let n = allAssigns.filter(function(a) { return a.user_id === userId; }).length;
    pendingRows.forEach(function(r) {
      if (r[2] === userId) n++;
    });
    return n;
  }

  function traineePickScore(u, preferredTeam) {
    let s = 0;
    if (preferredTeam && u.team_id === preferredTeam) s += 1000;
    if (u.target_role === 'מתמרן') s += 50;
    if (isMiluaim(u)) s += 10;
    return s;
  }

  function pickBestTrainee(candidates, preferredTeam) {
    if (!candidates.length) return null;
    candidates.sort(function(a, b) {
      const ca = assignCount(a.id, allRows);
      const cb = assignCount(b.id, allRows);
      if (ca !== cb) return ca - cb;
      const sa = traineePickScore(a, preferredTeam);
      const sb = traineePickScore(b, preferredTeam);
      if (sa !== sb) return sb - sa;
      return a.id.localeCompare(b.id);
    });
    return candidates[0];
  }

  function pickTrainee(pool, exId, preferredTeam, onEx) {
    function ok(u) {
      if (onEx[u.id]) return false;
      if (_userTimeConflict(u.id, exId, exRanges, userExMap)) return false;
      return true;
    }

    const eligible = pool.filter(ok);
    if (!eligible.length) return null;

    const eligibleMiluaim = eligible.filter(isMiluaim);
    let candidates = eligible.slice();

    // סדיר רק אם אין מילואים זמין ששובץ פחות ממנו
    if (eligibleMiluaim.length) {
      candidates = candidates.filter(function(u) {
        if (!isSadir(u)) return true;
        const sadirCount = assignCount(u.id, allRows);
        for (let i = 0; i < eligibleMiluaim.length; i++) {
          if (assignCount(eligibleMiluaim[i].id, allRows) < sadirCount) return false;
        }
        return true;
      });
    }

    if (!candidates.length) return null;

    if (preferredTeam) {
      const teamCandidates = candidates.filter(function(u) {
        return u.team_id === preferredTeam;
      });
      const teamPick = pickBestTrainee(teamCandidates, preferredTeam);
      if (teamPick) return teamPick;
    }

    return pickBestTrainee(candidates, preferredTeam);
  }

  function pickCommander(exId, exIdx, onEx, dominantTeam) {
    if (!commanders.length) return null;
    const candidates = [];
    for (let j = 0; j < commanders.length; j++) {
      const c = commanders[(exIdx + j) % commanders.length];
      if (onEx[c.id]) continue;
      if (_userTimeConflict(c.id, exId, exRanges, userExMap)) continue;
      candidates.push(c);
    }
    if (!candidates.length) return null;

    function commanderScore(c) {
      let s = 0;
      if (dominantTeam) {
        if (teamCommanderId[dominantTeam] === String(c.id)) s += 10000;
        if (String(c.team_id) === String(dominantTeam)) s += 5000;
      }
      s -= assignCount(c.id, allRows) * 10;
      return s;
    }

    candidates.sort(function(a, b) {
      const diff = commanderScore(b) - commanderScore(a);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    return candidates[0];
  }

  function teamCountsOnExercise(exId, pendingRows) {
    const teamCount = {};
    function countTrainee(userId) {
      const u = userById[userId];
      if (!u || !Roles_isTrainee(u.role) || !u.team_id) return;
      const tid = String(u.team_id);
      teamCount[tid] = (teamCount[tid] || 0) + 1;
    }
    allAssigns.forEach(function(a) {
      if (String(a.exercise_id) === String(exId)) countTrainee(a.user_id);
    });
    pendingRows.forEach(function(r) {
      if (String(r[1]) === String(exId)) countTrainee(r[2]);
    });
    return teamCount;
  }

  function dominantTeamOnExercise(exId, pendingRows) {
    const teamCount = teamCountsOnExercise(exId, pendingRows);
    const keys = Object.keys(teamCount).sort(function(a, b) {
      return teamCount[b] - teamCount[a];
    });
    return keys[0] || '';
  }

  function preferredTeamForEx(exId, onEx) {
    const teamCount = {};
    corpsPools[CORPS.INF].forEach(function(u) {
      if (onEx[u.id]) return;
      if (_userTimeConflict(u.id, exId, exRanges, userExMap)) return;
      if (!u.team_id) return;
      teamCount[u.team_id] = (teamCount[u.team_id] || 0) + 1;
    });
    const keys = Object.keys(teamCount).sort(function(a, b) {
      return teamCount[b] - teamCount[a];
    });
    return keys[0] || '';
  }

  const allRows = [];
  const stats = {
    added: 0,
    full: 0,
    partial: 0,
    empty: 0,
    slotsMissing: 0
  };

  sortedExercises.forEach(function(ex, exIdx) {
    const onExStart = onExercise(ex.id, allRows);
    let preferredTeam = dominantTeamOnExercise(ex.id, allRows);
    if (!preferredTeam) preferredTeam = preferredTeamForEx(ex.id, onExStart);

    SLOTS.forEach(function(slot) {
      if (slot.kind === 'commander') return;

      const need = slot.count - respCount(ex.id, slot.resp, allRows);
      for (let n = 0; n < need; n++) {
        const onEx = onExercise(ex.id, allRows);
        const pool = corpsPools[slot.corpsKey] || [];
        const user = pickTrainee(pool, ex.id, preferredTeam, onEx);

        if (!user) {
          stats.slotsMissing++;
          continue;
        }
        if (HomeConstraints_checkAssignment(user.id, ex.id)) {
          stats.slotsMissing++;
          continue;
        }

        const row = _assignmentRow(
          'A' + Date.now() + '_' + exIdx + '_' + stats.added,
          ex.id, user.id, 'pending', '', slot.resp, '', ''
        );
        allRows.push(row);
        _addUserToExerciseMap(userExMap, user.id, ex.id);
        stats.added++;
      }
    });

    const dominantTeam = dominantTeamOnExercise(ex.id, allRows);
    const cmdSlot = SLOTS.filter(function(s) { return s.kind === 'commander'; })[0];
    if (cmdSlot) {
      const need = cmdSlot.count - respCount(ex.id, cmdSlot.resp, allRows);
      for (let n = 0; n < need; n++) {
        const onEx = onExercise(ex.id, allRows);
        const user = pickCommander(ex.id, exIdx, onEx, dominantTeam);

        if (!user) {
          stats.slotsMissing++;
          continue;
        }
        if (HomeConstraints_checkAssignment(user.id, ex.id)) {
          stats.slotsMissing++;
          continue;
        }

        const row = _assignmentRow(
          'A' + Date.now() + '_' + exIdx + '_c' + stats.added,
          ex.id, user.id, 'pending', '', cmdSlot.resp, '', ''
        );
        allRows.push(row);
        _addUserToExerciseMap(userExMap, user.id, ex.id);
        stats.added++;
      }
    }

    const filled = SLOTS.reduce(function(sum, slot) {
      return sum + Math.min(slot.count, respCount(ex.id, slot.resp, allRows));
    }, 0);
    const total = SLOTS.reduce(function(sum, slot) { return sum + slot.count; }, 0);

    if (filled === 0) stats.empty++;
    else if (filled >= total) stats.full++;
    else stats.partial++;
  });

  if (allRows.length) _appendBatch('Assignments', allRows);

  let info = '✅ שיבוץ הושלם: ' + stats.added + ' הקצאות חדשות. ' +
    stats.full + ' תרגילים מלאים';
  if (stats.partial) info += ', ' + stats.partial + ' חלקיים';
  if (stats.empty) info += ', ' + stats.empty + ' ללא שיבוץ';
  if (stats.slotsMissing) {
    info += '. חסרים ' + stats.slotsMissing + ' משתתפים (חפיפה בזמן או מחסור בכוח אדם)';
  }
  info += '. משתתפים יכולים להופיע בכמה תרגילים — למעט תרגילים חופפים בזמן.';

  return Views_assign({ sid: p.sid, info: info });
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

// Update assignment fields — admin: all; tutor: score only for assigned tutee
function Assignments_update(p) {
  const u = Auth_require(p);
  const aid  = (p.assignmentId || '').trim();
  const exId = (p.exerciseId   || '').trim();
  if (!aid) throw new Error('חסר מזהה הקצאה.');

  const assignment = Assignments_get(aid);
  if (!assignment) throw new Error('ההקצאה לא נמצאה.');

  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');

  const sh = _sheet('Assignments');

  if (Roles_isTutor(u.role)) {
    if (!Assignments_canEditScore(u, assignment)) {
      throw new Error('אין הרשאה לעדכן ציון להקצאה זו.');
    }
    sh.getRange(row, 5).setValue(String(p.score != null ? p.score : '').trim());
    _cacheInvalidate('Assignments');
    return Views_exercise({ sid: p.sid, id: exId || assignment.exercise_id, info: 'הציון נשמר.' });
  }

  if (!Roles_hasAdminAccess(u.role)) throw new Error('אין הרשאה לפעולה זו.');

  const newStatus = String(p.status != null ? p.status : '').trim();
  const newScore  = String(p.score  != null ? p.score  : '').trim();
  const newResp   = String(p.responsibility != null ? p.responsibility : '').trim();
  const newTutor  = String(p.tutor != null ? p.tutor : '').trim();

  sh.getRange(row, 4).setValue(newStatus || 'pending');
  sh.getRange(row, 5).setValue(newScore);
  sh.getRange(row, 6).setValue(newResp);
  sh.getRange(row, 8).setValue(newTutor);
  _cacheInvalidate('Assignments');

  return Views_exercise({ sid: p.sid, id: exId, info: 'פרטי המשתתף עודכנו בהצלחה.' });
}

// Save free-text feedback on trainee performance in an exercise
function Assignments_saveFeedback(p) {
  const user = Auth_requireRole(p, ['admin', 'companyCommander', 'commander', 'tutor']);
  const aid  = (p.assignmentId || '').trim();
  const exId = (p.exerciseId || p.id || '').trim();
  if (!aid) throw new Error('חסר מזהה הקצאה.');

  const assignment = Assignments_get(aid);
  if (!assignment) throw new Error('ההקצאה לא נמצאה.');
  if (!Assignments_canEditFeedback(user, assignment)) {
    throw new Error('אין הרשאה לערוך משוב להקצאה זו.');
  }

  const row = _findRowIndex('Assignments', aid);
  if (row < 0) throw new Error('ההקצאה לא נמצאה.');
  _sheet('Assignments').getRange(row, 7).setValue(String(p.feedback != null ? p.feedback : '').trim());
  _cacheInvalidate('Assignments');

  return Views_exercise({
    sid: p.sid,
    id: exId || assignment.exercise_id,
    info: 'המשוב נשמר בהצלחה.'
  });
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

  HomeConstraints_assertCanAssign(userId, exId);

  const conflictWarnings = AssignmentConflicts_checkNewAssignment(userId, exId);
  conflictWarnings.forEach(function(w) {
    if (w.type === 'time') throw new Error('התנגשות תרגיל: ' + w.message);
  });

  var id = 'A' + new Date().getTime();
  _append('Assignments', _assignmentRow(id, exId, userId, 'pending', '', resp || '', '', ''));
  var out = { id: id, exercise_id: exId, user_id: userId, status: 'pending', responsibility: resp || '' };
  var procWarn = conflictWarnings.filter(function(w) { return w.type === 'procedure'; });
  if (procWarn.length) out.warnings = procWarn;
  return out;
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
  var sh = _sheet('Assignments');
  var userId = String(sh.getRange(row, 3).getValue());
  HomeConstraints_assertCanAssign(userId, toExId);
  var conflictWarnings = AssignmentConflicts_checkNewAssignment(userId, toExId);
  conflictWarnings.forEach(function(w) {
    if (w.type === 'time') throw new Error('התנגשות תרגיל: ' + w.message);
  });
  sh.getRange(row, 2).setValue(toExId);
  _cacheInvalidate('Assignments');
  return { ok: true };
}

// Update responsibility from assignment board (inline edit)
function updateAssignmentRespFromBoard(sid, assignId, exerciseId, responsibility) {
  var p = { sid: sid };
  Auth_requireRole(p, ['admin']);
  if (!assignId) throw new Error('חסר מזהה הקצאה.');
  var resp = String(responsibility || '').trim();
  if (!resp) throw new Error('יש לציין תפקיד.');

  var row = _findRowIndex('Assignments', assignId);
  if (row < 0) throw new Error('ההקצאה לא נמצאה: ' + assignId);

  var sh = _sheet('Assignments');
  var exId = String(sh.getRange(row, 2).getValue());
  if (exerciseId && String(exerciseId) !== exId) {
    throw new Error('ההקצאה אינה שייכת לתרגיל זה.');
  }

  sh.getRange(row, 6).setValue(resp);
  _cacheInvalidate('Assignments');
  return { ok: true, responsibility: resp };
}

function _assignmentMatrixCellPayload(assignment) {
  const u = Users_get(assignment.user_id);
  return {
    assignmentId: assignment.id,
    userId: assignment.user_id,
    name: u ? u.name : assignment.user_id,
    phone: u ? (u.phone || '') : ''
  };
}

/** שיבוץ משתמש לתא (תרגיל + תפקיד) מטבלת שליטה לפי תרגיל */
function assignExerciseMatrixCell(sid, exId, role, userId) {
  const p = { sid: sid };
  Auth_requireRole(p, ['admin']);
  exId = String(exId || '').trim();
  role = String(role || '').trim();
  userId = String(userId || '').trim();
  if (!exId || !role || !userId) throw new Error('חסר תרגיל, תפקיד או משתמש.');

  if (!Users_get(userId)) throw new Error('משתמש לא נמצא.');

  HomeConstraints_assertCanAssign(userId, exId);

  const onEx = Assignments_byExercise(exId);
  const roleRows = onEx.filter(function(a) {
    return String(a.responsibility || '').trim() === role;
  });
  const userRows = onEx.filter(function(a) { return a.user_id === userId; });

  const exact = roleRows.find(function(a) { return a.user_id === userId; });
  if (exact) return _assignmentMatrixCellPayload(exact);

  if (!userRows.length) {
    AssignmentConflicts_checkNewAssignment(userId, exId).forEach(function(w) {
      if (w.type === 'time') throw new Error('התנגשות תרגיל: ' + w.message);
    });
  }

  const sh = _sheet('Assignments');
  let keptId = null;

  function deleteAssign(a) {
    const r = _findRowIndex('Assignments', a.id);
    if (r >= 0) sh.deleteRow(r);
  }

  if (userRows.length) {
    keptId = userRows[0].id;
    const row = _findRowIndex('Assignments', keptId);
    sh.getRange(row, 6).setValue(role);
    userRows.slice(1).forEach(deleteAssign);
    roleRows.forEach(function(a) {
      if (a.id !== keptId) deleteAssign(a);
    });
  } else if (roleRows.length) {
    keptId = roleRows[0].id;
    const row = _findRowIndex('Assignments', keptId);
    sh.getRange(row, 3).setValue(userId);
    roleRows.slice(1).forEach(deleteAssign);
  } else {
    keptId = 'A' + new Date().getTime();
    _append('Assignments', _assignmentRow(keptId, exId, userId, 'pending', '', role, '', ''));
  }

  _cacheInvalidate('Assignments');
  return _assignmentMatrixCellPayload(Assignments_get(keptId));
}
