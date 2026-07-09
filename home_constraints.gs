// home_constraints.gs — אילוצי זמן בית (יציאה הביתה)

function HomeConstraints_appendRow(row) {
  const sh = _sheet('HomeConstraints');
  const last = sh.getLastRow();
  sh.getRange(last + 1, 1, 1, row.length).setValues([row]);
  sh.getRange(last + 1, 3, 1, 4).setNumberFormat('@');
  _cacheInvalidate('HomeConstraints');
}

function HomeConstraints_all() {
  return _rows('HomeConstraints').data.map(function(r) {
    return {
      id:             String(r[0]),
      user_id:        String(r[1] || ''),
      start_date:     _rawDate(r[2]),
      start_time:     _rawTime(r[3]),
      end_date:       _rawDate(r[4]),
      end_time:       _rawTime(r[5]),
      notes:          String(r[6] || ''),
      status:         String(r[7] || 'pending'),
      approval_tier:  String(r[8] || ''),
      supervisor_id:  String(r[9] || ''),
      approved_by:    String(r[10] || ''),
      approved_at:    String(r[11] || ''),
      rejection_note: String(r[12] || ''),
      created_at:     String(r[13] || '')
    };
  });
}

function HomeConstraints_get(id) {
  return HomeConstraints_all().find(function(x) { return x.id === String(id); }) || null;
}

function HomeConstraints_statusLabel(status) {
  if (status === 'approved') return 'אושר';
  if (status === 'rejected') return 'נדחה';
  return 'ממתין לאישור';
}

function HomeConstraints_approvalTierForRole(role) {
  const r = Roles_normalize(role);
  if (r === 'trainee') return 'companyCommander';
  if (['companyCommander', 'departmentCommander', 'unitCommander', 'tutor'].indexOf(r) !== -1) return 'admin';
  return '';
}

function HomeConstraints_canSubmit(user) {
  return !!HomeConstraints_approvalTierForRole(user && user.role);
}

function HomeConstraints_supervisorIdForUser(user) {
  if (!user) return '';
  const tier = HomeConstraints_approvalTierForRole(user.role);
  if (tier === 'companyCommander') return Users_teamCommanderId(user.id);
  return '';
}

function HomeConstraints_supervisorLabel(item) {
  if (!item) return '';
  if (item.approval_tier === 'companyCommander') {
    const sup = Users_get(item.supervisor_id);
    return sup ? ('מפקצ — ' + sup.name) : 'מפקצ';
  }
  return 'סגל';
}

function HomeConstraints_timeRange(c) {
  if (!c) return null;
  const DAY_MS  = 86400000;
  const HOUR_MS = 3600000;

  const startDate = _rawDate(c.start_date) || String(c.start_date || '').trim();
  const endDate   = _rawDate(c.end_date || c.start_date) || String(c.end_date || c.start_date || '').trim();
  const startTime = _rawTime(c.start_time);
  const endTime   = _rawTime(c.end_time);

  let startMs = _parseRawDate(startDate);
  let endMs   = _parseRawDate(endDate);
  if (isNaN(startMs)) return null;
  if (isNaN(endMs)) endMs = startMs + DAY_MS;

  if (startTime) {
    const parts = startTime.split(':').map(Number);
    startMs += parts[0] * HOUR_MS + (parts[1] || 0) * 60000;
  }
  if (endTime) {
    const parts = endTime.split(':').map(Number);
    endMs = _parseRawDate(endDate) +
      parts[0] * HOUR_MS + (parts[1] || 0) * 60000;
  } else if (!endDate || endDate === startDate) {
    endMs = startMs + DAY_MS;
  }
  if (endMs <= startMs) endMs = startMs + HOUR_MS;
  return { startMs: startMs, endMs: endMs };
}

function HomeConstraints_formatRange(c) {
  if (!c) return '—';
  const startDate = _rawDate(c.start_date) || '';
  const endDate = _rawDate(c.end_date || c.start_date) || startDate;
  const start = _fmtDateTimeFull(startDate, c.start_time);
  const end   = _fmtDateTimeFull(endDate, c.end_time);
  if (start && end && start !== end) return start + ' — ' + end;
  return start || end || '—';
}

