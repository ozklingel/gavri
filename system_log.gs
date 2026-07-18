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
