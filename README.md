# Military Training — Apps Script Web App (v8, absolute links fix)

## Why this version

This v8 fixes the remaining white-screen case where relative links opened the sandbox URL (`googleusercontent.com/userCodeAppPanel`). All navigation links now use the real Apps Script Web App URL from `ScriptApp.getService().getUrl()`, while forms continue to submit with GET and `target="_top"`.

The previous versions caused a **white screen after login** because Apps Script
web apps run inside a sandboxed `googleusercontent.com` iframe. Inside that
sandbox:
- `doPost()` responses cannot reliably navigate the parent frame
- `<meta http-equiv="refresh">` is blocked (CSP)
- `window.top.location` would need JavaScript (your spec forbids JS)

**Inspired by the `juhaHR` repo's pattern**, this version uses **GET-only
forms with `<base target="_top">`**, which is the proven pure-HTML approach
that works inside the iframe without any JS or CSS.

## Files

- `Code.gs` — entry point + router (`doGet` handles both pages and actions)
- `auth.gs` — login / logout / session (session = `sid` query param)
- `users.gs` — users & roles
- `exercises.gs` — CRUD + duplication (copies details)
- `assignments.gs` — assign + mark completed
- `views.gs` — pure-HTML rendering, no JS, no CSS; all links/forms use absolute Web App URLs
- `index.html` — single HTML shell with `<base target="_top">`

## Spreadsheet sheets

Run `setupSheets()` once from the editor. It creates:

| Sheet | Columns |
|---|---|
| Users | id, name, role, team_id |
| Credentials | user_id, password |
| Teams | id, name, commander_id |
| Exercises | id, title, description, created_by, date |
| ExerciseDetails | id, exercise_id, time, location, description |
| Assignments | id, exercise_id, user_id, status, score, responsibility |

Demo accounts seeded automatically:
- **U001 / admin123** — admin
- **U002 / cmd123** — commander of team T1
- **U003 / train123** — trainee in T1

## Deployment

1. Open your Google Sheet → **Extensions → Apps Script**
2. Paste each `.gs` file into a separate script file with the same name
3. Create an HTML file named exactly `index` and paste `index.html` into it
4. Run `setupSheets()` once (grant permissions). If your Assignments sheet already exists, make sure cell F1 is `responsibility`.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (or anyone in your domain)
6. Open the `/exec` URL — login page appears
7. After every code change: **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**

## How session works (no JS / no PropertiesService misuse)

`PropertiesService` in Apps Script is **per-script-owner**, not per-end-user,
so it cannot be used as a real session store. Instead, after login the
user's id is appended to every link as `&sid=Uxxx`. Every page resolves the
current user via `Auth_current(p)`. This is simple, stateless, and
compatible with the pure-HTML constraint.

For a production system add a server-side token table (random token →
user_id, with expiry) and pass the token instead of the raw user id.

## Troubleshooting

- **White page after login**: make sure you redeployed a **new version**
  (editing the script alone is not enough — the `/exec` URL serves the
  last deployed version).
- **Links navigate to a Google login page**: this is expected once and
  then the app loads. `<base target="_top">` ensures clicks escape the
  sandbox iframe.
- **"Sheet not found"**: run `setupSheets()` again.


## Where responsibility was added

- In the sheet: `Assignments` column F named `responsibility`
- In `assignments.gs`: `Assignments_all()` reads column F, and `Assignments_assign()` saves it
- In `views.gs`: Admin and Commander assignment forms contain `<input name="responsibility">`, and tables display the value


## Clean restart / recreate tables

If you get a white screen because the sheet headers/data are mixed, run this from Apps Script editor:

```js
resetTrainingTables()
```

It clears and recreates all sheets with the correct columns, including `Assignments` column F `responsibility`, and creates these logins:

- Admin: `1 / admin123`
- Commander: `2 / cmd123`
- Trainee: `3 / train123`

After running it, deploy a new version and open the `/exec` URL.
