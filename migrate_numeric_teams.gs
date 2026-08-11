// migrate_numeric_teams.gs — מיזוג צוותים «1»…«10» ל«צוות N» + מחיקת צוותים ריקים
//
// הרצה מעורך Apps Script:
//   migrateNumericTeamsPreview()  — תצוגה מקדימה (לוג)
//   migrateNumericTeamsOnce()     — ביצוע
//   migrateNumericTeamsOnce(true) — dry-run

function migrateNumericTeamsPreview() {
  return migrateNumericTeamsOnce(true);
}

/**
 * @param {boolean} dryRun
 */
function migrateNumericTeamsOnce(dryRun) {
  dryRun = !!dryRun;
  const plan = { merges: [], renames: [], skipped: [], deleted: [] };

  for (let n = 1; n <= 10; n++) {
    const target = Teams_findPreferredByNumber_(n);
    const sources = Teams_allRows_().filter(function(t) {
      return Teams_isNumericOnlyName_(t.name) && parseInt(t.name, 10) === n;
    });

    if (!sources.length) {
      plan.skipped.push({ n: n, reason: 'אין צוות מספרי «' + n + '»' });
      continue;
    }

    if (!target) {
      sources.forEach(function(src) {
        plan.renames.push({
          n: n,
          id: src.id,
          fromName: src.name,
          toName: 'צוות ' + n,
          members: Teams_memberCount_(src.id)
        });
      });
      continue;
    }

    sources.forEach(function(src) {
      if (src.id === target.id) return;
      plan.merges.push({
        n: n,
        fromId: src.id,
        fromName: src.name,
        toId: target.id,
        toName: target.name,
        members: Teams_memberCount_(src.id)
      });
    });
  }

  const emptyBefore = Teams_allRows_().filter(function(t) {
    return Teams_isEmpty_(t);
  });
  emptyBefore.forEach(function(t) {
    plan.deleted.push({ id: t.id, name: t.name, note: 'ריק כעת' });
  });

  Logger.log('=== migrate numeric teams ===');
  Logger.log('מיזוגים: ' + plan.merges.length + ' | שינוי שם: ' + plan.renames.length + ' | מחיקות: ' + plan.deleted.length);
  plan.merges.forEach(function(m) {
    Logger.log('  ⇢ «' + m.fromName + '» (' + m.fromId + ') → «' + m.toName + '» (' + m.toId + ') · ' + m.members + ' חברים');
  });
  plan.renames.forEach(function(r) {
    Logger.log('  ✎ «' + r.fromName + '» (' + r.id + ') → «' + r.toName + '» · ' + r.members + ' חברים');
  });
  plan.deleted.forEach(function(d) {
    Logger.log('  ✕ ריק: «' + d.name + '» (' + d.id + ')' + (d.note ? ' — ' + d.note : ''));
  });
  plan.skipped.forEach(function(s) {
    Logger.log('  ⊘ ' + s.n + ': ' + s.reason);
  });

  if (dryRun) {
    Logger.log('(dry-run — לא נכתב לגיליונות)');
    return { ok: true, dryRun: true, plan: plan };
  }

  _cacheBeginBatch();
  let merged = 0;
  let renamed = 0;
  let movedTotal = 0;
  try {
    plan.merges.forEach(function(m) {
      const r = Teams_merge_(m.fromId, m.toId, null,
        'מיזוג «' + m.fromName + '» → «' + m.toName + '»');
      merged++;
      movedTotal += (r && r.moved) || 0;
    });

    plan.renames.forEach(function(rn) {
      const row = _findRowIndex('Teams', rn.id);
      if (row < 0) return;
      _sheet('Teams').getRange(row, 2).setValue(rn.toName);
      renamed++;
    });
    if (renamed) _cacheInvalidate('Teams');

    const emptyAfter = Teams_allRows_().filter(function(t) { return Teams_isEmpty_(t); });
    const deleted = Teams_deleteEmptyCore_(emptyAfter.map(function(t) { return t.id; }));

    SpreadsheetApp.flush();
    _cacheInvalidate('Teams');
    _cacheInvalidate('Users');

    const summary = 'מוזגו ' + merged + ' צוותים (' + movedTotal + ' חברים), שונה שם ל-' + renamed +
      ' צוותים, נמחקו ' + deleted + ' צוותים ריקים.';
    Logger.log(summary);
    return { ok: true, info: summary, merged: merged, renamed: renamed, moved: movedTotal, deleted: deleted, plan: plan };
  } finally {
    _cacheEndBatch();
  }
}
