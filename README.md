# Military Training Exercises — Google Apps Script Web App

A server-rendered web app (HTML only — no CSS, no JS) that manages
training exercises for a military course, backed entirely by a Google Sheet.

## Files

| File             | Responsibility                                            |
|------------------|-----------------------------------------------------------|
| `Code.gs`        | Entry point: `doGet`, `doPost`, routing, sheet helpers    |
| `auth.gs`        | Login, logout, session via `PropertiesService`            |
| `users.gs`       | User & role queries, role updates                         |
| `exercises.gs`   | Exercises CRUD + duplication + timeline entries           |
| `assignments.gs` | Assigning exercises and marking them complete             |
| `views.gs`       | All HTML rendering                                        |

## Spreadsheet structure

Create a Google Sheet and add the following sheets (the `setupSheets()`
function will create them automatically on first run).

### `Users`
| id | name | role | team_id |
|----|------|------|---------|
| 1  | Admin     | admin     |   |
| 2  | Commander | commander | 1 |
| 3  | Trainee   | trainee   | 1 |

`role` is one of `admin`, `commander`, `trainee`.

### `Credentials` (admin-managed only)
| user_id | password |
|---------|----------|
| 1 | admin123 |
| 2 | cmd123   |
| 3 | train123 |

> Passwords are stored in plain text in the sheet, exactly as required by
> the spec. In a real deployment you would hash them.

### `Teams`
| id | name | commander_id |
|----|------|--------------|
| 1 | Alpha Team | 2 |

### `Exercises`
| id | title | description | created_by | date |
|----|-------|-------------|------------|------|

### `ExerciseDetails` (timeline)
| id | exercise_id | time | location | description |
|----|-------------|------|----------|-------------|

### `Assignments`
| id | exercise_id | user_id | status | score |
|----|-------------|---------|--------|-------|

`status` is `pending` or `completed`.

## Routing (URL parameters)

| URL                              | Page                                  |
|----------------------------------|---------------------------------------|
| `?page=login`                    | Login form                            |
| `?page=dashboard`                | Role-specific dashboard               |
| `?page=exercise&id=...`          | Exercise detail with timeline         |
| `?page=users`                    | (admin) Manage user roles             |
| `?page=exerciseForm[&id=...]`    | (admin) Create or edit exercise       |
| `?page=logout`                   | Clear session                         |

POST actions are dispatched via the hidden field `action`:
`login`, `createExercise`, `updateExercise`, `duplicateExercise`,
`addExerciseDetail`, `assignExercise`, `completeAssignment`, `updateUserRole`.

## Authorization summary

| Capability                             | Admin | Commander (own team) | Trainee |
|----------------------------------------|:-----:|:--------------------:|:-------:|
| View all exercises                     |  ✅   |          ✅           |   ✅*   |
| Create / edit / duplicate exercises    |  ✅   |          ❌           |   ❌    |
| Assign exercise                        |  ✅   |   ✅ (trainees only)  |   ❌    |
| Mark assignment complete               |  ✅   |          ✅           |   ❌    |
| Manage user roles                      |  ✅   |          ❌           |   ❌    |

*Trainees only see exercises that are assigned to them on the dashboard, but
can open any exercise page if they know the URL. Restrict in `Views_exercisePage`
if needed.

## Deployment

1. Open your Google Sheet → **Extensions → Apps Script**.
2. In the Apps Script editor, create six script files and paste in the
   contents of `Code.gs`, `auth.gs`, `users.gs`, `exercises.gs`,
   `assignments.gs`, `views.gs`.
3. Save the project.
4. From the editor, run the function **`setupSheets`** once.
   Approve the OAuth prompt. This will:
   - Create all required sheets with headers if missing.
   - Seed an admin/commander/trainee user with default passwords (see above).
5. Click **Deploy → New deployment → Web app**.
   - **Execute as:** *Me*
   - **Who has access:** *Anyone with the link* (or your domain)
6. Copy the Web App URL. Open it in your browser.
7. Log in with `userId=1`, `password=admin123` and start configuring users,
   teams and exercises.

## Re-deploying after changes

Apps Script web apps must be re-deployed (Deploy → Manage deployments → edit →
new version) for code changes to take effect at the existing URL.

## Notes

- Sessions live in `PropertiesService.getUserProperties()`, which is keyed
  by the Google account viewing the page. This works because the web app is
  deployed to *execute as you* but accessed by each viewer with their own
  Google identity. If you need true multi-user logins under a single Google
  account, switch to a token stored in a `Sessions` sheet instead.
- Every action does a full page reload — no JavaScript required.
- All inputs are HTML-escaped via `escapeHtml()` to prevent injection in
  rendered output.
