/**
 * assignments.gs — Assignments + completion
 *
 * Rules:
 *   - Admin can assign to anyone.
 *   - Commander can only assign to trainees in their own team.
 *   - Only Admin or Commander (of the trainee's team) can mark complete.
 *   - Trainees can never assign or complete.
 */

function Assignments_all() {
  return readSheet('Assignments');
}

function Assignments_forUser(userId) {
  userId = String(userId);
  return Assignments_all().filter(function (a) {
    return String(a.user_id) === userId;
  });
}

function Assignments_forExercise(exerciseId) {
  exerciseId = String(exerciseId);
  return Assignments_all().filter(function (a) {
    return String(a.exercise_id) === exerciseId;
  });
}

function Assignments_handleAssign(session, params) {
  Auth_requireRole(session, ['admin', 'commander']);
  var exerciseId = String(params.exercise_id || '');
  var userId     = String(params.user_id || '');

  var target = findById('Users', userId);
  if (!target) return Views_message('Target user not found.');
  var ex = findById('Exercises', exerciseId);
  if (!ex) return Views_message('Exercise not found.');

  if (session.role === 'commander') {
    if (target.role !== 'trainee' || String(target.team_id) !== session.team_id) {
      return Views_message('Commanders can only assign to trainees in their team.');
    }
  }

  // Prevent duplicate assignment
  var existing = Assignments_all().some(function (a) {
    return String(a.exercise_id) === exerciseId && String(a.user_id) === userId;
  });
  if (existing) {
    return Views_redirect('?page=dashboard&msg=Already+assigned');
  }

  appendRow('Assignments', {
    id: nextId('Assignments'),
    exercise_id: exerciseId,
    user_id: userId,
    status: 'pending',
    score: ''
  });

  return Views_redirect('?page=dashboard&msg=Assigned');
}

function Assignments_handleComplete(session, params) {
  Auth_requireRole(session, ['admin', 'commander']);
  var assignmentId = String(params.assignment_id || '');
  var score        = params.score != null ? params.score : '';

  var a = findById('Assignments', assignmentId);
  if (!a) return Views_message('Assignment not found.');

  if (session.role === 'commander') {
    var trainee = findById('Users', a.user_id);
    if (!trainee || String(trainee.team_id) !== session.team_id) {
      return Views_message('Commanders can only complete their team\'s assignments.');
    }
  }

  updateRow('Assignments', a._row, { status: 'completed', score: score });
  return Views_redirect('?page=dashboard&msg=Marked+complete');
}
