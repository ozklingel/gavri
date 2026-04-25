// ═══════════════════════════════════════
//  config.gs — הגדרות קבוצות וספרדשיטים
//  להוסיף קבוצה: שורה אחת בלבד כאן ↓
// ═══════════════════════════════════════

const GROUPS = {
  'פלוגה ב':      '1VUSeNNeN5TTgHGku4V1l0-jEuGz0qLNY_Zgb0pO8wic',
  'פלוגת לויתן': '1Izay9yr3uvk3lNIcZMhFlQ8LdDAO-FU6CE-kxoKnJR0', // החלף ב-ID האמיתי
};


const SHEET_NAME = 'סבב נוכחי'; // שם הגיליון — זהה בכל הקבוצות

function getGroups() {
  return Object.keys(GROUPS);
}