// views_team_matrix.gs — תצוגת מטריצה לפי צוות

function _teamMatrixIsMpRole(resp) {
  const r = String(resp || '').trim();
  if (!r) return false;
  return r.indexOf('מ"פ') !== -1 || r.indexOf('מ״פ') !== -1 ||
    r.indexOf('מפ') === 0 || r.indexOf('סמפ') === 0;
}

function _teamMatrixExerciseMeta(ex) {
  const title = String(ex.title || '');
  const type = String(ex.exercise_type || '').trim();
  let slot = '';
  if (title.indexOf('לילה') !== -1) slot = 'לילה';
  else if (title.indexOf('יום') !== -1) slot = 'יום';

  let slotLine = '';
  if (title.indexOf('יבש רטוב') !== -1) {
    slotLine = 'יבש רטוב' + (slot ? ' ' + slot : '');
  } else if (title.indexOf('יבש') !== -1 || title.indexOf('רטוב') !== -1) {
    slotLine = title.indexOf('יבש') !== -1 ? 'יבש' : 'רטוב';
  }

  const week = _isoWeekNumber(ex.rawStartDate);
  const timeParts = [];
  if (ex.rawStartTime) timeParts.push(ex.rawStartTime);
  if (ex.rawEndTime) timeParts.push('עד ' + ex.rawEndTime);
  let dateShort = '';
  if (ex.rawStartDate) {
    const p = String(ex.rawStartDate).split('-');
    if (p.length === 3) dateShort = p[2] + '.' + p[1];
  }
  const timeLine = timeParts.join(' ') + (dateShort ? ' | ' + dateShort : '');

  let typeLine = type;
  if (!typeLine) {
    if (title.indexOf('שיפון') !== -1) typeLine = 'שיפון' + (slot ? ' ' + slot : '');
    else if (title.indexOf('התקדמות') !== -1) typeLine = 'התקדמות' + (slot ? ' ' + slot : '');
    else typeLine = title.length > 24 ? title.substring(0, 24) + '…' : title;
  }

  return {
    id: ex.id,
    title: ex.title,
    week: week,
    weekYear: week ? _isoWeekYear(ex.rawStartDate) : 0,
    weekLabel: week ? _isoWeekLabel(ex.rawStartDate) : '',
    typeLine: typeLine,
    slotLine: slotLine,
    timeLine: timeLine,
    sortKey: ex.rawStartDate || ex.id
  };
}

function _teamMatrixAllowedTeams(user) {
  const all = Teams_all();
  if (Roles_hasAdminAccess(user.role) || Roles_isUnitCommander(user.role)) {
    return all;
  }
  if (Roles_isCompanyCommander(user.role)) {
    return all.filter(function(t) { return String(t.commander_id) === String(user.id); });
  }
  if (user.team_id) {
    const t = Teams_get(user.team_id);
    return t ? [t] : [];
  }
  return [];
}

