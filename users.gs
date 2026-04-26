// ═══════════════════════════════════════
//  users.gs — users & roles
// ═══════════════════════════════════════

function Users_all() {
  return _rows('Users').data.map(r => ({
    id: String(r[0]), name: String(r[1]), role: String(r[2]), team_id: String(r[3] || '')
  }));
}

function Users_get(id) {
  const u = Users_all().find(x => x.id === String(id));
  return u || null;
}

function Users_byTeam(teamId) {
  return Users_all().filter(u => u.team_id === String(teamId));
}

function Users_traineesOfCommander(commanderId) {
  // Find teams led by this commander
  const teams = _rows('Teams').data
    .filter(r => String(r[2]) === String(commanderId))
    .map(r => String(r[0]));
  return Users_all().filter(u => u.role === 'trainee' && teams.indexOf(u.team_id) !== -1);
}

function Users_updateRole(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  const newRole  = (p.newRole  || '').trim();
  const newTeam  = (p.newTeam  || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  if (['admin','commander','trainee'].indexOf(newRole) === -1) throw new Error('תפקיד לא חוקי.');

  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  const sh = _sheet('Users');
  sh.getRange(row, 3).setValue(newRole);
  sh.getRange(row, 4).setValue(newTeam);
  return Views_users({ sid: p.sid, info: 'התפקיד עודכן בהצלחה.' });
}
