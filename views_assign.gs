// views_assign.gs — drag-and-drop assignment board
function Views_assign(p) {
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });
  if (user.role !== 'admin') return Views_error('גישה למפקדי קורס בלבד.', p);

  const sid  = user.id;
  const sidQ = encodeURIComponent(sid);

  const exercises = Exercises_all();
  const allUsers  = Users_all();
  const assigns   = Assignments_all();

  // Build data payload for client-side JS
  // exercises: [{id, title, start_date, end_date}]
  // users:     [{id, name, role}]
  // assigns:   [{id, exercise_id, user_id, responsibility, status}]
  const exData = exercises.map(function(e) {
    return { id: e.id, title: e.title, start: e.start_date || '', end: e.end_date || '' };
  });
  const userMap = {};
  allUsers.forEach(function(u) {
    userMap[u.id] = {
      name: u.name,
      role: u.role,
      corps: String(u.military_affiliation || '').replace(/״/g, '').trim()
    };
  });

  const exMap = {}; // exercise_id → [assignments]
  assigns.forEach(function(a) {
    if (!exMap[a.exercise_id]) exMap[a.exercise_id] = [];
    exMap[a.exercise_id].push({ id: a.id, userId: a.user_id, resp: a.responsibility, status: a.status });
  });

  // Unassigned users (not assigned to any exercise)
  const assignedUserIds = new Set(assigns.map(function(a) { return a.user_id; }));
  const unassigned = allUsers.filter(function(u) { return !assignedUserIds.has(u.id); });

  const jsonData = JSON.stringify({
    exercises: exData,
    userMap:   userMap,
    exMap:     exMap,
    unassigned: unassigned.map(function(u) { return { id: u.id, name: u.name, role: u.role }; }),
    corpsList: [
      { key: 'חיר', label: 'חי״ר' },
      { key: 'חשן', label: 'חשן' },
      { key: 'חהן', label: 'חה״ן' },
      { key: 'מסייעת', label: 'מסייעת' },
      { key: 'מנהלי', label: 'מנהלי' }
    ],
    respOptions: _assignmentRespOptions()
  });

  const body = _topbar(user, sid) +
    '<div class="page">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0">🔀 לוח שיבוץ</div>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    '<span id="assignStatus" style="font-family:var(--mono);font-size:12px;color:var(--muted)"></span>' +
    _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div></div>' +

    '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:12px">' +
    '// גרור חייל מהעמודה השמאלית לתרגיל · גרור בין תרגילים להעברה · גרור לשורה השמאלית להסרה · לחץ על משתתף בתרגיל לשינוי תפקיד' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px">' +
    _confirmAction('action=autoAssignAll&sid=' + sidQ, '⚡ שיבוץ אוטומטי',
      'לבצע שיבוץ אוטומטי? ימולאו תרגילים חסרים. משתתף יכול להיות בכמה תרגילים — למעט תרגילים חופפים בזמן.', 'btn btn-primary') +
    _confirmAction('action=clearAllAssignments&sid=' + sidQ, '🗑 איפוס שיבוצים',
      'לאפס את כל השיבוצים? פעולה בלתי הפיכה.', 'btn btn-danger btn-sm') +
    '</div>' +

    // Data island
    '<script id="assignData" type="application/json">' + jsonData + '</script>' +
    '<input type="hidden" id="assignSid" value="' + _esc(sid) + '">' +
    _respDatalistHtml('assignRespList') +

    // Board
    '<div id="assignBoard" style="display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:16px">' +
    // Unassigned column rendered by JS
    '</div>' +

    '<div id="assignLeastSection" style="margin-top:8px;border-top:1px solid var(--border);padding-top:16px">' +
    '<div class="card-title" style="margin-bottom:10px;font-size:13px">📊 חניך מועדף לשיבוץ — הכי פחות משובץ לכל חיל</div>' +
    '<div id="assignLeastPanel" style="display:flex;gap:10px;flex-wrap:wrap"></div>' +
    '<p style="font-family:var(--mono);font-size:10px;color:var(--muted);margin:8px 0 0">מתעדכן אוטומטית לפי מספר התרגילים הנוכחי · אחד לכל חיל</p>' +
    '</div>' +
    '</div>' +

    '<script>' + _assignBoardJs() + '</script>';

  return _wrapPage(body, 'לוח שיבוץ');
}
function _assignBoardJs() {
  return `
(function() {
  var data  = JSON.parse(document.getElementById('assignData').textContent);
  var sid   = document.getElementById('assignSid').value;
  var board = document.getElementById('assignBoard');
  var status = document.getElementById('assignStatus');
  var leastPanel = document.getElementById('assignLeastPanel');

  var ROLE_LABELS = { admin: 'מפקד קורס', commander: 'מפקד צוות', trainee: 'חניך' };
  var ROLE_COLORS = { admin: '#4ade80', commander: '#60a5fa', trainee: '#94a3b8' };

  function setStatus(msg, color) {
    status.textContent = msg;
    status.style.color = color || 'var(--muted)';
  }

  var editingChip = null;

  function saveAssignmentResp(assignId, exId, newResp) {
    if (!newResp) { alert('יש לציין תפקיד'); return; }
    setStatus('⏳ מעדכן תפקיד...', '#fbbf24');
    showPageLoader('// UPDATING ROLE...');
    google.script.run
      .withSuccessHandler(function() {
        hidePageLoader();
        var list = data.exMap[exId];
        if (list) {
          list.forEach(function(a) {
            if (a.id === assignId) a.resp = newResp;
          });
        }
        editingChip = null;
        render();
        setStatus('✓ תפקיד עודכן', '#4ade80');
      })
      .withFailureHandler(function(err) {
        hidePageLoader();
        setStatus('✗ ' + err.message, '#f87171');
      })
      .updateAssignmentRespFromBoard(sid, assignId, exId, newResp);
  }

  function openRespEditor(chipEl, assignId, exId, userId, currentResp, userName) {
    if (editingChip && editingChip !== chipEl) closeRespEditor(editingChip);
    if (chipEl.dataset.editing === '1') return;
    editingChip = chipEl;
    chipEl.dataset.editing = '1';
    chipEl.draggable = false;

    var wrap = document.createElement('div');
    wrap.className = 'assign-resp-edit';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;width:100%';
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

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = 'שמור';
    saveBtn.onclick = function(e) {
      e.stopPropagation();
      saveAssignmentResp(assignId, exId, inp.value.trim());
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
      if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    });

    btns.appendChild(saveBtn);
    btns.appendChild(cancelBtn);
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    wrap.appendChild(btns);

    chipEl._respEditBackup = chipEl.innerHTML;
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

  function countAssignments(userId) {
    var n = 0;
    for (var exId in data.exMap) {
      if (!data.exMap.hasOwnProperty(exId)) continue;
      (data.exMap[exId] || []).forEach(function(a) {
        if (a.userId === userId) n++;
      });
    }
    return n;
  }

  function renderLeastAssigned() {
    if (!leastPanel) return;
    leastPanel.innerHTML = '';

    (data.corpsList || []).forEach(function(c) {
      var candidates = [];
      for (var uid in data.userMap) {
        if (!data.userMap.hasOwnProperty(uid)) continue;
        var u = data.userMap[uid];
        if (u.role !== 'trainee') continue;
        if ((u.corps || '') !== c.key) continue;
        candidates.push({ id: uid, name: u.name, count: countAssignments(uid) });
      }

      candidates.sort(function(a, b) {
        if (a.count !== b.count) return a.count - b.count;
        return a.name.localeCompare(b.name, 'he');
      });

      var card = document.createElement('div');
      card.style.cssText = [
        'min-width:150px;flex:1;max-width:200px',
        'background:var(--bg2);border:1px solid var(--border);border-radius:6px',
        'padding:10px 12px'
      ].join(';');

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
        var nameEl = document.createElement('b');
        nameEl.textContent = pick.name;
        body.appendChild(nameEl);
        body.appendChild(document.createElement('br'));
        var sub = document.createElement('span');
        sub.style.cssText = 'font-size:10px;color:var(--muted)';
        sub.textContent = pick.id + ' · ' + pick.count + ' תרגילים';
        body.appendChild(sub);
      }

      card.appendChild(lbl);
      card.appendChild(body);
      leastPanel.appendChild(card);
    });
  }

  // ── Build a draggable chip ──
  function makeChip(userId, assignId, resp, exId) {
    var u    = data.userMap[userId] || { name: userId, role: 'trainee' };
    var div  = document.createElement('div');
    div.className   = 'assign-chip';
    div.draggable   = true;
    div.dataset.userId   = userId;
    div.dataset.assignId = assignId || '';
    div.dataset.exId     = exId     || '';
    div.dataset.resp     = resp     || '';
    div.style.cssText = [
      'display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:4px',
      'background:var(--bg3);border:1px solid var(--border);border-radius:4px',
      'cursor:grab;font-family:var(--mono);font-size:12px;color:var(--text1)',
      'user-select:none;transition:opacity .15s'
    ].join(';');

    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (ROLE_COLORS[u.role] || '#888');

    var txt = document.createElement('span');
    txt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    txt.textContent = u.name + (resp ? ' · ' + resp : '');

    if (assignId && exId && exId !== '__unassigned__') {
      txt.style.cursor = 'pointer';
      txt.title = 'לחץ לשינוי תפקיד';
      txt.onclick = function(e) {
        e.stopPropagation();
        openRespEditor(div, assignId, exId, userId, resp, u.name);
      };
    }

    var del = document.createElement('span');
    del.textContent = '✕';
    del.title = 'הסר מתרגיל';
    del.style.cssText = 'color:var(--muted);cursor:pointer;padding:0 2px;flex-shrink:0';
    del.onclick = function(e) {
      e.stopPropagation();
      if (assignId) removeAssignment(assignId, div, exId);
    };

    div.appendChild(dot);
    div.appendChild(txt);
    if (assignId) div.appendChild(del);

    // Drag events
    div.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        userId: userId, assignId: assignId || '', fromExId: exId || '', resp: resp || ''
      }));
      div.style.opacity = '0.4';
    });

    div.addEventListener('dragend', function() {
      div.style.opacity = '1';
    });

    return div;
  }

  // ── Build a column (exercise or unassigned) ──
  function makeColumn(exId, title, subtitle, chips) {
    var col = document.createElement('div');
    col.dataset.exId = exId;
    col.style.cssText = [
      'min-width:200px;max-width:220px;flex-shrink:0',
      'background:var(--bg2);border:1px solid var(--border);border-radius:6px',
      'display:flex;flex-direction:column'
    ].join(';');

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:10px 12px;border-bottom:1px solid var(--border)';

    var h3 = document.createElement('div');
    h3.style.cssText = 'font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text1);margin-bottom:2px;word-break:break-word';
    h3.textContent = title;

    var sub = document.createElement('div');
    sub.style.cssText = 'font-family:var(--mono);font-size:10px;color:var(--muted)';
    sub.textContent = subtitle || '';

    hdr.appendChild(h3);
    if (subtitle) hdr.appendChild(sub);

    col.appendChild(hdr);

    // Drop zone
    var zone = document.createElement('div');
    zone.style.cssText = 'padding:8px;flex:1;min-height:60px';
    zone.dataset.exId = exId;

    chips.forEach(function(c) {
      zone.appendChild(c);
    });

    // Drag-over highlight
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      zone.style.background = 'rgba(74,222,128,0.07)';
    });

    zone.addEventListener('dragleave', function() {
      zone.style.background = '';
    });

    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.style.background = '';

      var payload;

      try {
        payload = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch(err) {
        return;
      }

      var toExId = exId;
      var fromExId = payload.fromExId;

      if (toExId === fromExId) return;

      if (toExId === '__unassigned__') {
        // Remove assignment
        if (payload.assignId) {
          removeAssignment(payload.assignId, null, fromExId);
        }
      } else {
        // Move or add
        if (payload.assignId && fromExId) {
          moveAssignment(payload.assignId, toExId, payload.userId, payload.resp, zone, fromExId);
        } else {
          addAssignment(toExId, payload.userId, payload.resp || '', zone);
        }
      }
    });

    col.appendChild(zone);

    return col;
  }

  // ── Render board ──
  function render() {
    board.innerHTML = '';

    // Unassigned column
    var unassignedChips = data.unassigned.map(function(u) {
      return makeChip(u.id, '', '', '');
    });

    board.appendChild(
      makeColumn(
        '__unassigned__',
        '👤 לא משובצים',
        data.unassigned.length + ' חיילים',
        unassignedChips
      )
    );

    // Exercise columns
    data.exercises.forEach(function(ex) {
      var parts = data.exMap[ex.id] || [];

      var chips = parts.map(function(a) {
        return makeChip(a.userId, a.id, a.resp, ex.id);
      });

      var subtitle = [ex.start, ex.end].filter(Boolean).join(' — ') || '';

      board.appendChild(
        makeColumn(ex.id, ex.title, subtitle, chips)
      );
    });

    renderLeastAssigned();
  }

  // ── API calls via google.script.run ──
  function hidePageLoader() {
    if (window.MapimSpaHideLoader) window.MapimSpaHideLoader();
  }
  function showPageLoader(msg) {
    if (window.MapimSpaShowLoader) window.MapimSpaShowLoader(msg || '// ASSIGNING...');
  }

  function addAssignment(exId, userId, resp, zone) {
    setStatus('⏳ משבץ...', '#fbbf24');
    showPageLoader('// ASSIGNING...');

    google.script.run
      .withSuccessHandler(function(result) {
        hidePageLoader();
        if (result && result.id) {
          if (!data.exMap[exId]) data.exMap[exId] = [];

          data.exMap[exId].push({
            id: result.id,
            userId: userId,
            resp: resp,
            status: 'pending'
          });

          data.unassigned = data.unassigned.filter(function(u) {
            return u.id !== userId;
          });

          render();

          setStatus('✓ שובץ בהצלחה', '#4ade80');
        }
      })
      .withFailureHandler(function(err) {
        hidePageLoader();
        setStatus('✗ ' + err.message, '#f87171');
      })
      .assignFromBoard(sid, exId, userId, resp);
  }

  function removeAssignment(assignId, chip, fromExId) {
    setStatus('⏳ מסיר...', '#fbbf24');
    showPageLoader('// REMOVING...');

    google.script.run
      .withSuccessHandler(function() {
        hidePageLoader();
        var userId = '';

        if (data.exMap[fromExId]) {
          var a = data.exMap[fromExId].find(function(x) {
            return x.id === assignId;
          });

          if (a) userId = a.userId;

          data.exMap[fromExId] = data.exMap[fromExId].filter(function(x) {
            return x.id !== assignId;
          });
        }

        if (userId && data.userMap[userId]) {
          data.unassigned.push({
            id: userId,
            name: data.userMap[userId].name,
            role: data.userMap[userId].role
          });
        }

        render();

        setStatus('✓ הוסר בהצלחה', '#4ade80');
      })
      .withFailureHandler(function(err) {
        hidePageLoader();
        setStatus('✗ ' + err.message, '#f87171');
      })
      .removeAssignmentById(sid, assignId);
  }

  function moveAssignment(assignId, toExId, userId, resp, zone, fromExId) {
    setStatus('⏳ מעביר...', '#fbbf24');
    showPageLoader('// MOVING...');

    google.script.run
      .withSuccessHandler(function() {
        hidePageLoader();
        if (data.exMap[fromExId]) {
          var a = data.exMap[fromExId].find(function(x) {
            return x.id === assignId;
          });

          if (a) {
            data.exMap[fromExId] = data.exMap[fromExId].filter(function(x) {
              return x.id !== assignId;
            });

            if (!data.exMap[toExId]) data.exMap[toExId] = [];

            data.exMap[toExId].push({
              id: assignId,
              userId: userId,
              resp: resp,
              status: a.status
            });
          }
        }

        render();

        setStatus('✓ הועבר בהצלחה', '#4ade80');
      })
      .withFailureHandler(function(err) {
        hidePageLoader();
        setStatus('✗ ' + err.message, '#f87171');
      })
      .moveAssignmentById(sid, assignId, toExId);
  }

  render();
})();
`;
}