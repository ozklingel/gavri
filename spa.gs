// spa.gs — Single-page API (fixed URL, no query-string navigation)

function apiRenderPage(sid, page, paramsJson) {
  const p = _spaMergeParams(sid, paramsJson);
  _cacheWarmForPage(page || 'login', p);
  try {
    return _spaEnsureWrap(_spaDispatchPage(page || 'login', p));
  } catch (err) {
    return _spaEnsureWrap(Views_error(err && err.message ? err.message : String(err), p));
  }
}

// Direct update for participant row save (explicit params — reliable in HtmlService iframe)
function apiUpdateExerciseTimes(sid, exerciseId, startDate, startTime, endDate, endTime, week) {
  const p = {
    sid: String(sid || '').trim(),
    id: String(exerciseId || '').trim(),
    start_date: String(startDate || '').trim(),
    start_time: startTime == null ? '' : String(startTime),
    end_date: String(endDate || '').trim(),
    end_time: endTime == null ? '' : String(endTime),
    week: week == null ? '0' : String(week),
    timelineInline: true
  };
  try {
    return _spaEnsureWrap(Exercises_updateTimes(p));
  } catch (err) {
    return _spaEnsureWrap(Views_error(err && err.message ? err.message : String(err), p));
  }
}

function apiUpdateAssignment(sid, assignmentId, exerciseId, status, score, responsibility, tutor) {
  const p = {
    sid: String(sid || '').trim(),
    assignmentId: String(assignmentId || '').trim(),
    exerciseId: String(exerciseId || '').trim(),
    status: status == null ? '' : String(status),
    score: score == null ? '' : String(score),
    responsibility: responsibility == null ? '' : String(responsibility),
    tutor: tutor == null ? '' : String(tutor)
  };
  try {
    return _spaEnsureWrap(Assignments_update(p));
  } catch (err) {
    return _spaEnsureWrap(Views_error(err && err.message ? err.message : String(err), p));
  }
}

function apiRunAction(sid, action, paramsJson) {
  const p = _spaMergeParams(sid, paramsJson);
  p.action = action;
  try {
    return _spaEnsureWrap(_spaDispatchAction(action, p));
  } catch (err) {
    return _spaEnsureWrap(Views_error(err && err.message ? err.message : String(err), p));
  }
}

function _spaMergeParams(sid, paramsJson) {
  let extra = {};
  if (paramsJson) {
    try {
      extra = JSON.parse(paramsJson);
    } catch (e) {
      extra = {};
    }
  }
  const p = Object.assign({}, extra);
  if (sid) p.sid = String(sid).trim();
  return p;
}

function _spaEnsureWrap(result) {
  if (result && (result.body != null || result.ok === true)) return result;
  throw new Error('תגובת שרת לא תקינה');
}

