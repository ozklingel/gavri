// field_forces.gs — כוחות בשטח CRUD

function FieldForces_qtyUnitOptions() {
  return [
    ['', '— ללא —'],
    ['פלוגה', 'פלוגות'],
    ['מחלקה', 'מחלקות'],
    ['גדוד', 'גדודים'],
    ['כיתה', 'כיתות'],
    ['יחידה', 'יחידות'],
    ['מרכז', 'מרכזים']
  ];
}

function FieldForces_qtyUnitPlural_(singular) {
  const map = {
    'פלוגה': 'פלוגות',
    'מחלקה': 'מחלקות',
    'גדוד': 'גדודים',
    'כיתה': 'כיתות',
    'יחידה': 'יחידות',
    'מרכז': 'מרכזים'
  };
  return map[String(singular || '').trim()] || String(singular || '').trim();
}

/** טקסט תצוגה: «2 פלוגות», «מחלקה אחת» */
function FieldForces_quantityText(f) {
  if (!f) return '';
  const unit = String(f.force_qty_unit || '').trim();
  if (!unit) return '';
  let n = parseInt(f.force_qty, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n === 1) return unit + ' אחת';
  return n + ' ' + FieldForces_qtyUnitPlural_(unit);
}

function FieldForces_parseQuantity_(p) {
  const unit = String(p.force_qty_unit || '').trim();
  if (!unit) return { force_qty: '', force_qty_unit: '' };
  let n = parseInt(p.force_qty, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 99) throw new Error('כמות הכוחות חייבת להיות בין 1 ל-99.');
  const allowed = FieldForces_qtyUnitOptions().map(function(o) { return o[0]; }).filter(Boolean);
  if (allowed.indexOf(unit) === -1) throw new Error('יחידת כמות לא חוקית.');
  return { force_qty: String(n), force_qty_unit: unit };
}

function FieldForces_all() {
  return _rows('FieldForces').data.map(function(r) {
    return {
      id:             String(r[0]),
      role:           String(r[1] || ''),
      commander_name: String(r[2] || ''),
      camp_location:  String(r[3] || ''),
      force_type:     String(r[4] || ''),
      force_name:     String(r[5] || ''),
      force_qty:      r[6] == null ? '' : String(r[6]),
      force_qty_unit: r[7] == null ? '' : String(r[7])
    };
  });
}

function FieldForces_get(id) {
  return FieldForces_all().find(function(x) { return x.id === String(id); }) || null;
}

/** שם הכוח — לבחירה בתרגיל כגדוד שת״פ */
function FieldForces_displayLabel(f) {
  if (!f) return '';
  const name = String(f.force_name || '').trim();
  const qty = FieldForces_quantityText(f);
  if (qty) return name ? (name + ' · ' + qty) : qty;
  return name;
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
    opts.push([f.id, label + (ft && label.indexOf(ft) === -1 ? ' · ' + ft : '')]);
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

  const qty = FieldForces_parseQuantity_(p);
  const id = 'FF' + new Date().getTime();
  _append('FieldForces', [id, role, commanderName, campLocation, forceType, forceName, qty.force_qty, qty.force_qty_unit]);
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

  const qty = FieldForces_parseQuantity_(p);
  _sheet('FieldForces').getRange(row, 2, 1, 7).setValues([[
    role, commanderName, campLocation, forceType, forceName, qty.force_qty, qty.force_qty_unit
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
