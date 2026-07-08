// views_home_constraints.gs — אילוצי זמן בית

function _homeConstraintStatusBadge(status) {
  if (status === 'approved') return _badge('✓ אושר', 'green');
  if (status === 'rejected') return _badge('✗ נדחה', 'muted');
  return _badge('◌ ממתין', 'yellow');
}

function _homeConstraintsRowActions(item, user, canApprove) {
  if (!canApprove) return '—';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    _formOpen('display:inline') +
    '<input type="hidden" name="action" value="approveHomeConstraint">' +
    '<input type="hidden" name="id" value="' + _esc(item.id) + '">' +
    _submitBtn('אשר', 'btn btn-primary btn-sm') +
    '</form>' +
    _formOpen('display:inline') +
    '<input type="hidden" name="action" value="rejectHomeConstraint">' +
    '<input type="hidden" name="id" value="' + _esc(item.id) + '">' +
    '<input type="text" name="rejection_note" class="form-input" placeholder="סיבת דחייה (אופציונלי)" style="width:140px;display:inline-block;vertical-align:middle">' +
    _submitBtn('דחה', 'btn btn-danger btn-sm') +
    '</form></div>';
}

function _homeConstraintsTableRows(items, user, opts) {
  opts = opts || {};
  let s = '';
  items.forEach(function(item) {
    const submitter = Users_get(item.user_id);
    const canApprove = HomeConstraints_canApprove(user, item);
    s += '<tr>' +
      '<td style="white-space:nowrap"><b>' + _esc(submitter ? submitter.name : item.user_id) + '</b>' +
      (submitter ? '<div style="font-size:11px;color:var(--muted)">' + _esc(Roles_label(submitter.role)) + '</div>' : '') +
      '</td>' +
      '<td style="font-size:12px;white-space:nowrap">' + _esc(HomeConstraints_formatRange(item)) + '</td>' +
      '<td>' + _esc(item.notes || '—') + '</td>';
    if (opts.showApprover) {
      s += '<td style="font-size:12px">' + _esc(HomeConstraints_supervisorLabel(item)) + '</td>';
    }
    s += '<td>' + _homeConstraintStatusBadge(item.status) + '</td>';
    if (opts.showActions) {
      s += '<td>' + _homeConstraintsRowActions(item, user, canApprove) + '</td>';
    }
    s += '</tr>';
  });
  return s;
}

function _homeConstraintsSubmitForm(approverHint) {
  let tail = _submitBtn('שלח לאישור', 'btn btn-primary btn-full') + '</form>';
  if (approverHint) {
    tail = _submitBtn('שלח לאישור', 'btn btn-primary btn-full') +
      '<p style="font-size:11px;color:var(--muted);margin:10px 0 0">' + _esc(approverHint) + '</p></form>';
  }
  return '<div class="card"><div class="card-header"><div class="card-title">➕ בקשת אילוץ יציאה הביתה</div></div>' +
    '<div class="card-body">' +
    '<p style="font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5">' +
    'הגש טווח זמן שבו אינך זמין לתרגילים. הבקשה תועבר לאישור הרמה הממונה עליך.</p>' +
    _formOpen() +
    '<input type="hidden" name="action" value="createHomeConstraint">' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">תאריך יציאה הביתה</label>' +
    _dateInput('start_date', '') + '</div>' +
    '<div class="form-row"><label class="form-label">שעת יציאה</label>' +
    _input('start_time', '', '', 'time') + '</div>' +
    '</div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">תאריך חזרה</label>' +
    _dateInput('end_date', '') + '</div>' +
    '<div class="form-row"><label class="form-label">שעת חזרה</label>' +
    _input('end_time', '', '', 'time') + '</div>' +
    '</div>' +
    '<div class="form-row"><label class="form-label">הערות</label>' +
    _input('notes', 'סיבה / פירוט (אופציונלי)', '', 'text') + '</div>' +
    tail + '</div></div>';
}

