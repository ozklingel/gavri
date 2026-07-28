// assignment_conflicts.gs — התנגשויות שיבוץ
// 1) time (חמורה): אדם משובץ בשני תרגילים חופפים בזמן
// 2) procedure (אזהרה): משובץ לתרגיל בזמן שנוה״ק של תרגיל אחר שהוא משובץ אליו מתקיים

var ASSIGNMENT_PROCEDURE_DEFAULT_MS = 3600000; // שעה אם אין סוף מפורש לאירוע נוה״ק

function AssignmentConflicts_gapMs(r1, r2) {
  if (!r1 || !r2) return Infinity;
  if (_timesOverlap(r1, r2)) return 0;
  if (r1.endMs <= r2.startMs) return r2.startMs - r1.endMs;
  return r1.startMs - r2.endMs;
}

function AssignmentConflicts_exerciseLabel(ex) {
  if (!ex) return '';
  const when = _fmtExerciseScheduleRange(ex);
  return ex.title + (when ? ' · ' + when : '');
}

function AssignmentConflicts_buildItem(userId, exIdA, exIdB, exById, type, extra) {
  const u = Users_get(userId);
  const exA = exById[exIdA];
  const exB = exById[exIdB];
  const item = {
    type: type,
    severity: type === 'time' ? 'severe' : 'warning',
    user_id: userId,
    user_name: u ? u.name : userId,
    exercise_a_id: exIdA,
    exercise_b_id: exIdB,
    exercise_a_title: exA ? exA.title : exIdA,
    exercise_b_title: exB ? exB.title : exIdB,
    exercise_a_label: AssignmentConflicts_exerciseLabel(exA),
    exercise_b_label: AssignmentConflicts_exerciseLabel(exB)
  };
  if (extra && extra.procedure_label) item.procedure_label = extra.procedure_label;
  if (extra && extra.gap_hours != null) item.gap_hours = extra.gap_hours;
  return item;
}

function AssignmentConflicts_userExerciseIds(userId, extraExId) {
  const ids = [];
  Assignments_all().forEach(function(a) {
    if (a.user_id !== String(userId)) return;
    if (ids.indexOf(a.exercise_id) === -1) ids.push(a.exercise_id);
  });
  if (extraExId && ids.indexOf(extraExId) === -1) ids.push(extraExId);
  return ids;
}

/** טווחי אירועי נוה״ק לתרגיל */
function AssignmentConflicts_procedureRanges(exId, detailsIndex) {
  const details = (detailsIndex && detailsIndex[String(exId)]) ||
    (typeof Exercises_details === 'function' ? Exercises_details(exId) : []) || [];
  const ranges = [];
  details.forEach(function(d) {
    const startMs = _exerciseDetailSortMs(d.rawTime);
    if (!isFinite(startMs) || startMs >= Number.MAX_SAFE_INTEGER - 2) return;

    let endMs = startMs + ASSIGNMENT_PROCEDURE_DEFAULT_MS;
    const raw = String(d.rawTime || '');
    // טווח מפורש: "2026-01-01 08:00 — 2026-01-01 10:00" או "08:00-10:00"
    const full = raw.match(
      /(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})\s*[—\-–]\s*(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})/
    );
    if (full) {
      const e = _exerciseDetailSortMs(full[2]);
      if (isFinite(e) && e > startMs) endMs = e;
    } else {
      const hm = raw.match(/(\d{1,2}:\d{2})\s*[—\-–]\s*(\d{1,2}:\d{2})/);
      if (hm) {
        const day = Exercise_msToYmd ? Exercise_msToYmd(startMs) : '';
        if (day && typeof Exercise_msFromYmdHm === 'function') {
          const e = Exercise_msFromYmdHm(day, hm[2]);
          if (!isNaN(e) && e > startMs) endMs = e;
          else if (!isNaN(e) && e <= startMs) {
            endMs = Exercise_msFromYmdHm(_ymdPlusDays(day, 1), hm[2]);
          }
        }
      }
    }

    ranges.push({
      startMs: startMs,
      endMs: endMs,
      label: String(d.description || d.time || 'נוה״ק').substring(0, 80)
    });
  });
  return ranges;
}

/**
 * משווה תרגילים של אותו משתמש:
 * - time: חפיפת זמני תרגיל ↔ תרגיל (חמורה)
 * - procedure: נוה״ק של תרגיל א׳ חופף לזמן תרגיל ב׳ (אזהרה בלבד)
 */
function AssignmentConflicts_compareUserExercises(userId, exIds, exRanges, exById, detailsIndex) {
  const timeOverlaps = [];
  const procedureGaps = [];
  if (!exIds || exIds.length < 2) return { timeOverlaps: timeOverlaps, procedureGaps: procedureGaps };

  const detailsIdx = detailsIndex ||
    (typeof Exercises_detailsIndex === 'function' ? Exercises_detailsIndex() : {});

  for (let i = 0; i < exIds.length; i++) {
    for (let j = i + 1; j < exIds.length; j++) {
      const idA = exIds[i];
      const idB = exIds[j];
      const rA = exRanges[idA];
      const rB = exRanges[idB];
      if (!rA || !rB) continue;

      // התנגשות חמורה — משובץ בשני תרגילים חופפים
      if (_timesOverlap(rA, rB)) {
        timeOverlaps.push(AssignmentConflicts_buildItem(
          userId, idA, idB, exById, 'time', null
        ));
        continue; // לא כפולים גם כאזהרת נוה״ק
      }

      // אזהרה — נוה״ק של אחד חופף לזמן התרגיל של השני
      const procsA = AssignmentConflicts_procedureRanges(idA, detailsIdx);
      const procsB = AssignmentConflicts_procedureRanges(idB, detailsIdx);
      let hit = null;

      for (let p = 0; p < procsA.length && !hit; p++) {
        if (_timesOverlap(procsA[p], rB)) {
          hit = {
            procedure_label: procsA[p].label,
            hostExId: idA,
            drillExId: idB
          };
        }
      }
      for (let q = 0; q < procsB.length && !hit; q++) {
        if (_timesOverlap(procsB[q], rA)) {
          hit = {
            procedure_label: procsB[q].label,
            hostExId: idB,
            drillExId: idA
          };
        }
      }
      if (hit) {
        procedureGaps.push(AssignmentConflicts_buildItem(
          userId, hit.drillExId, hit.hostExId, exById, 'procedure', {
            procedure_label: hit.procedure_label
          }
        ));
      }
    }
  }
  return { timeOverlaps: timeOverlaps, procedureGaps: procedureGaps };
}

