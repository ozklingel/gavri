// statistics.gs — נתוני סטטיסטיקות לדשבורד סגל

function _Statistics_isMpUser(user) {
  return !!(user && Roles_isTrainee(user.role));
}

function _Statistics_isMagadUser(user) {
  return !!(user && Roles_isUnitCommander(user.role));
}

function _Statistics_isMpAssignment(resp) {
  const r = String(resp || '').trim();
  if (!r) return false;
  return r.indexOf('מ"פ') !== -1 || r.indexOf('מ״פ') !== -1 ||
    r.indexOf('מפ') === 0 || r.indexOf('סמפ') === 0 || /^מפ /.test(r);
}

function _Statistics_isMagadAssignment(resp) {
  const r = String(resp || '').trim();
  if (!r) return false;
  return r.indexOf('מגד') !== -1 || r.indexOf('מג"ד') !== -1 || r.indexOf('מג״ד') !== -1;
}

function _Statistics_round1(n) {
  return Math.round(n * 10) / 10;
}

function _Statistics_cohortMetricsWithRole(userIds, assigns, isRoleFn) {
  const uid = {};
  userIds.forEach(function(id) { uid[String(id)] = true; });
  const cohortAssigns = assigns.filter(function(a) { return uid[String(a.user_id)]; });
  const exerciseIds = {};
  let roleAssigns = 0;
  let otherRoleAssigns = 0;
  cohortAssigns.forEach(function(a) {
    exerciseIds[a.exercise_id] = true;
    if (isRoleFn(a.responsibility)) roleAssigns++;
    else otherRoleAssigns++;
  });
  const people = userIds.length;
  const totalAssignments = cohortAssigns.length;
  const rolePct = totalAssignments
    ? Math.round(roleAssigns * 100 / totalAssignments) : 0;
  return {
    people: people,
    totalAssignments: totalAssignments,
    totalExercises: Object.keys(exerciseIds).length,
    avgPerPerson: people ? _Statistics_round1(totalAssignments / people) : 0,
    roleAssigns: roleAssigns,
    otherRoleAssigns: otherRoleAssigns,
    rolePct: rolePct
  };
}

function _Statistics_exerciseTypeKey(ex) {
  const t = String(ex && ex.exercise_type || '').trim();
  if (t) return t;
  const title = String(ex && ex.title || '').trim();
  if (!title) return 'ללא סוג';
  const dash = title.indexOf(' - ');
  if (dash > 0) return title.substring(0, dash).trim();
  if (title.length > 28) return title.substring(0, 28) + '…';
  return title;
}

