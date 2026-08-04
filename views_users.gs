// views_users.gs — users & teams management (admin)

function Views_users(p) {
  const user = Auth_requireRole(p, ['admin']);
  const sid = user.id;
  const tab = (p.tab || 'users') === 'teams' ? 'teams' : 'users';
  const openSet = _parseOpenSections(p);

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  s += '<h1 class="page-title" style="margin:0">👤 ניהול משתמשים וצוותים</h1>';
  s += '</div>';

  s += _spaTabsBar('users', {}, [
    { id: 'users', label: 'משתמשים' },
    { id: 'teams', label: 'צוותים' }
  ], tab);

  if (tab === 'users') {
    s += _usersTab(sid, openSet);
  } else {
    s += _teamsTab(sid, openSet);
  }

  s += '</div>';
  return _wrapPage(s, 'משתמשים וצוותים');
}

function _usersNewUserForm(sid, teams) {
  const teamOpts = [['', '— ללא —']].concat(teams.map(function(t) { return [t.id, t.name]; }));
  return '<div class="card"><div class="card-body">' +
    _formOpen() +
    '<input type="hidden" name="action" value="createUser">' +
    '<div class="form-row"><label class="form-label">מספר אישי</label>' + _input('newUserId', 'U005', '', 'text', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">שם מלא</label>' + _input('newName', 'שם מלא', '', 'text', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">סיסמה</label>' + _input('newPassword', '', '', 'password', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">דוא"ל (ל-MFA)</label>' +
    _input('email', 'user@example.com', '', 'email') + '</div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">תפקיד</label>' +
    _select('newRole', Roles_selectOptions(), 'trainee') + '</div>' +
    '<div class="form-row"><label class="form-label">צוות</label>' + _select('newTeamId', teamOpts, '') + '</div>' +
    '</div>' +
    _submitBtn('צור משתמש', 'btn btn-primary btn-full') +
    '</form></div></div>';
}

function _usersImportCsvPanel() {
  return '<div class="card"><div class="card-body">' +
    '<p style="font-size:12px;color:var(--text2);margin-bottom:8px;line-height:1.55">' +
    '<b>פורמט הקובץ (Excel XLSX / CSV):</b><br>' +
    'מייל, מספר טלפון, תפקיד עתידי, מספר אישי, חטיבה, יחידה, חיל, סוג שירות, תפקיד, שם מלא, צוות<br>' +
    '<span style="color:var(--muted)">(אופציונלי בהתחלה: עמודת אישור). חובה: שם מלא + מספר אישי. עמודת צוות = שם צוות בגיליון Teams (לא מזהה T…). קיים → דריסה. צוות חדש לפי שם → נוצר.</span>' +
    '</p>' +
    '<div style="margin-bottom:10px">' +
    '<button type="button" id="xlsxExampleDownload" class="btn btn-secondary btn-sm">📄 הורד קובץ דוגמה (CSV)</button>' +
    '</div>' +
    '<input type="file" id="xlsxFile" accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" class="form-input">' +
    '<div id="xlsxError" class="flash flash-error" style="display:none;margin-top:8px"></div>' +
    '<div id="xlsxPreview" style="display:none;margin-top:10px"><table class="tbl" id="xlsxPreviewTable"></table></div>' +
    '<button type="button" id="xlsxImportBtn" class="btn btn-primary" style="display:none;margin-top:10px" onclick="doXlsxImport()">ייבוא למערכת</button>' +
    '</div></div>';
}

function _usersTab(sid, openSet) {
  const users = Users_all();
  const teams = Teams_all();
  const teamById = Teams_byIdMap();
  const baseParams = { tab: 'users' };

  let s = '<div class="card" style="margin-top:14px"><div class="card-header"><div class="card-title">📋 משתמשים (' + users.length + ')</div></div>';
  if (!users.length) {
    s += '<div class="empty">אין משתמשים</div>';
  } else {
    s += _bulkDeleteBar('deleteUsersBulk', 'idsJson', 'למחוק {n} משתמשים? פעולה זו לא ניתנת לביטול.') +
      '<div class="card-body" style="padding:0"><table class="tbl bulk-select-table"><thead><tr>' +
      _bulkSelectHeader() +
      '<th>שיוך חיילי</th><th>שם</th><th>תפקיד</th><th>צוות</th><th>פעולות</th></tr></thead><tbody>';
    users.forEach(function(u) {
      const team = u.team_id ? teamById[u.team_id] : null;
      const isSelf = u.id === sid;
      s += '<tr>' +
        _bulkSelectCell(u.id, isSelf) +
        '<td>' + (u.military_affiliation ? _esc(u.military_affiliation) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + _userLink(u.id, u.name, '') + '</td>' +
        '<td>' + _badge(_roleHe(u.role), _roleBadgeType(u.role)) + '</td>' +
        '<td>' + _esc(team ? team.name : '—') + '</td>' +
        '<td class="actions" style="white-space:nowrap">' +
        (isSelf ? '<span style="font-size:11px;color:var(--muted)">מחובר</span> ' : '') +
        (isSelf ? '' : _confirmDelete('action=deleteUser&targetId=' + encodeURIComponent(u.id), 'למחוק את ' + u.name + '?')) +
        '</td></tr>';
    });
    s += '</tbody></table></div>';
  }
  s += '</div>';

  s += '<div class="expandable-stack" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">';
  s += _expandablePanel('users', baseParams, 'newUser', '➕ משתמש חדש',
    _usersNewUserForm(sid, teams), openSet);
  s += _expandablePanel('users', baseParams, 'importCsv', '📥 ייבוא מקובץ Excel / CSV',
    _usersImportCsvPanel(), openSet);
  s += _expandablePanel('users', baseParams, 'fieldDefs', '⚙ שדות פרופיל נוספים',
    _userFieldDefsAdminHtml(sid), openSet);
  s += '</div>';
  return s;
}

function _teamsNewTeamForm() {
  return '<div class="card"><div class="card-body">' +
    _formOpen() +
    '<input type="hidden" name="action" value="createTeam">' +
    '<div class="form-row"><label class="form-label">שם צוות</label>' + _input('teamName', 'שם הצוות', '', 'text', 'required') + '</div>' +
    _submitBtn('צור צוות', 'btn btn-primary btn-full') +
    '</form></div></div>';
}

function _teamsAutoSplitForm(unassignedTrainees, freeCommanders, previewTeams) {
  return '<div class="card"><div class="card-body">' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:12px">' +
    'חניכים ללא צוות: <b>' + unassignedTrainees.length + '</b> · מפקדי צוות פנויים: <b>' + freeCommanders.length + '</b>' +
    (previewTeams ? ' · ייווצרו כ-<b>' + previewTeams + '</b> צוותים' : '') +
    '</p>' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:12px">כל צוות: עד 10 חניכים + 1–2 מפקדי צוות (לפי בחירה).</p>' +
    _formOpen() +
    '<input type="hidden" name="action" value="autoSplitTeams">' +
    '<div class="form-row"><label class="form-label">קידומת שם</label>' + _input('teamNamePrefix', 'צוות', 'צוות', 'text', 'required') + '</div>' +
    '<div class="form-row"><label class="form-label">מפקדים לצוות</label>' +
    _select('commandersPerTeam', [['1','1 מפקד'],['2','2 מפקדים']], '1') + '</div>' +
    _submitBtn('חלק אוטומטית', 'btn btn-primary btn-full') +
    '</form></div></div>';
}

function _teamsTab(sid, openSet) {
  const allUsers = Users_all();
  const teams = Teams_all();
  const userById = Users_byIdMap();
  const membersByTeam = {};
  const unassigned = [];
  allUsers.forEach(function(u) {
    if (u.team_id) {
      if (!membersByTeam[u.team_id]) membersByTeam[u.team_id] = [];
      membersByTeam[u.team_id].push(u);
    } else {
      unassigned.push(u);
    }
  });
  const commanders = allUsers.filter(function(u) {
    return Roles_isCompanyCommander(u.role) || Roles_isAdmin(u.role) || Roles_isUnitCommander(u.role);
  });
  const cmdOpts = [['', '— ללא —']].concat(commanders.map(function(u) { return [u.id, u.id + ' — ' + u.name]; }));
  const baseParams = { tab: 'teams' };

  let s = '<div class="card" style="margin-top:14px"><div class="card-header"><div class="card-title">🪖 צוותים (' + teams.length + ')</div></div>';
  if (!teams.length) {
    s += '<div class="empty">אין צוותים</div>';
  } else {
    teams.forEach(function(t) {
      const members = membersByTeam[t.id] || [];
      const cmd = t.commander_id ? userById[t.commander_id] : null;
      s += '<div class="card" style="margin:10px;border:1px solid var(--border)"><div class="card-body">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">' +
        '<b>' + _esc(t.name) + '</b> <span class="mono" style="font-size:11px;color:var(--muted)">' + t.id + '</span>' +
        _confirmDelete('action=deleteTeam&teamId=' + encodeURIComponent(t.id), 'למחוק את הצוות ' + t.name + '?') +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">מפקד: ' +
        (cmd ? _userLink(cmd.id, cmd.name, '') : '—') + ' · ' + members.length + ' חברים</div>' +
        _formOpen('form-inline') +
        '<input type="hidden" name="action" value="renameTeam">' +
        '<input type="hidden" name="teamId" value="' + _esc(t.id) + '">' +
        _input('teamName', 'שם חדש', t.name, 'text', 'required style="min-width:120px"') +
        '<button type="submit" class="btn btn-secondary btn-sm">שינוי שם</button></form> ' +
        _formOpen('form-inline') +
        '<input type="hidden" name="action" value="setCommander">' +
        '<input type="hidden" name="teamId" value="' + _esc(t.id) + '">' +
        _select('commanderId', cmdOpts, t.commander_id) +
        '<button type="submit" class="btn btn-secondary btn-sm">מפקד</button></form>';

      if (members.length) {
        s += '<ul style="margin:8px 0 0;padding:0;list-style:none">';
        members.forEach(function(m) {
          let sub = '';
          if (Roles_isTrainee(m.role) && m.military_affiliation) {
            sub = ' <span style="font-size:10px;color:var(--muted)">' + _esc(m.military_affiliation) + '</span>';
          } else if (!Roles_isTrainee(m.role)) {
            sub = ' <span class="mono" style="font-size:10px">' + _esc(m.id) + '</span>';
          }
          s += '<li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">' +
            '<span>' + _userLink(m.id, m.name, '') + sub + '</span>' +
            _formOpen('form-inline') +
            '<input type="hidden" name="action" value="removeMember">' +
            '<input type="hidden" name="userId" value="' + _esc(m.id) + '">' +
            _submitBtn('הסר', 'btn btn-danger btn-sm btn-icon') + '</form></li>';
        });
        s += '</ul>';
      }
      s += '</div></div>';
    });

    if (unassigned.length) {
      const teamOpts = teams.map(function(t) { return [t.id, t.name + ' (' + t.id + ')']; });
      const userOpts = unassigned.map(function(u) { return [u.id, u.id + ' — ' + u.name]; });
      s += '<div class="card" style="margin:10px;border:1px dashed var(--border)"><div class="card-body">' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:8px">➕ הוספת חבר לצוות</div>' +
        '<p style="font-size:12px;color:var(--muted);margin:0 0 10px">חברים ללא שיוך: <b>' + unassigned.length + '</b></p>' +
        _formOpen('form-inline') +
        '<input type="hidden" name="action" value="addMember">' +
        _select('teamId', teamOpts) +
        _select('userId', userOpts) +
        _submitBtn('הוסף', 'btn btn-primary btn-sm') + '</form></div></div>';
    }
  }
  s += '</div>';

  const unassignedTrainees = unassigned.filter(function(u) { return Roles_isTrainee(u.role); });
  const freeCommanders = allUsers.filter(function(u) {
    return Roles_isCompanyCommander(u.role) && !u.team_id;
  });
  const previewTeams = unassignedTrainees.length
    ? Math.ceil(unassignedTrainees.length / 10)
    : 0;

  s += '<div class="expandable-stack" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">';
  s += _expandablePanel('users', baseParams, 'newTeam', '➕ צוות חדש',
    _teamsNewTeamForm(), openSet);
  s += _expandablePanel('users', baseParams, 'autoSplit', '⚡ חלוקה אוטומטית לצוותים',
    _teamsAutoSplitForm(unassignedTrainees, freeCommanders, previewTeams), openSet);
  s += '</div>';
  return s;
}
