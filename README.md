# Military Training App — v10 (Admin-only assignments, on exercise page)

## What changed in v10
- **Assignments are now admin-only.** Commanders can no longer assign exercises.
  - `Assignments_assign` requires role `admin`.
- **Assignment form moved to the Exercise page.**
  - Removed the "Assign exercise" panel from the admin dashboard (a hint now
    points users to open the exercise page).
  - Removed the per-trainee assign form from the commander dashboard.
  - The Exercise page (admin only) now shows a new panel
    **"➤ הקצאת חייל לתרגיל"** that lists only users who are NOT yet assigned
    to that exercise, plus the responsibility input.
- After a successful assignment, the user is returned to the same exercise page
  with a confirmation flash.

## Commander capabilities (unchanged)
- View their team and their team's assignments.
- Mark assignments as complete (`action=complete`).

## Deployment
1. Replace all files in your Apps Script project (Code.gs, auth.gs, users.gs,
   exercises.gs, assignments.gs, views.gs, index.html).
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.**
3. Test:
   - Login as `U001 / admin123`.
   - Open any exercise → scroll to **"➤ הקצאת חייל לתרגיל"** → assign.
   - Login as `U002 / cmd123` → confirm no assign form is visible.
