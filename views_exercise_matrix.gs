// views_exercise_matrix.gs — טבלת שליטה לפי תרגיל (חטיבה / גדוד / פלוגה)

function _exerciseMatrixRoleTiers() {
  return {
    brigade: {
      key: 'brigade',
      label: 'תפקידי חטיבה',
      roles: [
        'מנהל התרגיל (מפקץ / מחט)',
        'רען ק בטיחות (מלי)',
        'קמבץ מנהל תרגיל (קמפ)',
        'בקר שטח וצלם (ארזים)',
        'מטיס רחפן תחקור (ארזים)',
        'מפעיל מגנט (בגירה)',
        'מנהל לחימה (ארזים)',
        'קלח (ארזים)',
        'קמן (ארזים)',
        'מדריכת שוב (מח שוב מלפק)'
      ]
    },
    battalion: {
      key: 'battalion',
      label: 'תפקידי גדוד',
      roles: [
        'מפקד אחראי גדוד',
        'מגד (חניך קמג)',
        'מ"ג',
        'מפקד מכלול מבצעים (חניך קמג)',
        'קמבץ גדוד (חניך קמפ)',
        'מ חפק מגד רגלי (ממ מגדוד שתפ)',
        'קשא (השלמה חיילית)',
        'קשרג (השלמה חילית)',
        'קמן (השלמה חיילית)',
        'קסג (השלמה חיילית)',
        'מ מכלול מנהלה (חניך קמפ)',
        'סגן מ מכלול מנהלה'
      ]
    },
    company: {
      key: 'company',
      label: 'תפקידי פלוגה',
      roles: [
        'מפ חיר א', 'סמפ חיר א', 'חונך מפ א',
        'מפ חיר ב', 'סמפ חיר ב', 'חונך מפ ב',
        'מפ מסייעת', 'סמפ מסייעת', 'חונך מפ מסייעת',
        'מפ חהן', 'סמפ חהן', 'חנוך מפ חהן',
        'מפ חשן', 'סמפ חשן', 'חונך מפ חשן',
        'חונך מפ חלג'
      ]
    }
  };
}

function _exerciseMatrixExcludedRoles() {
  return [
    'ע קלח (השלמה חיילית לוגיסטיקה)',
    'מסח (מרהש - מלי)'
  ];
}

function _exerciseMatrixClassifyRole(resp) {
  const r = String(resp || '').trim();
  if (!r || _exerciseMatrixExcludedRoles().indexOf(r) !== -1) return '';
  const tiers = _exerciseMatrixRoleTiers();
  if (tiers.brigade.roles.indexOf(r) !== -1) return 'brigade';
  if (tiers.battalion.roles.indexOf(r) !== -1) return 'battalion';
  if (tiers.company.roles.indexOf(r) !== -1) return 'company';
  if (/ארזים|מחט|מלי|מגנ|מלפק|לוגיסטיקה|מרהש/.test(r)) return 'brigade';
  if (/גדוד|מגד|קמבץ|מכלול|קשא|קשרג|קסג|ממ מגדוד/.test(r)) return 'battalion';
  if (/^מפ |^סמפ |חונך מפ|חנוך מפ/.test(r)) return 'company';
  return 'company';
}

function _exerciseMatrixIsMpRole(resp) {
  const r = String(resp || '').trim();
  if (!r) return false;
  return /^מפ /.test(r) || /^סמפ /.test(r) || r.indexOf('חונך מפ') === 0 || r.indexOf('חנוך מפ') === 0;
}

function _exerciseMatrixLocation(ex) {
  if (!ex) return '';
  const details = Exercises_details(ex.id);
  for (let i = 0; i < details.length; i++) {
    if (details[i].location) return details[i].location;
  }
  return ex.camp || ex.partner_battalion || '';
}

