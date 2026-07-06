// spa_modules.gs — lazy HTML fragments (legacy module slots on GAS)

function apiLoadModule(sid, moduleId, paramsJson) {
  _cacheFlush();
  const p = _spaMergeParams(sid, paramsJson);
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
      return '<div class="dashboard-tab-panel team-matrix-page">' +
        _teamMatrixEmbedHtml(user, p) + '</div>';

    case 'dashboard.tab.exercise':
      return '<div class="dashboard-tab-panel ex-matrix-page">' +
        _exerciseMatrixEmbedHtml(user, p) + '</div>';

    case 'dashboard.tab.conflicts':
      return '<div class="dashboard-tab-panel">' + _dashboardConflictsTabHtml(sid) + '</div>';

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
      return _exercisesSidebarModuleHtml(user, sid);

    case 'statistics.main':
      return _adminStatisticsContent(sid);

    default:
      throw new Error('רכיב לא מוכר: ' + moduleId);
  }
}

function _dashboardTabSearchModule(user, p) {
  const searchUserId = String((p && p.searchUserId) || '').trim();
  let s = '<div class="dashboard-tab-panel dashboard-tab-search">';
  if (searchUserId) {
    s += _dashboardUserExerciseResults(user, searchUserId);
  } else {
    s += '<p style="font-size:12px;color:var(--muted);margin:8px 0 0">' +
      'הקלד שם או מספר אישי בשורת החיפוש למעלה.</p>';
  }
  s += '</div>';
  return s;
}