function HomeConstraints_byUser(userId) {
  return HomeConstraints_all().filter(function(c) {
    return c.user_id === String(userId);
  });
}

function HomeConstraints_approvedForUser(userId) {
  return HomeConstraints_byUser(userId).filter(function(c) {
    return c.status === 'approved';
  });
}

function HomeConstraints_allApproved() {
  return HomeConstraints_all().filter(function(c) { return c.status === 'approved'; });
}

function HomeConstraints_pendingForApprover(user) {
  if (!user) return [];
  const role = Roles_normalize(user.role);
  return HomeConstraints_all().filter(function(c) {
    if (c.status !== 'pending') return false;
    if (c.approval_tier === 'admin') return Roles_isAdmin(role);
    if (c.approval_tier === 'companyCommander') {
      return Roles_isCompanyCommander(role) && String(c.supervisor_id) === String(user.id);
    }
    return false;
  });
}

function HomeConstraints_canApprove(user, item) {
  if (!user || !item || item.status !== 'pending') return false;
  const role = Roles_normalize(user.role);
  if (item.approval_tier === 'admin') return Roles_isAdmin(role);
  if (item.approval_tier === 'companyCommander') {
    return Roles_isCompanyCommander(role) && String(item.supervisor_id) === String(user.id);
  }
  return false;
}

function HomeConstraints_overlapsExisting(userId, range, excludeId) {
  const mine = HomeConstraints_byUser(userId).filter(function(c) {
    if (excludeId && c.id === excludeId) return false;
    return c.status === 'pending' || c.status === 'approved';
  });
  for (let i = 0; i < mine.length; i++) {
    const other = HomeConstraints_timeRange(mine[i]);
    if (other && _timesOverlap(range, other)) return true;
  }
  return false;
}

function HomeConstraints_conflictsForExercise(userId, exerciseId) {
  const ex = Exercises_get(exerciseId);
  if (!ex) return [];
  const exRange = _exerciseTimeRange(ex);
  if (!exRange) return [];

  return HomeConstraints_approvedForUser(userId).filter(function(c) {
    const cRange = HomeConstraints_timeRange(c);
    return cRange && _timesOverlap(exRange, cRange);
  });
}

function HomeConstraints_checkAssignment(userId, exerciseId) {
  const conflicts = HomeConstraints_conflictsForExercise(userId, exerciseId);
  if (!conflicts.length) return null;
  const u = Users_get(userId);
  const name = u ? u.name : userId;
  return name + ' — אילוץ בית מאושר (' + HomeConstraints_formatRange(conflicts[0]) + ') חופף לזמן התרגיל.';
}

function HomeConstraints_assertCanAssign(userId, exerciseId) {
  const msg = HomeConstraints_checkAssignment(userId, exerciseId);
  if (msg) throw new Error('לא ניתן לשבץ: ' + msg);
}

function HomeConstraints_isUserBlockedAt(userId, range) {
  return HomeConstraints_approvedForUser(userId).some(function(c) {
    const cRange = HomeConstraints_timeRange(c);
    return cRange && range && _timesOverlap(range, cRange);
  });
}

