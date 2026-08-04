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

/** מזהה משתמש הבא — U001, U002… (או המשך ממקסימום קיים) */
function Users_nextIds(count) {
  count = Math.max(1, parseInt(count, 10) || 1);
  const data = _rows('Users').data;
  let max = 0;
  data.forEach(function(r) {
    const id = String(r[0] || '').trim();
    const m = id.match(/^U(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
    else {
      const n = parseInt(id, 10);
      if (!isNaN(n) && String(n) === id) max = Math.max(max, n);
    }
  });
  const out = [];
  for (let i = 1; i <= count; i++) {
    const n = max + i;
    out.push('U' + String(n).padStart(Math.max(3, String(n).length), '0'));
  }
  return out;
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

/** מחיקת משתמשים (אחד או יותר) — מחיקת שורות מלמטה למעלה + invalidate פעם אחת */
function Users_deleteCore_(targetIds, sid) {
  const idSet = {};
  (targetIds || []).forEach(function(id) {
    const t = String(id || '').trim();
    if (t && t !== String(sid || '').trim()) idSet[t] = true;
  });
  const ids = Object.keys(idSet);
  if (!ids.length) return { deleted: 0 };

  const usersSh = _sheet('Users');
  const usersData = _rows('Users').data;
  const userRows = [];
  usersData.forEach(function(r, i) {
    if (idSet[String(r[0])]) userRows.push(i + 2);
  });
  userRows.sort(function(a, b) { return b - a; });
  userRows.forEach(function(row) { usersSh.deleteRow(row); });

  const credSh = _sheet('Credentials');
  const credData = _rows('Credentials').data;
  const credRows = [];
  credData.forEach(function(r, i) {
    if (idSet[String(r[0])]) credRows.push(i + 2);
  });
  credRows.sort(function(a, b) { return b - a; });
  credRows.forEach(function(row) { credSh.deleteRow(row); });

  const assignSh = _sheet('Assignments');
  const assignData = _rows('Assignments').data;
  const assignRows = [];
  assignData.forEach(function(r, i) {
    if (idSet[String(r[2])]) assignRows.push(i + 2);
  });
  assignRows.sort(function(a, b) { return b - a; });
  assignRows.forEach(function(row) { assignSh.deleteRow(row); });

  const teamsSh = _sheet('Teams');
  const teamsData = _rows('Teams').data;
  teamsData.forEach(function(r, i) {
    if (idSet[String(r[2])]) teamsSh.getRange(i + 2, 3).setValue('');
  });

  _cacheInvalidate('Users');
  _cacheInvalidate('Credentials');
  _cacheInvalidate('Assignments');
  _cacheInvalidate('Teams');
  SpreadsheetApp.flush();

  return { deleted: userRows.length };
}

// Delete a user (admin only)
function Users_delete(p) {
  Auth_requireRole(p, ['admin']);
  const targetId = (p.targetId || '').trim();
  if (!targetId) throw new Error('חסר מזהה משתמש.');
  if (targetId === p.sid) throw new Error('לא ניתן למחוק את המשתמש המחובר.');
  const r = Users_deleteCore_([targetId], p.sid);
  if (!r.deleted) throw new Error('המשתמש לא נמצא.');
  return { ok: true, info: 'המשתמש נמחק יחד עם כל ההקצאות שלו.', page: 'users', tab: 'users' };
}

function Users_deleteBulk(p) {
  Auth_requireRole(p, ['admin']);
  let ids = [];
  try { ids = JSON.parse(p.idsJson || '[]'); } catch (e1) { ids = []; }
  if (!ids.length) throw new Error('לא נבחרו משתמשים למחיקה.');
  const r = Users_deleteCore_(ids, p.sid);
  if (!r.deleted) throw new Error('לא נמצאו משתמשים למחיקה (ייתכן שניסית למחוק את עצמך).');
  return {
    ok: true,
    info: 'נמחקו ' + r.deleted + ' משתמשים יחד עם ההקצאות שלהם.',
    page: 'users',
    tab: 'users'
  };
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

var _teamsById = null;

function Teams_byIdMap() {
  if (!_rowsCache['Teams']) _teamsById = null;
  if (_teamsById) return _teamsById;
  _teamsById = {};
  Teams_all().forEach(function(t) { _teamsById[t.id] = t; });
  return _teamsById;
}

function Teams_get(id) {
  if (!id) return null;
  return Teams_byIdMap()[String(id)] || null;
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
//  Users_importBulk — ייבוא משתמשים מקובץ
//  מספר אישי = id · סיסמה ברירת מחדל = מספר אישי
// ═══════════════════════════════════════
function Users_normalizeIdForImport(raw) {
  let id = String(raw == null ? '' : raw)
    .replace(/\u00a0/g, ' ')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, '')
    .trim();
  if (!id) return '';
  if (/^\d+\.0+$/.test(id)) id = String(parseInt(id, 10));
  if (/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(id)) {
    const n = Number(id);
    if (isFinite(n) && Math.abs(n) < 1e15) id = String(Math.round(n));
  }
  return id;
}

function Users_normalizeTeamImportRaw(raw) {
  raw = String(raw == null ? '' : raw)
    .replace(/\u00a0/g, ' ')
    .replace(/^\uFEFF/, '')
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || raw === '-' || raw === '—' || raw === '–') return '';
  // Excel לעיתים נותן 1.0 / 2.00
  if (/^\d+\.0+$/.test(raw)) raw = String(parseInt(raw, 10));
  return raw;
}

/** חיפוש צוות לפי שם זהה לעמודת «צוות» בקובץ (לא לפי T{n}) */
function Users_resolveTeamIdForImport(raw) {
  const nameKey = Users_normalizeTeamImportRaw(raw);
  if (!nameKey) return '';

  const all = Teams_all();
  // 1) שם זהה בדיוק לערך מהקובץ (למשל "3" או "צוות א")
  for (let i = 0; i < all.length; i++) {
    if (String(all[i].name || '').trim() === nameKey) return all[i].id;
  }
  // 2) אם בקובץ מספר — נסה גם «צוות N»
  if (/^\d+$/.test(nameKey)) {
    const withPrefix = 'צוות ' + nameKey;
    for (let j = 0; j < all.length; j++) {
      if (String(all[j].name || '').trim() === withPrefix) return all[j].id;
    }
  }
  return '';
}

/** מזהה צוות קיים לפי שם, או יוצר צוות חדש בשם הזהה לערך מהקובץ */
function Users_ensureTeamIdForImport(raw, createdNames) {
  const nameKey = Users_normalizeTeamImportRaw(raw);
  if (!nameKey) return '';

  const existing = Users_resolveTeamIdForImport(nameKey);
  if (existing) return existing;

  const mapKey = nameKey.toLowerCase();
  if (createdNames && createdNames[mapKey]) return createdNames[mapKey];

  // שם הצוות = הערך מעמודת «צוות»; המזהה (T…) נוצר בנפרד
  const newId = _nextTeamId();
  const name = nameKey;
  _append('Teams', [newId, name, '']);

  if (createdNames) {
    createdNames[mapKey] = newId;
    createdNames[String(newId).toLowerCase()] = newId;
    if (/^\d+$/.test(nameKey)) {
      createdNames[('צוות ' + nameKey).toLowerCase()] = newId;
    }
  }
  return newId;
}

function Users_extractTeamFromImportRow(row) {
  const candidates = [row.team_id, row.team, row.Team, row['צוות']];
  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    if (raw == null || String(raw).trim() === '') continue;
    const s = String(raw).trim();
    // לא לבלבל תפקיד מ"פ עם מספר/שם צוות
    if (/^מ["״']?פ/.test(s) || s === 'מפ') continue;
    const norm = Users_normalizeTeamImportRaw(s);
    if (norm) return norm;
  }
  return '';
}

/** מפת שם צוות → מזהה (לייבוא — בלי קריאות חוזרות ל-Teams_all) */
function Users_buildTeamNameMap() {
  const map = {};
  Teams_all().forEach(function(t) {
    const n = String(t.name || '').trim();
    if (!n) return;
    map[n] = t.id;
    if (/^\d+$/.test(n)) map['צוות ' + n] = t.id;
  });
  return map;
}

function Users_ensureTeamIdForImportMap(raw, teamNameToId, createdNames, pendingTeamRows, teamIdSeq) {
  const nameKey = Users_normalizeTeamImportRaw(raw);
  if (!nameKey) return '';

  if (teamNameToId[nameKey]) return teamNameToId[nameKey];

  const mapKey = nameKey.toLowerCase();
  if (createdNames && createdNames[mapKey]) return createdNames[mapKey];

  let newId;
  if (teamIdSeq) {
    teamIdSeq.next += 1;
    newId = 'T' + teamIdSeq.next;
  } else {
    newId = _nextTeamId();
  }
  if (pendingTeamRows) pendingTeamRows.push([newId, nameKey, '']);
  else _append('Teams', [newId, nameKey, '']);

  teamNameToId[nameKey] = newId;
  if (createdNames) {
    createdNames[mapKey] = newId;
    createdNames[String(newId).toLowerCase()] = newId;
    if (/^\d+$/.test(nameKey)) {
      createdNames[('צוות ' + nameKey).toLowerCase()] = newId;
      teamNameToId['צוות ' + nameKey] = newId;
    }
  }
  return newId;
}

function Users_importBulk(p) {
  Auth_requireRole(p, ['admin']);

  let rows;
  try {
    rows = JSON.parse(p.usersJson || '[]');
  } catch (e) {
    throw new Error('JSON לא תקין: ' + e.message);
  }

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('לא נמצאו שורות לייבוא. ודא שהקובץ בפורמט CSV עם כותרות בעברית.');
  }

  _cacheBeginBatch();
  var added = 0;
  var updated = 0;
  var teamsCreated = 0;
  var teamsReassigned = 0;
  var errors = [];
  var teamChangeNotes = [];
  try {
  const usersMeta = _rows('Users');
  const sheetRows = usersMeta.data.map(function(r) { return r.slice(); });
  const numCols = sheetRows.length ? sheetRows[0].length : 11;

  const idByNorm = {};
  const nameToSheetId = {};
  const idToSheetIdx = {};
  const usersById = {};
  sheetRows.forEach(function(r, idx) {
    const sheetId = String(r[0] || '').trim();
    const sheetName = String(r[1] || '').replace(/\s+/g, ' ').trim();
    if (!sheetId) return;
    idToSheetIdx[sheetId] = idx;
    idByNorm[sheetId] = sheetId;
    const norm = Users_normalizeIdForImport(sheetId);
    if (norm) idByNorm[norm] = sheetId;
    if (sheetName) nameToSheetId[sheetName] = sheetId;
    usersById[sheetId] = {
      id: sheetId,
      name: sheetName,
      role: Roles_normalize(String(r[2] || '')),
      team_id: String(r[3] || ''),
      unit_affiliation: String(r[4] || ''),
      service_type: String(r[5] || ''),
      military_affiliation: String(r[6] || ''),
      unit_classification: String(r[7] || ''),
      target_role: String(r[8] || ''),
      phone: r[9] == null ? '' : String(r[9]),
      email: r[10] == null ? '' : String(r[10])
    };
  });

  let autoIds = null;
  let autoIdx = 0;

  const newUserRows = [];
  const newCredRows = [];
  const createdTeamNames = {};
  const teamNameToId = Users_buildTeamNameMap();
  const pendingTeamRows = [];
  let teamMax = 0;
  _rows('Teams').data.forEach(function(r) {
    const tid = String(r[0] || '');
    const m = tid.match(/^T(\d+)$/i);
    if (m) teamMax = Math.max(teamMax, parseInt(m[1], 10));
    else {
      const n = parseInt(tid, 10);
      if (!isNaN(n)) teamMax = Math.max(teamMax, n);
    }
  });
  const teamIdSeq = { next: teamMax };
  const usersSheet = _sheet('Users');
  const teamById = Teams_byIdMap();
  let sheetDirty = false;

  rows.forEach(function(row, i) {
    const name = String(row.name || '').replace(/\s+/g, ' ').trim();
    let id = Users_normalizeIdForImport(row.id || row.personal_id || '');
    let password = String(row.password || '').trim();
    const line = i + 1;

    if (!name) {
      errors.push('שורה ' + line + ': חסר שם מלא');
      return;
    }

    if (!id) {
      if (!autoIds) autoIds = Users_nextIds(rows.length);
      id = autoIds[autoIdx++] || ('U' + Date.now() + '_' + i);
    }

    if (!password) password = id;

    const finalRole = typeof Roles_fromImport === 'function'
      ? Roles_fromImport(row.role || 'trainee')
      : 'trainee';

    const teamRaw = Users_extractTeamFromImportRow(row);
    const hasTeamInFile = !!teamRaw;

    const unitAffiliation = String(row.unit_affiliation || '').trim();
    const serviceType = String(row.service_type || '').trim();
    const militaryAffiliation = String(row.military_affiliation || '').trim();
    const unitClassification = String(row.unit_classification || '').trim();
    const targetRole = String(row.target_role || '').trim();
    const phone = String(row.phone || '').trim();
    const email = String(row.email || '').trim();

    let teamId = '';
    if (hasTeamInFile) {
      try {
        teamId = Users_ensureTeamIdForImportMap(teamRaw, teamNameToId, createdTeamNames, pendingTeamRows, teamIdSeq);
        if (!teamId) {
          errors.push('שורה ' + line + ': לא נוצר צוות עבור «' + teamRaw + '»');
        } else if (!teamById[teamId]) {
          teamById[teamId] = { id: teamId, name: teamRaw, commander_id: '' };
        }
      } catch (teamErr) {
        errors.push('שורה ' + line + ': יצירת צוות «' + teamRaw + '» נכשלה — ' +
          (teamErr && teamErr.message ? teamErr.message : String(teamErr)));
      }
    }

    let sheetId = idByNorm[id] || '';
    if (!sheetId && nameToSheetId[name]) sheetId = nameToSheetId[name];

    if (sheetId) {
      const dataIdx = idToSheetIdx[sheetId];
      if (dataIdx == null || dataIdx < 0) {
        errors.push('שורה ' + line + ': רשומה ' + sheetId + ' לא נמצאה בגיליון');
        return;
      }
      const cur = usersById[sheetId] || {};
      const prevTeam = String(cur.team_id || '');
      if (!hasTeamInFile) teamId = prevTeam;

      const roleToWrite = row.role
        ? finalRole
        : (Roles_normalize(cur.role || 'trainee') || 'trainee');

      const nextUnitAff = unitAffiliation !== '' ? unitAffiliation : String(cur.unit_affiliation || '');
      const nextService = serviceType !== '' ? serviceType : String(cur.service_type || '');
      const nextMilitary = militaryAffiliation !== '' ? militaryAffiliation : String(cur.military_affiliation || '');
      const nextUnitClass = unitClassification !== '' ? unitClassification : String(cur.unit_classification || '');
      const nextTarget = targetRole !== '' ? targetRole : String(cur.target_role || '');
      const nextPhone = phone !== '' ? phone : String(cur.phone || '');
      const nextEmail = email !== '' ? email : String(cur.email || '');
      const nextTeam = hasTeamInFile ? teamId : prevTeam;

      sheetRows[dataIdx][1] = name;
      sheetRows[dataIdx][2] = roleToWrite;
      sheetRows[dataIdx][3] = nextTeam;
      sheetRows[dataIdx][4] = nextUnitAff;
      sheetRows[dataIdx][5] = nextService;
      sheetRows[dataIdx][6] = nextMilitary;
      sheetRows[dataIdx][7] = nextUnitClass;
      sheetRows[dataIdx][8] = nextTarget;
      sheetRows[dataIdx][9] = nextPhone;
      sheetRows[dataIdx][10] = nextEmail;
      sheetDirty = true;

      usersById[sheetId] = Object.assign({}, cur, {
        name: name,
        role: roleToWrite,
        team_id: nextTeam,
        unit_affiliation: nextUnitAff,
        service_type: nextService,
        military_affiliation: nextMilitary,
        unit_classification: nextUnitClass,
        target_role: nextTarget,
        phone: nextPhone,
        email: nextEmail
      });

      if (hasTeamInFile && String(teamId) !== String(prevTeam)) {
        teamsReassigned++;
        const prevLabel = prevTeam
          ? ((teamById[prevTeam] && teamById[prevTeam].name) || prevTeam)
          : '—';
        const nextLabel = teamId
          ? ((teamById[teamId] && teamById[teamId].name) || teamId)
          : '—';
        teamChangeNotes.push(name + ': ' + prevLabel + ' → ' + nextLabel);
      }
      updated++;
      return;
    }

    newUserRows.push([
      id,
      name,
      finalRole,
      teamId,
      unitAffiliation,
      serviceType,
      militaryAffiliation,
      unitClassification,
      targetRole,
      phone,
      email
    ]);
    newCredRows.push([id, password]);
    idByNorm[id] = id;
    nameToSheetId[name] = id;
    added++;
  });

  if (pendingTeamRows.length) _appendBatch('Teams', pendingTeamRows);

  teamsCreated = pendingTeamRows.length;

  if (sheetDirty && sheetRows.length) {
    usersSheet.getRange(2, 1, sheetRows.length, numCols).setValues(sheetRows);
  }
  if (newUserRows.length) _appendBatch('Users', newUserRows);
  if (newCredRows.length) _appendBatch('Credentials', newCredRows);

  try { SpreadsheetApp.flush(); } catch (flushErr) { /* ignore */ }

  _usersById = null;
  _teamsById = null;
  if (added || updated) {
    _cacheInvalidate('Users');
    if (added) _cacheInvalidate('Credentials');
  }
  if (teamsCreated) _cacheInvalidate('Teams');
  } finally {
    _cacheEndBatch();
  }

  if (!added && !updated) {
    const detail = errors.length ? errors.slice(0, 5).join(' | ') : 'לא זוהו שורות תקינות';
    throw new Error('לא נוסף/עודכן אף משתמש. ' + detail);
  }

  let info = '✓ ייבוא הושלם';
  if (added) info += ': ' + added + ' נוספו';
  if (updated) info += (added ? ' · ' : ': ') + updated + ' עודכנו';
  if (teamsReassigned) info += ' · ' + teamsReassigned + ' שיוכי צוות הוחלפו';
  if (teamChangeNotes.length) {
    info += ' (' + teamChangeNotes.slice(0, 5).join('; ') +
      (teamChangeNotes.length > 5 ? '…' : '') + ')';
  }
  if (teamsCreated) info += ' · ' + teamsCreated + ' צוותים נוצרו';
  if (errors.length) {
    info += ' · התראות: ' + errors.slice(0, 3).join(' | ');
  }

  return { ok: true, info: info, page: 'users', tab: 'users' };
}
