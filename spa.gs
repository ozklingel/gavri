// spa.gs — Single-page API (fixed URL, no query-string navigation)

function apiRenderPage(sid, page, paramsJson) {
  const p = _spaMergeParams(sid, paramsJson);
  const pg = String(page || 'login').trim();
  if (pg !== 'login') {
    _cacheEnsureFullWarm();
    const cached = _htmlCacheGet(sid, pg, p);
    if (cached) {
      return _spaEnsureWrap(cached);
    }
  } else {
    // login — אל תחמם הכול
  }
  try {
    const result = _spaEnsureWrap(_spaDispatchPage(pg, p));
    if (pg !== 'login') _htmlCachePut(sid, pg, p, result);
    return result;
  } catch (err) {
    return _spaEnsureWrap(Views_error(err && err.message ? err.message : String(err), p));
  }
}

// Direct update for participant row save (explicit params — reliable in HtmlService iframe)
function apiUpdateExerciseTimes(sid, exerciseId, startDate, startTime, endDate, endTime, week, shiftProcedure, shiftAnchor) {
  const p = {
    sid: String(sid || '').trim(),
    id: String(exerciseId || '').trim(),
    start_date: String(startDate || '').trim(),
    start_time: startTime == null ? '' : String(startTime),
    end_date: String(endDate || '').trim(),
    end_time: endTime == null ? '' : String(endTime),
    week: week == null ? '0' : String(week),
    shift_procedure: shiftProcedure ? '1' : '',
    shift_anchor: shiftAnchor === 'end' ? 'end' : 'start',
    timelineInline: true
  };
  try {
    const result = _spaEnsureWrap(Exercises_updateTimes(p));
    _htmlCacheBump();
    return result;
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
    tutor: tutor == null ? '' : String(tutor),
    inline: true
  };
  try {
    const result = _spaEnsureWrap(Assignments_update(p));
    _htmlCacheBump();
    return result;
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function apiRunAction(sid, action, paramsJson) {
  const p = _spaMergeParams(sid, paramsJson);
  p.action = action;
  try {
    const result = _spaEnsureWrap(_spaDispatchAction(action, p));
    // כל כתיבה מבטלת קאש HTML בשרת (הגיליונות כבר write-through ב-_cacheInvalidate)
    _htmlCacheBump();
    return result;
  } catch (err) {
    return _spaEnsureWrap(Views_error(err && err.message ? err.message : String(err), p));
  }
}

/**
 * Step 1 — מינימום לדשבורד (טאב search).
 * מחמם רק גיליונות הדשבורד ומחזיר HTML מוכן לקאש לקוח.
 */
function getDashboardData(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, error: 'missing sid' };

  let user;
  try {
    user = Auth_current({ sid: s });
  } catch (e0) {
    return { ok: false, error: e0 && e0.message ? e0.message : String(e0) };
  }
  if (!user) return { ok: false, error: 'not logged in' };

  const dashSheets = (typeof DB_DASHBOARD_SHEETS !== 'undefined' && DB_DASHBOARD_SHEETS.length)
    ? DB_DASHBOARD_SHEETS
    : ['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'Series'];
  _cacheForceReloadSheets(dashSheets);

  let dash;
  try {
    dash = _spaEnsureWrap(Views_dashboard({ sid: s, tab: 'search' }));
  } catch (e1) {
    return { ok: false, error: e1 && e1.message ? e1.message : String(e1) };
  }
  if (!dash || dash.body == null) {
    return { ok: false, error: 'dashboard render failed', pages: [] };
  }

  const page = {
    page: 'dashboard',
    params: { tab: 'search' },
    body: dash.body,
    title: dash.title || 'מסך הבית'
  };

  return {
    ok: true,
    stage: 'dashboard',
    sheets: dashSheets.length,
    pages: [page],
    dashboard: page
  };
}

/** תאימות לאחור */
function apiReadyDashboard(sid) {
  return getDashboardData(sid);
}

/**
 * Step 3 — נתוני עמוד תרגילים (ברקע, אחרי הצגת דשבורד).
 */
function getExercisesData(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, pages: [] };

  let user;
  try {
    user = Auth_current({ sid: s });
  } catch (e0) {
    return { ok: false, pages: [] };
  }
  if (!user) return { ok: false, pages: [] };

  // בקשה חדשה — טוענים מ-Script Cache שכבר מולא ב-getDashboardData
  const dashSheets = (typeof DB_DASHBOARD_SHEETS !== 'undefined' && DB_DASHBOARD_SHEETS.length)
    ? DB_DASHBOARD_SHEETS
    : ['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'Series'];
  _cacheWarmSheetsIfNeeded(dashSheets);

  const pages = [];
  function pushPage(page, params) {
    try {
      const p = Object.assign({}, params || {}, { sid: s });
      const result = _spaEnsureWrap(_spaDispatchPage(page, p));
      if (result && result.body != null) {
        pages.push({
          page: page,
          params: params || {},
          body: result.body,
          title: result.title || ''
        });
      }
    } catch (err) {}
  }

  if (Roles_hasAdminAccess(user.role)) {
    pushPage('exercises', { tab: 'list' });
    pushPage('exercises', { tab: 'calendar' });
    pushPage('exercises', { tab: 'new' });
  }

  // טאבי דשבורד נוספים — שימושיים מיד אחרי הדשבורד הראשי
  pushPage('dashboard', { tab: 'exercise' });
  if (typeof _teamMatrixAllowedTeams === 'function' && _teamMatrixAllowedTeams(user).length) {
    pushPage('dashboard', { tab: 'team' });
  }
  if (Roles_hasAdminAccess(user.role)) {
    pushPage('dashboard', { tab: 'conflicts' });
  }

  return { ok: true, stage: 'exercises', pages: pages };
}

/**
 * Step 4 — שאר הגיליונות + שאר דפי האפליקציה (ברקע).
 */
function getRemainingAppData(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, pages: [] };

  let user;
  try {
    user = Auth_current({ sid: s });
  } catch (e0) {
    return { ok: false, pages: [] };
  }
  if (!user) return { ok: false, pages: [] };

  const dashSheets = (typeof DB_DASHBOARD_SHEETS !== 'undefined' && DB_DASHBOARD_SHEETS.length)
    ? DB_DASHBOARD_SHEETS
    : ['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'Series'];

  const rest = DB_FULL_CACHE_SHEETS.filter(function(name) {
    return dashSheets.indexOf(name) < 0;
  });
  if (rest.length) _cacheForceReloadSheets(rest);
  _cacheMarkWarmed();

  const pages = [];
  function pushPage(page, params) {
    try {
      const p = Object.assign({}, params || {}, { sid: s });
      const result = _spaEnsureWrap(_spaDispatchPage(page, p));
      if (result && result.body != null) {
        pages.push({
          page: page,
          params: params || {},
          body: result.body,
          title: result.title || ''
        });
      }
    } catch (err) {}
  }

  pushPage('homeConstraints', {});
  pushPage('fieldForces', {});
  pushPage('fireZones', {});
  if (Roles_hasTimelineAccess(user.role)) pushPage('timeline', {});

  if (Roles_hasAdminAccess(user.role)) {
    pushPage('assign', {});
    pushPage('users', { tab: 'users' });
    pushPage('users', { tab: 'teams' });
    pushPage('statistics', { section: 'kpi' });
    pushPage('statistics', { section: 'team' });
    pushPage('statistics', { section: 'compare' });
    pushPage('statistics', { section: 'trainees' });
    pushPage('statistics', { section: 'types' });
    pushPage('seriesArchive', {});
    pushPage('feedback', {});
    pushPage('teamMatrix', {});
    pushPage('exerciseMatrix', {});
  }

  return {
    ok: true,
    stage: 'remaining',
    sheets: rest.length,
    pages: pages,
    modules: ['drawer.panels']
  };
}

/** תאימות לאחור — מחזיר טאבי דשבורד נוספים + שאר גיליונות */
function apiWarmRestAfterDashboard(sid) {
  const ex = getExercisesData(sid);
  const rem = getRemainingAppData(sid);
  return {
    ok: true,
    pages: [].concat((ex && ex.pages) || [], (rem && rem.pages) || []),
    modules: (rem && rem.modules) || []
  };
}

/** רשימת דפים/טאבים לטעינה מלאה אחרי התחברות (לפי הרשאות). */
function apiPrefetchPlan(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, pages: [], modules: [] };
  let user;
  try {
    user = Auth_current({ sid: s });
  } catch (e1) {
    return { ok: false, pages: [], modules: [] };
  }
  if (!user) return { ok: false, pages: [], modules: [] };

  const pages = [
    { page: 'dashboard', params: { tab: 'search' } },
    { page: 'dashboard', params: { tab: 'exercise' } },
    { page: 'homeConstraints', params: {} },
    { page: 'fieldForces', params: {} },
    { page: 'fireZones', params: {} }
  ];

  if (typeof _teamMatrixAllowedTeams === 'function' && _teamMatrixAllowedTeams(user).length) {
    pages.push({ page: 'dashboard', params: { tab: 'team' } });
  }
  if (Roles_hasTimelineAccess(user.role)) {
    pages.push({ page: 'timeline', params: {} });
  }
  if (Roles_hasAdminAccess(user.role)) {
    pages.push(
      { page: 'dashboard', params: { tab: 'conflicts' } },
      { page: 'exercises', params: { tab: 'list' } },
      { page: 'exercises', params: { tab: 'calendar' } },
      { page: 'exercises', params: { tab: 'new' } },
      { page: 'assign', params: {} },
      { page: 'users', params: { tab: 'users' } },
      { page: 'users', params: { tab: 'teams' } },
      { page: 'statistics', params: { section: 'kpi' } },
      { page: 'statistics', params: { section: 'team' } },
      { page: 'statistics', params: { section: 'compare' } },
      { page: 'statistics', params: { section: 'trainees' } },
      { page: 'statistics', params: { section: 'types' } },
      { page: 'seriesArchive', params: {} },
      { page: 'feedback', params: {} },
      { page: 'teamMatrix', params: {} },
      { page: 'exerciseMatrix', params: {} }
    );
  }

  return {
    ok: true,
    pages: pages,
    modules: ['drawer.panels']
  };
}

/**
 * טעינת אצווה של דפים לקאש לקוח — חימום Sheets פעם אחת ואז רינדור מזיכרון.
 * pagesJson: [{ page, params }, ...]
 */
function apiPrefetchPages(sid, pagesJson) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, pages: [] };
  try {
    Auth_current({ sid: s });
  } catch (e1) {
    return { ok: false, pages: [] };
  }

  _cacheEnsureFullWarm();

  let list = [];
  try {
    list = JSON.parse(pagesJson || '[]');
  } catch (e2) {
    list = [];
  }
  if (!list || !list.length) return { ok: true, pages: [] };

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    const page = String(item.page || '').trim();
    if (!page || page === 'login') continue;
    const params = Object.assign({}, item.params || {});
    const p = Object.assign({}, params, { sid: s });
    try {
      const result = _spaEnsureWrap(_spaDispatchPage(page, p));
      if (result && result.body != null) {
        _htmlCachePut(s, page, p, result);
        out.push({
          page: page,
          params: params,
          body: result.body,
          title: result.title || ''
        });
      }
    } catch (err) {
      out.push({
        page: page,
        params: params,
        error: err && err.message ? err.message : String(err)
      });
    }
  }
  return { ok: true, pages: out };
}

