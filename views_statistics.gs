// views_statistics.gs — סטטיסטיקות סגל (גרפים ו-KPI)

function _statisticsKpiCard(label, value, tone, sub) {
  sub = sub || '';
  return '<div class="stats-kpi stats-kpi-' + tone + '">' +
    '<div class="stats-kpi-label">' + _esc(label) + '</div>' +
    '<div class="stats-kpi-value">' + _esc(String(value)) + '</div>' +
    (sub ? '<div class="stats-kpi-sub">' + _esc(sub) + '</div>' : '') +
    '</div>';
}

function _statisticsKpiSection(title, badgeClass, badgeLabel, metrics, roleLabel, roleSub) {
  let s = '<div class="stats-section">' +
    '<div class="stats-section-head">' +
    '<span class="stats-section-title">' + _esc(title) + '</span>' +
    '<span class="stats-cohort-badge ' + badgeClass + '">' + _esc(badgeLabel) + '</span>' +
    '</div>' +
    '<div class="stats-kpi-grid">' +
    _statisticsKpiCard('מספר ' + (badgeLabel === 'מ"פ' ? 'מפים' : 'מגדים'), metrics.people, 'blue') +
    _statisticsKpiCard('סה״כ שיבוצים', metrics.totalAssignments, 'green') +
    _statisticsKpiCard('ממוצע תרגילים ל' + badgeLabel, metrics.avgPerPerson, 'yellow') +
    _statisticsKpiCard('סה״כ תרגילים', metrics.totalExercises, 'cyan') +
    _statisticsKpiCard('שיבוצי ' + roleLabel, metrics.roleAssigns, 'pink', roleSub) +
    '</div></div>';
  return s;
}

