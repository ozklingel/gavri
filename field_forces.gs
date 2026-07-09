// field_forces.gs — כוחות בשטח CRUD

function FieldForces_all() {
  return _rows('FieldForces').data.map(function(r) {
    return {
      id:             String(r[0]),
      role:           String(r[1] || ''),
      commander_name: String(r[2] || ''),
      camp_location:  String(r[3] || ''),
      force_type:     String(r[4] || ''),
      force_name:     String(r[5] || '')
    };
  });
}

function FieldForces_get(id) {
  return FieldForces_all().find(function(x) { return x.id === String(id); }) || null;
}

/** שם הכוח — לבחירה בתרגיל כגדוד שת״פ */
function FieldForces_displayLabel(f) {
  if (!f) return '';
  return String(f.force_name || '').trim();
}

function FieldForces_displayLabels() {
  return FieldForces_all().map(FieldForces_displayLabel).filter(Boolean);
}

/** גדוד = תפקיד «גדוד» או שם כוח שמכיל «גדוד». */
function FieldForces_isBattalion(f) {
  if (!f) return false;
  const role = String(f.role || '').trim();
  const name = String(f.force_name || '').trim();
  return role === 'גדוד' || role.indexOf('גדוד') !== -1 ||
    name.indexOf('גדוד') !== -1;
}

function FieldForces_battalions() {
  return FieldForces_all().filter(FieldForces_isBattalion);
}

/** אפשרויות לבחירת גדוד בבניית סדרה — [id, label]. */
function FieldForces_battalionSelectOptions() {
  const items = FieldForces_battalions().slice().sort(function(a, b) {
    return FieldForces_displayLabel(a).localeCompare(FieldForces_displayLabel(b), 'he');
  });
  const opts = [['', '— בחר גדוד —']];
  items.forEach(function(f) {
    const label = FieldForces_displayLabel(f);
    const ft = String(f.force_type || '').trim();
    opts.push([f.id, label + (ft ? ' · ' + ft : '')]);
  });
  return opts;
}

function FieldForces_create(p) {
  Auth_requireRole(p, ['admin']);
  const role          = String(p.role || '').trim();
  const commanderName = String(p.commander_name || '').trim();
  const campLocation  = String(p.camp_location || '').trim();
  const forceType     = String(p.force_type || '').trim();
  const forceName     = String(p.force_name || '').trim();

  if (!role)          throw new Error('חובה להזין תפקיד.');
  if (!commanderName) throw new Error('חובה להזין שם מפקד.');
  if (!campLocation)  throw new Error('חובה להזין מקום מחנה.');
  if (!forceType)     throw new Error('חובה להזין סוג כוח.');
  if (!forceName)     throw new Error('חובה להזין שם הכוח.');

  const id = 'FF' + new Date().getTime();
  _append('FieldForces', [id, role, commanderName, campLocation, forceType, forceName]);
  return Views_fieldForces({ sid: p.sid, info: 'כוח בשטח נוצר (' + id + ').' });
}

function FieldForces_update(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('חסר מזהה.');

  const row = _findRowIndex('FieldForces', id);
  if (row < 0) throw new Error('הרשומה לא נמצאה.');

  const role          = String(p.role || '').trim();
  const commanderName = String(p.commander_name || '').trim();
  const campLocation  = String(p.camp_location || '').trim();
  const forceType     = String(p.force_type || '').trim();
  const forceName     = String(p.force_name || '').trim();

  if (!role || !commanderName || !campLocation || !forceType || !forceName) {
    throw new Error('כל השדות חובה.');
  }

  _sheet('FieldForces').getRange(row, 2, 1, 5).setValues([[
    role, commanderName, campLocation, forceType, forceName
  ]]);
  _cacheInvalidate('FieldForces');
  return Views_fieldForce({ sid: p.sid, id: id, info: 'הרשומה עודכנה.' });
}

function FieldForces_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('חסר מזהה.');

  const row = _findRowIndex('FieldForces', id);
  if (row < 0) throw new Error('הרשומה לא נמצאה.');

  _sheet('FieldForces').deleteRow(row);
  _cacheInvalidate('FieldForces');
  return Views_fieldForces({ sid: p.sid, info: 'הרשומה נמחקה.' });
}
