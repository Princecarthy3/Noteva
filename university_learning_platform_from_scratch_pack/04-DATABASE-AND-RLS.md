# Stage 4 — Database Schema, Storage, and Row Level Security

## Important implementation instruction

Do not run destructive SQL against an existing project. Inspect the current schema first. Create versioned migrations and apply them in a development project before production. Adjust names and foreign keys to match existing tables if the app already has a schema.

## 1. Core entities

Recommended tables:

### Profiles and academic structure
- `profiles`: `id` references `auth.users`, display name, avatar path, university ID, programme, academic level, current semester, timestamps.
- `universities`: ID, name, country code, optional website.
- `courses`: ID, university ID, code, title, description, optional department.
- `student_courses`: user ID, course ID, semester label, academic year, created timestamp.

### Lectures and resources
- `lectures`: ID, owner ID, optional course ID, title, media type, private storage path, status, transcript text or transcript reference, duration, provider job ID, error code/message, timestamps.
- `resources`: ID, owner ID, optional course ID, title, resource type, private storage path or structured content, visibility, metadata, timestamps.
- `ai_generations`: ID, owner ID, optional course ID, optional source lecture/resource ID, task type, status, input reference/metadata, output JSON or structured output, model identifier, usage metadata, timestamps.
- `flashcards`: ID, owner ID, optional AI generation ID, optional course ID, front, back, source reference, timestamps.
- `quizzes`: ID, owner ID, optional course ID, title, questions JSON or normalized question tables, source reference, timestamps.
- `quiz_attempts`: ID, quiz ID, user ID, answers, score, total, completed timestamp.

### Groups and sessions
- `study_groups`: ID, creator ID, optional course ID, name, description, visibility, created timestamp.
- `group_members`: group ID, user ID, role, joined timestamp.
- `group_invites`: ID, group ID, creator ID, token hash, expiry, max uses, use count, revoked timestamp.
- `group_messages`: ID, group ID, sender ID, body, optional resource reference, created timestamp.
- `study_sessions`: ID, group ID, creator ID, title, starts/ends timestamps, status, optional notes, timestamps.
- `call_sessions`: optional for call integration; session ID, provider, provider room reference, status, created/ended timestamps. Avoid storing long-lived secrets.

### Planner and notifications
- `study_tasks`: ID, owner ID, optional course ID, title, description, due date, status, priority, timestamps.
- `notifications`: ID, user ID, type, title, body, read timestamp, created timestamp.

## 2. Database conventions

- UUID primary keys unless there is an existing consistent convention.
- `created_at` and `updated_at` timestamps where appropriate.
- Foreign keys and useful indexes.
- Add constraints for allowed statuses and roles.
- Use UTC timestamps and render them in the user's local timezone.
- Avoid duplicating derived values without a clear reason.
- Prefer normalized relational tables for access-controlled data.
- JSON is appropriate for provider payloads or flexible generated quiz content, but validate its shape in application code.

## 3. RLS principles

Enable RLS on all user-facing tables.

- `profiles`: users can read/update permitted profile fields; never allow users to change privileged fields.
- `student_courses`: users manage only their own enrollment selections unless a legitimate shared-course model is introduced.
- `lectures` and private `resources`: owners can access their own records. Group-shared resources require a deliberate sharing model and membership checks.
- `ai_generations`, `flashcards`, `quizzes`, `quiz_attempts`, `study_tasks`: owner-based policies; shared quiz behavior must be explicitly designed.
- `study_groups`: readable according to visibility; private group content requires membership.
- `group_members`: joining/leaving/role changes must follow safe rules. Members must not be able to promote themselves or modify owner/moderator roles.
- `group_messages`: sender must be a group member; read access follows group visibility/membership.
- `study_sessions`: read access follows group membership; only permitted roles can create/update/cancel.
- `notifications`: users access only their own notifications.
- `group_invites`: do not expose raw invite tokens broadly; hash tokens at rest and validate expiry/use count server-side.

RLS policies must match the product rules. Do not use a broad `USING (true)` policy on private tables.

## 4. Storage

Use private buckets for:
- `lecture-media`
- `study-resources`
- `avatars` may be public only if intended; otherwise private

For private files:
- Verify the signed-in user owns the associated database record or has explicit group access.
- Use storage policies where possible.
- Generate short-lived signed URLs only after permission checks.
- Enforce size/type constraints in the server upload flow where feasible.
- Do not trust the file extension alone; validate MIME type and file signature where practical.
- Consider retention and deletion behavior for original media and derived transcripts.

## 5. Security tests

Test as at least two separate users:
- User A cannot read User B's private lecture.
- User A cannot read a private group without membership.
- A regular member cannot promote themselves to moderator/owner.
- A user cannot access a resource by guessing its UUID.
- A user cannot read another user's quiz attempts or tasks.
- Expired/revoked invites fail.
- Storage paths do not grant access by guessability alone.

## 6. Deliverables

- Versioned SQL migrations.
- Documented apply/reset workflow for development.
- RLS policies for each private table.
- Storage policies and bucket setup.
- A short data-access matrix in the project README.
