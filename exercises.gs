// ═══════════════════════════════════════
//  exercises.gs — exercise CRUD + duplication
// ═══════════════════════════════════════

// Format a spreadsheet date cell value → e.g. "יום שלישי, 15 באפריל 2025"
// Google Sheets gives Date cells as JS Date objects (midnight UTC).
function _fmtDate(val) {
  if (!val) return '';
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const days   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let dd, mm, yy, wd;
  if (val instanceof Date) {
    // Sheet Date objects are midnight UTC — use UTC accessors to avoid timezone shift
    dd = val.getUTCDate();
    mm = val.getUTCMonth();
    yy = val.getUTCFullYear();
    wd = val.getUTCDay();
  } else {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    dd = d.getUTCDate();
    mm = d.getUTCMonth();
    yy = d.getUTCFullYear();
    wd = d.getUTCDay();
  }
  return 'יום ' + days[wd] + ', ' + dd + ' ב' + months[mm] + ' ' + yy;
}


// Returns "YYYY-MM-DD" for the date picker value attribute
function _rawDate(val) {
  if (!val) return '';
  let d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return y + '-' + m + '-' + dd;
}

function Exercises_all() {
  return _rows('Exercises').data.map(r => ({
    id: String(r[0]), title: String(r[1]), description: String(r[2]),
    created_by: String(r[3]), date: _fmtDate(r[4]), rawDate: _rawDate(r[4])
  }));
}

function Exercises_get(id) {
  return Exercises_all().find(e => e.id === String(id)) || null;
}

function Exercises_details(exerciseId) {
  return _rows('ExerciseDetails').data
    .filter(r => String(r[1]) === String(exerciseId))
    .map(r => ({ id: String(r[0]), time: String(r[2]), location: String(r[3]), description: String(r[4]) }));
}

function Exercises_create(p) {
  const u      = Auth_requireRole(p, ['admin']);
  const id     = 'E' + _nextId('Exercises');
  const teamId = (p.teamId || '').trim();

  _append('Exercises', [id, p.title || '', p.description || '', u.id, p.date || '']);

  let info = 'התרגיל נוצר בהצלחה (' + id + ').';

  if (teamId) {
    const result = Assignments_assignTeam(id, teamId, p.sid);
    const team   = Teams_get(teamId);
    const tName  = team ? team.name : teamId;
    if (result.added > 0) {
      info += ' ' + result.added + ' חיילים מצוות "' + tName + '" נוספו אוטומטית.';
    }
    if (result.skipped > 0) {
      info += ' (' + result.skipped + ' כבר משתתפים.)';
    }
    // Open the exercise page so admin can see/edit participants
    return Views_exercise({ sid: p.sid, id: id, info: info });
  }

  return Views_dashboard({ sid: p.sid, info: info });
}

function Exercises_edit(p) {
  Auth_requireRole(p, ['admin']);
  const row = _findRowIndex('Exercises', p.id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  const sh = _sheet('Exercises');
  sh.getRange(row, 2).setValue(p.title || '');
  sh.getRange(row, 3).setValue(p.description || '');
  sh.getRange(row, 5).setValue(p.date || '');
  return Views_exercise({ sid: p.sid, id: p.id, info: 'התרגיל עודכן בהצלחה.' });
}

function Exercises_duplicate(p) {
  const u = Auth_requireRole(p, ['admin']);
  const orig = Exercises_get(p.id);
  if (!orig) throw new Error('התרגיל לא נמצא.');
  const newId = 'E' + _nextId('Exercises');
  _append('Exercises', [newId, orig.title + ' (copy)', orig.description, u.id, orig.date]);
  Exercises_details(orig.id).forEach(d => {
    const did = 'D' + _nextId('ExerciseDetails');
    _append('ExerciseDetails', [did, newId, d.time, d.location, d.description]);
  });
  return Views_dashboard({ sid: p.sid, info: 'התרגיל שוכפל כ-' + newId + '.' });
}

function Exercises_addDetail(p) {
  Auth_requireRole(p, ['admin']);
  const exId = p.exerciseId;
  if (!Exercises_get(exId)) throw new Error('התרגיל לא נמצא.');
  const did = 'D' + _nextId('ExerciseDetails');
  _append('ExerciseDetails', [did, exId, p.time || '', p.location || '', p.detailDescription || '']);
  return Views_exercise({ sid: p.sid, id: exId, info: 'רישום ציר הזמן נוסף בהצלחה.' });
}

// Safe delete: removes exercise + all its ExerciseDetails + all its Assignments
function Exercises_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = (p.id || '').trim();
  if (!id) throw new Error('חסר מזהה תרגיל.');

  // 1. Delete all Assignments for this exercise
  const assignSh = _sheet('Assignments');
  let assignData = _rows('Assignments').data;
  // Delete from bottom up to preserve row indices
  for (let i = assignData.length - 1; i >= 0; i--) {
    if (String(assignData[i][1]) === id) {
      assignSh.deleteRow(i + 2); // +2: 1-based + header row
    }
  }

  // 2. Delete all ExerciseDetails for this exercise
  const detailSh = _sheet('ExerciseDetails');
  let detailData = _rows('ExerciseDetails').data;
  for (let i = detailData.length - 1; i >= 0; i--) {
    if (String(detailData[i][1]) === id) {
      detailSh.deleteRow(i + 2);
    }
  }

  // 3. Delete the exercise itself
  const row = _findRowIndex('Exercises', id);
  if (row < 0) throw new Error('התרגיל לא נמצא.');
  _sheet('Exercises').deleteRow(row);

  return Views_dashboard({ sid: p.sid, info: 'התרגיל נמחק יחד עם כל ההקצאות ורשומות ציר הזמן.' });
}