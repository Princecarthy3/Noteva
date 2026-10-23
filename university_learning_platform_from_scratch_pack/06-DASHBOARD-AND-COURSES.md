# Stage 6 — Dashboard and Course Workspace

## 1. Dashboard purpose

The dashboard should answer:
- What should I work on today?
- What lecture or resource did I last use?
- What deadlines are coming up?
- What study sessions are scheduled?
- What is one useful next action?

Do not create fake statistics or hard-coded activity that looks real.

## 2. Dashboard sections

- Greeting and current academic context.
- Quick actions: Upload lecture, Open AI Study Lab, Create study group, Add task.
- Upcoming tasks/deadlines.
- Upcoming study sessions.
- Recently opened lectures/resources.
- Continue studying.
- Optional progress summary only when based on actual records.

Each section needs loading, empty, and error states.

## 3. Course list

- Show courses for the active semester.
- Add, edit, archive/remove from student's list.
- Search/filter by code or title.
- Handle an empty course list with a clear “Add your first course” action.
- Avoid duplicates for the same student/course/semester combination.

## 4. Course workspace

Tabs or sections:
- Overview
- Lectures
- Resources
- Flashcards
- Quizzes
- Tasks
- Study groups

Only render tabs that are implemented; disabled future features must be clearly labeled.

## 5. Data access

- Every course record must be scoped to the current user where required.
- If shared university courses are globally available, distinguish catalog data from a student's selected course list.
- Validate IDs and check ownership/membership for every operation.
- Do not expose other students' private resources simply because they share a course.

## 6. Acceptance criteria

- Dashboard reflects actual data.
- Empty states guide users to create their first course/task/upload.
- Course changes persist after refresh.
- The layout works on mobile.
- Unauthorized IDs cannot expose another user's data.
