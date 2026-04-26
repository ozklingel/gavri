# ★ צה״ל — מערכת ניהול תרגילי אימון (גרסה 9)

מערכת ניהול תרגילי אימון צבאית, בנויה כ-Google Apps Script Web App עם Google Sheets כמסד נתונים.

## ✨ חדש בגרסה 9
- 🟢 **עיצוב צבאי-ירוק** בסגנון צה״ל (ירוק זית, פונט מונוספייס)
- 🇮🇱 **עברית מלאה** + RTL
- ★ סמל צה״ל בכותרת
- כל ההודעות, התפקידים, והסטטוסים מתורגמים

## תפקידים
- **מפקד קורס** (admin) — ניהול מלא
- **מפקד צוות** (commander) — ניהול צוות בלבד
- **חניך** (trainee) — צפייה בתרגילים שהוקצו

## משתמשי דמו
| מספר אישי | סיסמה | תפקיד |
|---|---|---|
| U001 | admin123 | מפקד קורס |
| U002 | cmd123 | מפקד צוות |
| U003 | train123 | חניך |

## התקנה
1. פתח את גיליון ה-Google Sheets שלך → **הרחבות → Apps Script**
2. החלף את כל הקבצים בקבצים מ-zip זה (כולל `index.html`)
3. הרץ פעם אחת `setupSheets()` או `resetTrainingTables()` (לאיפוס מלא)
4. **פריסה → ניהול פריסות → ערוך (עיפרון) → גרסה: גרסה חדשה**
5. גש ל-Web App URL והתחבר

## מבנה גיליונות
- **Users**: id, name, role, team_id
- **Credentials**: user_id, password
- **Teams**: id, name, commander_id
- **Exercises**: id, title, description, created_by, date
- **ExerciseDetails**: id, exercise_id, time, location, description
- **Assignments**: id, exercise_id, user_id, status, score, **responsibility**

## ארכיטקטורה
- כל פעולה דרך GET (כדי לעקוף את מגבלות iframe של Apps Script)
- תבנית מרכזית: `index.html` עם `<base target="_top">` להבטחת ניווט בחלון העליון
- כל הקישורים מוחלטים דרך `ScriptApp.getService().getUrl()`
- ללא JavaScript בצד לקוח — הכל server-rendered
