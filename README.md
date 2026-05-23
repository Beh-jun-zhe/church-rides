# Church Ride Link
A mobile-first full-stack ride coordination app for Sunday church rides from North Campus and South Campus.

## Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Supabase Row Level Security (RLS)
- Deployable on Vercel

## Roles
- `owner`
  - Full system control, admin approvals, role management, lock/unlock schedule
  - All admin actions + dashboard + CSV export
- `admin` (requires owner approval)
  - Match riders/drivers, move/remove assignments, run auto-match, manage coordination notes
- `driver`
  - Submit/edit own availability, see only assigned riders and seat utilization
- `rider`
  - Submit/edit own request, choose only active time slots for selected location, see assignment status

## Core Features Implemented
- Email/password auth (with optional confirmation email flow)
- Protected routes: `/rider`, `/driver`, `/admin`, `/owner`
- Owner recognition via `OWNER_EMAIL` in app + owner seeding in SQL trigger
- Onboarding role selection with admin request flow (`pending` approval)
- Rider status labels:
  - `pending_assignment` → `Coordinating ride`
  - `assigned` → `Ride confirmed`
  - `cancelled` → `Cancelled`
- Admin matching dashboard:
  - Drag-and-drop rider-to-driver matching board
  - Filter riders by location/status
  - Manual assign / move / remove
  - Auto-match button
  - CSV export + copy list
- Weekly Sunday cycle:
  - Drivers/riders are stored per `sunday_date`
  - App automatically scopes dashboards to the current service Sunday
  - Driver/rider self-serve "Copy last Sunday" actions
- Weekly history and accountability:
  - `/history` page for prior Sunday snapshots
  - Audit log for matching/role/schedule actions
  - Reminder run history
- Owner dashboard extras:
  - Approve/reject pending admins
  - Update non-owner user roles
  - Lock/unlock schedule
- Reminder operations:
  - Manual reminder send buttons in owner dashboard
  - Optional Vercel cron endpoint for Thursday/Saturday reminders
- Schedule lock logic:
  - Manual lock by owner (owner can lock/unlock anytime)
- UX guardrails:
  - Confirmation prompts for destructive actions
  - Success/info/error toast messages after key actions
  - Phone normalization and display formatting

## Project Structure
```text
church-rides/
  src/
    app/
      page.tsx
      login/page.tsx
      onboarding/page.tsx
      rider/page.tsx
      driver/page.tsx
      admin/page.tsx
      owner/page.tsx
      history/page.tsx
      api/cron/reminders/route.ts
      forbidden/page.tsx
      auth/callback/route.ts
      layout.tsx
      globals.css
    components/
      auth/LoginForm.tsx
      forms/DriverAvailabilityForm.tsx
      forms/RiderRequestForm.tsx
      dashboard/AdminBoard.tsx
      dashboard/AdminDragMatchBoard.tsx
      dashboard/AdminUserIntake.tsx
      dashboard/OwnerControls.tsx
      dashboard/CopyAssignmentsButton.tsx
      ui/AppHeader.tsx
      ui/FlashToast.tsx
      ui/ConfirmSubmitButton.tsx
      ui/SectionCard.tsx
      ui/StatusBadge.tsx
      ui/SummaryGrid.tsx
    lib/
      audit.ts
      auth.ts
      constants.ts
      data.ts
      env.ts
      flash.ts
      reminders.ts
      phone.ts
      types.ts
      serviceWeek.ts
      utils.ts
      supabase/client.ts
      supabase/admin.ts
      supabase/server.ts
      supabase/middleware.ts
      actions/auth.ts
      actions/onboarding.ts
      actions/driver.ts
      actions/rider.ts
      actions/admin.ts
      actions/owner.ts
    proxy.ts
  supabase-schema.sql
  supabase/migrations/0001_church_rides.sql
  supabase/migrations/0002_weekly_service_cycle.sql
  supabase/migrations/0003_ops_and_history.sql
  vercel.json
  .env.example
```

## Supabase Setup
1. Create a Supabase project.
2. In Auth settings:
   - Enable Email provider and password sign-in
   - Optional: keep "Confirm email" enabled for account verification
   - Set site URL and redirect URL to include:
     - `http://localhost:3000/auth/callback`
     - your production callback URL
3. Open `supabase-schema.sql` and replace all `behjunzhe@gmail.com` values with your owner email.
4. Run `supabase-schema.sql` in Supabase SQL editor.
5. Then run `supabase/migrations/0002_weekly_service_cycle.sql` in Supabase SQL editor.
6. Then run `supabase/migrations/0003_ops_and_history.sql` in Supabase SQL editor.
7. Then run `supabase/migrations/0004_security_hardening.sql` in Supabase SQL editor.
8. Confirm owner email config in DB:
   ```sql
   update public.system_settings
   set owner_email = lower('your-owner-email@example.com')
   where id = true;
   ```

## Local Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env.local
   ```
3. Fill `.env.local` values.
   - Required:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `OWNER_EMAIL`
   - Needed for reminder cron/history logging from cron endpoint:
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `CRON_SECRET`
   - Needed for outbound emails:
     - `RESEND_API_KEY`
     - `REMINDER_FROM_EMAIL`
     - `APP_BASE_URL`
4. Start development:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Build / Verify
```bash
npm run lint
npm run build
```

If your environment blocks Turbopack internals, you can still verify with:
```bash
npm run build -- --webpack
```

## Matching Logic
Auto-match (`run_auto_match`) processes riders with `pending_assignment` in submission order:
1. Find active drivers with same pickup location + time slot.
2. Sort by fewest assigned riders, then earliest driver submission.
3. Assign if seats remain (`available_seats - assigned_count > 0`).
4. Insert/update `ride_assignments` row.
5. Keep rider as `pending_assignment` if no seat is available.

All matching and slot availability are scoped to the current service Sunday cycle.

## Deployment (Vercel)
1. Push `church-rides` to GitHub.
2. Import project into Vercel.
3. Set env vars in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OWNER_EMAIL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `APP_BASE_URL` (example: `https://your-app.vercel.app`)
   - Optional for email reminders:
     - `RESEND_API_KEY`
     - `REMINDER_FROM_EMAIL`
4. Ensure Supabase Auth redirect URLs include your Vercel callback URL:
   - `https://your-app.vercel.app/auth/callback`
5. Deploy.
6. In Vercel, cron schedules are read from `vercel.json` and call `/api/cron/reminders`.

## Notes
- RLS blocks unauthenticated access to private ride data.
- Admin access requires `role='admin'` and `admin_status='approved'`.
- Owner actions are restricted to owner profile role.
