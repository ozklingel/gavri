// views_assign.gs — drag-and-drop assignment board
function Views_assign(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  if (!Roles_hasAdminAccess(user.role)) return Views_error('גישה לסגל בלבד.', p);

  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);
  const openSet = _parseOpenSections(p);

  const body = _topbar(user, sid) +
    '<div class="page page-assign">' + _flash(p) +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">🔀 לוח שיבוץ</div>' +
    '<span id="assignStatus" style="font-family:var(--mono);font-size:12px;color:var(--muted)"></span>' +
    '</div>' +
    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:12px">' +
    '// ימין: חניכים לשיבוץ · שמאל: תרגילים (חסרים למעלה) · גרור לתרגיל · שינויים נשמרים בלחיצה על «שמירה ואישור»' +
    '</div>' +
    _assignMainModuleHtml(user, sid, openSet) +
    '</div>';

  return _wrapPage(body, 'לוח שיבוץ');
}

function _assignMainModuleHtml(user, sid, openSet) {
  openSet = openSet || {};
  const sidQ = encodeURIComponent(sid);

  const exercises = Exercises_all();
  const allUsers  = Users_all();
  const assigns   = Assignments_all();

  const exData = exercises.map(function(e) {
    return { id: e.id, title: e.title, start: e.start_date || '', end: e.end_date || '' };
  });
  const teamById = {};
  Teams_all().forEach(function(t) { teamById[t.id] = t.name; });

  const userMap = {};
  allUsers.forEach(function(u) {
    userMap[u.id] = {
      name: u.name,
      role: u.role,
      corps: String(u.military_affiliation || '').replace(/״/g, '').trim(),
      teamId: u.team_id,
      teamName: u.team_id ? (teamById[u.team_id] || u.team_id) : '',
      unitAffiliation: String(u.unit_affiliation || ''),
      serviceType: String(u.service_type || ''),
      militaryAffiliation: String(u.military_affiliation || ''),
      unitClassification: String(u.unit_classification || ''),
      targetRole: String(u.target_role || ''),
      phone: String(u.phone || '')
    };
  });

  const exMap = {};
  assigns.forEach(function(a) {
    if (!exMap[a.exercise_id]) exMap[a.exercise_id] = [];
    exMap[a.exercise_id].push({ id: a.id, userId: a.user_id, resp: a.responsibility, status: a.status });
  });

  const approvedHome = HomeConstraints_allApproved();
  const homeBlocked = HomeConstraints_blockedPairsForAssign();

  const jsonData = JSON.stringify({
    exercises: exData,
    userMap:   userMap,
    exMap:     exMap,
    homeBlocked: homeBlocked,
    approvedHomeCount: approvedHome.length,
    corpsList: [
      { key: 'חיר', label: 'חי״ר' },
      { key: 'חשן', label: 'חשן' },
      { key: 'חהן', label: 'חה״ן' },
      { key: 'מסייעת', label: 'מסייעת' },
      { key: 'מנהלי', label: 'מנהלי' }
    ],
    respOptions: _assignmentRespOptions(),
    slotConfig: Assignments_slotConfig().map(function(s) {
      return { resp: s.resp, count: s.count };
    })
  });

  return (approvedHome.length
      ? '<div class="flash flash-error" style="margin-bottom:12px;font-size:12px;line-height:1.5">' +
        '🏠 <b>' + approvedHome.length + ' אילוצי בית מאושרים</b> — לא ניתן לשבץ חניך לתרגיל החופף לטווח. ' +
        _a('page=homeConstraints', 'צפה ברשימה', 'btn btn-ghost btn-sm') +
        '</div>'
      : '') +
    '<div style="display:flex;gap:8px;margin-bottom:14px">' +
    _confirmAction('action=autoAssignAll&sid=' + sidQ, '⚡ שיבוץ אוטומטי',
      'לבצע שיבוץ אוטומטי? ימולאו תרגילים חסרים. משתתף יכול להיות בכמה תרגילים — למעט תרגילים חופפים בזמן.', 'btn btn-primary') +
    _confirmAction('action=clearAllAssignments&sid=' + sidQ, '🗑 איפוס שיבוצים',
      'לאפס את כל השיבוצים? פעולה בלתי הפיכה.', 'btn btn-danger btn-sm') +
    '</div>' +
    '<script id="assignData" type="application/json">' + jsonData + '</script>' +
    '<input type="hidden" id="assignSid" value="' + _esc(sid) + '">' +
    _respDatalistHtml('assignRespList') +
    '<div id="assignUserPopover" role="tooltip" style="display:none;position:fixed;z-index:10000;' +
    'max-width:280px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border2);' +
    'border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:var(--mono);font-size:11px;' +
    'color:var(--text1);pointer-events:none;line-height:1.45"></div>' +
    '<div id="assignChangesBar" class="assign-changes-bar" hidden>' +
    '<div class="assign-changes-head">' +
    '<span class="assign-changes-title">📝 שינויים ממתינים לאישור</span>' +
    '<span id="assignChangesCount" class="assign-changes-count"></span>' +
    '</div>' +
    '<ul id="assignChangesList" class="assign-changes-list"></ul>' +
    '<div class="assign-changes-actions">' +
    '<button type="button" id="assignDiscardBtn" class="btn btn-secondary btn-sm">↺ בטל שינויים</button>' +
    '<button type="button" id="assignSaveBtn" class="btn btn-primary">💾 שמירה ואישור</button>' +
    '</div></div>' +
    '<div class="assign-layout">' +
    '<aside class="assign-users-col" id="assignUsersCol">' +
    '<div class="assign-users-block">' +
    '<div class="assign-panel-head">👤 חניכים לשיבוץ <span class="assign-panel-sub">פחות שיבוצים למעלה</span></div>' +
    '<div id="assignTraineesList" class="assign-users-list"></div>' +
    '</div>' +
    '<div class="assign-users-block assign-mm-block">' +
    '<div class="assign-panel-head">🎖 ממ לשיבוץ <span class="assign-panel-sub">הכי משובץ למעלה</span></div>' +
    '<div id="assignMmList" class="assign-users-list"></div>' +
    '</div>' +
    '</aside>' +
    '<div class="assign-exercises-col">' +
    '<div class="assign-panel-head">🎯 תרגילים <span class="assign-panel-sub">חסרים למעלה</span></div>' +
    '<div id="assignExercisesList" class="assign-exercises-list"></div>' +
    '</div>' +
    '</div>' +
    '<div class="expandable-stack" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">' +
    _expandablePanel('assign', {}, 'conflicts', '⚠ התנגשויות שיבוץ',
      _assignConflictsSectionHtml(sid), openSet) +
    _expandablePanel('assign', {}, 'least', '📊 חניך מועדף לשיבוץ',
      _assignLeastSectionHtml(), openSet) +
    '</div>' +
    '<script>' + _assignBoardJs() + '</script>';
}

