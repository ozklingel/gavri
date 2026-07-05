// spa_modules.gs — lazy HTML fragments (legacy module slots)

function apiLoadModule(sid, moduleId, paramsJson) {
  _cacheFlush();
  const p = _spaMergeParams(sid, paramsJson);
  try {
    const html = SpaModule_render(String(moduleId || '').trim(), p);
    return { ok: true, html: html || '' };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
      html: '<div class="flash flash-error">⚠ ' +
        _esc(err && err.message ? err.message : String(err)) + '</div>'
    };
  }
}

function SpaModule_render(moduleId, p) {
  const user = Auth_current(p);
  if (!user) throw new Error('נדרשת התחברות.');
  const sid = user.id;

  switch (moduleId) {
    case 'exercises.list':
      return _exercisesListModuleHtml(user, sid);
    case 'exercises.sidebar':
      return _exercisesSidebarModuleHtml(user, sid);
    default:
      throw new Error('רכיב לא מוכר: ' + moduleId);
  }
}
