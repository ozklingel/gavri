// assignment_conflicts.gs — התנגשויות שיבוץ (זמן / נוהל קרב)

var ASSIGNMENT_MIN_PROCEDURE_GAP_MS = 5 * 3600000;

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

function AssignmentConflicts_buildItem(userId, exIdA, exIdB, exById, type, gapMs) {
  const u = Users_get(userId);
  const exA = exById[exIdA];
  const exB = exById[exIdB];
  const item = {
    type: type,
    user_id: userId,
    user_name: u ? u.name : userId,
    exercise_a_id: exIdA,
    exercise_b_id: exIdB,
    exercise_a_title: exA ? exA.title : exIdA,
    exercise_b_title: exB ? exB.title : exIdB,
    exercise_a_label: AssignmentConflicts_exerciseLabel(exA),
    exercise_b_label: AssignmentConflicts_exerciseLabel(exB)
  };
  if (type === 'procedure' && gapMs != null) {
    item.gap_hours = Math.round(gapMs / 360000) / 10;
  }
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

function AssignmentConflicts_compareUserExercises(userId, exIds, exRanges, exById) {
  const timeOverlaps = [];
  const procedureGaps = [];
  if (!exIds || exIds.length < 2) return { timeOverlaps: timeOverlaps, procedureGaps: procedureGaps };

  for (let i = 0; i < exIds.length; i++) {
    for (let j = i + 1; j < exIds.length; j++) {
      const r1 = exRanges[exIds[i]];
      const r2 = exRanges[exIds[j]];
      if (!r1 || !r2) continue;

      if (_timesOverlap(r1, r2)) {
        timeOverlaps.push(AssignmentConflicts_buildItem(
          userId, exIds[i], exIds[j], exById, 'time', null
        ));
      } else {
        const gap = AssignmentConflicts_gapMs(r1, r2);
        if (gap < ASSIGNMENT_MIN_PROCEDURE_GAP_MS) {
          procedureGaps.push(AssignmentConflicts_buildItem(
            userId, exIds[i], exIds[j], exById, 'procedure', gap
          ));
        }
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
      userId, userExercises[userId], exRanges, exById
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

  const userIds = {};
  Assignments_byExercise(exId).forEach(function(a) {
    userIds[a.user_id] = true;
  });

  const timeOverlaps = [];
  const procedureGaps = [];

  Object.keys(userIds).forEach(function(userId) {
    const exIds = AssignmentConflicts_userExerciseIds(userId);
    const part = AssignmentConflicts_compareUserExercises(userId, exIds, exRanges, exById);
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
  return AssignmentConflicts_compareUserExercises(userId, exIds, exRanges, exById);
}

function AssignmentConflicts_message(item) {
  if (!item) return '';
  if (item.type === 'time') {
    return item.user_name + ' — חפיפה בזמן בין "' + item.exercise_a_title + '" ל"' + item.exercise_b_title + '"';
  }
  return item.user_name + ' — מרווח ' + item.gap_hours + ' שעות בין "' +
    item.exercise_a_title + '" ל"' + item.exercise_b_title + '" (נדרשות לפחות 5 שעות)';
}

function AssignmentConflicts_checkNewAssignment(userId, exerciseId) {
  const result = AssignmentConflicts_wouldCreate(userId, exerciseId);
  const warnings = [];
  result.timeOverlaps.forEach(function(c) {
    if (c.exercise_a_id === exerciseId || c.exercise_b_id === exerciseId) {
      warnings.push({ type: 'time', message: AssignmentConflicts_message(c) });
    }
  });
  result.procedureGaps.forEach(function(c) {
    if (c.exercise_a_id === exerciseId || c.exercise_b_id === exerciseId) {
      warnings.push({ type: 'procedure', message: AssignmentConflicts_message(c) });
    }
  });
  return warnings;
}
