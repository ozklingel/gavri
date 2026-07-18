// ═══════════════════════════════════════
//  users.gs — users, teams, roles
// ═══════════════════════════════════════

// ── Users ──

function Users_all() {
  return _rows('Users').data.map(r => ({
    id:                    String(r[0]),
    name:                  String(r[1]),
    role:                  Roles_normalize(String(r[2])),
    team_id:               String(r[3] || ''),
    unit_affiliation:      String(r[4] || ''),
    service_type:          String(r[5] || ''),
    military_affiliation:  String(r[6] || ''),
    unit_classification:   String(r[7] || ''),
    target_role:           String(r[8] || ''),
    phone:                 r[9] == null ? '' : String(r[9]),
    email:                 r[10] == null ? '' : String(r[10])
  }));
}

var _usersById = null;

function Users_byIdMap() {
  if (!_rowsCache['Users']) _usersById = null;
  if (_usersById) return _usersById;
  _usersById = {};
  Users_all().forEach(function(u) { _usersById[u.id] = u; });
  return _usersById;
}

function Users_get(id) {
  return Users_byIdMap()[String(id)] || null;
}

function Users_byTeam(teamId) {
  return Users_all().filter(u => u.team_id === String(teamId));
}

function Users_isTeamCommanderOf(commanderId, userId) {
  const target = Users_get(userId);
  if (!target || !target.team_id) return false;
  const team = Teams_get(target.team_id);
  return !!(team && String(team.commander_id) === String(commanderId));
}

function Users_teamCommanderId(userId) {
  const target = Users_get(userId);
  if (!target || !target.team_id) return '';
  const team = Teams_get(target.team_id);
  return team && team.commander_id ? String(team.commander_id) : '';
}

function Users_canViewScores(viewer, targetUserId) {
  if (!viewer || !targetUserId) return false;
  if (String(viewer.id) === String(targetUserId)) return true;
  const role = Roles_normalize(viewer.role);
  if (role === 'admin' || role === 'unitCommander') return true;
  if (Roles_isCompanyCommander(role) && Users_isTeamCommanderOf(viewer.id, targetUserId)) return true;
  return false;
}

function Users_traineesOfCommander(commanderId) {
  const teams = _rows('Teams').data
    .filter(r => String(r[2]) === String(commanderId))
    .map(r => String(r[0]));
  return Users_all().filter(function(u) {
    return Roles_isTrainee(u.role) && teams.indexOf(u.team_id) !== -1;
  });
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
  if (!Roles_isValid(role)) throw new Error('תפקיד לא חוקי.');

  if (Users_get(newId)) throw new Error('מספר אישי ' + newId + ' כבר קיים במערכת.');

  _append('Users', [
    newId, name, Roles_normalize(role), teamId,
    (p.unit_affiliation     || '').trim(),
    (p.service_type         || '').trim(),
    (p.military_affiliation || '').trim(),
    (p.unit_classification  || '').trim(),
    (p.target_role          || '').trim(),
    (p.phone                || '').trim(),
    (p.email                || '').trim()
  ]);
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
  _cacheInvalidate('Users');

  const credRow = _findRowIndex('Credentials', targetId);
  if (credRow > 0) {
    _sheet('Credentials').deleteRow(credRow);
    _cacheInvalidate('Credentials');
  }

  // Cascade-delete assignments
  const assignSh = _sheet('Assignments');
  const assignData = _rows('Assignments').data;
  for (let i = assignData.length - 1; i >= 0; i--) {
    if (String(assignData[i][2]) === targetId) {
      assignSh.deleteRow(i + 2);
    }
  }
  _cacheInvalidate('Assignments');

  // Remove as commander from any team
  const teamsSh = _sheet('Teams');
  const teamsData = _rows('Teams').data;
  teamsData.forEach(function(r, i) {
    if (String(r[2]) === targetId) {
      teamsSh.getRange(i + 2, 3).setValue('');
    }
  });
  _cacheInvalidate('Teams');

  return Views_users({ sid: p.sid, tab: 'users', info: 'המשתמש נמחק יחד עם כל ההקצאות שלו.' });
}

