// spa.gs — Single-page API (fixed URL, no query-string navigation)

function apiRenderPage(sid, page, paramsJson) {
  const p = _spaMergeParams(sid, paramsJson);
  const pg = String(page || 'login').trim();
  if (pg !== 'login') {
    const cached = _htmlCacheGet(sid, pg, p);
    if (cached) {
      return _spaEnsureWrap(cached);
    }
    _cacheWarmForPage(pg);
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
 * שלב 1 — משתמשים בלבד + דשבורד shell.
 * מציגים ללקוח מיד אחרי שלב זה; drawer נפתח עם תפריט (nav ב-HTML).
 */
function getDashboardData(sid) {
  const profile = { marks: {} };
  const t0 = Date.now();
  console.time('getDashboardData');

  const s = String(sid || '').trim();
  if (!s) return { ok: false, error: 'missing sid' };

  let user;
  try {
    console.time('getDashboardData:auth');
    user = Auth_current({ sid: s });
    console.timeEnd('getDashboardData:auth');
    profile.marks.authMs = Date.now() - t0;
  } catch (e0) {
    console.timeEnd('getDashboardData');
    return { ok: false, error: e0 && e0.message ? e0.message : String(e0) };
  }
  if (!user) {
    console.timeEnd('getDashboardData');
    return { ok: false, error: 'not logged in' };
  }

  const userSheets = (typeof DB_USER_BOOT_SHEETS !== 'undefined' && DB_USER_BOOT_SHEETS.length)
    ? DB_USER_BOOT_SHEETS
    : ['Users', 'Teams', 'UserFieldDefs', 'UserFieldValues'];

  const tBatch = Date.now();
  console.time('getDashboardData:sheets');
  _cacheWarmSheetsIfNeeded(userSheets);
  console.timeEnd('getDashboardData:sheets');
  profile.marks.sheetsMs = Date.now() - tBatch;

  const data = {
    userId: user.id,
    counts: {}
  };
  userSheets.forEach(function(name) {
    const cur = _rowsCache[name];
    data.counts[name] = cur && cur.data ? cur.data.length : 0;
  });
  if (typeof Users_all === 'function') {
    data.usersIndex = Users_all().map(function(u) {
      return { id: u.id, name: u.name, role: Roles_label(u.role) };
    });
  }

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

  let dash;
  const tRender = Date.now();
  try {
    console.time('getDashboardData:render');
    dash = _spaEnsureWrap(Views_dashboard({ sid: s, tab: 'search', light: true }));
    console.timeEnd('getDashboardData:render');
    profile.marks.renderMs = Date.now() - tRender;
  } catch (e1) {
    console.timeEnd('getDashboardData');
    return {
      ok: false,
      error: e1 && e1.message ? e1.message : String(e1),
      profile: profile
    };
  }
  if (!dash || dash.body == null) {
    console.timeEnd('getDashboardData');
    return { ok: false, error: 'dashboard render failed', pages: [], profile: profile };
  }

  const dashPage = {
    page: 'dashboard',
    params: { tab: 'search' },
    body: dash.body,
    title: dash.title || 'מסך הבית'
  };
  pages.unshift(dashPage);

  const modules = [];
  if (Roles_hasAdminAccess(user.role)) {
    pushPage('users', { tab: 'users' });
    pushPage('users', { tab: 'teams' });
    modules.push('users.tab.users', 'users.tab.teams');
  }

  profile.marks.totalMs = Date.now() - t0;
  console.timeEnd('getDashboardData');
  Logger.log('getDashboardData profile: ' + JSON.stringify(profile));

  return {
    ok: true,
    stage: 'users',
    sheets: userSheets.length,
    pages: pages,
    dashboard: dashPage,
    data: data,
    profile: profile,
    modules: modules
  };
}

/** תאימות לאחור */
function apiReadyDashboard(sid) {
  return getDashboardData(sid);
}

/**
 * שלב 2 — תרגילים (ברקע, אחרי הצגת דשבורד).
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

  const exSheets = (typeof DB_EXERCISES_BOOT_SHEETS !== 'undefined' && DB_EXERCISES_BOOT_SHEETS.length)
    ? DB_EXERCISES_BOOT_SHEETS
    : ['Exercises', 'ExerciseDetails', 'Series'];
  _cacheWarmSheetsIfNeeded(exSheets);

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

  pushPage('exercises', { tab: 'list' });
  pushPage('exercises', { tab: 'calendar' });
  if (Roles_hasAdminAccess(user.role)) {
    pushPage('exercises', { tab: 'new' });
  }

  const modules = ['dashboard.tab.exercise'];
  if (typeof _teamMatrixAllowedTeams === 'function' && _teamMatrixAllowedTeams(user).length) {
    modules.push('dashboard.tab.team');
  }
  if (Roles_hasAdminAccess(user.role)) {
    modules.push('dashboard.tab.conflicts');
  }

  return { ok: true, stage: 'exercises', pages: pages, modules: modules };
}

/**
 * שלב 3 — שיבוצים + drawer panels + שאר דפים (ברקע).
 */
function getAssignData(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, pages: [] };

  let user;
  try {
    user = Auth_current({ sid: s });
  } catch (e0) {
    return { ok: false, pages: [] };
  }
  if (!user) return { ok: false, pages: [] };

  const assignSheets = (typeof DB_ASSIGN_BOOT_SHEETS !== 'undefined' && DB_ASSIGN_BOOT_SHEETS.length)
    ? DB_ASSIGN_BOOT_SHEETS
    : ['Assignments', 'HomeConstraints', 'SystemLog'];
  _cacheWarmSheetsIfNeeded(assignSheets);

  const dashSheets = (typeof DB_DASHBOARD_SHEETS !== 'undefined' && DB_DASHBOARD_SHEETS.length)
    ? DB_DASHBOARD_SHEETS
    : ['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'Series'];
  const rest = DB_FULL_CACHE_SHEETS.filter(function(name) {
    return dashSheets.indexOf(name) < 0 &&
      assignSheets.indexOf(name) < 0 &&
      (typeof DB_USER_BOOT_SHEETS === 'undefined' || DB_USER_BOOT_SHEETS.indexOf(name) < 0) &&
      (typeof DB_EXERCISES_BOOT_SHEETS === 'undefined' || DB_EXERCISES_BOOT_SHEETS.indexOf(name) < 0);
  });
  if (rest.length) {
    console.time('getAssignData:restSheets');
    _readSheetsBatch(rest, { force: false });
    console.timeEnd('getAssignData:restSheets');
  }
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

  pushPage('assign', {});

  pushPage('homeConstraints', {});
  pushPage('fieldForces', {});
  pushPage('fireZones', {});
  pushPage('timeline', {});

  if (Roles_hasAdminAccess(user.role)) {
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
    stage: 'assign',
    sheets: assignSheets.length + rest.length,
    pages: pages,
    modules: ['drawer.panels']
  };
}

/** @deprecated — השתמש ב-getAssignData */
function getRemainingAppData(sid) {
  return getAssignData(sid);
}

function apiGetUsersIndex(sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, users: [] };
  try {
    Auth_current({ sid: s });
  } catch (e1) {
    return { ok: false, users: [] };
  }
  _cacheWarmSheetsIfNeeded(['Users']);
  return {
    ok: true,
    users: Users_all().map(function(u) {
      return { id: u.id, name: u.name, role: Roles_label(u.role) };
    })
  };
}

/** תאימות לאחור — מחזיר טאבי דשבורד + שיבוצים */
function apiWarmRestAfterDashboard(sid) {
  const ex = getExercisesData(sid);
  const asn = getAssignData(sid);
  return {
    ok: true,
    pages: [].concat((ex && ex.pages) || [], (asn && asn.pages) || []),
    modules: [].concat((ex && ex.modules) || [], (asn && asn.modules) || [])
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
    { page: 'fireZones', params: {} },
    { page: 'exercises', params: { tab: 'list' } },
    { page: 'exercises', params: { tab: 'calendar' } },
    { page: 'assign', params: {} },
    { page: 'timeline', params: {} }
  ];

  if (typeof _teamMatrixAllowedTeams === 'function' && _teamMatrixAllowedTeams(user).length) {
    pages.push({ page: 'dashboard', params: { tab: 'team' } });
  }
  if (Roles_hasAdminAccess(user.role)) {
    pages.push(
      { page: 'dashboard', params: { tab: 'conflicts' } },
      { page: 'exercises', params: { tab: 'new' } },
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

  _cacheWarmSheetsIfNeeded(DB_SESSION_SHEETS);

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
  _cacheWarmSheetsIfNeeded(DB_SESSION_SHEETS);

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
    case 'deleteExercisesBulk': return Exercises_deleteBulk(p);
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
    case 'autoAssignGroup':    return Assignments_autoAssignAll(p);
    case 'clearAllAssignments':return Assignments_clearAll(p);
    case 'clearAssignGroup':   return Assignments_clearAll(p);
    case 'createUser':         return Users_create(p);
    case 'importUsers':        return Users_importBulk(p);
    case 'deleteUser':         return Users_delete(p);
    case 'deleteUsersBulk':    return Users_deleteBulk(p);
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
