# StudyStation

StudyStation is a university learning workspace built with Next.js, TypeScript, Tailwind CSS, Supabase, and Drizzle. The existing application UI is being extended in stages; the implementation pack is in [`university_learning_platform_from_scratch_pack/`](./university_learning_platform_from_scratch_pack/).

## Run locally

1. Install Node.js and npm.
2. If needed, create `.env.local` from `.env.example`, then add your own development values. Do not overwrite an existing configured file or commit `.env.local`.
3. Install packages and start the app:

   ```powershell
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000>.

Available checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

The app can render without configured Supabase/OpenRouter credentials, but connected features will not work until their server-side settings are supplied.

## Database migrations

The versioned Stage 4 migration is [`supabase/migrations/20261020000000_university_platform_stage4.sql`](./supabase/migrations/20261020000000_university_platform_stage4.sql). It preserves existing StudyStation tables, adds university/course catalog and platform tables, enables RLS, and creates private storage buckets. For platform tables that require `owner_id`, it upgrades compatible pre-existing tables by copying ownership from `user_id`, `created_by`, `creator_id`, `author_id`, or `uploaded_by`. It also adds missing optional `course_id` relationships needed by the platform indexes and policies.

The migration has **not** been verified against a live database. Before using it:

1. Create or select a development Supabase project, not production.
2. Inspect its current tables and policies. This migration keeps existing tables/data, but redefines the named policies and assumes the existing StudyStation table names and core columns match `src/db/schema.ts`.
3. Apply the SQL file using the development project's Supabase SQL Editor.
4. Verify behavior with two separate test accounts before enabling user-facing database features.

If Stage 4 previously stopped with `column "owner_id" does not exist`, `column "course_id" does not exist`, or `must be owner of table objects`, use the updated SQL file and rerun it from the beginning; do not drop tables or reset the project. Supabase manages RLS on `storage.objects`, so the migration avoids changing that table's RLS flag and only installs the bucket policies. Existing rows without an owner in one of the recognized columns cause a descriptive error rather than being assigned to an arbitrary account. In that case, inspect and map those rows to valid `auth.users` IDs before retrying.

This is a forward-only migration. Do not reset a shared or production database to apply it. Corrective changes should be added as a new migration.

## Authentication and onboarding

Stage 5 uses Supabase email/password auth, with Google sign-in and registration through Supabase OAuth. Apply migrations in order:

1. `20261020000000_university_platform_stage4.sql`
2. `20261020005000_auth_onboarding_progress.sql`
3. `20261020010000_lecture_write_boundary.sql` before using Stage 7 lecture records
4. `20261020020000_study_groups_stage9.sql` before using Study Groups
5. `20261020030000_study_calls_stage10.sql` before using Study Calls
6. `20261020040000_planner_progress_stage11.sql` before saving quiz attempts
7. `20261021000000_courses_legacy_compatibility.sql` to upgrade course fields on pre-existing tables
8. `20261021010000_courses_title_compatibility.sql` to rename a legacy `courses.name` field to `title`
9. `20261021020000_profile_avatars.sql` before uploading private profile pictures
10. `20261022000000_lectures_legacy_compatibility.sql` to upgrade lecture fields (`mime_type`, `storage_path`, `processing_error`) on pre-existing tables
11. `20261023000000_student_reviews.sql` before loading or submitting public student reviews

For local verification, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_URL=http://localhost:3000` in `.env.local`. In Supabase Auth settings:

- Enable email/password sign-in and choose whether email confirmation is required.
- Enable Google as a provider in Supabase Auth and configure its OAuth client credentials and redirect URI.
- Set the local Site URL to `http://localhost:3000`.
- Add `http://localhost:3000/auth/callback` to the redirect URL allowlist.
- For deployment, set `APP_URL` to the verified HTTPS app URL and allowlist its `/auth/callback` URL.