// Update role only (from users tab)
function Users_updateRole(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  const newRole  = (p.newRole  || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  if (!Roles_isValid(newRole)) throw new Error('תפקיד לא חוקי.');

  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(row, 3).setValue(Roles_normalize(newRole));
  _cacheInvalidate('Users');

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

function _nextTeamId() {
  const { data } = _rows('Teams');
  let max = 0;
  data.forEach(function(r) {
    const id = String(r[0] || '');
    const m = id.match(/^T(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
    else {
      const n = parseInt(id, 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  });
  return 'T' + (max + 1);
}

function _nextTeamIds(count) {
  const { data } = _rows('Teams');
  let max = 0;
  data.forEach(function(r) {
    const id = String(r[0] || '');
    const m = id.match(/^T(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
    else {
      const n = parseInt(id, 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  });
  const ids = [];
  for (let i = 0; i < count; i++) ids.push('T' + (max + 1 + i));
  return ids;
}

function Teams_create(p) {
  Auth_requireRole(p, ['admin']);
  const name = (p.teamName || '').trim();
  if (!name) throw new Error('נא להזין שם צוות.');
  const id = _nextTeamId();
  _append('Teams', [id, name, '']);
  return Views_users({ sid: p.sid, tab: 'teams', info: 'הצוות "' + name + '" (' + id + ') נוצר בהצלחה.' });
}

// Auto-split unassigned trainees into teams of 10 (+ 1–2 commanders each)
function Teams_autoSplit(p) {
  Auth_requireRole(p, ['admin']);
  const TRAINEES_PER_TEAM = 10;
  const cmdPerTeam = Math.min(2, Math.max(1, parseInt(p.commandersPerTeam, 10) || 1));
  const prefix = (p.teamNamePrefix || 'צוות').trim() || 'צוות';

  const trainees = Users_all()
    .filter(function(u) { return Roles_isTrainee(u.role) && !u.team_id; })
    .sort(function(a, b) { return a.id.localeCompare(b.id); });
  const commanders = Users_all()
    .filter(function(u) { return Roles_isCompanyCommander(u.role) && !u.team_id; })
    .sort(function(a, b) { return a.id.localeCompare(b.id); });

  if (!trainees.length) throw new Error('אין חניכים ללא צוות לחלוקה.');

  const numTeams = Math.ceil(trainees.length / TRAINEES_PER_TEAM);
  const commandersNeeded = numTeams * cmdPerTeam;
  const teamIds = _nextTeamIds(numTeams);
  const teamRows = [];
  const plans = [];
  let cmdIdx = 0;

  for (let i = 0; i < numTeams; i++) {
    const chunk = trainees.slice(i * TRAINEES_PER_TEAM, (i + 1) * TRAINEES_PER_TEAM);
    const cmds = [];
    for (let c = 0; c < cmdPerTeam && cmdIdx < commanders.length; c++) {
      cmds.push(commanders[cmdIdx++]);
    }
    const id = teamIds[i];
    const name = prefix + ' ' + (i + 1);
    teamRows.push([id, name, cmds[0] ? cmds[0].id : '']);
    plans.push({ id: id, trainees: chunk, commanders: cmds });
  }

  _appendBatch('Teams', teamRows);

  const userRows = {};
  _rows('Users').data.forEach(function(r, i) {
    userRows[String(r[0])] = i + 2;
  });
  const usersSh = _sheet('Users');

  plans.forEach(function(plan) {
    plan.trainees.forEach(function(u) {
      const row = userRows[u.id];
      if (row) usersSh.getRange(row, 4).setValue(plan.id);
    });
    plan.commanders.forEach(function(u) {
      const row = userRows[u.id];
      if (row) usersSh.getRange(row, 4).setValue(plan.id);
    });
  });

  _cacheInvalidate('Teams');
  _cacheInvalidate('Users');

  let info = 'נוצרו ' + numTeams + ' צוותים — ' + trainees.length + ' חניכים חולקו (עד ' +
    TRAINEES_PER_TEAM + ' לצוות, ' + cmdPerTeam + ' מפקדים לצוות).';
  const missingCmds = commandersNeeded - cmdIdx;
  if (missingCmds > 0) {
    info += ' חסרים ' + missingCmds + ' מפקדי צוות פנויים — חלק מהצוותים ללא מפקד מלא.';
  }
  const leftover = trainees.length % TRAINEES_PER_TEAM;
  if (leftover > 0) {
    info += ' הצוות האחרון כולל ' + leftover + ' חניכים.';
  }
  return Views_users({ sid: p.sid, tab: 'teams', info: info });
}

function Teams_rename(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId   || '').trim();
  const name   = (p.teamName || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');
  if (!name)   throw new Error('נא להזין שם חדש.');
  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').getRange(row, 2).setValue(name);
  _cacheInvalidate('Teams');
  return Views_users({ sid: p.sid, tab: 'teams', info: 'שם הצוות עודכן ל"' + name + '".' });
}

function Teams_delete(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');
  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').deleteRow(row);
  _cacheInvalidate('Teams');

  const usersSh = _sheet('Users');
  const { data } = _rows('Users');
  data.forEach((r, i) => {
    if (String(r[3]) === teamId) {
      usersSh.getRange(i + 2, 4).setValue('');
    }
  });
  _cacheInvalidate('Users');

  return Views_users({ sid: p.sid, tab: 'teams', info: 'הצוות נמחק וחברים הוסרו ממנו.' });
}

function Teams_setCommander(p) {
  Auth_requireRole(p, ['admin']);
  const teamId      = (p.teamId      || '').trim();
  const commanderId = (p.commanderId || '').trim();
  if (!teamId) throw new Error('חסר מזהה צוות.');
  const row = _findRowIndex('Teams', teamId);
  if (row < 0) throw new Error('הצוות לא נמצא.');
  _sheet('Teams').getRange(row, 3).setValue(commanderId);
  _cacheInvalidate('Teams');
  return Views_users({ sid: p.sid, tab: 'teams', info: 'מפקד הצוות עודכן.' });
}

function Teams_addMember(p) {
  Auth_requireRole(p, ['admin']);
  const teamId = (p.teamId || '').trim();
  const userId = (p.userId || '').trim();
  if (!teamId || !userId) throw new Error('חסרים פרטים.');
  if (!Teams_get(teamId)) throw new Error('הצוות לא נמצא.');
  const userRow = _findRowIndex('Users', userId);
  if (userRow < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(userRow, 4).setValue(teamId);
  _cacheInvalidate('Users');
  return Views_users({ sid: p.sid, tab: 'teams', info: 'המשתמש נוסף לצוות.' });
}

function Teams_removeMember(p) {
  Auth_requireRole(p, ['admin']);
  const userId = (p.userId || '').trim();
  if (!userId) throw new Error('חסר מזהה משתמש.');
  const userRow = _findRowIndex('Users', userId);
  if (userRow < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(userRow, 4).setValue('');
  _cacheInvalidate('Users');
  return Views_users({ sid: p.sid, tab: 'teams', info: 'המשתמש הוסר מהצוות.' });
}

// Update a user's extended profile fields (admin only)
// PERF: single setValues() call for all 6 profile columns
function Users_updateProfile(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  const sh = _sheet('Users');

  // Batch-write columns 5-11 (unit_affiliation … email) in one call
  sh.getRange(row, 5, 1, 7).setValues([[
    (p.unit_affiliation     || '').trim(),
    (p.service_type         || '').trim(),
    (p.military_affiliation || '').trim(),
    (p.unit_classification  || '').trim(),
    (p.target_role          || '').trim(),
    (p.phone                || '').trim(),
    (p.email                || '').trim()
  ]]);

  // Update team if provided
  if (p.newTeamId !== undefined) {
    sh.getRange(row, 4).setValue((p.newTeamId || '').trim());
  }
  // Update role if provided
  if (p.newRole) {
    sh.getRange(row, 3).setValue(Roles_normalize(p.newRole.trim()));
  }
  _cacheInvalidate('Users');
  UserProfileFields_saveForUser(targetId, p);

  if (p.returnTo === 'user') {
    return Views_user({ sid: p.sid, id: targetId, info: 'פרופיל המשתמש עודכן בהצלחה.' });
  }
  return Views_users({ sid: p.sid, tab: 'users', info: 'פרופיל המשתמש עודכן.' });
}

// ═══════════════════════════════════════
//  Users_importBulk — ייבוא משתמשים מאקסל
//  p.usersJson = JSON array of {id, name, role, password, team_id?}
// ═══════════════════════════════════════
function Users_importBulk(p) {
  Auth_requireRole(p, ['admin']);

  let rows;
  try {
    rows = JSON.parse(p.usersJson || '[]');
  } catch(e) {
    throw new Error('JSON לא תקין: ' + e.message);
  }

  if (!Array.isArray(rows) || !rows.length) throw new Error('לא נמצאו שורות לייבוא.');

  const usersSh = _sheet('Users');
  const credsSh = _sheet('Credentials');

  // Build lookup of existing IDs to avoid duplicates
  const existing = new Set(_rows('Users').data.map(r => String(r[0]).trim()));

  let added = 0, skipped = 0, errors = [];

  // PERF: collect all new rows; batch-append at the end
  const newUserRows  = [];
  const newCredRows  = [];

  rows.forEach(function(row, i) {
    const id       = String(row.id       || '').trim();
    const name     = String(row.name     || '').trim();
    const role     = String(row.role     || 'trainee').trim().toLowerCase();
    const password = String(row.password || '').trim();
    const teamId   = String(row.team_id  || '').trim();

    if (!id || !name) { errors.push('שורה ' + (i+1) + ': חסר id או שם'); return; }
    if (!password)    { errors.push('שורה ' + (i+1) + ': חסרה סיסמה ל-' + id); return; }

    const validRoles = Roles_allValid();
    const finalRole  = validRoles.includes(role) ? Roles_normalize(role) : 'trainee';

    if (existing.has(id)) { skipped++; return; }

    newUserRows.push([id, name, finalRole, teamId, '', '', '', '', '', '', String(row.email || '').trim()]);
    newCredRows.push([id, password]);
    existing.add(id);
    added++;
  });

  if (newUserRows.length) _appendBatch('Users',       newUserRows);
  if (newCredRows.length) _appendBatch('Credentials', newCredRows);

  let info = 'ייבוא הושלם: ' + added + ' משתמשים נוספו.';
  if (skipped) info += ' ' + skipped + ' דולגו (קיימים כבר).';
  if (errors.length) info += ' שגיאות: ' + errors.slice(0,3).join(' | ');

  return Views_users({ sid: p.sid, tab: 'users', info: info });
}
