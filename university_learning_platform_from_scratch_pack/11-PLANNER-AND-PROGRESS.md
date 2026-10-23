# Stage 11 — Study Calendar, Planner, and Learning Progress

## 1. Planner scope

- Create, edit, complete, and delete study tasks.
- Optional course association.
- Due date, priority, status, and notes.
- Show the planner task/progress overview on the dashboard and provide a separate full month/week calendar.
- Add and edit school classes, exams, study blocks, and personal events manually.
- Import school events from CSV locally; CSV columns include a title/event name and either a date or start timestamp, with optional start/end time, location, type, and course. Timestamp offsets are converted into the profile timezone.
- Extract calendar entries from PDF, PNG, JPEG, and WebP files. Require explicit consent before sending PDF/image contents to OpenRouter; extraction creates editable drafts and never saves without confirmation.
- Display calendar items, deadlines, and joined-group sessions using the profile timezone.
- Validate event ownership, course ownership, local times, and generated suggestions on the server.

## 2. Study plans

Students set their preferred study days/times, pace, session length, break length, and daily study limit. AI planning uses those preferences plus the student's courses, open tasks, and school events to suggest study/review blocks within a selected range of up to 35 days. Suggestions are checked against the profile timezone, requested date window, event conflicts, preferences, daily limit, and breaks between proposed blocks. Suggestions are editable drafts; only confirmed items are saved. AI must not invent or rewrite fixed school events, deadlines, or course facts. Calendar file imports and AI-generated plans are limited to five AI requests per user per hour.

## 3. Progress

Use real records:
- Quiz attempts and scores.
- Flashcards reviewed if review events are tracked.
- Completed tasks.
- Lectures processed.
- Study sessions attended only if attendance is actually recorded.

Do not equate time spent with learning mastery. Do not display fabricated streaks, scores, or comparative rankings.

## 4. Notifications

Start with in-app notifications if possible. Email or push reminders require additional configuration and consent.

- Avoid sending duplicate reminders.
- Let users control notification preferences.
- Do not expose notification data across accounts.
- If scheduled jobs are needed, document the hosting/cron limits and a safe fallback.

## 5. Progress insights

- Show trends only when enough data exists.
- Explain what each metric means.
- Highlight missed quiz questions and allow review.
- Avoid making medical or psychological claims about learning ability.
- Do not rank students publicly by default.

## 6. Acceptance criteria

- Task changes persist and are private to the owner.
- Due dates display correctly across timezones.
- Manual, CSV, PDF, and image calendar imports produce reviewable records in the profile timezone.
- AI study plans respect saved preferences and fixed events, and are persisted only after student confirmation.
- The dashboard shows planner overview content while the planner route provides the full calendar.
- Quiz scores are derived from stored attempts.
- Empty states explain how to begin tracking progress.
- Reminders are not claimed to work unless delivery is configured and tested.

## Implementation notes

Stage 11 uses the existing `study_tasks`, `timetable_events`, `study_preferences`, `study_sessions`, `lectures`, `quizzes`, `quiz_attempts`, and `ai_generations` tables. Planner tasks and calendar items are managed by authenticated owner-scoped actions; local datetime values are converted using the student's profile timezone and invalid DST-gap times are rejected. CSV parsing happens locally on the server; PDF and image files are sent to OpenRouter only after explicit consent. Imports and generated blocks remain reviewable drafts until confirmed. The AI routes track requests in `ai_generations` for a five-per-hour per-user limit. Upcoming group sessions use the existing membership RLS policy.

The former sample timetable and quiz-result screen were replaced with saved records. A completed AI Study Lab quiz can be submitted to a server endpoint that rechecks ownership, validates all answers, computes the score from the stored quiz output, and persists the quiz/attempt using the server-only service role. The UI displays saved attempts and a recent average only when records exist. Notifications are not delivered, flashcard review events are not tracked, and study-session attendance is not recorded.
