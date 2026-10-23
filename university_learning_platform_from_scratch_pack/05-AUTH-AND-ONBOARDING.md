# Stage 5 — Authentication and Student Onboarding

## 1. Scope

Implement a reliable account lifecycle and a short onboarding flow that collects enough academic context to personalize the product without making signup exhausting.

## 2. Authentication

- Email/password registration and login through Supabase Auth.
- Email verification behavior must match the project's Supabase settings.
- Password reset flow with a verified redirect URL and update-password page.
- Logout.
- Clear invalid/expired-link errors.
- Protected app routes redirect unauthenticated users to login.
- Authenticated users should not be stuck in a redirect loop.
- Do not invent Google/Apple/Microsoft OAuth configuration. Add OAuth only after credentials and redirect URLs are configured.

## 3. Profile fields

Minimum:
- Display name
- University
- Country
- Programme/department (free text initially if no canonical dataset exists)
- Academic level/year
- Current semester (optional)
- Timezone if needed for scheduling

Do not require student ID, date of birth, or other sensitive fields unless there is a clear product requirement.

## 4. Onboarding flow

1. Welcome screen explains the product in one sentence.
2. Student enters display name.
3. Student selects university/country; allow “My university isn't listed.”
4. Student enters programme and academic level.
5. Student adds/selects courses.
6. Show a completion screen and take them to dashboard.

Allow users to skip non-essential fields and finish later. Save progress so refresh does not lose the flow.

## 5. Validation and access

- Validate all inputs server-side.
- Use stable university/course IDs where available.
- Treat free-text programme and level as untrusted input.
- A user can update their own profile but cannot set admin/role fields.
- Use RLS and server-side checks.
- Avoid leaking whether arbitrary emails are registered in password reset responses.

## 6. UI states

Handle:
- Loading
- Duplicate/invalid email
- Weak password
- Verification required
- Expired reset link
- Missing academic data
- Failed profile save
- Existing profile/onboarding already completed

## 7. Acceptance tests

- Register a new account.
- Complete verification if enabled.
- Log in and log out.
- Refresh a protected route while signed in.
- Open a protected route signed out.
- Complete onboarding and verify profile/course records.
- Reset password with valid and expired links.
- Verify a second user cannot edit the first user's profile.
