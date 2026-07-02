// views_fire_zones.gs — שטחי אש pages

function _fireZoneFlagsForm(item) {
  item = item || {};
  return '<div class="form-row"><label class="form-label">סוגי תרגיל בשטח</label>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px">' +
    _checkboxRow('advancement', 'התקדמות', item.advancement) +
    _checkboxRow('attack', 'התקפה', item.attack) +
    _checkboxRow('defense', 'הגנה', item.defense) +
    _checkboxRow('dry_wet_day', 'יבש רטוב יום', item.dry_wet_day) +
    _checkboxRow('dry_wet_night', 'יבש רטוב לילה', item.dry_wet_night) +
    '</div></div>';
}

function Views_fireZones(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const isAdmin = Roles_hasAdminAccess(user.role);
  const items = FireZones_all();

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<h1 class="page-title" style="margin:0">🔥 שטחי אש</h1>' +
    _a('page=dashboard', '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div>';

  s += '<div class="grid-2" style="align-items:start">';

  s += '<div class="card"><div class="card-header"><div class="card-title">📋 רשימה (' + items.length + ')</div></div>';
  if (!items.length) {
    s += '<div class="empty">אין שטחי אש</div>';
  } else {
    s += '<div class="card-body" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr>' +
      '<th>שם</th><th>התקדמות</th><th>התקפה</th><th>הגנה</th><th>יבש רטוב יום</th><th>יבש רטוב לילה</th>' +
      (isAdmin ? '<th>פעולות</th>' : '') +
      '</tr></thead><tbody>';
    items.forEach(function(item) {
      s += '<tr>' +
        '<td><a href="#" data-spa-page="fireZone"' + _spaParamsAttr({ id: item.id }) +
          ' style="color:var(--blue);text-decoration:underline"><b>' + _esc(item.name) + '</b></a></td>' +
        '<td>' + _boolBadge(item.advancement) + '</td>' +
        '<td>' + _boolBadge(item.attack) + '</td>' +
        '<td>' + _boolBadge(item.defense) + '</td>' +
        '<td>' + _boolBadge(item.dry_wet_day) + '</td>' +
        '<td>' + _boolBadge(item.dry_wet_night) + '</td>';
      if (isAdmin) {
        s += '<td style="white-space:nowrap">' +
          _a('page=fireZone&id=' + encodeURIComponent(item.id), '✎', 'btn btn-ghost btn-sm') + ' ' +
          _confirmDelete('action=deleteFireZone&id=' + encodeURIComponent(item.id),
            'למחוק את ' + item.name + '?') +
          '</td>';
      }
      s += '</tr>';
    });
    s += '</tbody></table></div>';
  }
  s += '</div>';

  if (isAdmin) {
    s += '<div class="card"><div class="card-header"><div class="card-title">➕ שטח אש חדש</div></div><div class="card-body">' +
      _formOpen() +
      '<input type="hidden" name="action" value="createFireZone">' +
      '<div class="form-row"><label class="form-label">שם</label>' +
      _input('name', 'שם שטח אש', '', 'text', 'required') + '</div>' +
      _fireZoneFlagsForm() +
      _submitBtn('צור שטח אש', 'btn btn-primary btn-full') +
      '</form></div></div>';
  }

  s += '</div></div>';
  return _wrapPage(s, 'שטחי אש');
}

function Views_fireZone(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const isAdmin = Roles_hasAdminAccess(user.role);
  const id = String(p.id || '').trim();
  const item = FireZones_get(id);
  if (!item) return Views_error('הרשומה לא נמצאה.', p);

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">🔥 ' + _esc(item.name) + '</div>' +
    '<div style="display:flex;gap:6px">' +
    _a('page=fireZones', '← רשימה', 'btn btn-ghost btn-sm') +
    _a('page=dashboard', '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div></div>';

  s += '<div class="card" style="margin-bottom:14px"><div class="card-header"><span class="card-title">פרטים</span></div>' +
    '<div class="card-body"><table class="tbl"><tbody>' +
    '<tr><td style="width:160px;color:var(--muted)">מזהה</td><td class="mono">' + _esc(item.id) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">שם</td><td><b>' + _esc(item.name) + '</b></td></tr>' +
    '<tr><td style="color:var(--muted)">התקדמות</td><td>' + _boolBadge(item.advancement) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">התקפה</td><td>' + _boolBadge(item.attack) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">הגנה</td><td>' + _boolBadge(item.defense) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">יבש רטוב יום</td><td>' + _boolBadge(item.dry_wet_day) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">יבש רטוב לילה</td><td>' + _boolBadge(item.dry_wet_night) + '</td></tr>' +
    '</tbody></table></div></div>';

  if (isAdmin) {
    s += '<div class="card"><div class="card-header"><span class="card-title">✏ עריכה</span></div><div class="card-body">' +
      _formOpen() +
      '<input type="hidden" name="action" value="updateFireZone">' +
      '<input type="hidden" name="id" value="' + _esc(item.id) + '">' +
      '<div class="form-row"><label class="form-label">שם</label>' +
      _input('name', '', item.name, 'text', 'required') + '</div>' +
      _fireZoneFlagsForm(item) +
      _submitBtn('שמור שינויים', 'btn btn-primary') +
      '</form></div></div>';
  }

  s += '</div>';
  return _wrapPage(s, item.name + ' — שטח אש');
}