function Views_homeConstraints(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  const sid = user.id;
  const openSet = _parseOpenSections(p);

  const myItems = HomeConstraints_byUser(user.id).slice().reverse();
  const pendingApproval = HomeConstraints_pendingForApprover(user);
  const isAdmin = Roles_hasAdminAccess(user.role);
  const canSubmit = HomeConstraints_canSubmit(user);
  const tier = HomeConstraints_approvalTierForRole(user.role);
  let approverHint = '';
  if (canSubmit) {
    approverHint = tier === 'companyCommander'
      ? 'הבקשה תישלח למפקצ הצוות שלך.'
      : 'הבקשה תישלח לסגל.';
  }

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<h1 class="page-title" style="margin:0">🏠 אילוצי זמן בית</h1>' +
    _a('page=dashboard', '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div>';

  if (pendingApproval.length) {
    s += '<div class="card" style="margin-bottom:14px;border-color:var(--yellow)">' +
      '<div class="card-header"><div class="card-title">⏳ ממתינות לאישורך (' + pendingApproval.length + ')</div></div>' +
      '<div class="card-body" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr>' +
      '<th>מבקש</th><th>טווח</th><th>הערות</th><th>סטטוס</th><th>פעולות</th>' +
      '</tr></thead><tbody>' +
      _homeConstraintsTableRows(pendingApproval, user, { showActions: true }) +
      '</tbody></table></div></div>';
  }

  if (isAdmin) {
    const approved = HomeConstraints_allApproved().slice().reverse();
    s += '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-header"><div class="card-title">🚫 אילוצים מאושרים — חסימת שיבוץ (' + approved.length + ')</div></div>';
    if (!approved.length) {
      s += '<div class="empty">אין אילוצי בית מאושרים</div>';
    } else {
      s += '<p style="font-size:12px;color:var(--muted);margin:0;padding:12px 16px 0">' +
        'לא ניתן לשבץ משתמש לתרגיל החופף לטווח מאושר.</p>' +
        '<div class="card-body" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr>' +
        '<th>משתמש</th><th>טווח</th><th>הערות</th><th>סטטוס</th>' +
        '</tr></thead><tbody>' +
        _homeConstraintsTableRows(approved, user, {}) +
        '</tbody></table></div>';
    }
    s += '</div>';
  }

  s += '<div class="card" style="margin-bottom:14px"><div class="card-header"><div class="card-title">📋 הבקשות שלי (' + myItems.length + ')</div></div>';
  if (!myItems.length) {
    s += '<div class="empty">טרם הוגשו בקשות</div>';
  } else {
    s += '<div class="card-body" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr>' +
      '<th>טווח</th><th>הערות</th><th>ממתין אצל</th><th>סטטוס</th>' +
      '</tr></thead><tbody>';
    myItems.forEach(function(item) {
      s += '<tr>' +
        '<td style="font-size:12px;white-space:nowrap">' + _esc(HomeConstraints_formatRange(item)) + '</td>' +
        '<td>' + _esc(item.notes || '—') + '</td>' +
        '<td style="font-size:12px">' + _esc(item.status === 'pending' ? HomeConstraints_supervisorLabel(item) : '—') + '</td>' +
        '<td>' + _homeConstraintStatusBadge(item.status) +
        (item.status === 'rejected' && item.rejection_note
          ? '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + _esc(item.rejection_note) + '</div>' : '') +
        '</td></tr>';
    });
    s += '</tbody></table></div>';
  }
  s += '</div>';

  if (canSubmit) {
    s += _expandablePanel('homeConstraints', {}, 'submit', '➕ בקשת אילוץ יציאה הביתה',
      _homeConstraintsSubmitForm(approverHint), openSet);
  } else {
    s += '<div class="card"><div class="card-body"><p style="font-size:12px;color:var(--muted);margin:0">' +
      'תפקיד הסגל אינו מגיש בקשות אילוץ — ניהול אישורים בלבד.</p></div></div>';
  }

  s += '</div>';
  return _wrapPage(s, 'אילוצי זמן בית');
}

function _homeConstraintsDashboardWidget(user, sid) {
  if (!user) return '';
  const pending = HomeConstraints_pendingForApprover(user).length;
  const canSubmit = HomeConstraints_canSubmit(user);
  if (!pending && !canSubmit) return '';

  let s = '<div class="card" style="margin-bottom:16px">' +
    '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<span class="card-title">🏠 אילוצי זמן בית</span>' +
    _a('page=homeConstraints', 'פתח', 'btn btn-secondary btn-sm') +
    '</div><div class="card-body" style="font-size:13px;line-height:1.6">';
  if (pending) {
    s += '<p style="margin:0 0 8px"><b style="color:var(--yellow)">' + pending +
      '</b> בקשות ממתינות לאישורך.</p>';
  }
  if (canSubmit) {
    s += '<p style="margin:0;color:var(--muted)">ניתן להגיש בקשת יציאה הביתה לאישור הרמה הממונה.</p>';
  }
  s += '</div></div>';
  return s;
}