function AssignmentConflicts_scan() {
  const exercises = Exercises_all();
  const exById = {};
  const exRanges = {};
  exercises.forEach(function(ex) {
    exById[ex.id] = ex;
    exRanges[ex.id] = _exerciseTimeRange(ex);
  });
  const detailsIndex = typeof Exercises_detailsIndex === 'function' ? Exercises_detailsIndex() : {};

  const userExercises = {};
  Assignments_all().forEach(function(a) {
    if (!userExercises[a.user_id]) userExercises[a.user_id] = [];
    if (userExercises[a.user_id].indexOf(a.exercise_id) === -1) {
      userExercises[a.user_id].push(a.exercise_id);
    }
  });

  const timeOverlaps = [];
  const procedureGaps = [];

  Object.keys(userExercises).forEach(function(userId) {
    const part = AssignmentConflicts_compareUserExercises(
      userId, userExercises[userId], exRanges, exById, detailsIndex
    );
    timeOverlaps.push.apply(timeOverlaps, part.timeOverlaps);
    procedureGaps.push.apply(procedureGaps, part.procedureGaps);
  });

  return { timeOverlaps: timeOverlaps, procedureGaps: procedureGaps };
}

function AssignmentConflicts_forExercise(exerciseId) {
  const exId = String(exerciseId || '');
  if (!exId) return { timeOverlaps: [], procedureGaps: [] };

  const exercises = Exercises_all();
  const exById = {};
  const exRanges = {};
  exercises.forEach(function(ex) {
    exById[ex.id] = ex;
    exRanges[ex.id] = _exerciseTimeRange(ex);
  });
  const detailsIndex = typeof Exercises_detailsIndex === 'function' ? Exercises_detailsIndex() : {};

  const userIds = {};
  Assignments_byExercise(exId).forEach(function(a) {
    userIds[a.user_id] = true;
  });

  const timeOverlaps = [];
  const procedureGaps = [];

  Object.keys(userIds).forEach(function(userId) {
    const exIds = AssignmentConflicts_userExerciseIds(userId);
    const part = AssignmentConflicts_compareUserExercises(
      userId, exIds, exRanges, exById, detailsIndex
    );
    part.timeOverlaps.forEach(function(c) {
      if (c.exercise_a_id === exId || c.exercise_b_id === exId) timeOverlaps.push(c);
    });
    part.procedureGaps.forEach(function(c) {
      if (c.exercise_a_id === exId || c.exercise_b_id === exId) procedureGaps.push(c);
    });
  });

  return { timeOverlaps: timeOverlaps, procedureGaps: procedureGaps };
}

function AssignmentConflicts_wouldCreate(userId, exerciseId) {
  const exIds = AssignmentConflicts_userExerciseIds(userId, exerciseId);
  const exercises = Exercises_all();
  const exById = {};
  const exRanges = {};
  exercises.forEach(function(ex) {
    exById[ex.id] = ex;
    exRanges[ex.id] = _exerciseTimeRange(ex);
  });
  const detailsIndex = typeof Exercises_detailsIndex === 'function' ? Exercises_detailsIndex() : {};
  return AssignmentConflicts_compareUserExercises(
    userId, exIds, exRanges, exById, detailsIndex
  );
}

function AssignmentConflicts_message(item) {
  if (!item) return '';
  if (item.type === 'time') {
    return item.user_name + ' משובץ בשני תרגילים חופפים: "' +
      item.exercise_a_title + '" ו-"' + item.exercise_b_title + '"';
  }
  // procedure — אזהרה: נוה״ק מול תרגיל
  const proc = item.procedure_label ? (' («' + item.procedure_label + '»)') : '';
  return item.user_name + ' משובץ לתרגיל "' + item.exercise_a_title +
    '" בזמן שמתקיים נוה״ק' + proc + ' של "' + item.exercise_b_title + '"';
}

function AssignmentConflicts_checkNewAssignment(userId, exerciseId) {
  const result = AssignmentConflicts_wouldCreate(userId, exerciseId);
  const warnings = [];
  result.timeOverlaps.forEach(function(c) {
    if (c.exercise_a_id === exerciseId || c.exercise_b_id === exerciseId) {
      warnings.push({
        type: 'time',
        severity: 'severe',
        message: AssignmentConflicts_message(c)
      });
    }
  });
  result.procedureGaps.forEach(function(c) {
    if (c.exercise_a_id === exerciseId || c.exercise_b_id === exerciseId) {
      warnings.push({
        type: 'procedure',
        severity: 'warning',
        message: AssignmentConflicts_message(c)
      });
    }
  });
  return warnings;
}
