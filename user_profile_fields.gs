// user_profile_fields.gs — שדות פרופיל דינמיים (הגדרה על ידי סגל)

function UserProfileFields_defsAll() {
  return _rows('UserFieldDefs').data.map(function(r) {
    return {
      id: String(r[0]),
      label: String(r[1] || ''),
      field_key: String(r[2] || ''),
      sort_order: parseInt(r[3], 10) || 0
    };
  }).filter(function(d) { return d.label && d.field_key; })
    .sort(function(a, b) {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.label.localeCompare(b.label, 'he');
    });
}

function UserProfileFields_valuesForUser(userId) {
  userId = String(userId || '');
  const map = {};
  _rows('UserFieldValues').data.forEach(function(r) {
    if (String(r[0]) === userId) map[String(r[1])] = String(r[2] == null ? '' : r[2]);
  });
  return map;
}

function UserProfileFields_valuesMerged(userId) {
  const vals = UserProfileFields_valuesForUser(userId);
  return UserProfileFields_defsAll().map(function(d) {
    return {
      id: d.id,
      label: d.label,
      field_key: d.field_key,
      value: vals[d.field_key] || ''
    };
  });
}

function UserProfileFields_makeKey(label, existingKeys) {
  let base = String(label || '').trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u0590-\u05FF-]/g, '')
    .slice(0, 28);
  if (!base) base = 'f' + Date.now().toString(36);
  let key = base;
  let n = 2;
  while (existingKeys[key]) {
    key = base + '_' + n;
    n++;
  }
  return key;
}

function UserProfileFields_existingKeys() {
  const keys = {};
  UserProfileFields_defsAll().forEach(function(d) { keys[d.field_key] = true; });
  return keys;
}

function _userFieldValueUpsert(userId, fieldKey, value) {
  userId = String(userId || '');
  fieldKey = String(fieldKey || '');
  value = String(value == null ? '' : value).trim();
  const sh = _sheet('UserFieldValues');
  const { data } = _rows('UserFieldValues');
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === userId && String(data[i][1]) === fieldKey) {
      if (!value) {
        sh.deleteRow(i + 2);
      } else {
        sh.getRange(i + 2, 3).setValue(value);
      }
      _cacheInvalidate('UserFieldValues');
      return;
    }
  }
  if (value) _append('UserFieldValues', [userId, fieldKey, value]);
}

function UserProfileFields_saveForUser(userId, p) {
  userId = String(userId || '').trim();
  if (!userId) return;
  UserProfileFields_defsAll().forEach(function(d) {
    const paramKey = 'uf_' + d.field_key;
    if (!Object.prototype.hasOwnProperty.call(p, paramKey)) return;
    _userFieldValueUpsert(userId, d.field_key, p[paramKey]);
  });
}

function UserProfileFields_createDef(p) {
  Auth_requireRole(p, ['admin']);
  const label = String(p.field_label || p.label || '').trim();
  if (!label) throw new Error('חובה להזין שם לשדה.');
  const existing = UserProfileFields_existingKeys();
  let key = String(p.field_key || '').trim();
  if (key) {
    if (!/^[a-zA-Z0-9_\u0590-\u05FF-]{1,32}$/.test(key)) {
      throw new Error('מזהה שדה לא תקין — אותיות, מספרים, קו תחתון בלבד.');
    }
    if (existing[key]) throw new Error('שדה עם מזהה «' + key + '» כבר קיים.');
  } else {
    key = UserProfileFields_makeKey(label, existing);
  }
  const sortOrder = parseInt(p.sort_order, 10);
  const order = isNaN(sortOrder) ? UserProfileFields_defsAll().length : sortOrder;
  _append('UserFieldDefs', ['UF' + Date.now(), label, key, order]);
  return Views_users({
    sid: p.sid,
    tab: 'users',
    open: 'fieldDefs',
    info: 'שדה «' + label + '» נוסף.'
  });
}