function apiPrefetchModules(sid, modulesJson) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, modules: [] };
  try {
    Auth_current({ sid: s });
  } catch (e1) {
    return { ok: false, modules: [] };
  }
  _cacheEnsureFullWarm();

  let list = [];
  try {
    list = JSON.parse(modulesJson || '[]');
  } catch (e2) {
    list = [];
  }
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const moduleId = String(list[i] || '').trim();
    if (!moduleId) continue;
    try {
      const html = SpaModule_render(moduleId, { sid: s });
      out.push({ moduleId: moduleId, params: {}, html: html || '' });
    } catch (err) {
      out.push({
        moduleId: moduleId,
        params: {},
        error: err && err.message ? err.message : String(err)
      });
    }
  }
  return { ok: true, modules: out };
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
  if (String(page || 'login').trim() === 'login') return;
  _cacheEnsureFullWarm();
}

function _spaDispatchPage(page, p) {
  switch (page) {
    case 'login':     return Views_login(p);
    case 'dashboard': return Views_dashboard(p);
    case 'exercise':  return Views_exercise(p);
    case 'exercises': return Views_exercises(p);
    case 'seriesArchive': return Views_seriesArchive(p);
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
    case 'deleteArchivedSeries': return Series_deleteArchived(p);
    case 'editExercise':       return Exercises_edit(p);
    case 'duplicateExercise':  return Exercises_duplicate(p);
    case 'deleteExercise':     return Exercises_delete(p);
    case 'addDetail':          return Exercises_addDetail(p);
    case 'updateDetail':       return Exercises_updateDetail(p);
    case 'deleteDetail':       return Exercises_deleteDetail(p);
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
    case 'createUserFieldDef': return UserProfileFields_createDef(p);
    case 'deleteUserFieldDef': return UserProfileFields_deleteDef(p);
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
