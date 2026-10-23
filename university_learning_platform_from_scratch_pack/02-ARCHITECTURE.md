# Stage 2 — Architecture and Repository Structure

## 1. Architecture goals

- One Next.js application and one shared account system.
- Server-side control over data access and AI/provider calls.
- Supabase as the primary application database and private file store.
- Clear separation between product features and external provider adapters.
- Small vertical slices that can be tested independently.

## 2. Recommended structure

Adapt to the existing repository instead of forcing an exact structure if it already has a sound convention.

```text
src/
  app/
    (marketing)/
      page.tsx
    (auth)/
      login/page.tsx
      register/page.tsx
      onboarding/page.tsx
    (app)/
      dashboard/page.tsx
      courses/page.tsx
      courses/[courseId]/page.tsx
      lecture-studio/page.tsx
      lectures/[lectureId]/page.tsx
      ai-study/page.tsx
      groups/page.tsx
      groups/[groupId]/page.tsx
      library/page.tsx
      planner/page.tsx
      progress/page.tsx
      settings/page.tsx
    api/
      lectures/route.ts
      lectures/[lectureId]/process/route.ts
      ai/generate/route.ts
      groups/route.ts
      groups/[groupId]/sessions/route.ts
  components/
    layout/
    navigation/
    ui/
    forms/
    feedback/
  features/
    auth/
    courses/
    lectures/
    ai-study/
    groups/
    calls/
    planner/
    progress/
  lib/
    supabase/
    ai/
    transcription/
    calls/
    validation/
    security/
  types/
supabase/
  migrations/
  seed.sql (development-only if needed)
```

## 3. Supabase clients

Use the supported Supabase SSR approach appropriate to the installed package versions.

- Browser client: only for operations safe for an authenticated browser session.
- Server client: for route handlers, server components, and actions using the request's auth cookies.
- Admin/service-role client: only when truly needed, server-only, and never for routine user operations that can use RLS.
- Middleware/proxy: follow the current Next.js and Supabase guidance for refreshing auth sessions. Do not blindly copy outdated middleware examples.

Inspect installed package versions before coding. Avoid mixing incompatible examples from older tutorials.

## 4. External service adapters

Create interfaces around providers so business logic does not depend on one vendor.

### AI adapter
- Accept a validated task type and bounded text/context.
- Call OpenRouter only on the server.
- Validate response shape.
- Normalize provider errors.
- Apply usage limits and safe timeouts.
- Never send secrets or unrelated user data.

### Transcription adapter
- Accept an authorized private media object.
- Check file type, size, and user ownership.
- Submit job or process file according to provider capabilities.
- Normalize statuses and transcript format.
- Support retryable vs terminal failures.
- Do not log raw transcript or media contents.

### Calls adapter
- Return a provider-specific join configuration only after checking user membership.
- Prefer short-lived provider tokens if supported.
- Do not expose provider secrets to the browser.
- For Jitsi public rooms, use unpredictable room identifiers and understand that room names alone are not equivalent to application authorization. Do not put confidential data in a room unless the chosen setup provides appropriate access controls.

## 5. Processing long lectures

Do not send an unlimited lecture transcript in a single prompt.

- Enforce file size and duration limits.
- Use asynchronous jobs for long processing when needed.
- Store processing state and errors.
- Chunk long text and retain source offsets/timestamps where possible.
- Use retrieval or selected chunks for Q&A.
- Let the user retry failed jobs without duplicate charges where feasible.
- Record usage metadata but avoid storing provider secrets or sensitive logs.

## 6. API conventions

- Validate all request bodies and URL parameters.
- Authenticate before private reads/writes.
- Authorize resource ownership/group membership.
- Return consistent status codes and useful, non-sensitive error messages.
- Rate-limit expensive endpoints.
- Keep server-only modules separate from client-importable code.
- Do not trust IDs sent by the browser without verifying access.

## 7. State and data ownership

- A user owns their profile and private materials.
- Course enrollment links a student to a course.
- Group visibility and membership determine group content access.
- Sharing a private resource into a group must be explicit.
- AI outputs should record owner, source resource(s), task type, and creation time.
- Call membership is validated server-side at join time.

## 8. Architecture acceptance criteria

- A clean build works from documented setup.
- No provider secret is included in client bundles.
- Each provider has a narrow adapter and clear configuration state.
- Private access depends on verified user/session and RLS, not UI hiding.