function Statistics_buildPayload() {
  const users = Users_all();
  const assigns = Assignments_all();
  const exercises = Exercises_all();
  const teams = Teams_all().slice().sort(function(a, b) {
    return String(a.name).localeCompare(String(b.name), 'he');
  });

  const trainees = users.filter(function(u) { return Roles_isTrainee(u.role); });
  const mpUsers = users.filter(_Statistics_isMpUser);
  const magadUsers = users.filter(_Statistics_isMagadUser);

  const mpIds = mpUsers.map(function(u) { return u.id; });
  const magadIds = magadUsers.map(function(u) { return u.id; });

  const mp = _Statistics_cohortMetricsWithRole(mpIds, assigns, _Statistics_isMpAssignment);
  const magad = _Statistics_cohortMetricsWithRole(magadIds, assigns, _Statistics_isMagadAssignment);

  const assignsByUser = {};
  assigns.forEach(function(a) {
    if (!assignsByUser[a.user_id]) assignsByUser[a.user_id] = [];
    assignsByUser[a.user_id].push(a);
  });

  const teamStats = teams.map(function(team) {
    const members = trainees.filter(function(u) { return String(u.team_id) === String(team.id); });
    const counts = members.map(function(m) {
      return (assignsByUser[m.id] || []).length;
    });
    const sum = counts.reduce(function(s, n) { return s + n; }, 0);
    const avg = members.length ? _Statistics_round1(sum / members.length) : 0;
    const max = counts.length ? Math.max.apply(null, counts) : 0;
    const min = counts.length ? Math.min.apply(null, counts) : 0;
    let mpRole = 0;
    let otherRole = 0;
    members.forEach(function(m) {
      (assignsByUser[m.id] || []).forEach(function(a) {
        if (_Statistics_isMpAssignment(a.responsibility)) mpRole++;
        else otherRole++;
      });
    });
    return {
      id: team.id,
      name: team.name,
      trainees: members.length,
      avg: avg,
      max: max,
      min: min,
      mpRole: mpRole,
      otherRole: otherRole
    };
  });

  const traineeRows = trainees.map(function(u) {
    const team = Teams_get(u.team_id);
    const count = (assignsByUser[u.id] || []).length;
    return {
      id: u.id,
      name: u.name,
      teamId: u.team_id || '',
      teamName: team ? team.name : '—',
      rank: u.target_role || '—',
      exercises: count,
      isMp: true,
      isMagad: false
    };
  }).sort(function(a, b) { return b.exercises - a.exercises; });

  const commanderRows = users.filter(_Statistics_isMagadUser).map(function(u) {
    const team = Teams_get(u.team_id);
    const count = (assignsByUser[u.id] || []).length;
    return {
      id: u.id,
      name: u.name,
      teamId: u.team_id || '',
      teamName: team ? team.name : '—',
      rank: Roles_label(u.role),
      exercises: count,
      isMp: false,
      isMagad: true
    };
  }).sort(function(a, b) { return b.exercises - a.exercises; });

  const exById = {};
  exercises.forEach(function(ex) { exById[ex.id] = ex; });

  const typeMap = {};
  exercises.forEach(function(ex) {
    const key = _Statistics_exerciseTypeKey(ex);
    if (!typeMap[key]) {
      typeMap[key] = { type: key, exerciseCount: 0, assignmentCount: 0, exerciseIds: {} };
    }
    typeMap[key].exerciseCount++;
    typeMap[key].exerciseIds[ex.id] = true;
  });
  assigns.forEach(function(a) {
    const ex = exById[a.exercise_id];
    if (!ex) return;
    const key = _Statistics_exerciseTypeKey(ex);
    if (!typeMap[key]) {
      typeMap[key] = { type: key, exerciseCount: 0, assignmentCount: 0, exerciseIds: {} };
    }
    typeMap[key].assignmentCount++;
  });

  const exerciseTypes = Object.keys(typeMap).map(function(k) {
    return {
      type: typeMap[k].type,
      exerciseCount: typeMap[k].exerciseCount,
      assignmentCount: typeMap[k].assignmentCount
    };
  }).sort(function(a, b) { return b.assignmentCount - a.assignmentCount; });

  const avgExercisesPerTrainee = trainees.length
    ? _Statistics_round1(
      trainees.reduce(function(s, u) {
        return s + (assignsByUser[u.id] || []).length;
      }, 0) / trainees.length
    ) : 0;

  const userById = {};
  users.forEach(function(u) { userById[u.id] = u; });

  const assignmentsLite = assigns.map(function(a) {
    const u = userById[a.user_id];
    const ex = exById[a.exercise_id];
    return {
      exerciseId: a.exercise_id,
      type: _Statistics_exerciseTypeKey(ex),
      teamId: u ? String(u.team_id || '') : '',
      isMp: !!(u && _Statistics_isMpUser(u)),
      isMagad: !!(u && _Statistics_isMagadUser(u))
    };
  });

  return {
    mp: mp,
    magad: magad,
    teams: teams.map(function(t) { return { id: t.id, name: t.name }; }),
    teamStats: teamStats,
    trainees: traineeRows,
    commanders: commanderRows,
    exerciseTypes: exerciseTypes,
    assignmentsLite: assignmentsLite,
    avgExercisesPerTrainee: avgExercisesPerTrainee
  };
}