Registration, Google OAuth, and password recovery use that callback route. If confirmation is enabled, the student completes onboarding after opening the verification email. Password-reset requests always show a neutral response so they do not reveal whether an email is registered. Both email/password and Google are available on the login and registration pages.

Onboarding progress and profile/course writes use the authenticated Supabase session and RLS, not the service-role key or the privileged Drizzle connection. The university catalog is optional; when it is empty or unavailable, students can enter their university manually. Course code/title entries are saved to the student's personal `courses` records.

### Manual auth check

After configuring the development project and applying both migrations:

1. Register a new email/password account and complete email confirmation if enabled.
2. Open `/app` while signed out and confirm it redirects to sign-in; sign in and refresh `/app`.
3. Complete onboarding, refresh `/onboarding`, and confirm saved progress/course entries remain; finish and confirm `/app` opens.
4. Sign out from the workspace and verify `/app` again requires sign-in.
5. Request a password reset, open the email link, change the password, then sign in with the new password. Try an expired link and confirm the page offers a new reset request.
6. With a second account, verify that profile and course data from the first account is not readable or editable.

### Data-access boundaries

| Data | Access rule |
| --- | --- |
| Profiles, personal courses, lectures, notes, study materials, planner, and chat | The authenticated owner only |
| University and course catalog | Read-only to authenticated users |
| Student course selections | The authenticated owner only |
| Study groups | Public groups are discoverable by authenticated users; private groups require membership |
| Group members, messages, invites, and sessions | Membership/manager policies; owners are added by a database trigger |
| Resources | Owner only unless explicitly shared with a group; group access requires membership |
| AI generations, quiz attempts, and notifications | Owner-readable; writes are reserved for trusted server workflows |
| Flashcards, quizzes, and study tasks | The authenticated owner only |
| `lecture-media` and `study-resources` storage | Private buckets; owner-path writes, with group-member reads only for explicitly shared resources |
| `profile-avatars` storage | Private bucket; users can access only objects under their own user-ID folder |

Use the Supabase server/browser clients with the signed-in user's session for user-scoped database work. A privileged `DATABASE_URL`/Drizzle connection does not automatically carry the user's Supabase identity and must not be used for user-facing reads or writes without an explicit, verified RLS-aware design. Stage 7's lecture-processing routes use `SUPABASE_SERVICE_ROLE_KEY` only on the server after authenticating the caller, checking lecture ownership, and applying explicit owner filters; clients can read their own lecture rows but cannot directly insert, update status, or delete them.

### Profile and account settings

The workspace profile page lets students update their name, programme, university, semester, and timezone; choose a light, dark, or system appearance; upload a private JPG/PNG/WebP avatar; and sign out. Apply `20261021020000_profile_avatars.sql` before uploading profile pictures. Account deletion requires typed confirmation and the server-only service-role key; private files under the user's own storage folders are removed before permanently deleting the Supabase Auth user and related database records.

## Dashboard and courses

Stage 6 reads the signed-in student's active/archived courses, open study tasks, upcoming study/review events, and recent lectures through the Supabase session. Course creation, editing, archiving/restoring, removal, and task creation are owner-scoped; the server actions also verify course ownership before attaching a task.

The dashboard has explicit empty/error states and does not report demo statistics as real progress. Lecture history is populated by Stage 7. Course workspace sections currently implemented are Overview and Lectures. The dashboard includes the Stage 11 task/progress overview, and the Study Planner route provides the full month/week calendar.

### Manual dashboard/course check

After applying the required migrations to a development project and signing in:

1. Add a course, refresh, edit it, archive it, restore it, and remove it. Confirm duplicate course codes are rejected and another account cannot change it.
2. Create a task with and without a course/deadline. Confirm the task appears on the dashboard after refresh and a course ID from another account is rejected.
3. Add study/review events in Study planner and confirm only upcoming events appear in the dashboard.
4. Verify empty lists guide the student to add a course/task/lecture, and database errors are shown rather than replaced with sample data.

