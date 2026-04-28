// ═══════════════════════════════════════
//  users.gs — users, teams, roles
// ═══════════════════════════════════════

// ─── Users ───

function Users_all() {
  return _rows('Users').data.map(r => ({
    id: String(r[0]), name: String(r[1]), role: String(r[2]), team_id: String(r[3] || '')
  }));
}

function Users_get(id) {
  return Users_all().find(x => x.id === String(id)) || null;
}

function Users_byTeam(teamId) {
  return Users_all().filter(u => u.team_id === String(teamId));
}

function Users_traineesOfCommander(commanderId) {
  const teams = _rows('Teams').data
    .filter(r => String(r[2]) === String(commanderId))
    .map(r => String(r[0]));
  return Users_all().filter(u => u.role === 'trainee' && teams.indexOf(u.team_id) !== -1);
}

function Users_updateRole(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  const newRole  = (p.newRole  || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  if (['admin','commander','trainee'].indexOf(newRole) === -1) throw new Error('תפקיד לא חוקי.');
  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(row, 3).setValue(newRole);
  return Views_users({ sid: p.sid, info: 'התפקיד עודכן בהצלחה.', tab: 'users' });
}

function Users_create(p) {
  Auth_requireRole(p, ['admin']);
  const userId   = (p.newUserId   || '').trim();
  const name     = (p.newName     || '').trim();
  const password = (p.newPassword || '').trim();
  const role     = (p.newRole     || 'trainee').trim();
  const teamId   = (p.newTeamId   || '').trim();

  if (!userId || !name || !password) throw new Error('יש למלא מספר אישי, שם וסיסמה.');
  if (['admin','commander','trainee'].indexOf(role) === -1) throw new Error('תפקיד לא חוקי.');

  // Check duplicate ID
  if (Users_get(userId)) throw new Error('מספר אישי ' + userId + ' כבר קיים במערכת.');

  _append('Users', [userId, name, role, teamId]);
  _append('Credentials', [userId, password]);

  // If a team was selected, verify it exists
  if (teamId && _findRowIndex('Teams', teamId) < 0) throw new Error('הצוות לא נמצא.');

  return Views_users({ sid: p.sid, info: 'המשתמש ' + name + ' (' + userId + ') נוצר בהצלחה.', tab: 'create' });
}

function Users_delete(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');

  const me = Auth_current(p);
  if (me && me.id === targetId) throw new Error('לא ניתן למחוק את המשתמש המחובר.');

  const rowU = _findRowIndex('Users', targetId);
  if (rowU < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').deleteRow(rowU);

  // Remove credentials
  const rowC = _findRowIndex('Credentials', targetId);
  if (rowC > 0) _sheet('Credentials').deleteRow(rowC);

  return Views_users({ sid: p.sid, info: 'המשתמש נמחק.', tab: 'users' });
}

// ─── Teams ───

function Teams_all() {
  return _rows('Teams').data.map(r => ({
    id: String(r[0]), name: String(r[1]), commander_id: String(r[2] || '')
  }));
}

function Teams_get(id) {
  return Teams_all().find(t => t.id === String(id)) || null;
}

function Teams_create(p) {
  Auth_requireRole(p, ['admin']);
  const name = (p.teamName || '').trim();
  if (!name) throw new Error('יש להזין שם לצוות.');

  const id = 'T' + _nextId('Teams');
  _append('Teams', [id, name, '']);
  return Views_users({ sid: p.sid, info: 'הצוות "' + name + '" (' + id + ') נוצר בהצלחה.', tab: 'teams' });
}

function Teams_rename(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId   || '').trim();
  const name   = (p.teamName || '').trim();
  if (!teamId || !name) throw new Error('חסר מזהה צוות או שם.');
  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').getRange(row, 2).setValue(name);
  return Views_users({ sid: p.sid, info: 'שם הצוות עודכן ל"' + name + '".', tab: 'teams' });
}

function Teams_delete(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');
  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');

  // Clear team_id from all members
  const sh = _sheet('Users');
  const { data } = _rows('Users');
  data.forEach((r, i) => {
    if (String(r[3]) === teamId) sh.getRange(i + 2, 4).setValue('');
  });

  _sheet('Teams').deleteRow(row);
  return Views_users({ sid: p.sid, info: 'הצוות נמחק.', tab: 'teams' });
}

function Teams_setCommander(p) {
  Auth_requireRole(p, ['admin']);
  const teamId      = (p.teamId      || '').trim();
  const commanderId = (p.commanderId || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');

  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').getRange(row, 3).setValue(commanderId);

  // If a commander was selected, make sure they're in this team
  if (commanderId) {
    const userRow = _findRowIndex('Users', commanderId);
    if (userRow > 0) _sheet('Users').getRange(userRow, 4).setValue(teamId);
  }

  const msg = commanderId ? 'המפקד הוגדר בהצלחה.' : 'המפקד הוסר מהצוות.';
  return Views_users({ sid: p.sid, info: msg, tab: 'teams' });
}

function Teams_addMember(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId || '').trim();
  const userId = (p.userId || '').trim();
  if (!teamId || !userId) throw new Error('חסר מזהה צוות או משתמש.');

  if (_findRowIndex('Teams', teamId) < 0) throw new Error('הצוות לא נמצא.');
  const userRow = _findRowIndex('Users', userId);
  if (userRow < 0) throw new Error('המשתמש לא נמצא.');

  _sheet('Users').getRange(userRow, 4).setValue(teamId);

  const user = Users_get(userId);
  return Views_users({ sid: p.sid, info: (user ? user.name : userId) + ' נוסף לצוות.', tab: 'teams' });
}

function Teams_removeMember(p) {
  Auth_requireRole(p, ['admin']);
  const userId = (p.userId || '').trim();
  if (!userId) throw new Error('חסר מזהה משתמש.');

  const userRow = _findRowIndex('Users', userId);
  if (userRow < 0) throw new Error('המשתמש לא נמצא.');

  // Also clear as commander if they were set
  const user = Users_get(userId);
  if (user) {
    const teamRow = _findRowIndex('Teams', user.team_id);
    if (teamRow > 0) {
      const cmdId = String(_sheet('Teams').getRange(teamRow, 3).getValue());
      if (cmdId === userId) _sheet('Teams').getRange(teamRow, 3).setValue('');
    }
  }

  _sheet('Users').getRange(userRow, 4).setValue('');
  return Views_users({ sid: p.sid, info: (user ? user.name : userId) + ' הוסר מהצוות.', tab: 'teams' });
}