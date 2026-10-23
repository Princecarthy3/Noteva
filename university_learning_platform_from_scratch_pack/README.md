# University Learning Platform — AI Implementation Pack

This pack guides an AI coding agent (Codex, Claude Code, or a similar tool) to build a single university learning platform that combines:

- Lecture transcription and lecture-material processing
- AI summaries, explanations, flashcards, and quizzes
- Courses and academic organization
- Study groups and shared resources
- Audio/video study calls
- Planner, reminders, and learning progress

The platform should be built incrementally, not generated as one huge untested code dump.

## Product principles

1. **One product, one account, one connected experience.**
2. **Ship in stages.** Finish and verify each stage before moving to the next.
3. **Build for a Ghana-first pilot, but don't hard-code the product to one university or country.**
4. **Use free tiers carefully.** No provider should be described as unlimited or guaranteed free. Check current provider limits before launch.
5. **Security before convenience.** API keys stay server-side; private files remain private; database access is protected by Row Level Security (RLS).
6. **Accessible, responsive, low-bandwidth-aware UX.**
7. **Do not fake functionality.** If a service is not configured, show a useful setup state instead of pretending the operation succeeded.

## Suggested stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, and selectively Realtime
- OpenRouter for text-generation tasks
- A separately configured speech-to-text provider for transcription
- Jitsi Meet as an initial call option, subject to its public service terms and limits
- Vercel for deployment

Provider free plans and limits can change. Confirm current limits before making cost promises.

## Important: this project starts from zero

There is no reusable application code assumed. These files are the implementation plan only. Start with `CODEX-FIRST-PROMPT.md` and `FROM-SCRATCH-BOOTSTRAP.md`; the agent should initialize a new Next.js project and preserve these Markdown files. Do not assume an existing app, package.json, components, or database.

## How to use these files

1. Give the AI coding agent `CODEX-FIRST-PROMPT.md` first, along with `00-MASTER-INSTRUCTIONS.md` and `FROM-SCRATCH-BOOTSTRAP.md`.
2. Ask it to read the relevant stage file before implementation.
3. Implement only one stage at a time.
4. After each stage, run the required checks and fix errors before continuing.
5. Keep `PROJECT-STATUS.md` updated after every stage.
6. Never paste secret keys into chat, source control, client-side code, or `.env.example`.

## Stage order

| Stage | File | Outcome |
|---|---|---|
| 0 | `CODEX-FIRST-PROMPT.md` + `FROM-SCRATCH-BOOTSTRAP.md` | Initialize a new app from an empty folder |
| — | `00-MASTER-INSTRUCTIONS.md` | Agent rules and workflow |
| 1 | `01-PRODUCT-SPEC.md` | Product scope and user journeys |
| 2 | `02-ARCHITECTURE.md` | Technical architecture and repository structure |
| 3 | `03-DESIGN-SYSTEM.md` | Visual system and reusable UI |
| 4 | `04-DATABASE-AND-RLS.md` | Schema, relationships, access policies |
| 5 | `05-AUTH-AND-ONBOARDING.md` | Accounts and university/course onboarding |
| 6 | `06-DASHBOARD-AND-COURSES.md` | Dashboard and course workspace |
| 7 | `07-LECTURE-STUDIO.md` | Uploads, transcription pipeline, lecture records |
| 8 | `08-AI-STUDY-LAB.md` | Summaries, Q&A, flashcards, quizzes |
| 9 | `09-STUDY-GROUPS.md` | Groups, membership, discussions, shared resources |
| 10 | `10-CALLS.md` | Study-call integration |
| 11 | `11-PLANNER-AND-PROGRESS.md` | Tasks, calendar, performance |
| 12 | `12-SECURITY-TESTING-AND-RELEASE.md` | Hardening, testing, deployment |
| — | `PROJECT-STATUS.md` | Stage tracker and known issues |

## Definition of done for each stage

A stage is complete only when:
- Its UI and server behavior are implemented, not mocked unless explicitly labeled as a prototype.
- Loading, empty, success, and error states exist.
- Permissions are checked on the server and enforced in the database where applicable.
- TypeScript, lint, and build checks pass (or any pre-existing failures are documented precisely).
- Manual test steps are recorded.
- The next stage has not been started prematurely.
