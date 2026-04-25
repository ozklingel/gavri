// ═══════════════════════════════════════
//  chat.gs — שליפת נתונים לצ'אט AI
// ═══════════════════════════════════════

function getSheetDataForChat(groupName) {
  const spreadsheetId = GROUPS[groupName];
  if (!spreadsheetId) throw new Error('קבוצה לא נמצאה');

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheetNames = ['סבב נוכחי', 'פרטים אישיים', 'דוח 1'];
  const result = {};

  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return;

    // מגביל ל-100 שורות ו-50 עמודות כדי לא לעבור מגבלות
    const rows = Math.min(lastRow, 100);
    const cols = Math.min(lastCol, 50);

    const data = sheet.getRange(1, 1, rows, cols).getDisplayValues();
    result[name] = data;
  });

  return result;
}

function getChatSystemPrompt() {
  return getSystemPrompt();
}

function callClaude(fullPrompt, chatHistory) {
  const key = PropertiesService.getScriptProperties().getProperty("anthropy_key");

  const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: fullPrompt,
      messages: chatHistory
    })
  });

  return JSON.parse(response.getContentText());
}