function _teamMatrixBuildPayload(user) {
  const teams = _teamMatrixAllowedTeams(user);
  const membersByTeam = {};
  const teamExercises = {};
  const cells = {};

  teams.forEach(function(t) {
    membersByTeam[t.id] = Users_byTeam(t.id)
      .sort(function(a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
    teamExercises[t.id] = [];
    cells[t.id] = {};
  });

  const exById = {};
  Exercises_all().forEach(function(e) { exById[e.id] = e; });

  const exMeta = {};
  Object.keys(exById).forEach(function(exId) {
    exMeta[exId] = _teamMatrixExerciseMeta(exById[exId]);
  });

  Assignments_all().forEach(function(a) {
    teams.forEach(function(t) {
      const members = membersByTeam[t.id] || [];
      const memberIds = {};
      members.forEach(function(m) { memberIds[m.id] = true; });
      if (!memberIds[a.user_id]) return;

      if (!cells[t.id][a.user_id]) cells[t.id][a.user_id] = {};
      cells[t.id][a.user_id][a.exercise_id] = String(a.responsibility || '');

      if (teamExercises[t.id].indexOf(a.exercise_id) === -1) {
        teamExercises[t.id].push(a.exercise_id);
      }
    });
  });

  teams.forEach(function(t) {
    teamExercises[t.id].sort(function(a, b) {
      const ma = exMeta[a] || {};
      const mb = exMeta[b] || {};
      return String(ma.sortKey).localeCompare(String(mb.sortKey));
    });
  });

  return {
    teams: teams.map(function(t) {
      return {
        id: t.id,
        name: t.name,
        memberCount: (membersByTeam[t.id] || []).length
      };
    }),
    membersByTeam: membersByTeam,
    teamExercises: teamExercises,
    cells: cells,
    exMeta: exMeta
  };
}

function Views_teamMatrix(p) {
  p = p || {};
  p.tab = 'team';
  return Views_dashboard(p);
}

function _teamMatrixEmbedHtml(user, p) {
  const teams = _teamMatrixAllowedTeams(user);
  if (!teams.length) {
    return '<div class="card"><div class="empty">אין צוות משויך לתצוגה זו.</div></div>';
  }

  const payload = _teamMatrixBuildPayload(user);
  const initialTeam = String((p && p.teamId) || teams[0].id).trim();
  const jsonData = JSON.stringify(payload).replace(/</g, '\\u003c');

  return '<script id="teamMatrixData" type="application/json">' + jsonData + '</script>' +
    '<input type="hidden" id="teamMatrixInitialTeam" value="' + _esc(initialTeam) + '">' +
    '<div class="card" style="margin-bottom:14px"><div class="card-body" style="padding:12px 16px">' +
    '<div class="form-label" style="margin-bottom:8px">בחר צוות:</div>' +
    '<div id="teamMatrixTeamTabs" class="team-matrix-tabs"></div>' +
    '</div></div>' +
    '<div id="teamMatrixPanel" class="card">' +
    '<div class="card-header" style="flex-wrap:wrap;gap:10px;align-items:center">' +
    '<span class="card-title" id="teamMatrixTitle">—</span>' +
    '<div style="display:flex;gap:6px;margin-right:auto">' +
    '<button type="button" id="teamMatrixExportCsv" class="btn btn-secondary btn-sm">Excel</button>' +
    '</div></div>' +
    '<div class="card-body" style="padding:12px 16px;border-bottom:1px solid var(--border)">' +
    '<div class="form-label" style="margin-bottom:8px">סנן לפי שבוע לועזי:</div>' +
    '<div id="teamMatrixWeekTabs" class="team-matrix-tabs"></div>' +
    '</div>' +
    '<div id="teamMatrixStats" class="team-matrix-stats"></div>' +
    '<div class="team-matrix-scroll"><table class="tbl team-matrix-tbl" id="teamMatrixTable">' +
    '<thead id="teamMatrixHead"></thead><tbody id="teamMatrixBody"></tbody></table></div>' +
    '</div>' +
    '<script>' + _teamMatrixJs() + '</script>';
}

function _teamMatrixJs() {
  return `
(function() {
  var data = JSON.parse(document.getElementById('teamMatrixData').textContent);
  var currentTeam = document.getElementById('teamMatrixInitialTeam').value || (data.teams[0] && data.teams[0].id);
  var currentWeek = 'all';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function userLinkHtml(userId, userName) {
    if (window.MapimSpa && MapimSpa.userLinkHtml) return MapimSpa.userLinkHtml(userId, userName);
    return '<b>' + esc(userName) + '</b>';
  }

  function isMpRole(r) {
    r = String(r || '').trim();
    if (!r) return false;
    return r.indexOf('מ"פ') >= 0 || r.indexOf('מ״פ') >= 0 || r.indexOf('מפ') === 0 || r.indexOf('סמפ') === 0;
  }

  function getTeam() {
    return data.teams.find(function(t) { return t.id === currentTeam; }) || data.teams[0];
  }

  function getExercises() {
    var ids = data.teamExercises[currentTeam] || [];
    if (currentWeek === 'all') return ids;
    var w = parseInt(currentWeek, 10);
    return ids.filter(function(exId) {
      var m = data.exMeta[exId];
      return m && m.week === w;
    });
  }

  function collectWeeks() {
    var weeks = {};
    (data.teamExercises[currentTeam] || []).forEach(function(exId) {
      var m = data.exMeta[exId];
      if (m && m.week) weeks[m.week] = true;
    });
    return Object.keys(weeks).map(Number).sort(function(a, b) { return a - b; });
  }

  function renderTeamTabs() {
    var el = document.getElementById('teamMatrixTeamTabs');
    el.innerHTML = data.teams.map(function(t) {
      return '<button type="button" class="team-matrix-tab' + (t.id === currentTeam ? ' active' : '') + '" data-team="' + esc(t.id) + '">' +
        esc(t.name) + '</button>';
    }).join('');
    el.querySelectorAll('.team-matrix-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentTeam = btn.getAttribute('data-team');
        currentWeek = 'all';
        render();
      });
    });
  }

  function weekFilterLabel() {
    if (currentWeek === 'all') return 'כל השבועות';
    var w = parseInt(currentWeek, 10);
    var exIds = data.teamExercises[currentTeam] || [];
    var sampleId = exIds.find(function(exId) {
      return data.exMeta[exId] && data.exMeta[exId].week === w;
    });
    var y = sampleId && data.exMeta[sampleId] ? data.exMeta[sampleId].weekYear : 0;
    return 'שבוע לועזי ' + w + (y ? ' · ' + y : '');
  }

  function renderWeekTabs() {
    var weeks = collectWeeks();
    var el = document.getElementById('teamMatrixWeekTabs');
    var html = '<button type="button" class="team-matrix-tab' + (currentWeek === 'all' ? ' active' : '') + '" data-week="all">הצג הכל</button>';
    weeks.forEach(function(w) {
      html += '<button type="button" class="team-matrix-tab' + (String(currentWeek) === String(w) ? ' active' : '') + '" data-week="' + w + '">שבוע לועזי ' + w + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.team-matrix-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentWeek = btn.getAttribute('data-week');
        renderMatrix();
      });
    });
  }

  function computeStats(exIds, members) {
    var total = 0, mp = 0;
    members.forEach(function(m) {
      var row = (data.cells[currentTeam] && data.cells[currentTeam][m.id]) || {};
      exIds.forEach(function(exId) {
        var resp = row[exId];
        if (!resp) return;
        total++;
        if (isMpRole(resp)) mp++;
      });
    });
  var other = total - mp;
    var mpPct = total ? Math.round(mp * 100 / total) : 0;
    var otherPct = total ? Math.round(other * 100 / total) : 0;
    return { total: total, mp: mp, other: other, mpPct: mpPct, otherPct: otherPct };
  }

  function rowSummary(m, exIds) {
    var row = (data.cells[currentTeam] && data.cells[currentTeam][m.id]) || {};
    var total = 0, mp = 0;
    exIds.forEach(function(exId) {
      var resp = row[exId];
      if (!resp) return;
      total++;
      if (isMpRole(resp)) mp++;
    });
    if (!total) return 'אין שיבוצים';
    return 'סה״כ ' + total + ' — מ״פ ' + mp + ' — אחר ' + (total - mp);
  }

  function renderStats(stats) {
    document.getElementById('teamMatrixStats').innerHTML =
      '<div class="team-matrix-stat"><div class="team-matrix-stat-num">' + stats.total + '</div><div class="team-matrix-stat-label">סה״כ תרגילים</div></div>' +
      '<div class="team-matrix-stat"><div class="team-matrix-stat-num">' + stats.mp + ' <span style="font-size:12px;opacity:.7">(' + stats.mpPct + '%)</span></div><div class="team-matrix-stat-label">תפקיד מ״פ</div></div>' +
      '<div class="team-matrix-stat"><div class="team-matrix-stat-num">' + stats.other + ' <span style="font-size:12px;opacity:.7">(' + stats.otherPct + '%)</span></div><div class="team-matrix-stat-label">תפקידים אחרים</div></div>';
  }

  function renderMatrix() {
    var team = getTeam();
    var members = data.membersByTeam[currentTeam] || [];
    var exIds = getExercises();
    var stats = computeStats(exIds, members);

    document.getElementById('teamMatrixTitle').textContent =
      team.name + ' — ' + members.length + ' חברים · מוצג: ' + weekFilterLabel();
    renderStats(stats);

    var head = '<tr><th class="team-matrix-sticky">שם</th>';
    exIds.forEach(function(exId) {
      var m = data.exMeta[exId] || { title: exId };
      var fullTitle = String(m.title || m.label || exId || '');
      head += '<th class="team-matrix-col-hdr team-matrix-ex-col"><div class="team-matrix-ex-title"' +
        (fullTitle ? ' title="' + esc(fullTitle) + '"' : '') + '>' + esc(fullTitle) + '</div>';
      if (m.weekLabel) head += '<div class="team-matrix-ex-sub">' + esc(m.weekLabel) + '</div>';
      else if (m.week) head += '<div class="team-matrix-ex-sub">שבוע לועזי ' + m.week + '</div>';
      if (m.typeLine) head += '<div class="team-matrix-ex-sub">' + esc(m.typeLine) + '</div>';
      if (m.slotLine) head += '<div class="team-matrix-ex-sub">' + esc(m.slotLine) + '</div>';
      if (m.timeLine) head += '<div class="team-matrix-ex-sub">' + esc(m.timeLine) + '</div>';
      head += '</th>';
    });
    head += '</tr>';
    document.getElementById('teamMatrixHead').innerHTML = head;

    if (!members.length) {
      document.getElementById('teamMatrixBody').innerHTML =
        '<tr><td colspan="' + (exIds.length + 1) + '" class="empty">אין חברים בצוות</td></tr>';
      return;
    }

    var body = '';
    members.forEach(function(m) {
      body += '<tr><td class="team-matrix-sticky team-matrix-name"><div class="team-matrix-user-name">' + userLinkHtml(m.id, m.name) + '</div>' +
        '<div class="team-matrix-user-sub">' + esc(rowSummary(m, exIds)) + '</div></td>';
      var row = (data.cells[currentTeam] && data.cells[currentTeam][m.id]) || {};
      exIds.forEach(function(exId) {
        var resp = row[exId] || '';
        body += '<td class="team-matrix-cell' + (resp ? ' filled' : '') + '">' +
          (resp ? '<span class="team-matrix-role">' + esc(resp) + '</span>' : '') + '</td>';
      });
      body += '</tr>';
    });
    document.getElementById('teamMatrixBody').innerHTML = body;
  }

  function exportCsv() {
    var team = getTeam();
    var members = data.membersByTeam[currentTeam] || [];
    var exIds = getExercises();
    var rows = [];
    var header = ['שם', 'סיכום אישי'];
    exIds.forEach(function(exId) {
      var m = data.exMeta[exId] || {};
      header.push((m.title || exId) + (m.weekLabel ? ' (' + m.weekLabel + ')' : ''));
    });
    rows.push(header);
    members.forEach(function(u) {
      var row = [u.name, rowSummary(u, exIds)];
      var cells = (data.cells[currentTeam] && data.cells[currentTeam][u.id]) || {};
      exIds.forEach(function(exId) { row.push(cells[exId] || ''); });
      rows.push(row);
    });
    var csv = rows.map(function(r) {
      return r.map(function(c) {
        c = String(c == null ? '' : c);
        if (c.indexOf(',') >= 0 || c.indexOf('"') >= 0 || c.indexOf('\\n') >= 0) {
          return '"' + c.replace(/"/g, '""') + '"';
        }
        return c;
      }).join(',');
    }).join('\\n');
    var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'team-matrix-' + team.id + '.csv';
    a.click();
  }

  function render() {
    renderTeamTabs();
    renderWeekTabs();
    renderMatrix();
  }

  document.getElementById('teamMatrixExportCsv').addEventListener('click', exportCsv);
  render();
})();
`;
}
