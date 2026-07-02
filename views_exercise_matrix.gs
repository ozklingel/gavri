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
        'מסח (מרהש - מלי)',
        'קלח (ארזים)',
        'ע קלח (השלמה חיילית לוגיסטיקה)',
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

function _exerciseMatrixClassifyRole(resp) {
  const r = String(resp || '').trim();
  if (!r) return '';
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

  exList.forEach(function(ex, idx) {
    exIds.push(ex.id);
    const meta = _teamMatrixExerciseMeta(ex);
    meta.location = _exerciseMatrixLocation(ex);
    meta.label = 'תרגיל ' + (idx + 1);
    exMeta[ex.id] = meta;
    exercises.push({ id: ex.id, label: meta.label });
  });

  const cells = {};
  const roleSet = {};
  const extraRoles = { brigade: {}, battalion: {}, company: {} };

  Assignments_all().forEach(function(a) {
    const resp = String(a.responsibility || '').trim();
    if (!resp || exIds.indexOf(a.exercise_id) === -1) return;

    const u = Users_get(a.user_id);
    const key = a.exercise_id + '\x1f' + resp;
    cells[key] = {
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
  const user = Auth_current(p);
  if (!user) return Views_login({ error: 'נדרשת התחברות.' });

  const sid = user.id;
  const payload = _exerciseMatrixBuildPayload();
  const jsonData = JSON.stringify(payload).replace(/</g, '\\u003c');

  const body = _topbar(user, sid) +
    '<div class="page ex-matrix-page">' + _flash(p) +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div class="page-title" style="margin:0" id="exMatrixPageTitle">🎯 טבלת שליטה לפי תרגיל</div>' +
    _a('page=dashboard', '← לוח בקרה', 'btn btn-ghost btn-sm') +
    '</div>' +

    '<script id="exerciseMatrixData" type="application/json">' + jsonData + '</script>' +

    '<div class="card" style="margin-bottom:14px"><div class="card-body" style="padding:12px 16px">' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">' +
    '<div id="exMatrixRoleFilters" class="team-matrix-tabs"></div>' +
    '<div style="margin-right:auto;display:flex;gap:6px">' +
    '<button type="button" id="exMatrixExportCsv" class="btn btn-secondary btn-sm">Excel</button>' +
    '</div></div>' +
    '<div class="form-label" style="margin-bottom:8px">בחר תרגילים:</div>' +
    '<div id="exMatrixWeekTabs" class="team-matrix-tabs"></div>' +
    '</div></div>' +

    '<div id="exMatrixAccordions"></div>' +
    '<script>' + _exerciseMatrixJs() + '</script>' +
    '</div>';

  return _wrapPage(body, 'טבלת שליטה לפי תרגיל');
}

function _exerciseMatrixJs() {
  return `
(function() {
  var data = JSON.parse(document.getElementById('exerciseMatrixData').textContent);
  var roleFilter = 'all';
  var weekFilter = 'all';
  var openTiers = { brigade: false, battalion: false, company: true };

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

  function updateTitle() {
    var exs = getExercises();
    var roles = 0;
    ['brigade', 'battalion', 'company'].forEach(function(tk) {
      roles += tierRoles(tk).length;
    });
    document.getElementById('exMatrixPageTitle').textContent =
      'טבלת שליטה לפי תרגיל — ' + data.totalRoles + ' תפקידים, ' + exs.length + ' תרגילים';
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
        '" data-week="' + w + '">שבוע ' + w + ' <span style="opacity:.7">(' + count + ')</span></button>';
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
    exs.forEach(function(ex, idx) {
      var m = data.exMeta[ex.id] || {};
      head += '<th class="team-matrix-col-hdr ex-matrix-col"><div class="team-matrix-ex-title">' +
        esc(m.label || ex.label || ('תרגיל ' + (idx + 1))) + '</div>';
      if (m.week) head += '<div class="team-matrix-ex-sub">שבוע ' + m.week + '</div>';
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
        var c = cellData(ex.id, role);
        body += '<td class="ex-matrix-assign-cell' + (c ? ' filled' : '') + '">';
        if (c) {
          body += '<div class="ex-matrix-person"><div class="ex-matrix-person-name">' + esc(c.name) + '</div>';
          if (c.phone) body += '<div class="ex-matrix-person-phone">' + esc(c.phone) + '</div>';
          body += '</div>';
        } else {
          body += '<span style="color:var(--muted)">—</span>';
        }
        body += '</td>';
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
      rows[0].push((m.label || ex.id) + ' (שבוע ' + (m.week || '') + ')');
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
  render();
})();
`;
}
