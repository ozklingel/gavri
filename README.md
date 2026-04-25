# Military Training — Apps Script Web App (v4, index.html shell)

## What changed

This version follows the same Apps Script pattern as the referenced `juhaHR` project:

- Adds a real `index.html` file.
- `Code.gs` only routes requests.
- `views.gs` builds server-side HTML partials and injects them into `index.html` using `HtmlService.createTemplateFromFile('index')`.
- Forms submit to the deployed web-app URL with `target="_top"`.
- No CSS and no JavaScript are used.

This removes the previous fragile redirect mechanism that can cause a white screen in Apps Script web-app iframes.

## Files

- `Code.gs` — entry point, router, sheet helpers, setup
- `index.html` — single HtmlService shell template
- `auth.gs` — login / logout / session lookup
- `users.gs` — users & roles
- `exercises.gs` — CRUD + duplication
- `assignments.gs` — assign + mark completed
- `views.gs` — pure server-rendered HTML partials

## Spreadsheet sheets

Run `setupSheets()` once from the Apps Script editor. It creates:

| Sheet | Columns |
|---|---|
| Users | id, name, role, team_id |
| Credentials | user_id, password |
| Teams | id, name, commander_id |
| Exercises | id, title, description, created_by, date |
| ExerciseDetails | id, exercise_id, time, location, description |
| Assignments | id, exercise_id, user_id, status, score |

Demo accounts, if seeded:

- `U001 / admin123` — admin
- `U002 / cmd123` — commander
- `U003 / train123` — trainee

## Deployment steps

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Create these script files and paste the matching contents:
   - `Code.gs`
   - `auth.gs`
   - `users.gs`
   - `exercises.gs`
   - `assignments.gs`
   - `views.gs`
4. Create an HTML file named exactly `index` and paste `index.html` into it.
5. Run `setupSheets()` once if the sheets do not already exist.
6. Deploy as a web app:
   - Execute as: **Me**
   - Who has access: **Anyone** or your organization
7. After replacing files, deploy a **new version**:
   - **Deploy → Manage deployments → Edit → Version → New version → Deploy**
8. Open the `/exec` web-app URL and log in with `U001 / admin123`.

## Important

If you already created the sheets, you do not need to recreate them. Just replace the script files, add the `index` HTML file, and deploy a new version.
