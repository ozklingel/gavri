function getUsers(groupName) {
  const spreadsheetId = GROUPS[groupName];
  if (!spreadsheetId) throw new Error('קבוצה לא נמצאה');

  const ss    = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName("סבב נוכחי");
  if (!sheet) throw new Error('גיליון סבב נוכחי לא נמצא');

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return [];

  const data = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  // מצא את תחילת השמות (שורה שמכילה טקסט בעברית ולא תאריך/מספר)
  const users = data
    .map(row => (row[0] || '').toString().trim())
    .filter(val => {
      if (!val) return false;

      // מסנן תאריכים
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(val)) return false;

      // מסנן כותרות/מערכת
      if (val.includes('סהכ') || val.includes('מספר') || val.includes('בקשה')) return false;

      // משאיר רק טקסט (שמות)
      return /[א-ת]/.test(val);
    });

  return users.sort();
}