const SHEET_ID = "1JxurxC9nEhRQVW3kGIGMwnALCjOZYcJQv3lovbvFvGA";
const SHEET_NAME = "Credentials";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index");
}

// 🔐 LOGIN FUNCTION
function login(userId, password) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  const data = sheet.getDataRange().getValues();

  // skip header row
  for (let i = 1; i < data.length; i++) {
    const rowUser = data[i][0];
    const rowPass = data[i][1];

    if (rowUser === userId && rowPass === password) {
      return {
        success: true,
        user: userId
      };
    }
  }

  return {
    success: false,
    message: "Invalid username or password"
  };
}

// 📊 OPTIONAL: Get full user table (admin/debug use)
function getData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  return sheet.getDataRange().getValues();
}