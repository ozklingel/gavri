// views_statistics.gs — סטטיסטיקות סגל

function _adminStatisticsContent(sid) {
  const corpsStats = _dashboardCorpsAssignedCounts();
  let s = '<p style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:12px">' +
    'סך ההקצאות — לפי שיוך חיילי</p>';
  s += _dashboardCorpsStatsHtml(corpsStats, false);
  s += _assignmentConflictsDashboardWidget();
  return s;
}

function Views_statistics(p) {
  const user = Auth_current(p);
  if (!user) {
    return Views_login({ error: 'נדרשת התחברות.' });
  }
  if (!Roles_isAdmin(user.role)) {
    return Views_error('אין הרשאה לצפות בדף זה.', p);
  }

  const sid = user.id;
  const sidQ = encodeURIComponent(sid);

  let s = _topbar(user, sid);
  s += '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  s += '<h1 class="page-title" style="margin:0">📊 סטטיסטיקות — סגל</h1>';
  s += _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm');
  s += '</div>';
  s += _adminStatisticsContent(sid);
  s += '</div>';

  return _wrapPage(s, 'סטטיסטיקות');
}
