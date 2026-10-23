# Stage 1 — Product Specification

## 1. Product concept

Build a unified university learning platform that helps students capture lecture knowledge, study with AI, collaborate with peers, and organize academic work.

The name is not chosen yet. Use a neutral internal project label such as `Campus Learning Platform` in code and documentation until the user chooses a verified brand name. Do not bake a candidate brand into the architecture.

## 2. Audience and rollout

- Primary initial audience: university students in Ghana.
- First validation cohort: students at UMaT, Tarkwa.
- Long-term audience: university students internationally.
- The data model must support multiple universities, programmes, courses, academic levels, and semesters.
- Do not hard-code UMaT-specific course names or identifiers.

## 3. Core product pillars

### A. Lecture Studio
- Upload supported audio and video files.
- Upload supported lecture documents such as PDFs.
- Create a lecture record and attach it to a course.
- For audio/video, submit the media to a configured transcription service.
- Display processing states: queued, processing, completed, failed.
- Display transcript with timestamps if the provider returns them.
- Allow transcript editing and saving.
- Generate a summary only after transcript/text is available.
- Keep the original uploaded file private.
- Browser recording can be a later enhancement; do not promise background recording after a mobile browser is suspended.

### B. AI Study Lab
- Ask questions about a student's own lecture materials.
- Generate structured summaries.
- Generate flashcards.
- Generate quizzes with answer choices, correct answers, and explanations.
- Save generated resources to a course or personal library.
- Allow students to edit generated content.
- Track quiz attempts and scores.
- Show a reminder that AI output can be wrong and should be checked against course materials.

### C. Courses and Library
- Course list organized by semester.
- Course details with linked lectures, notes, files, flashcards, quizzes, tasks, and groups.
- Personal library of resources.
- Private files by default.
- Sharing must be explicit and permission-aware.

### D. Study Groups
- Create public/discoverable or private groups.
- Group fields: name, description, optional course, creator, visibility.
- Group roles: owner, moderator, member.
- Invite members using secure invite links or codes.
- Members can post discussions and share approved resources.
- Add scheduled study sessions.
- Group membership must be checked before reading private group data or accessing call links.

### E. Study Calls
- Integrate a call provider behind an adapter so it can be replaced.
- Initial exploration: Jitsi Meet, subject to public-service limits and terms.
- Do not promise a call service will be free forever or unlimited.
- A call room must belong to a study group or scheduled session.
- Show audio-only guidance for low bandwidth.
- Call integration is later than the core learning workflows.

### F. Planner and Progress
- Tasks and deadlines.
- Study-session schedule.
- Personal study goals.
- Quiz attempts and topic-level performance where meaningful.
- Progress should reflect actual recorded activity, not fabricated statistics.

## 4. Main navigation

- Dashboard
- My Courses
- Lecture Studio
- AI Study Lab
- Study Groups
- Library
- Planner
- My Progress
- Settings

Navigation may be adjusted after usability testing, but all core areas should remain discoverable.

## 5. Key user journeys

### Journey 1: First-time student
1. Register and verify email if email verification is enabled.
2. Complete profile.
3. Select university, programme, academic level, and semester.
4. Add or select courses.
5. Land on dashboard with a clear next action.

### Journey 2: Process a lecture
1. Open a course and select Add Lecture.
2. Upload a supported audio/video file or document.
3. Validate file type and size before upload.
4. Create a lecture record with processing status.
5. Transcribe media through the configured provider, or extract document text.
6. Save transcript/text privately.
7. Generate summary/flashcards/quiz through the AI Study Lab.
8. Let the student save or share outputs explicitly.

### Journey 3: Study with classmates
1. Create a group and select visibility.
2. Join by discovery or invitation.
3. View discussions and shared resources according to membership.
4. Schedule a session.
5. Join the session call only after server-side membership authorization.
6. Leave and optionally record attendance or notes.

### Journey 4: Prepare for an exam
1. Add exam date and relevant course.
2. Break revision into tasks.
3. Generate practice questions from course materials.
4. Complete quizzes and review explanations.
5. See genuine progress and revisit missed questions.

## 6. MVP boundaries

Include in the initial product:
- Authentication and onboarding
- Courses
- Dashboard
- Private lecture/resource uploads
- Audio/video transcription pipeline with a configured provider
- Document text extraction for supported PDFs
- AI summaries, flashcards, quizzes, and material Q&A
- Study groups, membership, basic discussions, and resource sharing
- Basic planner/tasks
- Basic quiz progress
- Responsive UI and security controls

Implement in later stages:
- Embedded audio/video calls
- Live transcription
- Advanced collaborative editing/whiteboard
- OCR for scanned PDFs
- Complex analytics and recommendation systems
- Native iOS/Android applications
- Payments and premium tiers

## 7. Out of scope for first release

- University official student information system integrations
- Automatic access to restricted course portals
- Scraping arbitrary video/audio links without rights or a supported downloadable source
- Guaranteeing transcription accuracy
- Automatic grading of high-stakes examinations
- Payments until usage and operating costs are understood

## 8. Acceptance criteria

A student can register, set up courses, upload a supported lecture file, get a transcript or extracted text, generate a study resource, save it privately, and share selected materials with a permitted study group. All visible features must either work or clearly state that configuration is missing.
