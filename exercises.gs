/**
 * exercises.gs — Exercise CRUD + duplication + ExerciseDetails
 */

function Exercises_all() {
  return readSheet('Exercises');
}

function Exercises_get(id) {
  return findById('Exercises', id);
}

function Exercises_details(exerciseId) {
  exerciseId = String(exerciseId);
  return readSheet('ExerciseDetails').filter(function (d) {
    return String(d.exercise_id) === exerciseId;
  });
}

function Exercises_handleCreate(session, params) {
  Auth_requireRole(session, ['admin']);
  var id = nextId('Exercises');
  appendRow('Exercises', {
    id: id,
    title: params.title || '',
    description: params.description || '',
    created_by: session.id,
    date: params.date || ''
  });
  return Views_redirect('?page=exercise&id=' + id + '&msg=Created');
}

function Exercises_handleUpdate(session, params) {
  Auth_requireRole(session, ['admin']);
  var ex = Exercises_get(params.id);
  if (!ex) return Views_message('Exercise not found.');
  updateRow('Exercises', ex._row, {
    title: params.title,
    description: params.description,
    date: params.date
  });
  return Views_redirect('?page=exercise&id=' + ex.id + '&msg=Updated');
}

function Exercises_handleDuplicate(session, params) {
  Auth_requireRole(session, ['admin']);
  var ex = Exercises_get(params.id);
  if (!ex) return Views_message('Exercise not found.');

  var newId = nextId('Exercises');
  appendRow('Exercises', {
    id: newId,
    title: ex.title + ' (Copy)',
    description: ex.description,
    created_by: session.id,
    date: ex.date
  });

  // Copy all ExerciseDetails
  var details = Exercises_details(ex.id);
  details.forEach(function (d) {
    appendRow('ExerciseDetails', {
      id: nextId('ExerciseDetails'),
      exercise_id: newId,
      time: d.time,
      location: d.location,
      description: d.description
    });
  });

  return Views_redirect('?page=exercise&id=' + newId + '&msg=Duplicated');
}

function Exercises_handleAddDetail(session, params) {
  Auth_requireRole(session, ['admin']);
  var ex = Exercises_get(params.exercise_id);
  if (!ex) return Views_message('Exercise not found.');
  appendRow('ExerciseDetails', {
    id: nextId('ExerciseDetails'),
    exercise_id: ex.id,
    time: params.time || '',
    location: params.location || '',
    description: params.description || ''
  });
  return Views_redirect('?page=exercise&id=' + ex.id + '&msg=Detail+added');
}
