// views_series_archive.gs — admin browse of archived series

function Views_seriesArchive(p) {
  const user = Auth_requireRole(p, ['admin']);
  const sid = user.id;
  const seriesId = String(p.seriesId || p.id || '').trim();
  if (seriesId) return _viewsSeriesArchiveDetail(user, sid, p, seriesId);
  return _viewsSeriesArchiveList(user, sid, p);
}

function _viewsSeriesArchiveList(user, sid, p) {
  const active = Series_getActiveRow();
  const archived = Series_archivedList();

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  s += '<h1 class="page-title" style="margin:0">🗄 ארכיון סדרות</h1>';
  s += _a('page=exercises', '← חזרה לתרגילים', 'btn btn-ghost btn-sm');
  s += '</div>';

  s += '<p class="rules-muted" style="font-size:12px;margin:0 0 14px">' +
    'סדרות בארכיון נשמרות במלואן (תרגילים, שיבוצים, נוה״ק). רק הסדרה הפעילה מוצגת לשאר המערכת.</p>';

  if (active) {
    s += '<div class="card" style="margin-bottom:14px;border-color:var(--green2)">';
    s += '<div class="card-header"><div class="card-title">✅ סדרה פעילה (נוכחית)</div></div>';
    s += '<div class="card-body">';
    s += '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">';
    s += '<div><span class="rules-muted">שם</span><br><b>' + _esc(active.label || active.id) + '</b></div>';
    s += '<div><span class="rules-muted">טווח</span><br><b>' +
      _esc(active.start_date || '—') + ' — ' + _esc(active.end_date || '—') + '</b></div>';
    s += '<div><span class="rules-muted">תרגילים</span><br><b>' + (active.exercise_count || 0) + '</b></div>';
    s += '<div><span class="rules-muted">שיבוצים</span><br><b>' + (active.assignment_count || 0) + '</b></div>';
    s += '</div>';
    s += '<div style="margin-top:10px">' +
      _a('page=exercises', 'פתח בניהול תרגילים', 'btn btn-primary btn-sm') + '</div>';
    s += '</div></div>';
  }

  s += '<div class="card"><div class="card-header"><div class="card-title">📦 סדרות בארכיון</div></div>';
  if (!archived.length) {
    s += '<div class="empty">אין עדיין סדרות בארכיון</div>';
  } else {
    s += '<table class="tbl"><thead><tr>' +
      '<th>שם</th><th>טווח</th><th>תרגילים</th><th>שיבוצים</th><th>נוה״ק</th><th>נוצר</th>' +
      '<th style="text-align:left">פעולות</th></tr></thead><tbody>';
    archived.forEach(function(row) {
      s += '<tr>' +
        '<td><b>' + _esc(row.label || row.id) + '</b><div class="mono" style="font-size:10px;opacity:0.6">' +
          _esc(row.id) + '</div></td>' +
        '<td>' + _esc(row.start_date || '—') + '<br><span class="rules-muted">→ ' + _esc(row.end_date || '—') + '</span></td>' +
        '<td style="text-align:center">' + (row.exercise_count || 0) + '</td>' +
        '<td style="text-align:center">' + (row.assignment_count || 0) + '</td>' +
        '<td style="text-align:center">' + (row.detail_count || 0) + '</td>' +
        '<td>' + _esc(Series_formatCreatedAt(row.created_at)) + '</td>' +
        '<td style="text-align:left">' +
          _a('page=seriesArchive&seriesId=' + encodeURIComponent(row.id), '👁 צפה', 'btn btn-primary btn-sm') +
        '</td></tr>';
    });
    s += '</tbody></table>';
  }
  s += '</div>';

  s += '<div class="card" style="margin-top:14px"><div class="card-header"><div class="card-title">📜 יומן מערכת (אחרון)</div></div>';
  s += '<div class="card-body" style="padding:0">';
  s += _systemLogPreviewHtml(12);
  s += '</div></div>';

  s += '</div>';
  return _wrapPage(s, 'ארכיון סדרות');
}

