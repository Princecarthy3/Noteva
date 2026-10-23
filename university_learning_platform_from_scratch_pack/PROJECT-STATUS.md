# Project Status

Update this file after each implementation stage. Keep it factual and short.

## Current stage
Stage 11 full calendar, dashboard planner overview, and progress features are authored. Stage 4/5/9/10/11 migrations, live auth/RLS acceptance tests, and provider-backed transcription/generation/call/calendar checks remain pending development-project verification.

## Completed stages
- [x] Stage 0 — Existing Next.js foundation inspected and preserved; no re-scaffolding needed
- [x] Stage 1 — Product specification reviewed
- [x] Stage 2 — Architecture reviewed against existing code
- [x] Stage 3 — Existing design reviewed and retained
- [ ] Stage 4 — Database and RLS (migration authored; external acceptance checks pending)
- [ ] Stage 5 — Authentication and onboarding (implementation authored; external acceptance checks pending)
- [x] Stage 6 — Dashboard and courses (implementation authored; live database acceptance checks pending)
- [x] Stage 7 — Lecture Studio (authenticated private uploads and transcript workflow authored; live provider acceptance checks pending)
- [x] Stage 8 — AI Study Lab (authenticated source selection, validated generation, editable saved outputs, and per-user limits authored; live checks pending)
- [x] Stage 9 — Study groups (group discovery, membership, invitations, discussions, sessions, sharing, and reporting authored; live checks pending)
- [x] Stage 10 — Calls (Jitsi iframe prototype, server-authorized group sessions, random room IDs, muted-by-default join, and third-party disclosure; live call checks pending)
- [x] Stage 11 — Planner and progress (dashboard overview, full month/week calendar, manual/CSV/PDF/image imports, preference-based AI study plans, server-scored quiz attempts, record-based metrics; live database/provider checks pending)
- [ ] Stage 12 — Security, testing, and release

