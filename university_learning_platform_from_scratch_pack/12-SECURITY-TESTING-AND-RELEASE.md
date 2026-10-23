# Stage 12 — Security, Testing, and Release

## 1. Security checklist

- [ ] No secrets in Git, client bundles, screenshots, logs, or `.env.example`.
- [ ] Environment variables documented.
- [ ] RLS enabled and policies reviewed for all user-facing tables.
- [ ] Private storage buckets and policies tested.
- [ ] Server validates all IDs, payloads, MIME types, sizes, and roles.
- [ ] Rate limits or usage limits exist on expensive AI/transcription endpoints.
- [ ] Provider error messages do not leak credentials or internal diagnostics.
- [ ] Upload, delete, share, invite, and call actions verify authorization.
- [ ] User can delete their own data according to documented behavior.
- [ ] Third-party processing is disclosed.
- [ ] Logs avoid raw media, transcript content, and secrets.
- [ ] Dependency audit reviewed where available.

## 2. Testing checklist

### Automated
- [ ] TypeScript check.
- [ ] Lint.
- [ ] Production build.
- [ ] Unit tests for validators and provider response parsing.
- [ ] Tests for authorization helpers.
- [ ] Tests for AI output schemas.
- [ ] Tests for important server routes/actions.

### Manual
- [ ] New account and onboarding.
- [ ] Login/logout and password reset.
- [ ] Create/select course.
- [ ] Upload a supported lecture file.
- [ ] Handle unsupported file and missing provider config.
- [ ] Process a transcript and generate a study resource.
- [ ] Save, edit, delete, and share content.
- [ ] Create/join/leave group.
- [ ] Private group invite expiry/revocation.
- [ ] Join call as member and reject non-member.
- [ ] Create and complete task.
- [ ] Verify second account cannot access first account's private data.
- [ ] Test mobile layout and slow connection.
- [ ] Test keyboard navigation and visible focus.

## 3. Release strategy

1. Local development.
2. Private preview with test accounts and non-sensitive sample materials.
3. Small UMaT pilot with clear feedback channel.
4. Fix reliability and usability issues.
5. Invite more students gradually.
6. Review actual service usage and costs before promising a free public service at scale.

## 4. Deployment

- Set environment variables in local `.env.local` and hosting settings.
- Keep `.env.local` out of version control.
- Configure Supabase site URL and redirect allowlist correctly.
- Apply migrations deliberately and verify policies.
- Confirm the production build.
- Test auth redirects on the deployed domain.
- Test uploads, transcription, AI calls, and call provider in production configuration.
- Add a useful error/feedback path.
- Keep a rollback plan for schema and deployment changes.

## 5. Privacy and legal readiness

Before public launch, prepare:
- Privacy policy explaining collected data, storage, and third-party processing.
- Terms of use.
- Content and copyright rules.
- Community guidelines and reporting path.
- Retention/deletion explanation.
- Clear consent before any recording or transcription involving other people.
- Appropriate protection for minors if the product is used by younger students.

This document is not legal advice. Obtain qualified advice for obligations applicable to the actual launch locations and providers.

## 6. Release gate

Do not call the product production-ready until:
- Core flows work end-to-end.
- Authorization tests pass.
- Errors are recoverable and understandable.
- The deployed version is tested with non-owner accounts.
- Provider usage limits and fallback behavior are documented.
- No major known data-leak or account-access issue remains.
