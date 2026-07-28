// exports.gs — ייצוא תרגילים לאקסל (CSV עם BOM)

function _exportCsvEscape(val) {
  var s = String(val == null ? '' : val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function _exportCsvBuild(rows) {
  var body = (rows || []).map(function(row) {
    return (row || []).map(_exportCsvEscape).join(',');
  }).join('\n');
  return '\uFEFF' + body;
}

function _exportYmdStamp() {
  var d = new Date();
  function p(n) { return n < 10 ? '0' + n : String(n); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function _exportAssigneeLabel(userId, usersById) {
  var u = usersById[userId];
  if (!u) return String(userId || '');
  var name = String(u.name || userId);
  return name + (userId ? ' (' + userId + ')' : '');
}

/** סדר עמודות תפקידים: טבלת שליטה + אופציות שיבוץ + תפקידים בפועל */
function _exportRoleColumns(assigns) {
  var ordered = [];
  var seen = {};

  function add(role) {
    role = String(role || '').trim();
    if (!role || seen[role]) return;
    seen[role] = true;
    ordered.push(role);
  }

  if (typeof _exerciseMatrixRoleTiers === 'function') {
    var tiers = _exerciseMatrixRoleTiers();
    ['brigade', 'battalion', 'company'].forEach(function(tk) {
      if (tiers[tk] && tiers[tk].roles) {
        tiers[tk].roles.forEach(add);
      }
    });
  }

  if (typeof _assignmentRespOptions === 'function') {
    _assignmentRespOptions().forEach(add);
  }

  if (typeof Assignments_slotConfig === 'function') {
    Assignments_slotConfig().forEach(function(s) { add(s.resp); });
  }

  (assigns || []).forEach(function(a) { add(a.responsibility); });
  return ordered;
}

/**
 * 1) טבלת תרגילים + שיבוצים בכל תפקיד (ללא נוה״ק)
 * שורה = תרגיל, עמודות = פרטי תרגיל + תפקידים
 */
function exportExercisesAssignmentsCsv(sid) {
  Auth_require({ sid: sid });

  var exercises = Exercises_all().slice().sort(function(a, b) {
    return String(a.rawStartDate || a.id).localeCompare(String(b.rawStartDate || b.id));
  });
  var assigns = Assignments_all();
  var usersById = typeof Users_byIdMap === 'function' ? Users_byIdMap() : {};
  if (!Object.keys(usersById).length) {
    Users_all().forEach(function(u) { usersById[u.id] = u; });
  }

  var roles = _exportRoleColumns(assigns).filter(function(role) {
    return assigns.some(function(a) {
      var resp = String(a.responsibility || '').trim();
      if (!resp) return role === '(ללא תפקיד)';
      return resp === role;
    });
  });
  if (assigns.some(function(a) { return !String(a.responsibility || '').trim(); })) {
    if (roles.indexOf('(ללא תפקיד)') === -1) roles.push('(ללא תפקיד)');
  }
  if (!roles.length) {
    roles = _exportRoleColumns([]);
  }

  var byExRole = {};
  assigns.forEach(function(a) {
    var resp = String(a.responsibility || '').trim();
    if (!resp) resp = '(ללא תפקיד)';
    var key = a.exercise_id + '\x1f' + resp;
    if (!byExRole[key]) byExRole[key] = [];
    byExRole[key].push(_exportAssigneeLabel(a.user_id, usersById));
  });

  var header = [
    'מזהה', 'שם תרגיל', 'סוג', 'התחלה', 'סיום',
    'גדוד שותף', 'מחנה', 'מפקד גדוד', 'כוח בשטח'
  ].concat(roles);

  var rows = [header];
  exercises.forEach(function(ex) {
    var row = [
      ex.id,
      ex.title || '',
      ex.exercise_type || '',
      ex.start_date || '',
      ex.end_date || '',
      ex.partner_battalion || '',
      ex.camp || '',
      ex.battalion_commander || '',
      ex.field_force_id || ''
    ];
    roles.forEach(function(role) {
      var list = byExRole[ex.id + '\x1f' + role] || [];
      row.push(list.join('; '));
    });
    rows.push(row);
  });

  return {
    ok: true,
    filename: 'תרגילים-שיבוצים-' + _exportYmdStamp() + '.csv',
    csv: _exportCsvBuild(rows),
    rows: rows.length - 1,
    roles: roles.length
  };
}

/**
 * 2) טבלת תרגילים + זמני נוהל קרב (אירועי ExerciseDetails)
 * שורה = אירוע נוה״ק (עם פרטי התרגיל)
 */
function exportExercisesProceduresCsv(sid) {
  Auth_require({ sid: sid });

  var exercises = Exercises_all().slice().sort(function(a, b) {
    return String(a.rawStartDate || a.id).localeCompare(String(b.rawStartDate || b.id));
  });
  var detailsByEx = Exercises_detailsIndex();

  var rows = [[
    'מזהה תרגיל', 'שם תרגיל', 'סוג',
    'התחלת תרגיל', 'סיום תרגיל',
    'זמן נוה״ק', 'מיקום', 'תיאור אירוע נוה״ק'
  ]];

  exercises.forEach(function(ex) {
    var details = detailsByEx[ex.id] || Exercises_details(ex.id) || [];
    if (!details.length) {
      rows.push([
        ex.id,
        ex.title || '',
        ex.exercise_type || '',
        ex.start_date || '',
        ex.end_date || '',
        '',
        '',
        '(אין אירועי נוה״ק)'
      ]);
      return;
    }
    details.forEach(function(d) {
      rows.push([
        ex.id,
        ex.title || '',
        ex.exercise_type || '',
        ex.start_date || '',
        ex.end_date || '',
        d.time || '',
        d.location || '',
        d.description || ''
      ]);
    });
  });

  return {
    ok: true,
    filename: 'תרגילים-נוהל-קרב-' + _exportYmdStamp() + '.csv',
    csv: _exportCsvBuild(rows),
    rows: rows.length - 1
  };
}