function HomeConstraints_create(p) {
  const user = Auth_current(p);
  if (!user) throw new Error('נדרשת התחברות.');
  if (!HomeConstraints_canSubmit(user)) {
    throw new Error('לתפקידך אין אפשרות להגיש אילוץ בית.');
  }

  const startDate = String(p.start_date || '').trim();
  const endDate   = String(p.end_date || p.start_date || '').trim();
  const startTime = String(p.start_time || '').trim();
  const endTime   = String(p.end_time || '').trim();
  const notes     = String(p.notes || '').trim();

  if (!startDate) throw new Error('חובה לבחור תאריך יציאה הביתה.');
  if (!endDate) throw new Error('חובה לבחור תאריך חזרה.');
  if (isNaN(_parseRawDate(startDate)) || isNaN(_parseRawDate(endDate))) {
    throw new Error('תאריכים לא תקינים.');
  }
  if (_parseRawDate(endDate) < _parseRawDate(startDate)) {
    throw new Error('תאריך החזרה חייב להיות אחרי תאריך היציאה.');
  }

  const tier = HomeConstraints_approvalTierForRole(user.role);
  const supervisorId = HomeConstraints_supervisorIdForUser(user);
  if (tier === 'companyCommander' && !supervisorId) {
    throw new Error('לא נמצא מפקצ ממונה — פנה לסגל.');
  }

  const range = HomeConstraints_timeRange({
    start_date: startDate, start_time: startTime,
    end_date: endDate, end_time: endTime
  });
  if (!range) throw new Error('טווח זמן לא תקין.');
  if (HomeConstraints_overlapsExisting(user.id, range, '')) {
    throw new Error('כבר קיימת בקשה פעילה בטווח זמן זה.');
  }

  const id = 'HC' + new Date().getTime();
  HomeConstraints_appendRow([
    id, user.id, startDate, startTime, endDate, endTime, notes,
    'pending', tier, supervisorId, '', '', '', new Date().toISOString()
  ]);

  return Views_homeConstraints({
    sid: p.sid,
    info: 'בקשת אילוץ בית נשלחה לאישור ' + (tier === 'admin' ? 'הסגל' : 'המפקצ') + '.'
  });
}

function HomeConstraints_approve(p) {
  const user = Auth_current(p);
  if (!user) throw new Error('נדרשת התחברות.');

  const id = String(p.id || '').trim();
  const item = HomeConstraints_get(id);
  if (!item) throw new Error('הבקשה לא נמצאה.');
  if (!HomeConstraints_canApprove(user, item)) throw new Error('אין הרשאה לאשר בקשה זו.');

  const row = _findRowIndex('HomeConstraints', id);
  if (row < 0) throw new Error('הבקשה לא נמצאה.');

  _sheet('HomeConstraints').getRange(row, 8, 1, 5).setValues([[
    'approved', item.approval_tier, item.supervisor_id,
    user.id, new Date().toISOString()
  ]]);
  _cacheInvalidate('HomeConstraints');

  return Views_homeConstraints({ sid: p.sid, info: 'הבקשה אושרה.' });
}

function HomeConstraints_reject(p) {
  const user = Auth_current(p);
  if (!user) throw new Error('נדרשת התחברות.');

  const id = String(p.id || '').trim();
  const note = String(p.rejection_note || '').trim();
  const item = HomeConstraints_get(id);
  if (!item) throw new Error('הבקשה לא נמצאה.');
  if (!HomeConstraints_canApprove(user, item)) throw new Error('אין הרשאה לדחות בקשה זו.');

  const row = _findRowIndex('HomeConstraints', id);
  if (row < 0) throw new Error('הבקשה לא נמצאה.');

  _sheet('HomeConstraints').getRange(row, 8, 1, 6).setValues([[
    'rejected', item.approval_tier, item.supervisor_id,
    user.id, new Date().toISOString(), note
  ]]);
  _cacheInvalidate('HomeConstraints');

  return Views_homeConstraints({ sid: p.sid, info: 'הבקשה נדחתה.' });
}

function HomeConstraints_blocksMapForAssign() {
  const map = {};
  HomeConstraints_allApproved().forEach(function(c) {
    if (!map[c.user_id]) map[c.user_id] = [];
    map[c.user_id].push({
      range: HomeConstraints_formatRange(c),
      start_date: c.start_date,
      end_date: c.end_date || c.start_date,
      start_time: c.start_time,
      end_time: c.end_time
    });
  });
  return map;
}

function HomeConstraints_blockedPairsForAssign() {
  const pairs = {};
  const exercises = Exercises_all();
  exercises.forEach(function(ex) {
    Users_all().forEach(function(u) {
      const conflicts = HomeConstraints_conflictsForExercise(u.id, ex.id);
      if (conflicts.length) {
        pairs[u.id + '\x1f' + ex.id] = HomeConstraints_formatRange(conflicts[0]);
      }
    });
  });
  return pairs;
}
