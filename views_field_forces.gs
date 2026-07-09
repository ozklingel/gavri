// views_field_forces.gs — כוחות בשטח pages

function Views_fieldForces(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const isAdmin = Roles_hasAdminAccess(user.role);
  const openSet = _parseOpenSections(p);
  const items = FieldForces_all();

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<h1 class="page-title" style="margin:0">⚔ כוחות בשטח</h1>' +
    '</div>';

  s += '<div class="card"><div class="card-header"><div class="card-title">📋 רשימה (' + items.length + ')</div></div>';
  if (!items.length) {
    s += '<div class="empty">אין כוחות בשטח</div>';
  } else {
    s += '<div class="card-body" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr>' +
      '<th>שם הכוח</th><th>תפקיד</th><th>שם מפקד</th><th>מקום מחנה</th><th>סוג כוח</th>' +
      (isAdmin ? '<th>פעולות</th>' : '') +
      '</tr></thead><tbody>';
    items.forEach(function(item) {
      s += '<tr>' +
        '<td><a href="#" data-spa-page="fieldForce"' + _spaParamsAttr({ id: item.id }) +
          ' style="color:var(--blue);text-decoration:underline"><b>' + _esc(item.force_name || item.role) + '</b></a></td>' +
        '<td>' + _esc(item.role) + '</td>' +
        '<td>' + _esc(item.commander_name) + '</td>' +
        '<td>' + _esc(item.camp_location) + '</td>' +
        '<td>' + (item.force_type ? _badge(item.force_type, 'muted') : '—') + '</td>';
      if (isAdmin) {
        s += '<td style="white-space:nowrap">' +
          _a('page=fieldForce&id=' + encodeURIComponent(item.id), '✎', 'btn btn-ghost btn-sm') + ' ' +
          _confirmDelete('action=deleteFieldForce&id=' + encodeURIComponent(item.id),
            'למחוק את ' + (item.force_name || item.role) + '?') +
          '</td>';
      }
      s += '</tr>';
    });
    s += '</tbody></table></div>';
  }
  s += '</div>';

  if (isAdmin) {
    const createHtml = '<div class="card"><div class="card-body">' +
      _formOpen() +
      '<input type="hidden" name="action" value="createFieldForce">' +
      '<div class="form-row"><label class="form-label">שם הכוח</label>' +
      _input('force_name', 'שם הכוח', '', 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">תפקיד</label>' +
      _input('role', 'תפקיד', '', 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">שם מפקד</label>' +
      _input('commander_name', 'שם מפקד', '', 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">מקום מחנה</label>' +
      _input('camp_location', 'מקום מחנה', '', 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">סוג כוח</label>' +
      _input('force_type', 'סוג כוח', '', 'text', 'required') + '</div>' +
      _submitBtn('צור כוח', 'btn btn-primary btn-full') +
      '</form></div></div>';
    s += '<div style="margin-top:12px">' +
      _expandablePanel('fieldForces', {}, 'new', '➕ כוח חדש', createHtml, openSet) +
      '</div>';
  }

  s += '</div>';
  return _wrapPage(s, 'כוחות בשטח');
}

function Views_fieldForce(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const isAdmin = Roles_hasAdminAccess(user.role);
  const id = String(p.id || '').trim();
  const item = FieldForces_get(id);
  if (!item) return Views_error('הרשומה לא נמצאה.', p);

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">⚔ ' + _esc(item.force_name || item.role) + '</div>' +
    '<div style="display:flex;gap:6px">' +
    _a('page=fieldForces', '← רשימה', 'btn btn-ghost btn-sm') +
    '</div></div>';

  s += '<div class="card" style="margin-bottom:14px"><div class="card-header"><span class="card-title">פרטים</span></div>' +
    '<div class="card-body"><table class="tbl"><tbody>' +
    '<tr><td style="width:140px;color:var(--muted)">מזהה</td><td class="mono">' + _esc(item.id) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">שם הכוח</td><td><b>' + _esc(item.force_name) + '</b></td></tr>' +
    '<tr><td style="color:var(--muted)">תפקיד</td><td>' + _esc(item.role) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">שם מפקד</td><td>' + _esc(item.commander_name) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">מקום מחנה</td><td>' + _esc(item.camp_location) + '</td></tr>' +
    '<tr><td style="color:var(--muted)">סוג כוח</td><td>' + _esc(item.force_type) + '</td></tr>' +
    '</tbody></table></div></div>';

  if (isAdmin) {
    s += '<div class="card"><div class="card-header"><span class="card-title">✏ עריכה</span></div><div class="card-body">' +
      _formOpen() +
      '<input type="hidden" name="action" value="updateFieldForce">' +
      '<input type="hidden" name="id" value="' + _esc(item.id) + '">' +
      '<div class="form-row"><label class="form-label">שם הכוח</label>' +
      _input('force_name', '', item.force_name, 'text', 'required') + '</div>' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">תפקיד</label>' +
      _input('role', '', item.role, 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">שם מפקד</label>' +
      _input('commander_name', '', item.commander_name, 'text', 'required') + '</div>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">מקום מחנה</label>' +
      _input('camp_location', '', item.camp_location, 'text', 'required') + '</div>' +
      '<div class="form-row"><label class="form-label">סוג כוח</label>' +
      _input('force_type', '', item.force_type, 'text', 'required') + '</div>' +
      '</div>' +
      _submitBtn('שמור שינויים', 'btn btn-primary') +
      '</form></div></div>';
  }

  s += '</div>';
  return _wrapPage(s, (item.force_name || item.role) + ' — כוח בשטח');
}