function _statisticsPageJs() {
  return `
(function() {
  var root = document.getElementById('statisticsPage');
  if (!root || root._statsInit) return;
  root._statsInit = true;

  var dataEl = document.getElementById('statisticsData');
  if (!dataEl) return;
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var charts = [];
  function destroyCharts() {
    charts.forEach(function(c) { try { c.destroy(); } catch (err) {} });
    charts = [];
  }

  function loadChartJs(cb) {
    if (window.Chart) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var teamChart, compareChart, typeChart;
  var selectedTeams = [];
  var compareMode = 'team';
  var traineeMode = 'team';
  var typeFilter = 'all';
  var typeTeam = '';
  var typeSort = 'busy';

  function renderTeamTable() {
    var tbody = document.getElementById('statsTeamTableBody');
    if (!tbody) return;
    tbody.innerHTML = data.teamStats.map(function(t) {
      return '<tr><td>' + esc(t.name) + '</td><td>' + t.trainees + '</td>' +
        '<td class="stats-num-green">' + t.avg + '</td>' +
        '<td class="stats-num-blue">' + t.max + '</td>' +
        '<td class="stats-num-orange">' + t.min + '</td></tr>';
    }).join('');
  }

  function renderTeamChart() {
    var canvas = document.getElementById('statsTeamChart');
    if (!canvas || !window.Chart) return;
    if (teamChart) teamChart.destroy();
    var labels = data.teamStats.map(function(t) { return t.name; });
    teamChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'ממוצע', data: data.teamStats.map(function(t) { return t.avg; }), backgroundColor: '#16a34a' },
          { label: 'מקסימום', data: data.teamStats.map(function(t) { return t.max; }), backgroundColor: '#6366f1' },
          { label: 'מינימום', data: data.teamStats.map(function(t) { return t.min; }), backgroundColor: '#f59e0b' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Heebo' } } } },
        scales: {
          x: { ticks: { font: { family: 'Heebo' } } },
          y: { beginAtZero: true, ticks: { font: { family: 'Heebo' } } }
        }
      }
    });
    charts.push(teamChart);
  }

  function renderCompareTeamButtons() {
    var el = document.getElementById('statsCompareTeams');
    if (!el) return;
    el.innerHTML = data.teams.map(function(t) {
      var on = selectedTeams.indexOf(t.id) !== -1;
      return '<button type="button" class="stats-chip' + (on ? ' active' : '') + '" data-team-id="' + esc(t.id) + '">' + esc(t.name) + '</button>';
    }).join('') +
      '<button type="button" class="stats-chip stats-chip-clear" id="statsCompareClear">✕ נקה</button>';
    el.querySelectorAll('[data-team-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-team-id');
        var idx = selectedTeams.indexOf(id);
        if (idx === -1) selectedTeams.push(id);
        else selectedTeams.splice(idx, 1);
        renderCompareTeamButtons();
        renderCompareChart();
      });
    });
    var clearBtn = document.getElementById('statsCompareClear');
    if (clearBtn) clearBtn.onclick = function() {
      selectedTeams = [];
      renderCompareTeamButtons();
      renderCompareChart();
    };
  }

  function filteredTeamStats() {
    if (!selectedTeams.length) return data.teamStats;
    var set = {};
    selectedTeams.forEach(function(id) { set[id] = true; });
    return data.teamStats.filter(function(t) { return set[t.id]; });
  }

  function renderCompareChart() {
    var canvas = document.getElementById('statsCompareChart');
    if (!canvas || !window.Chart) return;
    if (compareChart) compareChart.destroy();
    var rows = filteredTeamStats();
    compareChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(function(t) { return t.name; }),
        datasets: [
          { label: 'תפקיד מ״פ', data: rows.map(function(t) { return t.mpRole; }), backgroundColor: '#166534' },
          { label: 'תפקידים אחרים', data: rows.map(function(t) { return t.otherRole; }), backgroundColor: '#ea580c' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Heebo' } } } },
        scales: {
          x: { ticks: { font: { family: 'Heebo' } } },
          y: { beginAtZero: true, ticks: { font: { family: 'Heebo' } } }
        }
      }
    });
    charts.push(compareChart);
  }

  function traineeRowsFiltered() {
    var rows;
    if (typeFilter === 'mp') {
      rows = (data.commanders || []).filter(function(r) { return r.isMp; });
    } else if (typeFilter === 'magad') {
      rows = (data.commanders || []).filter(function(r) { return r.isMagad; });
    } else {
      rows = data.trainees.slice();
    }
    if (typeTeam) rows = rows.filter(function(r) { return String(r.teamId) === String(typeTeam); });
    if (traineeMode === 'rank') {
      rows.sort(function(a, b) {
        var c = String(a.rank).localeCompare(String(b.rank), 'he');
        return c !== 0 ? c : b.exercises - a.exercises;
      });
    } else if (traineeMode === 'team') {
      rows.sort(function(a, b) {
        var c = String(a.teamName).localeCompare(String(b.teamName), 'he');
        return c !== 0 ? c : b.exercises - a.exercises;
      });
    }
    return rows;
  }

  function exerciseCountClass(n) {
    var avg = data.avgExercisesPerTrainee;
    if (n > avg) return 'above';
    if (n < avg) return 'below';
    return 'avg';
  }

  function renderTraineeTable() {
    var tbody = document.getElementById('statsTraineeTableBody');
    if (!tbody) return;
    var rows = traineeRowsFiltered();
    tbody.innerHTML = rows.map(function(r, i) {
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(r.name) + '</b></td>' +
        '<td><span class="stats-rank-badge">' + esc(r.rank) + '</span></td>' +
        '<td>' + esc(r.teamName) + '</td>' +
        '<td><span class="stats-ex-count ' + exerciseCountClass(r.exercises) + '">' + r.exercises + '</span></td></tr>';
    }).join('');
  }

  function filteredExerciseTypes() {
    var filtered = (data.assignmentsLite || []).filter(function(a) {
      if (typeFilter === 'mp' && !a.isMp) return false;
      if (typeFilter === 'magad' && !a.isMagad) return false;
      if (typeTeam && String(a.teamId) !== String(typeTeam)) return false;
      return true;
    });
    var byType = {};
    filtered.forEach(function(a) {
      if (!byType[a.type]) byType[a.type] = { type: a.type, assignmentCount: 0, exerciseIds: {} };
      byType[a.type].assignmentCount++;
      byType[a.type].exerciseIds[a.exerciseId] = true;
    });
    var list = Object.keys(byType).map(function(k) {
      return {
        type: byType[k].type,
        assignmentCount: byType[k].assignmentCount,
        exerciseCount: Object.keys(byType[k].exerciseIds).length
      };
    });
    if (typeSort === 'light') list.sort(function(a, b) { return a.assignmentCount - b.assignmentCount; });
    else list.sort(function(a, b) { return b.assignmentCount - a.assignmentCount; });
    return list;
  }

  function renderTypeTable() {
    var tbody = document.getElementById('statsTypeTableBody');
    if (!tbody) return;
    tbody.innerHTML = filteredExerciseTypes().map(function(r) {
      return '<tr><td>' + esc(r.type) + '</td>' +
        '<td class="stats-num-green">' + r.exerciseCount + '</td>' +
        '<td>' + r.assignmentCount + '</td></tr>';
    }).join('');
  }

  var palette = ['#166534', '#2563eb', '#ea580c', '#dc2626', '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#0d9488'];

  function renderTypeChart() {
    var canvas = document.getElementById('statsTypeChart');
    if (!canvas || !window.Chart) return;
    if (typeChart) typeChart.destroy();
    var rows = filteredExerciseTypes();
    typeChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: rows.map(function(r) { return r.type; }),
        datasets: [{
          data: rows.map(function(r) { return r.exerciseCount; }),
          backgroundColor: rows.map(function(r, i) { return palette[i % palette.length]; })
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Heebo', size: 10 } } }
        }
      }
    });
    charts.push(typeChart);
  }

  function bindTabs(groupSel, onChange) {
    document.querySelectorAll(groupSel).forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll(groupSel).forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        onChange(btn.getAttribute('data-mode'));
      });
    });
  }

  bindTabs('[data-stats-compare-mode]', function(mode) { compareMode = mode; });
  bindTabs('[data-stats-trainee-mode]', function(mode) {
    traineeMode = mode;
    renderTraineeTable();
  });
  bindTabs('[data-stats-type-filter]', function(mode) {
    typeFilter = mode;
    renderTraineeTable();
    renderTypeTable();
    renderTypeChart();
  });
  bindTabs('[data-stats-type-sort]', function(mode) {
    typeSort = mode;
    renderTypeTable();
    renderTypeChart();
  });

  var teamSel = document.getElementById('statsTypeTeam');
  if (teamSel) {
    teamSel.innerHTML = '<option value="">צוות...</option>' +
      data.teams.map(function(t) {
        return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>';
      }).join('');
    teamSel.addEventListener('change', function() {
      typeTeam = teamSel.value;
      renderTraineeTable();
      renderTypeTable();
      renderTypeChart();
    });
  }

  loadChartJs(function() {
    renderTeamTable();
    renderTeamChart();
    renderCompareTeamButtons();
    renderCompareChart();
    renderTraineeTable();
    renderTypeTable();
    renderTypeChart();
  });

  window.addEventListener('pagehide', destroyCharts);
})();
`;
}