function _viewsSeriesArchiveDetail(user, sid, p, seriesId) {
  const series = Series_get(seriesId);
  if (!series) return Views_error('הסדרה לא נמצאה.', p);
  Series_updateCounts(seriesId);
  const fresh = Series_get(seriesId) || series;
  const exercises = Exercises_bySeriesId(seriesId);
  const mpCounts = {};
  Assignments_all(true).forEach(function(a) {
    if (String(a.exercise_id)) {
      mpCounts[a.exercise_id] = mpCounts[a.exercise_id] || 0;
      if (Assignments_isMpRole(a.responsibility)) mpCounts[a.exercise_id]++;
    }
  });

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  s += '<h1 class="page-title" style="margin:0">🗄 ' + _esc(fresh.label || fresh.id) + '</h1>';
  s += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  s += _a('page=seriesArchive', '← חזרה לארכיון', 'btn btn-ghost btn-sm');
  s += '</div></div>';

  s += '<div class="card" style="margin-bottom:14px">';
  s += '<div class="card-body" style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px">';
  s += '<div><span class="rules-muted">מזהה</span><br><span class="mono">' + _esc(fresh.id) + '</span></div>';
  s += '<div><span class="rules-muted">סטטוס</span><br>' +
    _badge(fresh.status === 'active' ? 'פעילה' : 'בארכיון', fresh.status === 'active' ? 'green' : 'muted') + '</div>';
  s += '<div><span class="rules-muted">טווח</span><br><b>' +
    _esc(fresh.start_date || '—') + ' — ' + _esc(fresh.end_date || '—') + '</b></div>';
  s += '<div><span class="rules-muted">נוצר</span><br>' + _esc(Series_formatCreatedAt(fresh.created_at)) + '</div>';
  s += '<div><span class="rules-muted">תרגילים / שיבוצים / נוה״ק</span><br><b>' +
    (fresh.exercise_count || 0) + ' / ' + (fresh.assignment_count || 0) + ' / ' + (fresh.detail_count || 0) + '</b></div>';
  s += '</div></div>';

  s += '<div class="card"><div class="card-header"><div class="card-title">📋 תרגילים בסדרה (' + exercises.length + ')</div></div>';
  if (!exercises.length) {
    s += '<div class="empty">אין תרגילים בסדרה זו</div>';
  } else {
    s += '<table class="tbl"><thead><tr>' +
      '<th>שם</th><th>סוג</th><th>מפים</th><th>התחלה</th><th>סיום</th>' +
      '<th style="text-align:left">פעולות</th></tr></thead><tbody>';
    exercises.forEach(function(e) {
      const mpN = mpCounts[e.id] || 0;
      s += '<tr>' +
        '<td><div class="ex-title">' + _esc(e.title) + '</div>' +
          '<div class="mono" style="font-size:10px;opacity:0.6">' + _esc(e.id) + '</div></td>' +
        '<td>' + (e.exercise_type ? _badge(e.exercise_type, 'muted') : '—') + '</td>' +
        '<td style="text-align:center">' + (mpN ? _badge(String(mpN), 'green') : '0') + '</td>' +
        '<td>' + _esc(e.start_date || '—') + '</td>' +
        '<td>' + _esc(e.end_date || '—') + '</td>' +
        '<td style="text-align:left">' +
          _a('page=exercise&id=' + encodeURIComponent(e.id) + '&archive=1', '👁 צפה', 'btn btn-ghost btn-sm') +
        '</td></tr>';
    });
    s += '</tbody></table>';
  }
  s += '</div></div>';

  return _wrapPage(s, 'ארכיון — ' + (fresh.label || fresh.id));
}

function _systemLogPreviewHtml(limit) {
  const rows = SystemLog_all(limit);
  if (!rows.length) {
    return '<div class="empty" style="padding:16px">אין רשומות ביומן</div>';
  }
  let s = '<table class="tbl" style="font-size:11px"><thead><tr>' +
    '<th>זמן</th><th>פעולה</th><th>ישות</th><th>פרטים</th></tr></thead><tbody>';
  rows.forEach(function(row) {
    const details = row.details && row.details.label
      ? String(row.details.label)
      : (row.details && row.details.counts
        ? JSON.stringify(row.details.counts)
        : '');
    s += '<tr>' +
      '<td class="mono" style="white-space:nowrap">' + _esc(Series_formatCreatedAt(row.timestamp)) + '</td>' +
      '<td>' + _esc(row.action || '') + '</td>' +
      '<td class="mono">' + _esc(row.entity_id || '') + '</td>' +
      '<td class="rules-muted">' + _esc(details) + '</td></tr>';
  });
  s += '</tbody></table>';
  s += '<p class="rules-muted" style="font-size:11px;margin:8px 14px 12px">ניתן לראות את כל הרשומות גם בגיליון <b>SystemLog</b> ב-Google Sheets.</p>';
  return s;
}