## AI Study Lab

Stage 8 adds the AI Study Lab to the workspace navigation. It can create revision summaries, concept explanations, source-grounded answers, simplified explanations, flashcards, and multiple-choice practice quizzes from a completed lecture transcript owned by the signed-in student. The transcript is supplied as retrieved context, while Gemini can use its subject reasoning to clarify and connect ideas without contradicting the source. The generated output is stored in `ai_generations`, can be edited or deleted, and is restricted to 20 requests per user per hour. Each request uses at most 8,000 transcript characters; unrelated account data is not sent to the AI provider. Structured output is validated before it is saved. Configure the server-only `GEMINI_API_KEY` from Google AI Studio and, optionally, `GEMINI_STUDY_MODEL` (defaults to `gemini-3.5-flash-lite` with minimal thinking).

### Manual AI Study Lab check

After applying the Stage 4 and Stage 7 migrations and configuring Gemini:

1. Complete a lecture transcription, then generate each study task from that lecture. Confirm the output is grounded in its transcript and appears in Recent generations after refresh.
2. Edit a generated result and save it; delete another result. Confirm both changes persist.
3. Try a lecture ID from another account, a lecture without a completed transcript, malformed request values, and a request beyond the per-hour limit. Confirm no unauthorized source is processed and each invalid request gets a clear response.
4. Temporarily remove `GEMINI_API_KEY` and confirm the interface reports missing configuration rather than producing demo content.
5. Check generated summaries and answer explanations against the lecture material; AI output can be incorrect and must not be treated as guaranteed fact.

## Study Groups

Stage 9 adds collaboration to the existing workspace. Students can create public or private groups, discover and join public groups, and use high-entropy seven-day invitation links for private groups. Owners and moderators can invite classmates and schedule sessions. Members can post plain-text messages, report a group or message, explicitly share a private resource with a group, open group-shared content, or leave. Owners can delete their group; they cannot leave while they own it. Public discovery does not expose member rosters, and discussions, sessions, and shared resources are available only to members.

Apply `20261020020000_study_groups_stage9.sql` after Stage 4. Server-side group operations also require `SUPABASE_SERVICE_ROLE_KEY`; user identity is verified first and each privileged membership, invitation, report, and rate-limit operation is explicitly scoped. Discussion posts are limited to 10 per minute per user per group. Group files use short-lived signed URLs only after the signed-in member passes the shared-resource RLS check.

### Manual Study Groups check

After applying Stage 4 and Stage 9 migrations, configuring Supabase and the server-only service-role key, and signing in with two test accounts:

1. Create a public group and a private group; verify the creator is the owner. Browse and join the public group from the second account.
2. Confirm the second account cannot view private-group discussions before joining. Create an invite as the owner, use it from the second account, then retry it after joining.
3. Post messages, load older messages, and schedule a session as an owner/moderator. Confirm an ordinary member cannot schedule or cancel sessions.
4. Share one of the first account's private resources. Open it from the second member account, then unshare it and confirm access is removed.
5. Submit a report and confirm it is not visible to ordinary members. Attempt role escalation, a third-party resource share, and a message from a nonmember; each must be rejected.
6. Verify a member can leave, the owner cannot leave, and the owner can delete a group after explicit confirmation.

## Study Calls

Stage 10 adds scheduled-session calls using the Jitsi iframe API as a prototype. Apply `20261020030000_study_calls_stage10.sql` after Stage 9 and configure `JITSI_MEET_DOMAIN` on the server (for example, `meet.jit.si`). Calls are available only for current group members and only from 30 minutes before a scheduled session until its end. Room names are random per session and are disclosed only after server-side membership and session checks. The Jitsi script is loaded only after a user explicitly chooses to join; microphone and camera start muted, and audio-only mode is available.