function _adminStatisticsContent(sid) {
  const payload = Statistics_buildPayload();
  const jsonData = JSON.stringify(payload).replace(/</g, '\\u003c');

  const mpSub = payload.mp.rolePct + '% מכלל השיבוצים';
  const magadSub = payload.magad.otherRoleAssigns + ' שיבוצים בתפקיד אחר';

  let s = '<div id="statisticsPage" class="stats-page">';
  s += '<script id="statisticsData" type="application/json">' + jsonData + '</script>';

  s += _statisticsKpiSection('מדדי מ״פ', 'stats-badge-mp', 'מ"פ', payload.mp, 'מ״פ', mpSub);
  s += _statisticsKpiSection('מדדי מגד', 'stats-badge-magad', 'מגד', payload.magad, 'מגד', magadSub);

  s += '<div class="card stats-card"><div class="card-header stats-card-header">' +
    '<span class="card-title">👥 ממוצע תרגילים לחניך לפי צוות</span></div>' +
    '<div class="card-body stats-chart-body">' +
    '<div class="stats-chart-wrap"><canvas id="statsTeamChart" aria-label="ממוצע תרגילים לפי צוות"></canvas></div>' +
    '<div class="stats-table-wrap"><table class="tbl stats-tbl"><thead><tr>' +
    '<th>צוות</th><th>חניכים</th><th>ממוצע תרגילים</th><th>מקסימום</th><th>מינימום</th>' +
    '</tr></thead><tbody id="statsTeamTableBody"></tbody></table></div></div></div>';

  s += '<div class="card stats-card"><div class="card-header stats-card-header">' +
    '<span class="card-title">📊 השוואה מותאמת אישית</span>' +
    '<div class="stats-seg-tabs">' +
    '<button type="button" class="stats-seg active" data-stats-compare-mode="team">לפי צוות</button>' +
    '<button type="button" class="stats-seg" data-stats-compare-mode="trainee">לפי חניכים</button>' +
    '</div></div><div class="card-body">' +
    '<p class="stats-hint">בחר צוותים להשוואה (ריק = כולם):</p>' +
    '<div id="statsCompareTeams" class="stats-chip-row"></div>' +
    '<div class="stats-chart-wrap stats-chart-wrap-md"><canvas id="statsCompareChart"></canvas></div>' +
  '<p class="stats-chart-caption">השוואת שיבוצים לפי תפקיד</p></div></div>';

  s += '<div class="card stats-card"><div class="card-header stats-card-header">' +
    '<span class="card-title">🏅 תרגילים לפי חניך</span>' +
    '<div class="stats-seg-tabs">' +
    '<button type="button" class="stats-seg active" data-stats-trainee-mode="team">לפי צוות</button>' +
    '<button type="button" class="stats-seg" data-stats-trainee-mode="rank">לפי מדרג</button>' +
    '</div></div><div class="card-body">' +
    '<p class="stats-avg-line">ממוצע: <b>' + payload.avgExercisesPerTrainee + '</b> תרגילים</p>' +
    '<div class="stats-table-wrap"><table class="tbl stats-tbl stats-leaderboard"><thead><tr>' +
    '<th>#</th><th>שם</th><th>מדרג</th><th>צוות</th><th>תרגילים</th>' +
    '</tr></thead><tbody id="statsTraineeTableBody"></tbody></table></div>' +
    '<div class="stats-legend">' +
    '<span><i class="dot above"></i>מעל הממוצע</span>' +
    '<span><i class="dot below"></i>מתחת לממוצע</span>' +
    '<span><i class="dot avg"></i>בממוצע</span></div></div></div>';

  s += '<div class="card stats-card"><div class="card-header stats-card-header">' +
    '<span class="card-title">🥧 פירוט לפי סוג תרגיל</span></div><div class="card-body">' +
    '<div class="stats-filters">' +
    '<span class="stats-filter-label">סינון:</span>' +
    '<div class="stats-seg-tabs stats-seg-sm">' +
    '<button type="button" class="stats-seg active" data-stats-type-filter="all">כל החניכים</button>' +
    '<button type="button" class="stats-seg" data-stats-type-filter="mp">רק מ״פ</button>' +
    '<button type="button" class="stats-seg" data-stats-type-filter="magad">רק מגדים</button>' +
    '</div>' +
    '<select id="statsTypeTeam" class="form-select stats-team-select"></select>' +
    '<span class="stats-filter-label">סדר:</span>' +
    '<div class="stats-seg-tabs stats-seg-sm">' +
    '<button type="button" class="stats-seg active" data-stats-type-sort="busy">עמוס ביותר</button>' +
    '<button type="button" class="stats-seg" data-stats-type-sort="light">פחות עמוס</button>' +
    '</div></div>' +
    '<div class="stats-table-wrap"><table class="tbl stats-tbl"><thead><tr>' +
    '<th>סוג תרגיל</th><th>כמות</th><th>שיבוצי חניכים</th>' +
    '</tr></thead><tbody id="statsTypeTableBody"></tbody></table></div>' +
    '<div class="stats-chart-wrap stats-chart-wrap-pie"><canvas id="statsTypeChart"></canvas></div>' +
    '</div></div>';

  s += '<script>' + _statisticsPageJs() + '</script>';
  s += '</div>';
  return s;
}

function Views_statistics(p) {
  const user = Auth_current(p);
  if (!user) {
    return Views_login({ error: 'נדרשת התחברות.' });
  }
  if (!Roles_isAdmin(user.role)) {
    return Views_error('אין הרשאה לצפות בדף זה.', p);
  }

  const sid = user.id;
  const sidQ = encodeURIComponent(sid);

  let s = _topbar(user, sid);
  s += '<div class="page">' + _flash(p);
  s += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  s += '<h1 class="page-title" style="margin:0">📊 סטטיסטיקות — סגל</h1>';
  s += _a('page=dashboard&sid=' + sidQ, '← לוח בקרה', 'btn btn-ghost btn-sm');
  s += '</div>';
  s += _adminStatisticsContent(sid);
  s += '</div>';

  return _wrapPage(s, 'סטטיסטיקות');
}