function _exerciseMatrixBuildPayload() {
  const tiers = _exerciseMatrixRoleTiers();
  const exList = Exercises_all().slice().sort(function(a, b) {
    return String(a.rawStartDate || a.id).localeCompare(String(b.rawStartDate || b.id));
  });

  const exercises = [];
  const exMeta = {};
  const exIds = [];

  exList.forEach(function(ex) {
    exIds.push(ex.id);
    const meta = _teamMatrixExerciseMeta(ex);
    meta.location = _exerciseMatrixLocation(ex);
    meta.label = String(ex.title || ex.id || '').trim();
    exMeta[ex.id] = meta;
    exercises.push({ id: ex.id, label: meta.label });
  });

  const cells = {};
  const roleSet = {};
  const extraRoles = { brigade: {}, battalion: {}, company: {} };

  Assignments_all().forEach(function(a) {
    const resp = String(a.responsibility || '').trim();
    if (!resp || exIds.indexOf(a.exercise_id) === -1) return;
    if (_exerciseMatrixExcludedRoles().indexOf(resp) !== -1) return;

    const u = Users_get(a.user_id);
    const key = a.exercise_id + '\x1f' + resp;
    cells[key] = {
      assignmentId: a.id,
      userId: a.user_id,
      name: u ? u.name : a.user_id,
      phone: u ? (u.phone || '') : ''
    };
    roleSet[resp] = true;

    const tier = _exerciseMatrixClassifyRole(resp);
    if (tier && tiers[tier].roles.indexOf(resp) === -1) {
      extraRoles[tier][resp] = true;
    }
  });

  Object.keys(tiers).forEach(function(tk) {
    Object.keys(extraRoles[tk]).forEach(function(r) {
      if (tiers[tk].roles.indexOf(r) === -1) tiers[tk].roles.push(r);
    });
  });

  return {
    tiers: {
      brigade: { label: tiers.brigade.label, roles: tiers.brigade.roles },
      battalion: { label: tiers.battalion.label, roles: tiers.battalion.roles },
      company: { label: tiers.company.label, roles: tiers.company.roles }
    },
    exercises: exercises,
    exMeta: exMeta,
    cells: cells,
    totalRoles: Object.keys(roleSet).length,
    totalExercises: exercises.length
  };
}

function Views_exerciseMatrix(p) {
  p = p || {};
  p.tab = 'exercise';
  return Views_dashboard(p);
}

function _exerciseMatrixEmbedHtml(user, p) {
  const canEdit = Roles_hasAdminAccess(user.role);
  const payload = _exerciseMatrixBuildPayload();
  payload.canEdit = canEdit;
  const highlightUserId = _dashboardHighlightUserId(p, user);
  payload.highlightUserId = highlightUserId;
  const highlightUser = highlightUserId ? Users_get(highlightUserId) : null;
  if (highlightUser) payload.highlightUserName = highlightUser.name;
  if (canEdit) {
    payload.users = Users_all().map(function(u) {
      return { id: u.id, name: u.name, role: Roles_label(u.role) };
    });
  }
  const jsonData = JSON.stringify(payload).replace(/</g, '\\u003c');

  const editorHtml = canEdit
    ? '<div id="exMatrixCellEditor" class="ex-matrix-cell-editor" hidden>' +
      '<div class="ex-matrix-cell-editor-head">' +
      '<span id="exMatrixCellEditorTitle" class="ex-matrix-cell-editor-title"></span>' +
      '<button type="button" id="exMatrixCellEditorClose" class="btn btn-ghost btn-sm">✕</button>' +
      '</div>' +
      '<div id="exMatrixCellEditorCurrent" class="ex-matrix-cell-editor-current" hidden></div>' +
      '<button type="button" id="exMatrixCellEditorDelete" class="btn btn-danger btn-sm btn-full ex-matrix-cell-editor-delete" hidden>🗑 מחק שיבוץ</button>' +
      '<input type="text" id="exMatrixCellEditorInput" class="form-input" ' +
      'placeholder="חיפוש לפי שם או מספר אישי..." autocomplete="off">' +
      '<div id="exMatrixCellEditorResults" class="user-search-results ex-matrix-cell-editor-results"></div>' +
      '</div>'
    : '';

  return '<script id="exerciseMatrixData" type="application/json">' + jsonData + '</script>' +
    '<div id="exMatrixPageTitle" style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:12px"></div>' +
    (highlightUser
      ? '<div class="matrix-highlight-banner">מודגש: <b>' + _esc(highlightUser.name) + '</b> — תאי שיבוץ מסומנים בטבלה</div>'
      : '') +
    '<div class="card" style="margin-bottom:14px"><div class="card-body" style="padding:12px 16px">' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">' +
    '<div id="exMatrixRoleFilters" class="team-matrix-tabs"></div>' +
    '<div style="margin-right:auto;display:flex;gap:6px">' +
    '<button type="button" id="exMatrixExportCsv" class="btn btn-secondary btn-sm">Excel</button>' +
    '</div></div>' +
    '<div class="form-label" style="margin-bottom:8px">סנן לפי שבוע לועזי:</div>' +
    '<div id="exMatrixWeekTabs" class="team-matrix-tabs"></div>' +
    '</div></div>' +
    '<div id="exMatrixAccordions"></div>' +
    editorHtml +
    '<script>' + _exerciseMatrixJs() + '</script>';
}