This integration does **not** make public `meet.jit.si` rooms private or access-controlled: anyone who learns a room name may be able to join directly without passing StudyStation's membership check. Jitsi is a third party that may process meeting connection details and in-call content; its service terms do not guarantee uptime. The UI discloses these limitations before joining. Do not use this prototype for confidential discussions, and do not claim it provides private or production-secure calling. Assess a signed-token provider or self-hosted Jitsi deployment before making that claim. Calls are not recorded by this integration.

### Manual Study Calls check

After applying Stages 4, 9, and 10, configuring Supabase and the server-only service-role key, and setting `JITSI_MEET_DOMAIN`:

1. Schedule a session in a test group. Confirm no join action appears until 30 minutes before its start, and that it disappears at the end.
2. As a current group member, open the call and review the third-party disclosure. Confirm the Jitsi script is not requested before the explicit join action.
3. Verify the prejoin screen is shown and that the microphone and camera start muted. Explicitly enable devices and confirm browser permission handling; test audio-only mode and the mobile browsers/devices you support.
4. Leave and reconnect. Switch networks during a test call and verify the provider recovery experience. Check the call returns cleanly to the group after leaving.
5. As a nonmember, request the call configuration directly and confirm it is denied. Try a session from a different group, a cancelled session, and calls outside the permitted window; all should be rejected.
6. Remove `JITSI_MEET_DOMAIN` and confirm the UI does not show an active join button. Restore it and verify the endpoint rejects invalid host configuration.
7. Verify the limitations above remain visible and do not share sensitive meeting content or room names.

## Study Planner and Progress

Stage 11 replaces the sample planner schedule and quiz-results screen with owner-scoped tasks, a full editable month/week calendar, upcoming group sessions, and metrics derived from saved tasks, ready lectures, and quiz attempts. The dashboard shows the planner overview. Students can add school events manually or import CSV files (parsed locally), PDFs, and images; PDF/image extraction requires explicit consent to send the file to OpenRouter and returns editable drafts for review. CSV date/time offsets and event inputs use the profile timezone. Students can save preferences and request an AI-generated personal study calendar based on their courses, open tasks, school events, and preferred study times. Generated blocks are validated against the requested range, timezone, preferences, calendar conflicts, and daily limits, and are saved only after student confirmation. AI calendar generation and PDF/image extraction are limited to five requests per user per hour. Apply `20261020040000_planner_progress_stage11.sql` after Stage 4 and Stage 9/10 migrations; it grants the server-only service role the quiz-table permissions needed for the authenticated quiz-attempt endpoint. Planner actions use the signed-in user's Supabase session and existing owner RLS policies.

Quiz attempts are scored server-side from a completed quiz generation owned by the signed-in student. The browser submits one selected option for each question; the API validates the generation and answer shape, calculates the score from stored correct answers, then stores the result in `quizzes` and `quiz_attempts`. Notification delivery is not configured, and the app explicitly does not claim that reminders are sent. The progress page shows exact counts for completed tasks, ready lecture transcripts, and saved quiz attempts, plus the average of up to ten recent attempts. Flashcard review counts and study-session attendance are not shown because those activities are not tracked.

### Manual Study Planner and Progress check

After applying the Stage 4 and Stage 11 migrations, configuring Supabase and the server-only service-role key, and signing in:

1. Create, edit, complete, reopen, and delete tasks; test course association, notes, priority, and deadlines. Confirm the changes persist after refresh and another account cannot read or change them.
2. Create, edit, and delete study blocks and exam dates. Check timezone display across a daylight-saving transition and confirm invalid/nonexistent local times are rejected.
3. Confirm group sessions shown in the planner belong only to groups the account has joined.
4. Generate a quiz in AI Study Lab, answer every question, save the attempt, and confirm the score appears in Quiz progress and Study planner after refresh. Try incomplete answers, malformed choices, a quiz ID from another account, and non-quiz generations; these must not create an attempt.
5. Check progress values against the account's saved records. Confirm empty states do not invent scores, streaks, rankings, flashcard counts, or attendance.
6. Confirm the app says reminders are not being delivered and does not display fabricated notification items.
7. Confirm the dashboard shows the planner overview and its Full calendar action opens the month/week calendar.
8. Add school events manually, import a CSV with local and offset timestamps, then verify dates in the profile timezone. Try malformed/ambiguous dates and confirm they are rejected or left for explicit correction rather than silently guessed.
9. Import a PDF/image only after accepting the disclosure. Review/edit extracted drafts, exclude an item, and confirm nothing is saved until import confirmation.
10. Save study preferences, generate an AI plan for a bounded date range, edit/exclude suggestions, and confirm only selected blocks are saved. Try conflicts, out-of-range dates, and a sixth AI request within an hour.

## Lecture Studio

Stage 7 uses the private `lecture-media` Supabase Storage bucket. The browser requests an authenticated signed upload and transfers the file directly to storage; the server then downloads only the signed-in owner's lecture and submits it to the configured transcription provider. The transcript is saved to the owner's `lectures` record. Apply `20261020010000_lecture_write_boundary.sql` and set `SUPABASE_SERVICE_ROLE_KEY` server-side so browsers cannot bypass status transitions. Never expose or commit this key.

Supported inputs are MP3, M4A, WAV, and WebM audio, plus MP4 and WebM video, up to **25 MB** per file. The file extension and browser-reported media type must match, and the server checks the media container signature before processing. PDF/document extraction and external URL imports are not supported. Failed jobs can be retried; transcripts can be edited, copied, downloaded, or deleted. Deleting a lecture also deletes associated notes and study materials through the configured database relations.

Set `OPENROUTER_API_KEY` on the server to enable processing. Audio uses `OPENROUTER_TRANSCRIPTION_MODEL` (default `openai/whisper-large-v3`); video requires `OPENROUTER_VIDEO_MODEL`, and the selected model must accept video input. Provider and service-role keys are never sent to the browser. When processing is unconfigured, the uploaded lecture remains private and retryable, and the UI reports the missing setup rather than returning fabricated transcript text.

Uploaded recordings and transcripts are sent to OpenRouter for processing when configured. Upload only media you have permission to use. Provider retention and processing are subject to the provider's terms; do not upload confidential course materials unless that use is permitted.

Lecture status transitions are `uploaded → processing → ready` or `uploaded → processing → failed`; a failed lecture may be retried (`failed → processing`). Completed transcripts can be edited without changing processing status. Deletion is blocked while a transcription is in progress. The Stage 7 migration removes direct authenticated insert/update/delete privileges on lecture rows; server routes use the server-only service-role key only after validating the signed-in owner.

### Manual Lecture Studio check

After applying the Stage 4, 5, and 7 migrations, configuring Supabase, and setting the server-side service-role/provider keys:

1. Upload each supported file type at or below 25 MB. Confirm direct private storage upload, transcript creation, refresh persistence, and editing/copy/download.
2. Try a mismatched extension/MIME type, malformed media, an unsupported format, an empty file, and a file over 25 MB; each should be rejected with a clear message.
3. Temporarily remove the provider key and upload media. Confirm the lecture remains in the account with a setup message and can be retried after restoring configuration.
4. Use a second account to attempt to read, edit, process, and delete the first account's lecture ID and storage object. Confirm access is denied.
5. Delete a lecture and confirm the original media and associated notes/study materials are removed.

## Environment variables

`.env.example` contains placeholders only. Keep server-only credentials out of browser code. Configure only the providers required by the feature stage you are working on; Lecture Studio requires `SUPABASE_SERVICE_ROLE_KEY` for server-side lecture mutations and `OPENROUTER_API_KEY` for transcription. The AI Study Lab uses `GEMINI_API_KEY` and the service-role key for authenticated result persistence. Study Calls use the server-side `JITSI_MEET_DOMAIN` setting; do not add a provider secret to client-side variables.

