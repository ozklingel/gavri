/**
 * users.gs — User & roles management (admin only for mutations)
 */

function Users_all() {
  return readSheet('Users');
}

function Users_byTeam(teamId) {
  teamId = String(teamId);
  return Users_all().filter(function (u) {
    return String(u.team_id) === teamId;
  });
}

function Users_traineesOfTeam(teamId) {
  return Users_byTeam(teamId).filter(function (u) { return u.role === 'trainee'; });
}

function Users_teamName(teamId) {
  var t = findById('Teams', teamId);
  return t ? t.name : '';
}

function Users_teams() {
  return readSheet('Teams');
}

function Users_handleUpdateRole(session, params) {
  Auth_requireRole(session, ['admin']);
  var userId = String(params.userId || '');
  var role   = String(params.role || '');
  var teamId = String(params.team_id || '');

  if (['admin', 'commander', 'trainee'].indexOf(role) === -1) {
    return Views_message('Invalid role.');
  }
  var u = findById('Users', userId);
  if (!u) return Views_message('User not found.');

  updateRow('Users', u._row, { role: role, team_id: teamId });
  return Views_redirect('?page=users&msg=Updated');
}
