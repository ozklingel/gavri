// ═══════════════════════════════════════
//  users.gs — users, teams, roles
// ═══════════════════════════════════════

// ── Users ──

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

// Create a new user (admin only)
function Users_create(p) {
  Auth_requireRole(p, ['admin']);
  const newId   = (p.newUserId   || '').trim();
  const name    = (p.newName     || '').trim();
  const pass    = (p.newPassword || '').trim();
  const role    = (p.newRole     || 'trainee').trim();
  const teamId  = (p.newTeamId   || '').trim();

  if (!newId)  throw new Error('נא להזין מספר אישי.');
  if (!name)   throw new Error('נא להזין שם מלא.');
  if (!pass)   throw new Error('נא להזין סיסמה.');
  if (['admin','commander','trainee'].indexOf(role) === -1) throw new Error('תפקיד לא חוקי.');

  // Uniqueness check
  if (Users_get(newId)) throw new Error('מספר אישי ' + newId + ' כבר קיים במערכת.');

  _append('Users',       [newId, name, role, teamId]);
  _append('Credentials', [newId, pass]);

  return Views_users({ sid: p.sid, tab: 'users', info: 'המשתמש ' + name + ' (' + newId + ') נוצר בהצלחה.' });
}

// Delete a user (admin only)
function Users_delete(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  if (targetId === p.sid) throw new Error('לא ניתן למחוק את המשתמש המחובר.');

  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').deleteRow(row);

  // Delete credentials
  const credRow = _findRowIndex('Credentials', targetId);
  if (credRow > 0) _sheet('Credentials').deleteRow(credRow);

  // Delete all Assignments belonging to this user (cascade)
  const assignSh = _sheet('Assignments');
  const assignData = _rows('Assignments').data;
  for (let i = assignData.length - 1; i >= 0; i--) {
    if (String(assignData[i][2]) === targetId) {
      assignSh.deleteRow(i + 2);
    }
  }

  // Remove as commander from any team
  const teamsSh = _sheet('Teams');
  const teamsData = _rows('Teams').data;
  teamsData.forEach(function(r, i) {
    if (String(r[2]) === targetId) {
      teamsSh.getRange(i + 2, 3).setValue('');
    }
  });

  return Views_users({ sid: p.sid, tab: 'users', info: 'המשתמש נמחק יחד עם כל ההקצאות שלו.' });
}

// Update role only (from users tab)
function Users_updateRole(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  const newRole  = (p.newRole  || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  if (['admin','commander','trainee'].indexOf(newRole) === -1) throw new Error('תפקיד לא חוקי.');

  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(row, 3).setValue(newRole);

  return Views_users({ sid: p.sid, tab: 'users', info: 'התפקיד עודכן בהצלחה.' });
}

// ── Teams ──

function Teams_all() {
  return _rows('Teams').data.map(r => ({
    id: String(r[0]), name: String(r[1]), commander_id: String(r[2] || '')
  }));
}

function Teams_get(id) {
  return Teams_all().find(t => t.id === String(id)) || null;
}

// Create a new team
function Teams_create(p) {
  Auth_requireRole(p, ['admin']);
  const name = (p.teamName || '').trim();
  if (!name) throw new Error('נא להזין שם צוות.');

  const id = 'T' + _nextId('Teams');
  _append('Teams', [id, name, '']);
  return Views_users({ sid: p.sid, tab: 'teams', info: 'הצוות "' + name + '" (' + id + ') נוצר בהצלחה.' });
}

// Rename a team
function Teams_rename(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId   || '').trim();
  const name   = (p.teamName || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');
  if (!name)   throw new Error('נא להזין שם חדש.');

  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').getRange(row, 2).setValue(name);
  return Views_users({ sid: p.sid, tab: 'teams', info: 'שם הצוות עודכן ל"' + name + '".' });
}

// Delete a team (removes team_id from all members)
function Teams_delete(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');

  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').deleteRow(row);

  // Clear team_id for all members of this team
  const usersSh = _sheet('Users');
  const { data } = _rows('Users');
  data.forEach((r, i) => {
    if (String(r[3]) === teamId) {
      usersSh.getRange(i + 2, 4).setValue('');
    }
  });

  // Also clear commander_id references pointing to this team (already handled above)
  return Views_users({ sid: p.sid, tab: 'teams', info: 'הצוות נמחק וחברים הוסרו ממנו.' });
}

// Set team commander (updates Teams sheet col C)
function Teams_setCommander(p) {
  Auth_requireRole(p, ['admin']);
  const teamId      = (p.teamId      || '').trim();
  const commanderId = (p.commanderId || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');

  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').getRange(row, 3).setValue(commanderId);
  return Views_users({ sid: p.sid, tab: 'teams', info: 'מפקד הצוות עודכן.' });
}

// Add a user to a team (sets user's team_id)
function Teams_addMember(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId || '').trim();
  const userId = (p.userId || '').trim();
  if (!teamId || !userId) throw new Error('חסרים פרטים.');

  if (!Teams_get(teamId)) throw new Error('הצוות לא נמצא.');

  const userRow = _findRowIndex('Users', userId);
  if (userRow < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(userRow, 4).setValue(teamId);

  return Views_users({ sid: p.sid, tab: 'teams', info: 'המשתמש נוסף לצוות.' });
}

// Remove a user from a team (clears team_id)
function Teams_removeMember(p) {
  Auth_requireRole(p, ['admin']);
  const userId = (p.userId || '').trim();
  if (!userId) throw new Error('חסר מזהה משתמש.');

  const userRow = _findRowIndex('Users', userId);
  if (userRow < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(userRow, 4).setValue('');

  return Views_users({ sid: p.sid, tab: 'teams', info: 'המשתמש הוסר מהצוות.' });
}