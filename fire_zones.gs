// fire_zones.gs — שטחי אש CRUD

function FireZones_all() {
  return _rows('FireZones').data.map(function(r) {
    return {
      id:            String(r[0]),
      name:          String(r[1] || ''),
      advancement:   _parseBool(r[2]),
      attack:        _parseBool(r[3]),
      defense:       _parseBool(r[4]),
      dry_wet_day:   _parseBool(r[5]),
      dry_wet_night: _parseBool(r[6])
    };
  });
}

function FireZones_get(id) {
  return FireZones_all().find(function(x) { return x.id === String(id); }) || null;
}

function _fireZoneFromParams(p) {
  return {
    name:          String(p.name || '').trim(),
    advancement:   _boolToSheet(p.advancement),
    attack:        _boolToSheet(p.attack),
    defense:       _boolToSheet(p.defense),
    dry_wet_day:   _boolToSheet(p.dry_wet_day),
    dry_wet_night: _boolToSheet(p.dry_wet_night)
  };
}

function FireZones_create(p) {
  Auth_requireRole(p, ['admin']);
  const z = _fireZoneFromParams(p);
  if (!z.name) throw new Error('חובה להזין שם שטח אש.');

  const id = 'FZ' + new Date().getTime();
  _append('FireZones', [
    id, z.name, z.advancement, z.attack, z.defense, z.dry_wet_day, z.dry_wet_night
  ]);
  return Views_fireZones({ sid: p.sid, info: 'שטח אש נוצר (' + id + ').' });
}

function FireZones_update(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('חסר מזהה.');

  const row = _findRowIndex('FireZones', id);
  if (row < 0) throw new Error('הרשומה לא נמצאה.');

  const z = _fireZoneFromParams(p);
  if (!z.name) throw new Error('חובה להזין שם שטח אש.');

  _sheet('FireZones').getRange(row, 2, 1, 6).setValues([[
    z.name, z.advancement, z.attack, z.defense, z.dry_wet_day, z.dry_wet_night
  ]]);
  _cacheInvalidate('FireZones');
  return Views_fireZone({ sid: p.sid, id: id, info: 'הרשומה עודכנה.' });
}

function FireZones_delete(p) {
  Auth_requireRole(p, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('חסר מזהה.');

  const row = _findRowIndex('FireZones', id);
  if (row < 0) throw new Error('הרשומה לא נמצאה.');

  _sheet('FireZones').deleteRow(row);
  _cacheInvalidate('FireZones');
  return Views_fireZones({ sid: p.sid, info: 'הרשומה נמחקה.' });
}
