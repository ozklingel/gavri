// ═══════════════════════════════════════
//  users.gs — users, teams, roles
// ═══════════════════════════════════════

// ── Users ──

function Users_all() {
  return _rows('Users').data.map(r => ({
    id:                    String(r[0]),
    name:                  String(r[1]),
    role:                  String(r[2]),
    team_id:               String(r[3] || ''),
    unit_affiliation:      String(r[4] || ''),
    service_type:          String(r[5] || ''),
    military_affiliation:  String(r[6] || ''),
    unit_classification:   String(r[7] || ''),
    target_role:           String(r[8] || ''),
    phone:                 r[9] == null ? '' : String(r[9])
  }));
}

function Users_get(id) {
  // PERF: uses cached _rows — no extra Sheets API call
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

  if (Users_get(newId)) throw new Error('מספר אישי ' + newId + ' כבר קיים במערכת.');

  _append('Users', [
    newId, name, role, teamId,
    (p.unit_affiliation     || '').trim(),
    (p.service_type         || '').trim(),
    (p.military_affiliation || '').trim(),
    (p.unit_classification  || '').trim(),
    (p.target_role          || '').trim(),
    (p.phone                || '').trim()
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
  if (['admin','commander','trainee'].indexOf(newRole) === -1) throw new Error('תפקיד לא חוקי.');

  const row = _findRowIndex('Users', targetId);
  if (row < 0) throw new Error('המשתמש לא נמצא.');
  _sheet('Users').getRange(row, 3).setValue(newRole);
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

function Teams_create(p) {
  Auth_requireRole(p, ['admin']);
  const name = (p.teamName || '').trim();
  if (!name) throw new Error('נא להזין שם צוות.');
  const id = 'T' + _nextId('Teams');
  _append('Teams', [id, name, '']);
  return Views_users({ sid: p.sid, tab: 'teams', info: 'הצוות "' + name + '" (' + id + ') נוצר בהצלחה.' });
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

  // Batch-write columns 5-10 (unit_affiliation … phone) in one call
  sh.getRange(row, 5, 1, 6).setValues([[
    (p.unit_affiliation     || '').trim(),
    (p.service_type         || '').trim(),
    (p.military_affiliation || '').trim(),
    (p.unit_classification  || '').trim(),
    (p.target_role          || '').trim(),
    (p.phone                || '').trim()
  ]]);

  // Update team if provided
  if (p.newTeamId !== undefined) {
    sh.getRange(row, 4).setValue((p.newTeamId || '').trim());
  }
  // Update role if provided
  if (p.newRole) {
    sh.getRange(row, 3).setValue(p.newRole.trim());
  }
  _cacheInvalidate('Users');

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

    const validRoles = ['admin','commander','trainee'];
    const finalRole  = validRoles.includes(role) ? role : 'trainee';

    if (existing.has(id)) { skipped++; return; }

    newUserRows.push([id, name, finalRole, teamId, '', '', '', '', '', '']);
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