function UserProfileFields_deleteDef(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.fieldId || p.id || '').trim();
  if (!id) throw new Error('חסר מזהה שדה.');
  const row = _findRowIndex('UserFieldDefs', id);
  if (row < 0) throw new Error('השדה לא נמצא.');
  const fieldKey = String(_sheet('UserFieldDefs').getRange(row, 3).getValue() || '');
  _sheet('UserFieldDefs').deleteRow(row);
  _cacheInvalidate('UserFieldDefs');

  const valSh = _sheet('UserFieldValues');
  const valRows = _rows('UserFieldValues').data;
  for (let i = valRows.length - 1; i >= 0; i--) {
    if (String(valRows[i][1]) === fieldKey) valSh.deleteRow(i + 2);
  }
  _cacheInvalidate('UserFieldValues');

  return Views_users({
    sid: p.sid,
    tab: 'users',
    open: 'fieldDefs',
    info: 'השדה נמחק.'
  });
}

function _customProfileFieldsFormHtml(target) {
  const fields = UserProfileFields_valuesMerged(target.id);
  if (!fields.length) return '';
  let s = '<div class="custom-profile-fields" style="margin-top:8px;padding-top:12px;border-top:1px dashed var(--border)">' +
    '<div class="form-label" style="margin-bottom:10px">שדות נוספים</div><div class="form-grid">';
  fields.forEach(function(f) {
    s += '<div class="form-row"><label class="form-label">' + _esc(f.label) + '</label>' +
      _input('uf_' + f.field_key, '', f.value) + '</div>';
  });
  s += '</div></div>';
  return s;
}

function _customProfileFieldsDisplayRows(userId) {
  const fields = UserProfileFields_valuesMerged(userId);
  let s = '';
  fields.forEach(function(f) {
    s += '<tr><td style="color:var(--muted);font-family:var(--mono);font-size:12px">' + _esc(f.label) + '</td>' +
      '<td>' + (f.value ? _esc(f.value) : '<span style="color:var(--muted)">—</span>') + '</td></tr>';
  });
  return s;
}

function _userFieldDefsAdminHtml(sid) {
  sid = String(sid || '');
  const defs = UserProfileFields_defsAll();
  let list = '';
  if (!defs.length) {
    list = '<p style="font-size:12px;color:var(--muted);margin:0">אין שדות מותאמים — הוסף שדה למטה.</p>';
  } else {
    list = '<table class="tbl" style="font-size:12px;margin:0 0 14px"><thead><tr>' +
      '<th>שם שדה</th><th>מזהה</th><th style="text-align:left">פעולות</th></tr></thead><tbody>';
    defs.forEach(function(d) {
      list += '<tr><td><b>' + _esc(d.label) + '</b></td>' +
        '<td class="mono" style="font-size:11px">' + _esc(d.field_key) + '</td>' +
        '<td style="text-align:left">' +
        _confirmDelete(
          'action=deleteUserFieldDef&fieldId=' + encodeURIComponent(d.id) + '&sid=' + encodeURIComponent(sid),
          'למחוק את השדה «' + d.label + '»? הערכים שנשמרו למשתמשים יימחקו.'
        ) + '</td></tr>';
    });
    list += '</tbody></table>';
  }

  return '<div style="font-size:12px;line-height:1.6">' +
    '<p class="rules-muted" style="margin:0 0 12px">' +
    'הגדר כאן שדות נוספים שיופיעו בפרופיל כל משתמש (עריכה על ידי סגל בלבד).</p>' +
    list +
    _formOpen() +
    '<input type="hidden" name="action" value="createUserFieldDef">' +
    '<input type="hidden" name="sid" value="' + _esc(sid) + '">' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="form-label">שם השדה (תווית)</label>' +
    '<input type="text" name="field_label" class="form-input" placeholder="לדוגמה: כיתה / מחלקה" required></div>' +
    '<div class="form-row"><label class="form-label">מזהה (אופציונלי)</label>' +
    '<input type="text" name="field_key" class="form-input" placeholder="אוטומטי אם ריק"></div>' +
    '</div>' +
    _submitBtn('הוסף שדה', 'btn btn-primary btn-sm') +
    '</form></div>';
}
