// ═══════════════════════════════════════
//  requests.gs — הגשת בקשות יציאה
// ═══════════════════════════════════════

function submitLeaveRequest(groupName, soldierName, startDate, endDate, reason) {
  const spreadsheetId = GROUPS[groupName];
  if (!spreadsheetId) throw new Error('קבוצה לא נמצאה');

  const ss    = SpreadsheetApp.openById(spreadsheetId);
  let sheet   = ss.getSheetByName('בקשות יציאה');

  // אם הגיליון לא קיים — צור אותו עם כותרות
  if (!sheet) {
    sheet = ss.insertSheet('בקשות יציאה');
    sheet.appendRow(['חותמת זמן', 'שם החייל', 'תאריך התחלה', 'תאריך סיום', 'סיבת הבקשה']);
  }

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  sheet.appendRow([timestamp, soldierName, startDate, endDate, reason]);

  return { success: true };
}