// spa_modules.gs — lazy HTML fragments (legacy module slots on GAS)

function apiLoadModule(sid, moduleId, paramsJson) {
  const p = _spaMergeParams(sid, paramsJson);
  _cacheWarmForModule(String(moduleId || '').trim(), p);
  try {
    const html = SpaModule_render(String(moduleId || '').trim(), p);
    return { ok: true, html: html || '' };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
      html: '<div class="flash flash-error">⚠ ' +
        _esc(err && err.message ? err.message : String(err)) + '</div>'
    };
  }
}

function SpaModule_render(moduleId, p) {
  const user = Auth_current(p);
  if (!user) throw new Error('נדרשת התחברות.');
  const sid = user.id;

  switch (moduleId) {
    case 'drawer.panels':
      return _drawerDashboardPanels(user, sid);

    case 'dashboard.tab.search':
      return _dashboardTabSearchModule(user, p);

    case 'dashboard.tab.team':
      return '<div class="team-matrix-page">' + _teamMatrixEmbedHtml(user, p) + '</div>';

    case 'dashboard.tab.exercise':
      return '<div class="ex-matrix-page">' + _exerciseMatrixEmbedHtml(user, p) + '</div>';

    case 'dashboard.tab.conflicts':
      return _dashboardConflictsTabHtml(sid);

    case 'users.tab.users':
      return _usersTab(sid);

    case 'users.tab.teams':
      return _teamsTab(sid);

    case 'statistics.section.kpi':
      return _statisticsSectionKpi(sid);

    case 'statistics.section.team':
      return _statisticsSectionTeam(sid);

    case 'statistics.section.compare':
      return _statisticsSectionCompare(sid);

    case 'statistics.section.trainees':
      return _statisticsSectionTrainees(sid);

    case 'statistics.section.types':
      return _statisticsSectionTypes(sid);

    case 'assign.section.conflicts':
      return _assignConflictsSectionHtml(sid);

    case 'assign.section.least':
      return _assignLeastSectionHtml();

    case 'exercise.panel.edit':
      return _exerciseEditPanelHtml(p);

    case 'exercise.panel.assign':
      return _exerciseAssignPanelHtml(p);

    case 'timeline.main':
      if (typeof _timelineMainModuleHtml === 'function') {
        return _timelineMainModuleHtml(user, p);
      }
      throw new Error('עדכן views_timeline.gs מהפרויקט המקומי.');

    case 'assign.main':
      return _assignMainModuleHtml(user, sid);

    case 'exercises.list':
      return _exercisesListModuleHtml(user, sid);

    case 'exercises.sidebar':
      return _exercisesSidebarModuleHtml(user, sid, _parseOpenSections(p));

    case 'statistics.main':
      return _adminStatisticsContent(sid);

    default:
      throw new Error('רכיב לא מוכר: ' + moduleId);
  }
}

function _dashboardTabSearchModule(user, p) {
  const searchUserId = _dashboardResolveSearchUserId(p, user, 'search');
  if (searchUserId) {
    return _dashboardUserExerciseResults(user, searchUserId);
  }
  return '<p style="font-size:12px;color:var(--muted);margin:8px 0 0">' +
    'הקלד שם או מספר אישי בשורת החיפוש למעלה.</p>';
}

function _cacheWarmForModule(moduleId, p) {
  const id = String(moduleId || '').trim();
  if (!id) return;

  if (id === 'drawer.panels') {
    _cacheWarmSheetsIfNeeded(['Users', 'Teams', 'Assignments', 'HomeConstraints']);
    return;
  }
  if (id.indexOf('dashboard.tab.') === 0) {
    const tab = id.replace('dashboard.tab.', '');
    if (tab === 'conflicts') {
      _cacheWarmSheetsIfNeeded(['Users', 'Exercises', 'Assignments']);
    } else {
      _cacheWarmSheetsIfNeeded(DB_SESSION_SHEETS);
    }
    return;
  }
  if (id.indexOf('users.tab.') === 0) {
    _cacheWarmSheetsIfNeeded(['Users', 'Teams']);
    return;
  }
  if (id.indexOf('statistics.') === 0 || id === 'statistics.main') {
    _cacheWarmSheetsIfNeeded(['Users', 'Teams', 'Exercises', 'Assignments']);
    return;
  }
  if (id.indexOf('assign.') === 0 || id === 'assign.main') {
    _cacheWarmSheetsIfNeeded(['Users', 'Teams', 'Exercises', 'ExerciseDetails', 'Assignments', 'HomeConstraints']);
    return;
  }
  if (id.indexOf('exercise.panel.') === 0) {
    _cacheWarmSheetsIfNeeded(['Users', 'Exercises', 'ExerciseDetails', 'Assignments', 'FieldForces', 'FireZones']);
    return;
  }
  if (id === 'timeline.main') {
    _cacheWarmTimelineSheets();
    return;
  }
  if (id === 'exercises.list' || id === 'exercises.sidebar') {
    _cacheWarmSheetsIfNeeded(['Users', 'Exercises', 'ExerciseDetails', 'FieldForces', 'FireZones']);
    return;
  }

  _cacheWarmSheetsIfNeeded(DB_SESSION_SHEETS);
}