function _assignConflictsSectionHtml(sid) {
  return _assignmentConflictsPanel(AssignmentConflicts_scan(), { alwaysShow: true });
}

function _assignLeastSectionHtml() {
  return '<div id="assignLeastSection" style="padding-top:4px">' +
    '<div id="assignLeastPanel" style="display:flex;gap:10px;flex-wrap:wrap"></div>' +
    '<p style="font-family:var(--mono);font-size:10px;color:var(--muted);margin:8px 0 0">' +
    'מתעדכן לפי מספר התרגילים הנוכחי · אחד לכל חיל</p></div>';
}

function _assignBoardJs() {
  return `
(function() {
  var data = JSON.parse(document.getElementById('assignData').textContent);
  var sid = document.getElementById('assignSid').value;
  var traineesList = document.getElementById('assignTraineesList');
  var mmList = document.getElementById('assignMmList');
  var exercisesList = document.getElementById('assignExercisesList');
  var status = document.getElementById('assignStatus');
  var leastPanel = document.getElementById('assignLeastPanel');
  var changesBar = document.getElementById('assignChangesBar');
  var changesList = document.getElementById('assignChangesList');
  var changesCount = document.getElementById('assignChangesCount');
  var saveBtn = document.getElementById('assignSaveBtn');
  var discardBtn = document.getElementById('assignDiscardBtn');

  var baseline = JSON.parse(JSON.stringify({ exMap: data.exMap }));
  var nextTempId = 1;
  var editingChip = null;

  var ROLE_LABELS = {
    admin: 'סגל', unitCommander: 'מגד', companyCommander: 'מפקצ',
    departmentCommander: 'ממ', tutor: 'חונך', trainee: 'חניך', commander: 'מפקצ'
  };
  var ROLE_COLORS = {
    admin: '#4ade80', unitCommander: '#4ade80', companyCommander: '#60a5fa',
    departmentCommander: '#60a5fa', tutor: '#fbbf24', trainee: '#94a3b8', commander: '#60a5fa'
  };
  var popoverPinned = false;
  var hoverTimer = null;

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(msg, color) {
    if (!status) return;
    status.textContent = msg;
    status.style.color = color || 'var(--muted)';
  }

  function getExTitle(exId) {
    var ex = data.exercises.find(function(e) { return e.id === exId; });
    return ex ? ex.title : exId;
  }

  function countAssignments(userId) {
    var n = 0;
    Object.keys(data.exMap).forEach(function(exId) {
      (data.exMap[exId] || []).forEach(function(a) {
        if (a.userId === userId) n++;
      });
    });
    return n;
  }

  function exAssigneeCount(exId) {
    return (data.exMap[exId] || []).length;
  }

  function exerciseFillStatus(exId) {
    var slots = data.slotConfig || [];
    var byResp = {};
    (data.exMap[exId] || []).forEach(function(a) {
      var r = String(a.resp || '').trim();
      if (r) byResp[r] = (byResp[r] || 0) + 1;
    });
    var filled = 0;
    var total = 0;
    slots.forEach(function(s) {
      total += s.count;
      filled += Math.min(s.count, byResp[s.resp] || 0);
    });
    return {
      filled: filled,
      total: total,
      isFull: total > 0 && filled >= total,
      isEmpty: filled === 0,
      missing: Math.max(0, total - filled)
    };
  }

  function exerciseSubtitle(ex, status) {
    var dates = [ex.start, ex.end].filter(Boolean).join(' — ');
    var fill = status.filled + '/' + status.total + ' תפקידים';
    if (status.isFull) return (dates ? dates + ' · ' : '') + fill + ' · מלא';
    if (status.isEmpty) return (dates ? dates + ' · ' : '') + 'ללא שיבוץ · חסרים ' + status.missing;
    return (dates ? dates + ' · ' : '') + fill + ' · חסרים ' + status.missing;
  }

  function isTempId(id) {
    return String(id || '').indexOf('__new_') === 0;
  }

  function newTempId() {
    return '__new_' + (nextTempId++) + '__';
  }

  function cloneExMap(src) {
    var out = {};
    Object.keys(src || {}).forEach(function(exId) {
      out[exId] = (src[exId] || []).map(function(a) {
        return { id: a.id, userId: a.userId, resp: a.resp || '', status: a.status || 'pending' };
      });
    });
    return out;
  }

  function resetWorking() {
    data.exMap = cloneExMap(baseline.exMap);
    editingChip = null;
    hideUserPopoverForce();
    render();
    setStatus('', 'var(--muted)');
  }

  function computePendingChanges() {
    var changes = [];
    var baseList = [];
    var workList = [];

    Object.keys(baseline.exMap).forEach(function(exId) {
      (baseline.exMap[exId] || []).forEach(function(a) {
        baseList.push({ assignId: a.id, userId: a.userId, exId: exId, resp: a.resp || '' });
      });
    });
    Object.keys(data.exMap).forEach(function(exId) {
      (data.exMap[exId] || []).forEach(function(a) {
        workList.push({ assignId: a.id, userId: a.userId, exId: exId, resp: a.resp || '' });
      });
    });

    var baseById = {};
    baseList.forEach(function(a) { baseById[a.assignId] = a; });
    var workById = {};
    workList.forEach(function(a) { workById[a.assignId] = a; });

    baseList.forEach(function(a) {
      if (!workById[a.assignId]) {
        changes.push({ type: 'remove', assignId: a.assignId, userId: a.userId, exId: a.exId });
      }
    });

    workList.forEach(function(a) {
      if (isTempId(a.assignId)) {
        changes.push({ type: 'add', userId: a.userId, exId: a.exId, resp: a.resp });
        return;
      }
      var b = baseById[a.assignId];
      if (!b) return;
      if (b.exId !== a.exId) {
        changes.push({
          type: 'move', assignId: a.assignId, userId: a.userId,
          fromExId: b.exId, toExId: a.exId, resp: a.resp
        });
      } else if (b.resp !== a.resp) {
        changes.push({
          type: 'resp', assignId: a.assignId, exId: a.exId,
          userId: a.userId, resp: a.resp, oldResp: b.resp
        });
      }
    });

    return changes;
  }

  function changeLabel(ch) {
    var u = data.userMap[ch.userId];
    var name = u ? u.name : ch.userId;
    if (ch.type === 'add') {
      return '+ שיבוץ ' + name + ' → ' + getExTitle(ch.exId) + (ch.resp ? ' (' + ch.resp + ')' : '');
    }
    if (ch.type === 'remove') {
      return '− הסרת ' + name + ' מ־' + getExTitle(ch.exId);
    }
    if (ch.type === 'move') {
      return '↔ העברת ' + name + ' ל־' + getExTitle(ch.toExId);
    }
    if (ch.type === 'resp') {
      return '✎ תפקיד ' + name + ': ' + (ch.oldResp || '—') + ' → ' + ch.resp;
    }
    return '';
  }

  function renderChangesBar() {
    var changes = computePendingChanges();
    if (!changesBar) return;
    if (!changes.length) {
      changesBar.hidden = true;
      changesList.innerHTML = '';
      if (changesCount) changesCount.textContent = '';
      return;
    }
    changesBar.hidden = false;
    if (changesCount) changesCount.textContent = changes.length + ' שינויים';
    changesList.innerHTML = '';
    changes.forEach(function(ch, idx) {
      var li = document.createElement('li');
      li.className = 'assign-change-item assign-change-' + ch.type;
      li.textContent = (idx + 1) + '. ' + changeLabel(ch);
      changesList.appendChild(li);
    });
    setStatus('● ' + changes.length + ' שינויים ממתינים לשמירה', '#fbbf24');
  }

  function homeBlockMsg(userId, exId) {
    var key = userId + '\\x1f' + exId;
    if (data.homeBlocked && data.homeBlocked[key]) {
      return 'אילוץ בית מאושר (' + data.homeBlocked[key] + ')';
    }
    return '';
  }

  function userAlreadyInExercise(userId, exId) {
    return (data.exMap[exId] || []).some(function(a) { return a.userId === userId; });
  }

  function stageAdd(exId, userId, resp) {
    var block = homeBlockMsg(userId, exId);
    if (block) {
      setStatus('✗ לא ניתן לשבץ: ' + block, '#f87171');
      return false;
    }
    if (userAlreadyInExercise(userId, exId)) {
      setStatus('✗ החניך כבר משובץ לתרגיל זה', '#f87171');
      return false;
    }
    if (!data.exMap[exId]) data.exMap[exId] = [];
    data.exMap[exId].push({
      id: newTempId(),
      userId: userId,
      resp: resp || '',
      status: 'pending'
    });
    render();
    return true;
  }

  function stageRemove(assignId, fromExId) {
    if (!data.exMap[fromExId]) return;
    data.exMap[fromExId] = data.exMap[fromExId].filter(function(a) {
      return a.id !== assignId;
    });
    render();
  }

  function stageMove(assignId, toExId, userId, resp, fromExId) {
    var block = homeBlockMsg(userId, toExId);
    if (block) {
      setStatus('✗ לא ניתן להעביר: ' + block, '#f87171');
      return false;
    }
    if (userAlreadyInExercise(userId, toExId)) {
      setStatus('✗ החניך כבר משובץ לתרגיל יעד', '#f87171');
      return false;
    }
    var list = data.exMap[fromExId] || [];
    var a = list.find(function(x) { return x.id === assignId; });
    if (!a) return false;
    data.exMap[fromExId] = list.filter(function(x) { return x.id !== assignId; });
    if (!data.exMap[toExId]) data.exMap[toExId] = [];
    data.exMap[toExId].push({
      id: assignId,
      userId: userId,
      resp: resp || a.resp || '',
      status: a.status || 'pending'
    });
    render();
    return true;
  }

  function stageResp(assignId, exId, newResp) {
    if (!newResp) { alert('יש לציין תפקיד'); return; }
    var list = data.exMap[exId] || [];
    list.forEach(function(a) {
      if (a.id === assignId) a.resp = newResp;
    });
    editingChip = null;
    render();
  }

  function getTraineePool() {
    var list = [];
    Object.keys(data.userMap).forEach(function(uid) {
      var u = data.userMap[uid];
      if (!u || u.role !== 'trainee') return;
      list.push({ id: uid, name: u.name, count: countAssignments(uid) });
    });
    list.sort(function(a, b) {
      if (a.count !== b.count) return a.count - b.count;
      return String(a.name || '').localeCompare(String(b.name || ''), 'he');
    });
    return list;
  }

  function getDepartmentCommanderPool() {
    var list = [];
    Object.keys(data.userMap).forEach(function(uid) {
      var u = data.userMap[uid];
      if (!u || u.role !== 'departmentCommander') return;
      list.push({ id: uid, name: u.name, count: countAssignments(uid) });
    });
    list.sort(function(a, b) {
      if (a.count !== b.count) return b.count - a.count;
      return String(a.name || '').localeCompare(String(b.name || ''), 'he');
    });
    return list;
  }

  function renderUserPool(listEl, pool, emptyLabel) {
    if (!listEl) return;
    listEl.innerHTML = '';
    listEl.className = 'assign-users-list';
    bindPoolDropZone(listEl);
    if (!pool.length) {
      var empty = document.createElement('div');
      empty.className = 'assign-users-empty';
      empty.textContent = emptyLabel;
      listEl.appendChild(empty);
      return;
    }
    pool.forEach(function(t) {
      listEl.appendChild(makePoolChip(t.id, t.count));
    });
  }

  function profileRow(label, val) {
    if (!val) return '';
    return '<div style="display:flex;gap:8px;margin-bottom:3px">' +
      '<span style="color:var(--muted);flex-shrink:0">' + escHtml(label) + '</span>' +
      '<span style="word-break:break-word">' + escHtml(val) + '</span></div>';
  }

  function buildProfileHtml(u, uid) {
    if (!u) return '';
    var h = '<div style="font-weight:700;margin-bottom:8px;font-size:12px">' + escHtml(u.name) +
      ' <span style="font-weight:400;color:var(--muted)">' + escHtml(uid || '') + '</span></div>';
    h += profileRow('תפקיד', ROLE_LABELS[u.role] || u.role);
    h += profileRow('צוות', u.teamName);
    h += profileRow('שיבוצים', String(countAssignments(uid)));
    h += profileRow('טלפון', u.phone);
    return h;
  }

  function getPopover() { return document.getElementById('assignUserPopover'); }

  function positionPopover(anchor) {
    var pop = getPopover();
    if (!pop || !anchor) return;
    pop.style.display = 'block';
    var rect = anchor.getBoundingClientRect();
    var pw = pop.offsetWidth || 260;
    var ph = pop.offsetHeight || 120;
    var left = rect.left;
    var top = rect.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (left < 8) left = 8;
    if (top + ph > window.innerHeight - 8) top = rect.top - ph - 6;
    if (top < 8) top = 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function showUserPopover(userId, anchor, pin) {
    var u = data.userMap[userId];
    var pop = getPopover();
    if (!pop || !u) return;
    popoverPinned = !!pin;
    pop.innerHTML = buildProfileHtml(u, userId);
    positionPopover(anchor);
  }

  function hideUserPopover() {
    if (popoverPinned) return;
    var pop = getPopover();
    if (pop) pop.style.display = 'none';
  }

  function hideUserPopoverForce() {
    popoverPinned = false;
    var pop = getPopover();
    if (pop) pop.style.display = 'none';
  }

  function attachProfileHints(chipEl, userId) {
    var longPressTimer = null;
    var longPressTriggered = false;
    chipEl.addEventListener('mouseenter', function() {
      if (chipEl.dataset.editing === '1') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function() {
        if (!popoverPinned) showUserPopover(userId, chipEl, false);
      }, 350);
    });
    chipEl.addEventListener('mouseleave', function() {
      clearTimeout(hoverTimer);
      if (!popoverPinned) hideUserPopover();
    });
    chipEl.addEventListener('pointerdown', function(e) {
      if (e.target.closest && e.target.closest('.assign-chip-del')) return;
      if (chipEl.dataset.editing === '1') return;
      longPressTriggered = false;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(function() {
        longPressTriggered = true;
        showUserPopover(userId, chipEl, true);
      }, 500);
    });
    chipEl.addEventListener('pointerup', function() { clearTimeout(longPressTimer); });
    chipEl.addEventListener('pointercancel', function() { clearTimeout(longPressTimer); });
    chipEl.addEventListener('click', function(e) {
      if (longPressTriggered) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  document.addEventListener('pointerdown', function(e) {
    if (!popoverPinned) return;
    if (e.target.closest && (e.target.closest('#assignUserPopover') || e.target.closest('.assign-chip'))) return;
    hideUserPopoverForce();
  });

  function makePoolChip(userId, count) {
    var u = data.userMap[userId] || { name: userId, role: 'trainee' };
    var div = document.createElement('div');
    div.className = 'assign-chip assign-chip-pool';
    div.draggable = true;
    div.dataset.userId = userId;
    div.dataset.assignId = '';
    div.dataset.exId = '__pool__';
    div.dataset.resp = '';

    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (ROLE_COLORS[u.role] || '#888');

    var txt = document.createElement('span');
    txt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    txt.textContent = u.name;

    var badge = document.createElement('span');
    badge.className = 'assign-count-badge';
    badge.textContent = count + ' תרגילים';
    badge.title = 'מספר שיבוצים נוכחי';

    div.appendChild(dot);
    div.appendChild(txt);
    div.appendChild(badge);

    div.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        userId: userId, assignId: '', fromExId: '__pool__', resp: ''
      }));
      div.style.opacity = '0.4';
    });
    div.addEventListener('dragend', function() { div.style.opacity = '1'; });
    attachProfileHints(div, userId);
    return div;
  }

  function makeChip(userId, assignId, resp, exId) {
    var u = data.userMap[userId] || { name: userId, role: 'trainee' };
    var div = document.createElement('div');
    div.className = 'assign-chip';
    div.draggable = true;
    div.dataset.userId = userId;
    div.dataset.assignId = assignId || '';
    div.dataset.exId = exId || '';
    div.dataset.resp = resp || '';
    div.style.cssText = [
      'display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:4px',
      'background:var(--bg3);border:1px solid var(--border);border-radius:4px',
      'cursor:grab;font-family:var(--mono);font-size:12px;color:var(--text1)',
      'user-select:none'
    ].join(';');

    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (ROLE_COLORS[u.role] || '#888');

    var txt = document.createElement('span');
    txt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    txt.textContent = u.name + (resp ? ' · ' + resp : '');

    if (assignId && exId && exId !== '__pool__') {
      txt.style.cursor = 'pointer';
      txt.title = 'לחץ לשינוי תפקיד';
      txt.onclick = function(e) {
        e.stopPropagation();
        openRespEditor(div, assignId, exId, userId, resp, u.name);
      };
    }

    var del = document.createElement('span');
    del.className = 'assign-chip-del';
    del.textContent = '✕';
    del.title = 'הסר מתרגיל';
    del.style.cssText = 'color:var(--muted);cursor:pointer;padding:0 2px;flex-shrink:0';
    del.onclick = function(e) {
      e.stopPropagation();
      if (assignId) stageRemove(assignId, exId);
    };

    div.appendChild(dot);
    div.appendChild(txt);
    if (assignId) div.appendChild(del);

    div.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        userId: userId, assignId: assignId || '', fromExId: exId || '', resp: resp || ''
      }));
      div.style.opacity = '0.4';
    });
    div.addEventListener('dragend', function() { div.style.opacity = '1'; });
    attachProfileHints(div, userId);
    return div;
  }

  function openRespEditor(chipEl, assignId, exId, userId, currentResp, userName) {
    hideUserPopoverForce();
    if (editingChip && editingChip !== chipEl) closeRespEditor(editingChip);
    if (chipEl.dataset.editing === '1') return;
    editingChip = chipEl;
    chipEl.dataset.editing = '1';
    chipEl.draggable = false;

    var wrap = document.createElement('div');
    wrap.className = 'assign-resp-edit';
    wrap.onclick = function(e) { e.stopPropagation(); };

    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:10px;color:var(--muted)';
    lbl.textContent = userName + ' — תפקיד';

    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-input';
    inp.setAttribute('list', 'assignRespList');
    inp.placeholder = 'בחר או הקלד...';
    inp.value = currentResp || '';
    inp.style.cssText = 'width:100%;font-size:11px';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:4px';

    var okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-primary btn-sm';
    okBtn.textContent = 'אישור';
    okBtn.onclick = function(e) {
      e.stopPropagation();
      stageResp(assignId, exId, inp.value.trim());
    };

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = 'ביטול';
    cancelBtn.onclick = function(e) {
      e.stopPropagation();
      closeRespEditor(chipEl);
      render();
    };

    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    });

    btns.appendChild(okBtn);
    btns.appendChild(cancelBtn);
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    wrap.appendChild(btns);
    chipEl.innerHTML = '';
    chipEl.appendChild(wrap);
    inp.focus();
    inp.select();
  }

  function closeRespEditor(chipEl) {
    if (!chipEl) return;
    chipEl.dataset.editing = '0';
    chipEl.draggable = true;
    if (editingChip === chipEl) editingChip = null;
  }

  function makeExerciseRow(exId, title, subtitle, chips, opts) {
    opts = opts || {};
    var row = document.createElement('div');
    row.dataset.exId = exId;
    row.className = 'assign-ex-row' + (opts.needs ? ' assign-ex-row-needs' : '');

    var hdr = document.createElement('div');
    hdr.className = 'assign-ex-row-head';
    var h3 = document.createElement('div');
    h3.className = 'assign-ex-row-title';
    h3.textContent = title;
    var sub = document.createElement('div');
    sub.className = 'assign-ex-row-meta';
    sub.textContent = subtitle || '';
    hdr.appendChild(h3);
    if (subtitle) hdr.appendChild(sub);
    row.appendChild(hdr);

    var zone = document.createElement('div');
    zone.className = 'assign-ex-row-zone';
    zone.dataset.exId = exId;
    if (!chips.length) {
      zone.classList.add('is-empty');
    }
    chips.forEach(function(c) { zone.appendChild(c); });

    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', function() { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      var payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
      var toExId = exId;
      var fromExId = payload.fromExId;
      if (toExId === fromExId) return;
      if (toExId === '__pool__') {
        if (payload.assignId && fromExId) stageRemove(payload.assignId, fromExId);
        return;
      }
      if (payload.assignId && fromExId) {
        stageMove(payload.assignId, toExId, payload.userId, payload.resp, fromExId);
      } else {
        stageAdd(toExId, payload.userId, payload.resp || '');
      }
    });

    row.appendChild(zone);
    return row;
  }

  function bindPoolDropZone(zone) {
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', function() { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      var payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
      if (payload.assignId && payload.fromExId && payload.fromExId !== '__pool__') {
        stageRemove(payload.assignId, payload.fromExId);
      }
    });
  }

  function renderLeastAssigned() {
    if (!leastPanel) return;
    leastPanel.innerHTML = '';
    (data.corpsList || []).forEach(function(c) {
      var candidates = [];
      Object.keys(data.userMap).forEach(function(uid) {
        var u = data.userMap[uid];
        if (!u || u.role !== 'trainee' || (u.corps || '') !== c.key) return;
        candidates.push({ id: uid, name: u.name, count: countAssignments(uid) });
      });
      candidates.sort(function(a, b) {
        if (a.count !== b.count) return a.count - b.count;
        return a.name.localeCompare(b.name, 'he');
      });
      var card = document.createElement('div');
      card.style.cssText = 'min-width:150px;flex:1;max-width:200px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px 12px';
      var lbl = document.createElement('div');
      lbl.style.cssText = 'font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:6px';
      lbl.textContent = c.label;
      var body = document.createElement('div');
      if (!candidates.length) {
        body.style.cssText = 'font-size:12px;color:var(--muted)';
        body.textContent = '— אין חניכים';
      } else {
        var pick = candidates[0];
        body.style.cssText = 'font-family:var(--mono);font-size:12px;color:var(--text1)';
        body.innerHTML = '<b>' + escHtml(pick.name) + '</b><br><span style="font-size:10px;color:var(--muted)">' +
          escHtml(pick.id) + ' · ' + pick.count + ' תרגילים</span>';
      }
      card.appendChild(lbl);
      card.appendChild(body);
      leastPanel.appendChild(card);
    });
  }

  function render() {
    hideUserPopoverForce();
    if (exercisesList) exercisesList.innerHTML = '';

    var sortedExercises = data.exercises.slice().sort(function(a, b) {
      var sa = exerciseFillStatus(a.id);
      var sb = exerciseFillStatus(b.id);
      if (sa.missing !== sb.missing) return sb.missing - sa.missing;
      if (sa.isFull !== sb.isFull) return sa.isFull ? 1 : -1;
      return String(a.title || '').localeCompare(String(b.title || ''), 'he');
    });

    if (exercisesList) {
      sortedExercises.forEach(function(ex) {
        var status = exerciseFillStatus(ex.id);
        var parts = data.exMap[ex.id] || [];
        var chips = parts.map(function(a) {
          return makeChip(a.userId, a.id, a.resp, ex.id);
        });
        exercisesList.appendChild(
          makeExerciseRow(ex.id, ex.title, exerciseSubtitle(ex, status), chips, { needs: !status.isFull })
        );
      });
    }

    renderUserPool(traineesList, getTraineePool(), 'אין חניכים במערכת');
    renderUserPool(mmList, getDepartmentCommanderPool(), 'אין ממ במערכת');

    renderChangesBar();
    renderLeastAssigned();
  }

  function showPageLoader(msg) {
    if (window.MapimSpaShowLoader) window.MapimSpaShowLoader(msg || '// SAVING...');
  }
  function hidePageLoader() {
    if (window.MapimSpaHideLoader) window.MapimSpaHideLoader();
  }

  function saveChanges() {
    var changes = computePendingChanges();
    if (!changes.length) return;
    var summary = changes.map(function(ch, i) { return (i + 1) + '. ' + changeLabel(ch); }).join('\\n');
    if (!confirm('לאשר ' + changes.length + ' שינויים?\\n\\n' + summary)) return;

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ שומר...'; }
    setStatus('⏳ שומר שינויים...', '#fbbf24');
    showPageLoader('// SAVING ASSIGNMENTS...');

    google.script.run
      .withSuccessHandler(function(res) {
        hidePageLoader();
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 שמירה ואישור'; }
        var n = (res && res.applied) || changes.length;
        if (window.MapimSpa && MapimSpa.navigate) {
          MapimSpa.navigate('assign', { info: 'נשמרו ' + n + ' שינויים בהצלחה' });
        } else {
          setStatus('✓ נשמרו ' + n + ' שינויים', '#4ade80');
          baseline.exMap = cloneExMap(data.exMap);
          render();
        }
      })
      .withFailureHandler(function(err) {
        hidePageLoader();
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 שמירה ואישור'; }
        setStatus('✗ ' + (err.message || String(err)), '#f87171');
        alert(err.message || String(err));
      })
      .applyBoardChanges(sid, JSON.stringify(changes));
  }

  if (saveBtn) saveBtn.addEventListener('click', saveChanges);
  if (discardBtn) {
    discardBtn.addEventListener('click', function() {
      if (!computePendingChanges().length) return;
      if (!confirm('לבטל את כל השינויים שלא נשמרו?')) return;
      resetWorking();
    });
  }

  render();
})();
`;
}
