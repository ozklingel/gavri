// views_feedback.gs — trainee performance feedback for an assignment

function Views_feedback(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });

  const sid = user.id;
  const aid = String(p.assignmentId || '').trim();
  const exId = String(p.id || p.exerciseId || '').trim();

  if (!aid) return Views_error('חסר מזהה הקצאה.', p);

  const assignment = Assignments_get(aid);
  if (!assignment) return Views_error('ההקצאה לא נמצאה.', p);

  const exerciseId = exId || assignment.exercise_id;
  const ex = Exercises_get(exerciseId);
  if (!ex) return Views_error('התרגיל לא נמצא.', p);
  if (String(assignment.exercise_id) !== String(exerciseId)) {
    return Views_error('ההקצאה אינה שייכת לתרגיל זה.', p);
  }

  if (!_canViewExercise(user, exerciseId)) {
    return Views_error('אין הרשאה לצפות בתרגיל זה.', p);
  }
  if (!Assignments_canEditFeedback(user, assignment)) {
    return Views_error('אין הרשאה למלא משוב להקצאה זו.', p);
  }

  const trainee = Users_get(assignment.user_id);
  const traineeName = trainee ? trainee.name : assignment.user_id;

  let s = _topbar(user, sid) + '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  s += '<h1 class="page-title" style="margin:0">📝 משוב על תפקוד</h1>';
  s += _a('page=exercise&id=' + encodeURIComponent(exerciseId), '← חזרה לתרגיל', 'btn btn-ghost btn-sm');
  s += '</div>';

  s += '<div class="card" style="margin-bottom:14px"><div class="card-body">';
  s += '<div style="display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:12px">';
  s += '<div><span style="color:var(--muted)">תרגיל</span><br><b>' + _esc(ex.title) + '</b></div>';
  s += '<div><span style="color:var(--muted)">חניך</span><br><b>' + _esc(traineeName) + '</b></div>';
  s += '<div><span style="color:var(--muted)">תפקיד בתרגיל</span><br><b>' + _esc(assignment.responsibility || '—') + '</b></div>';
  s += '</div></div></div>';

  s += '<div class="card"><div class="card-header"><div class="card-title">משוב (מלל חופשי)</div></div>';
  s += '<div class="card-body">';
  s += _formOpen();
  s += '<input type="hidden" name="action" value="saveFeedback">';
  s += '<input type="hidden" name="assignmentId" value="' + _esc(aid) + '">';
  s += '<input type="hidden" name="exerciseId" value="' + _esc(exerciseId) + '">';
  s += '<div class="form-row"><label class="form-label">תפקוד החניך בתרגיל</label>';
  s += _textarea('feedback', 'תאר את תפקוד החניך בתרגיל…', assignment.feedback, 'rows="8" style="min-height:160px"');
  s += '</div>';
  s += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  s += _submitBtn('שמור משוב', 'btn btn-primary');
  s += _a('page=exercise&id=' + encodeURIComponent(exerciseId), 'ביטול', 'btn btn-secondary');
  s += '</div></form></div></div>';

  s += '</div>';
  return _wrapPage(s, 'משוב — ' + traineeName);
}
