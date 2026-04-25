// ═══════════════════════════════════════
//  attendance.gs — מי מגיע לבסיס
// ═══════════════════════════════════════

function getAttendance(groupName, dateLabel) {
  const spreadsheetId = GROUPS[groupName];
  if (!spreadsheetId) throw new Error('קבוצה לא נמצאה');

  const ss    = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(REPORT_SHEET);
  if (!sheet) throw new Error('גיליון דוח 1 לא נמצא');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const data    = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const header  = data[0];

  // מצא את עמודת התאריך המבוקש
  const colIndex = header.findIndex(c => c.trim() === dateLabel);
  if (colIndex === -1) return { success: false, error: 'תאריך לא נמצא בדוח 1: ' + dateLabel };

  // מצא את עמודת היום הקודם (colIndex - 1), מדלג על עמודות ריקות
  let prevColIndex = -1;
  for (let c = colIndex - 1; c >= 0; c--) {
    if ((header[c] || '').trim() !== '') { prevColIndex = c; break; }
  }

  // שלוף שמות מהעמודה הנוכחית (בבסיס)
  const inBase = [];
  for (let i = 2; i < data.length; i++) {
    const val = (data[i][colIndex] || '').trim();
    if (val !== '') inBase.push(val);
  }

  // שלוף שמות מהעמודה הקודמת (היו בבית יום לפני)
  const prevInBase = [];
  if (prevColIndex !== -1) {
    for (let i = 2; i < data.length; i++) {
      const val = (data[i][prevColIndex] || '').trim();
      if (val !== '') prevInBase.push(val);
    }
  }

  // מי היה בבית יום לפני = מי מופיע בעמודה הנוכחית אבל לא בקודמת
  const comingFromHome = inBase.filter(name => prevInBase.indexOf(name) === -1);

  return {
    success:         true,
    dateLabel:       dateLabel,
    prevLabel:       prevColIndex !== -1 ? (header[prevColIndex] || '').trim() : '',
    inBase:          inBase,
    comingFromHome:  comingFromHome
  };
}