function _exerciseMatrixJs() {
  return `
(function() {
  var data = JSON.parse(document.getElementById('exerciseMatrixData').textContent);
  var roleFilter = 'all';
  var weekFilter = 'all';
  var openTiers = { brigade: false, battalion: false, company: true };
  var canEdit = !!data.canEdit;
  var users = data.users || [];
  var highlightUserId = String(data.highlightUserId || '');
  var activeCell = null;
  var editorActiveIdx = -1;

  function userLinkHtml(userId, userName) {
    if (window.MapimSpa && MapimSpa.userLinkHtml) return MapimSpa.userLinkHtml(userId, userName);
    var safe = String(userName == null ? '' : userName).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return '<b>' + safe + '</b>';
  }

  function whatsappLinkHtml(phone, label) {
    if (window.MapimSpa && MapimSpa.whatsappLinkHtml) return MapimSpa.whatsappLinkHtml(phone, label);
    var raw = String(phone || '').trim();
    if (!raw) return '';
    return String(label != null ? label : raw).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function exerciseLinkHtml(exId, title) {
    if (window.MapimSpa && MapimSpa.exerciseLinkHtml) return MapimSpa.exerciseLinkHtml(exId, title);
    var safe = String(title == null ? '' : title).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return '<b>' + safe + '</b>';
  }

  function cellHtml(exId, role, c) {
    var isUserHighlight = !!(c && highlightUserId && String(c.userId) === highlightUserId);
    var cls = 'ex-matrix-assign-cell' + (c ? ' filled' : '') + (canEdit ? ' editable' : '') +
      (isUserHighlight ? ' ex-matrix-cell-highlight' : '');
    var attrs = ' class="' + cls + '" data-ex-id="' + esc(exId) + '" data-role="' + esc(role) + '"';
    if (c && c.assignmentId) attrs += ' data-assignment-id="' + esc(c.assignmentId) + '"';
    if (c && c.userId) attrs += ' data-user-id="' + esc(c.userId) + '"';
    if (canEdit) attrs += ' title="לחץ לעריכת שיבוץ" tabindex="0"';
    var inner = '';
    if (c) {
      inner += '<div class="ex-matrix-person"><div class="ex-matrix-person-name' +
        (isUserHighlight ? ' is-highlighted' : '') + '">' + userLinkHtml(c.userId, c.name) + '</div>';
      if (c.phone) inner += '<div class="ex-matrix-person-phone">' + whatsappLinkHtml(c.phone) + '</div>';
      inner += '</div>';
    } else if (canEdit) {
      inner += '<span class="ex-matrix-cell-empty">+ שיבוץ</span>';
    } else {
      inner += '<span style="color:var(--muted)">—</span>';
    }
    return '<td' + attrs + '>' + inner + '</td>';
  }

  function setCellData(exId, role, cell) {
    var key = exId + '\\x1f' + role;
    if (cell) data.cells[key] = cell;
    else delete data.cells[key];
  }

  function clearCellAssignment() {
    if (!activeCell) return;
    var exId = activeCell.getAttribute('data-ex-id');
    var role = activeCell.getAttribute('data-role');
    var cell = cellData(exId, role);
    if (!cell) return;
    if (!confirm('למחוק את השיבוץ של ' + cell.name + '?')) return;

    var sid = window.MapimSpa && MapimSpa.getSid ? MapimSpa.getSid() : '';
    if (!sid) { alert('נדרשת התחברות'); return; }

    var td = activeCell;
    closeCellEditor();
    td.classList.add('ex-matrix-cell-saving');

    google.script.run
      .withSuccessHandler(function() {
        td.classList.remove('ex-matrix-cell-saving');
        setCellData(exId, role, null);
        td.outerHTML = cellHtml(exId, role, null);
        updateTitle();
      })
      .withFailureHandler(function(err) {
        td.classList.remove('ex-matrix-cell-saving');
        alert(err && err.message ? err.message : String(err));
      })
      .clearExerciseMatrixCell(sid, exId, role);
  }

  function closeCellEditor() {
    var editor = document.getElementById('exMatrixCellEditor');
    if (editor) editor.hidden = true;
    activeCell = null;
    editorActiveIdx = -1;
  }

  function positionCellEditor(td) {
    var editor = document.getElementById('exMatrixCellEditor');
    if (!editor || !td) return;
    var rect = td.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = Math.max(8, rect.left);
    var width = Math.max(rect.width, 260);
    var editorH = editor.offsetHeight || 280;
    if (top + editorH > window.innerHeight) top = Math.max(8, rect.top - editorH - 6);
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    editor.style.top = top + 'px';
    editor.style.left = left + 'px';
    editor.style.width = width + 'px';
    editor.hidden = false;
  }

  function renderEditorMatches(q) {
    var results = document.getElementById('exMatrixCellEditorResults');
    if (!results) return;
    var query = String(q || '').trim().toLowerCase();
    if (!query) {
      results.innerHTML = '';
      results.hidden = true;
      editorActiveIdx = -1;
      return;
    }
    var matches = users.filter(function(u) {
      return String(u.id || '').toLowerCase().indexOf(query) !== -1 ||
        String(u.name || '').toLowerCase().indexOf(query) !== -1;
    }).slice(0, 12);
    if (!matches.length) {
      results.innerHTML = '<div style="padding:10px 12px;color:var(--muted);font-size:12px">לא נמצאו משתמשים</div>';
      results.hidden = false;
      return;
    }
    results.innerHTML = matches.map(function(u, i) {
      return '<button type="button" class="user-search-item' + (i === editorActiveIdx ? ' active' : '') +
        '" data-user-id="' + esc(u.id) + '">' +
        '<span>' + esc(u.name) + '</span>' +
        '<small>' + esc(u.id) + ' · ' + esc(u.role || '') + '</small></button>';
    }).join('');
    results.hidden = false;
  }

  function saveCellUser(userId) {
    if (!activeCell || !userId) return;
    var exId = activeCell.getAttribute('data-ex-id');
    var role = activeCell.getAttribute('data-role');
    var sid = window.MapimSpa && MapimSpa.getSid ? MapimSpa.getSid() : '';
    if (!sid) { alert('נדרשת התחברות'); return; }

    var td = activeCell;
    closeCellEditor();
    td.classList.add('ex-matrix-cell-saving');

    google.script.run
      .withSuccessHandler(function(cell) {
        td.classList.remove('ex-matrix-cell-saving');
        setCellData(exId, role, cell);
        td.outerHTML = cellHtml(exId, role, cell);
        updateTitle();
      })
      .withFailureHandler(function(err) {
        td.classList.remove('ex-matrix-cell-saving');
        alert(err && err.message ? err.message : String(err));
      })
      .assignExerciseMatrixCell(sid, exId, role, userId);
  }

  function openCellEditor(td) {
    if (!canEdit) return;
    var editor = document.getElementById('exMatrixCellEditor');
    var input = document.getElementById('exMatrixCellEditorInput');
    var title = document.getElementById('exMatrixCellEditorTitle');
    var current = document.getElementById('exMatrixCellEditorCurrent');
    var deleteBtn = document.getElementById('exMatrixCellEditorDelete');
    if (!editor || !input) return;

    activeCell = td;
    var exId = td.getAttribute('data-ex-id');
    var role = td.getAttribute('data-role');
    var cell = cellData(exId, role);
    var exLabel = (data.exMeta[exId] && data.exMeta[exId].label) || exId;
    if (title) title.textContent = exLabel + ' · ' + role;

    if (cell && current) {
      current.hidden = false;
      current.innerHTML = '<span class="ex-matrix-cell-editor-current-label">משובץ:</span> ' +
        userLinkHtml(cell.userId, cell.name) +
        (cell.phone ? ' <span class="ex-matrix-cell-editor-current-phone">' + whatsappLinkHtml(cell.phone) + '</span>' : '');
    } else if (current) {
      current.hidden = true;
      current.innerHTML = '';
    }

    if (deleteBtn) deleteBtn.hidden = !cell;

    input.value = '';
    input.placeholder = cell ? 'החלף משתמש — חיפוש לפי שם או מספר אישי...' :
      'חיפוש לפי שם או מספר אישי...';
    renderEditorMatches('');
    positionCellEditor(td);
    input.focus();
  }

  function initCellEditor() {
    if (!canEdit) return;
    var editor = document.getElementById('exMatrixCellEditor');
    var input = document.getElementById('exMatrixCellEditorInput');
    var results = document.getElementById('exMatrixCellEditorResults');
    var closeBtn = document.getElementById('exMatrixCellEditorClose');
    var deleteBtn = document.getElementById('exMatrixCellEditorDelete');
    if (!editor || !input) return;

    document.getElementById('exMatrixAccordions').addEventListener('click', function(e) {
      var td = e.target.closest('.ex-matrix-assign-cell.editable');
      if (!td) return;
      e.stopPropagation();
      openCellEditor(td);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeCellEditor);
    if (deleteBtn) deleteBtn.addEventListener('click', clearCellAssignment);

    input.addEventListener('input', function() {
      editorActiveIdx = -1;
      renderEditorMatches(input.value);
    });

    input.addEventListener('keydown', function(e) {
      var items = results ? results.querySelectorAll('.user-search-item') : [];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (results && results.hidden) renderEditorMatches(input.value);
        items = results ? results.querySelectorAll('.user-search-item') : [];
        editorActiveIdx = Math.min(editorActiveIdx + 1, items.length - 1);
        items.forEach(function(el, i) { el.classList.toggle('active', i === editorActiveIdx); });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        editorActiveIdx = Math.max(editorActiveIdx - 1, 0);
        items.forEach(function(el, i) { el.classList.toggle('active', i === editorActiveIdx); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items.length && editorActiveIdx >= 0 && items[editorActiveIdx]) {
          saveCellUser(items[editorActiveIdx].getAttribute('data-user-id'));
        } else if (items.length === 1) {
          saveCellUser(items[0].getAttribute('data-user-id'));
        }
      } else if (e.key === 'Escape') {
        closeCellEditor();
      }
    });

    if (results) {
      results.addEventListener('mousedown', function(e) {
        var btn = e.target.closest('.user-search-item');
        if (!btn) return;
        e.preventDefault();
        saveCellUser(btn.getAttribute('data-user-id'));
      });
    }

    document.addEventListener('click', function(e) {
      if (!editor.hidden && !e.target.closest('#exMatrixCellEditor') &&
          !e.target.closest('.ex-matrix-assign-cell.editable')) {
        closeCellEditor();
      }
    });

    window.addEventListener('scroll', function() {
      if (!editor.hidden && activeCell) positionCellEditor(activeCell);
    }, true);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isMpRole(r) {
    r = String(r || '').trim();
    return /^מפ /.test(r) || /^סמפ /.test(r) || r.indexOf('חונך מפ') === 0 || r.indexOf('חנוך מפ') === 0;
  }

  function passRoleFilter(role) {
    if (roleFilter === 'all') return true;
    if (roleFilter === 'mp') return isMpRole(role);
    return !isMpRole(role);
  }

  function getExercises() {
    if (weekFilter === 'all') return data.exercises;
    var w = parseInt(weekFilter, 10);
    return data.exercises.filter(function(ex) {
      var m = data.exMeta[ex.id];
      return m && m.week === w;
    });
  }

  function collectWeeks() {
    var weeks = {};
    data.exercises.forEach(function(ex) {
      var m = data.exMeta[ex.id];
      if (m && m.week) weeks[m.week] = true;
    });
    return Object.keys(weeks).map(Number).sort(function(a, b) { return a - b; });
  }

  function cellData(exId, role) {
    return data.cells[exId + '\\x1f' + role] || null;
  }

  function tierRoles(tierKey) {
    var tier = data.tiers[tierKey];
    if (!tier) return [];
    return tier.roles.filter(passRoleFilter);
  }

  function weekFilterLabel() {
    if (weekFilter === 'all') return 'מוצג: כל השבועות';
    var w = parseInt(weekFilter, 10);
    var sample = data.exercises.find(function(ex) {
      return data.exMeta[ex.id] && data.exMeta[ex.id].week === w;
    });
    var y = sample && data.exMeta[sample.id] ? data.exMeta[sample.id].weekYear : 0;
    return 'מוצג: שבוע לועזי ' + w + (y ? ' · ' + y : '');
  }

  function updateTitle() {
    var titleEl = document.getElementById('exMatrixPageTitle');
    if (!titleEl) return;
    var exs = getExercises();
    titleEl.textContent =
      'טבלת שליטה לפי תרגיל — ' + data.totalRoles + ' תפקידים, ' + exs.length + ' תרגילים · ' +
      weekFilterLabel();
  }

  function renderRoleFilters() {
    var el = document.getElementById('exMatrixRoleFilters');
    var opts = [
      { id: 'all', label: 'כולם' },
      { id: 'mp', label: 'מ״פ בלבד' },
      { id: 'other', label: 'יתר המשתתפים' }
    ];
    el.innerHTML = opts.map(function(o) {
      return '<button type="button" class="team-matrix-tab' + (roleFilter === o.id ? ' active' : '') +
        '" data-role-filter="' + o.id + '">' + esc(o.label) + '</button>';
    }).join('');
    el.querySelectorAll('[data-role-filter]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        roleFilter = btn.getAttribute('data-role-filter');
        render();
      });
    });
  }

  function renderWeekTabs() {
    var weeks = collectWeeks();
    var el = document.getElementById('exMatrixWeekTabs');
    var html = '<button type="button" class="team-matrix-tab' + (weekFilter === 'all' ? ' active' : '') +
      '" data-week="all">הצג הכל</button>';
    weeks.forEach(function(w) {
      var count = data.exercises.filter(function(ex) {
        return data.exMeta[ex.id] && data.exMeta[ex.id].week === w;
      }).length;
      html += '<button type="button" class="team-matrix-tab' + (String(weekFilter) === String(w) ? ' active' : '') +
        '" data-week="' + w + '">שבוע לועזי ' + w + ' <span style="opacity:.7">(' + count + ')</span></button>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-week]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        weekFilter = btn.getAttribute('data-week');
        renderAccordions();
        updateTitle();
        renderWeekTabs();
      });
    });
  }

  function renderMatrixTable(tierKey, roles, exs) {
    if (!roles.length) {
      return '<div class="empty" style="padding:16px">אין תפקידים להצגה בסינון הנוכחי</div>';
    }
    var head = '<tr><th class="team-matrix-sticky">תפקיד</th>';
    exs.forEach(function(ex) {
      var m = data.exMeta[ex.id] || {};
      var fullTitle = String(m.label || m.title || ex.label || ex.id || '');
      head += '<th class="team-matrix-col-hdr ex-matrix-col"><div class="team-matrix-ex-title"' +
        (fullTitle ? ' title="' + esc(fullTitle) + '"' : '') + '>' +
        exerciseLinkHtml(ex.id, fullTitle) + '</div>';
      if (m.weekLabel) head += '<div class="team-matrix-ex-sub">' + esc(m.weekLabel) + '</div>';
      else if (m.week) head += '<div class="team-matrix-ex-sub">שבוע לועזי ' + m.week + '</div>';
      if (m.typeLine) head += '<div class="team-matrix-ex-sub">' + esc(m.typeLine) + '</div>';
      if (m.slotLine) head += '<div class="team-matrix-ex-sub">' + esc(m.slotLine) + '</div>';
      if (m.location) head += '<div class="team-matrix-ex-sub">' + esc(m.location) + '</div>';
      if (m.timeLine) head += '<div class="team-matrix-ex-sub">' + esc(m.timeLine) + '</div>';
      head += '</th>';
    });
    head += '</tr>';

    var body = '';
    roles.forEach(function(role) {
      body += '<tr><td class="team-matrix-sticky ex-matrix-role-cell">' + esc(role) + '</td>';
      exs.forEach(function(ex) {
        body += cellHtml(ex.id, role, cellData(ex.id, role));
      });
      body += '</tr>';
    });

    return '<div class="team-matrix-scroll"><table class="tbl team-matrix-tbl ex-matrix-tbl">' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function renderAccordions() {
    var exs = getExercises();
    var container = document.getElementById('exMatrixAccordions');
    var tierOrder = [
      { key: 'brigade', cls: 'ex-matrix-tier-brigade' },
      { key: 'battalion', cls: 'ex-matrix-tier-battalion' },
      { key: 'company', cls: 'ex-matrix-tier-company' }
    ];

    container.innerHTML = tierOrder.map(function(t) {
      var tier = data.tiers[t.key];
      var roles = tierRoles(t.key);
      var open = !!openTiers[t.key];
      return '<div class="card ex-matrix-tier-card" style="margin-bottom:12px">' +
        '<button type="button" class="ex-matrix-tier-toggle ' + t.cls + (open ? ' open' : '') + '" data-tier="' + t.key + '">' +
        '<span>' + esc(tier.label) + ' (' + roles.length + ' תפקידים)</span>' +
        '<span class="ex-matrix-tier-arrow">' + (open ? '▾' : '◂') + '</span></button>' +
        '<div class="ex-matrix-tier-body" id="exMatrixBody_' + t.key + '"' + (open ? '' : ' hidden') + '>' +
        renderMatrixTable(t.key, roles, exs) +
        '</div></div>';
    }).join('');

    container.querySelectorAll('.ex-matrix-tier-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tk = btn.getAttribute('data-tier');
        openTiers[tk] = !openTiers[tk];
        renderAccordions();
      });
    });
  }

  function exportCsv() {
    var exs = getExercises();
    var rows = [['תפקיד רמה', 'תפקיד']];
    exs.forEach(function(ex) {
      var m = data.exMeta[ex.id] || {};
      rows[0].push((m.label || ex.id) + (m.weekLabel ? ' (' + m.weekLabel + ')' : ''));
    });
    ['brigade', 'battalion', 'company'].forEach(function(tk) {
      var tier = data.tiers[tk];
      tierRoles(tk).forEach(function(role) {
        var row = [tier.label, role];
        exs.forEach(function(ex) {
          var c = cellData(ex.id, role);
          row.push(c ? (c.name + (c.phone ? ' / ' + c.phone : '')) : '');
        });
        rows.push(row);
      });
    });
    var csv = rows.map(function(r) {
      return r.map(function(c) {
        c = String(c == null ? '' : c);
        if (c.indexOf(',') >= 0 || c.indexOf('"') >= 0) return '"' + c.replace(/"/g, '""') + '"';
        return c;
      }).join(',');
    }).join('\\n');
    var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exercise-matrix.csv';
    a.click();
  }

  function render() {
    updateTitle();
    renderRoleFilters();
    renderWeekTabs();
    renderAccordions();
  }

  document.getElementById('exMatrixExportCsv').addEventListener('click', exportCsv);
  initCellEditor();
  render();
})();
`;
}
