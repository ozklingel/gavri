// system_log.gs — persistent audit log for system actions

function SystemLog_write(entry) {
  entry = entry || {};
  const id = 'L' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  _append('SystemLog', [
    id,
    new Date().toISOString(),
    String(entry.user_id || ''),
    String(entry.action || ''),
    String(entry.entity_type || ''),
    String(entry.entity_id || ''),
    JSON.stringify(entry.details || {})
  ]);
}

function SystemLog_all(limit) {
  limit = limit == null ? 500 : parseInt(limit, 10);
  if (isNaN(limit) || limit < 1) limit = 500;
  const rows = _rows('SystemLog').data;
  const out = [];
  for (let i = rows.length - 1; i >= 0 && out.length < limit; i--) {
    const r = rows[i];
    let details = {};
    try { details = JSON.parse(String(r[6] || '{}')); } catch (e1) { details = {}; }
    out.push({
      id: String(r[0]),
      timestamp: String(r[1] || ''),
      user_id: String(r[2] || ''),
      action: String(r[3] || ''),
      entity_type: String(r[4] || ''),
      entity_id: String(r[5] || ''),
      details: details
    });
  }
  return out;
}

function SystemLog_get(id) {
  id = String(id || '').trim();
  if (!id) return null;
  const rows = _rows('SystemLog').data;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    let details = {};
    try { details = JSON.parse(String(rows[i][6] || '{}')); } catch (e1) { details = {}; }
    return {
      id: String(rows[i][0]),
      timestamp: String(rows[i][1] || ''),
      user_id: String(rows[i][2] || ''),
      action: String(rows[i][3] || ''),
      entity_type: String(rows[i][4] || ''),
      entity_id: String(rows[i][5] || ''),
      details: details,
      _row: i + 2
    };
  }
  return null;
}

function SystemLog_updateDetails(id, details) {
  const row = SystemLog_get(id);
  if (!row || !row._row) return false;
  const json = JSON.stringify(details || {});
  _sheet('SystemLog').getRange(row._row, 7).setValue(json);
  _cachePatchRow('SystemLog', row._row, { 7: json });
  return true;
}