## Repository notes
- Repository path: `D:\Xampp\htdocs\ai-student-study-assistant`
- Framework/package versions: Next.js 16.2.6, React 19.2.6, TypeScript 5.9.3, Tailwind CSS 4.1.17, Drizzle ORM 0.45.2
- Existing routes/features: `/`, protected `/app`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/update-password`, `/auth/callback`, `/onboarding`, `/api/health`, `/api/ai`, `/api/lectures`, `/api/lectures/[id]`, `/api/transcribe`, `/api/study-lab`, `/api/study-lab/[id]/attempt`, `/api/study-groups`, `/api/study-groups/[id]/sessions/[sessionId]/call`, `/api/planner/import`, `/api/planner/generate`, `/api/planner/preferences`, manifest
- Supabase environment file: Present locally; values and live project connectivity have not been verified
- OpenRouter configured: Not live-verified; `.env.example` contains placeholders
- Transcription provider configured: Not live-verified; OpenRouter audio/video processing needs a server-side key
- Calls provider configured: Jitsi public-service prototype selected; live configuration and device checks pending

## Environment/setup tasks
- [ ] Verify `.env.local` contains the user's development Supabase URL, publishable key, and server-only service-role key
- [ ] Configure Supabase URL and public key
- [ ] Apply the Stage 4 migration to a development Supabase project
- [ ] Apply the Stage 5 onboarding progress migration
- [ ] Configure Supabase email/password, Site URL, and `/auth/callback` redirect allowlist
- [ ] Verify private data, group permissions, and storage access with two separate test users
- [ ] Verify registration, email verification, login/logout, protected-route redirect, onboarding persistence, and password reset
- [ ] Configure Supabase server-only service-role key for Stage 7 lecture mutations
- [ ] Configure OpenRouter server-side key for Stage 7 transcription
- [ ] Configure OpenRouter study-generation model and verify structured outputs
- [ ] Apply the Stage 9 study groups migration
- [ ] Apply the Stage 10 study calls migration and configure server-only `JITSI_MEET_DOMAIN`
- [ ] Apply the Stage 11 planner/progress migration
- [ ] Verify planner AI requires the server-side OpenRouter and Supabase service-role keys; test the five-request hourly limits
- [ ] Test public/private group access, invitation use limits, discussion permissions, reports, session moderation, and resource sharing with two accounts
- [ ] Verify the selected OpenRouter audio/video models support the configured input formats
- [ ] Test authorized/unauthorized call configuration, session time window, mobile permissions, audio-only, leave, and reconnect
- [ ] Test task/calendar ownership, timezone handling, server-scored quiz attempt persistence, and record-derived progress
- [ ] Test manual, CSV, PDF, and image calendar import; verify third-party consent, editable drafts, timezone conversion, and explicit confirmation
- [ ] Test AI study-calendar date bounds, course/task context, fixed school/group event conflicts, preferences, daily limits, breaks, and draft confirmation

## Checks
- Typecheck: `npm run typecheck` — passed after full calendar implementation
- Lint: `npm run lint` — passed after full calendar implementation
- Tests: No test script is configured; `psql` is not installed for local migration execution
- Production build: `npm run build` — passed after full calendar implementation; live provider calls not tested
- Stage 6 production build: `npm run build` — passed
- Stage 7 typecheck: `npm run typecheck` — passed
- Stage 7 lint: `npm run lint` — passed
- Stage 9 typecheck: `npm run typecheck` — passed
- Stage 9 lint: `npm run lint` — passed
- Stage 9 production build: `npm run build` — passed; live Supabase and two-user checks remain pending
- Stage 10 typecheck: `npm run typecheck` — passed
- Stage 10 lint: `npm run lint` — passed
- Stage 10 production build: `npm run build` — passed; live Supabase/Jitsi and device checks remain pending
- Stage 11 typecheck: `npm run typecheck` — passed
- Stage 11 lint: `npm run lint` — passed
- Stage 11 production build: `npm run build` — passed; live Supabase, timezone, and two-user checks remain pending
- Runtime health check: Production server returned the expected `503` JSON setup state when `DATABASE_URL` was absent
- Auth route smoke check: Live account flow has not been verified with the current local environment

## Known issues
- The migration has not been applied to a Supabase project; SQL execution and two-user RLS/storage tests remain required.
- Stage 5 auth and profile/course flows are implemented but cannot be verified end-to-end until migrations and Supabase Auth redirect settings are applied.
- Stage 6 dashboard/course data and course/task actions use authenticated Supabase sessions; live database and two-user tests remain pending.
- Stage 7 uses signed private uploads, owner-checked server routes, and a follow-on migration that denies direct browser writes to lecture records; live provider and two-user storage checks remain pending.
- Stage 8 generates summaries, explanations, source-grounded answers, simplified material, flashcards, and quizzes from the authenticated user's completed lecture transcripts; generated outputs are validated, persisted, editable/deletable, and limited to 20 per hour per user. Live provider and cross-user tests remain pending.
- Stage 9 supports public/private groups, hashed seven-day invitation tokens with use limits, member-only discussions, session scheduling, explicit resource sharing with RLS-authorized signed downloads, member reports, and leave/delete actions. Live two-user and Supabase checks remain pending.
- Stage 10 uses public Jitsi as a prototype; Noteva checks current membership before returning random room names, but public Jitsi does not enforce that authorization if a room name is shared. Live Supabase, mobile-device, and call-provider checks remain pending.
- Stage 11 replaces the sample planner and quiz-score interfaces with owner-scoped tasks/calendar entries, dashboard planner overview, a full calendar, local CSV parsing, consent-based PDF/image extraction, five-per-hour tracked AI calendar requests, server-validated editable study-plan suggestions, server-scored saved quiz attempts, current group sessions, and metrics derived from database records. Live migration, timezone, provider, service-role, and two-user checks remain pending; notifications are not delivered.
- Lecture Studio currently supports MP3, M4A, WAV, WebM audio and MP4/WebM video up to 25 MB. PDF extraction and external URL imports are explicitly unsupported.
- Existing owner foreign keys are added `NOT VALID` to avoid blocking legacy rows. Audit existing data and validate those constraints in development.
- The Drizzle `DATABASE_URL` connection does not carry the signed-in Supabase user identity. Use session-scoped Supabase clients for user-facing data access.

## Next action
Apply and verify the Stage 4/5/7/9/10/11 migrations, configure the server-only Supabase service-role and OpenRouter keys plus `JITSI_MEET_DOMAIN`, and run the documented two-user, Lecture Studio, AI Study Lab, Study Groups, Study Calls, and Study Planner checks in a development Supabase project. Then proceed to Stage 12 — Security, Testing, and Release.