function _cacheWarmForPage(page, p) {
  const pg = String(page || 'login').trim();
  if (pg === 'login') return;

  if (pg === 'dashboard') {
    const tab = String((p && p.tab) || 'search').trim();
    if (tab === 'team' || tab === 'exercise' || tab === 'conflicts') {
      _cacheWarmAllIfNeeded();
    } else if (tab === 'search') {
      _cacheWarmSheetsIfNeeded(['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments']);
    } else {
      _cacheWarmSheetsIfNeeded(DB_BOOT_SHEETS);
    }
    return;
  }

  if (pg === 'fieldForces' || pg === 'fieldForce') {
    _cacheWarmSheetsIfNeeded(['Users', 'FieldForces']);
    return;
  }
  if (pg === 'fireZones' || pg === 'fireZone') {
    _cacheWarmSheetsIfNeeded(['Users', 'FireZones']);
    return;
  }
  if (pg === 'homeConstraints') {
    _cacheWarmSheetsIfNeeded(['Users', 'HomeConstraints']);
    return;
  }
  if (pg === 'timeline') {
    _cacheWarmSheetsIfNeeded(['Users', 'Exercises', 'ExerciseDetails', 'TimelineBlocks', 'Assignments']);
    return;
  }
  if (pg === 'assign') {
    _cacheWarmSheetsIfNeeded(['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'HomeConstraints']);
    return;
  }
  if (pg === 'statistics') {
    _cacheWarmAllIfNeeded();
    return;
  }

  _cacheWarmAllIfNeeded();
}

function _spaDispatchPage(page, p) {
  switch (page) {
    case 'login':     return Views_login(p);
    case 'dashboard': return Views_dashboard(p);
    case 'exercise':  return Views_exercise(p);
    case 'exercises': return Views_exercises(p);
    case 'users':     return Views_users(p);
    case 'timeline':  return Views_timeline(p);
    case 'user':      return Views_user(p);
    case 'assign':    return Views_assign(p);
    case 'feedback':  return Views_feedback(p);
    case 'fieldForces': return Views_fieldForces(p);
    case 'fieldForce':  return Views_fieldForce(p);
    case 'fireZones':   return Views_fireZones(p);
    case 'fireZone':    return Views_fireZone(p);
    case 'teamMatrix':  return Views_teamMatrix(p);
    case 'exerciseMatrix': return Views_exerciseMatrix(p);
    case 'homeConstraints': return Views_homeConstraints(p);
    case 'statistics':    return Views_statistics(p);
    default:          return Views_login(p);
  }
}

function _spaDispatchAction(action, p) {
  switch (action) {
    case 'login':              return Auth_login(p);
    case 'verifyMfa':          return Auth_verifyMfa(p);
    case 'resendMfa':          return Auth_resendMfa(p);
    case 'logout':             return Auth_logout(p);
    case 'createExercise':     return Exercises_create(p);
    case 'buildSeries':        return Exercises_buildSeries(p);
    case 'editExercise':       return Exercises_edit(p);
    case 'duplicateExercise':  return Exercises_duplicate(p);
    case 'deleteExercise':     return Exercises_delete(p);
    case 'addDetail':          return Exercises_addDetail(p);
    case 'generateTimeline':   return Exercises_generateTimeline(p);
    case 'assign':             return Assignments_assign(p);
    case 'assignTeam':         return Assignments_assignTeamAction(p);
    case 'removeAssignment':   return Assignments_remove(p);
    case 'updateAssignment':   return Assignments_update(p);
    case 'complete':           return Assignments_complete(p);
    case 'autoAssignAll':      return Assignments_autoAssignAll(p);
    case 'clearAllAssignments':return Assignments_clearAll(p);
    case 'createUser':         return Users_create(p);
    case 'importUsers':        return Users_importBulk(p);
    case 'deleteUser':         return Users_delete(p);
    case 'updateRole':         return Users_updateRole(p);
    case 'updateProfile':      return Users_updateProfile(p);
    case 'createTeam':         return Teams_create(p);
    case 'autoSplitTeams':     return Teams_autoSplit(p);
    case 'renameTeam':         return Teams_rename(p);
    case 'deleteTeam':         return Teams_delete(p);
    case 'setCommander':       return Teams_setCommander(p);
    case 'addMember':          return Teams_addMember(p);
    case 'removeMember':       return Teams_removeMember(p);
    case 'saveFeedback':       return Assignments_saveFeedback(p);
    case 'updateExerciseTimes':return Exercises_updateTimes(p);
    case 'createFieldForce':   return FieldForces_create(p);
    case 'updateFieldForce':   return FieldForces_update(p);
    case 'deleteFieldForce':   return FieldForces_delete(p);
    case 'createFireZone':     return FireZones_create(p);
    case 'updateFireZone':     return FireZones_update(p);
    case 'deleteFireZone':     return FireZones_delete(p);
    case 'createHomeConstraint':  return HomeConstraints_create(p);
    case 'approveHomeConstraint': return HomeConstraints_approve(p);
    case 'rejectHomeConstraint':  return HomeConstraints_reject(p);
    case 'createTimelineBlock':   return TimelineBlocks_create(p);
    case 'deleteTimelineBlock':   return TimelineBlocks_delete(p);
    default:
      throw new Error('פעולה לא מוכרת: ' + action);
  }
}
