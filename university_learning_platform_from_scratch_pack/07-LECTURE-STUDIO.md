# Stage 7 — Lecture Studio: Uploads and Transcription

## 1. Goal

Provide a dependable workflow for turning lecture recordings and documents into searchable study content. Transcription and AI generation are separate jobs.

## 2. Supported input types

Initially support a conservative list of file types validated against the chosen provider, such as:
- Audio: MP3, WAV, M4A, WebM if provider-supported.
- Video: MP4, WebM if provider-supported.
- Documents: text-based PDF; other document formats only if explicitly supported.

Do not assume every provider supports every codec, file size, duration, or URL. Document the current configured limits in the UI and configuration docs.

External links:
- Do not claim every URL can be transcribed.
- Accept only supported, authorized sources and only where the provider can access the media.
- Avoid scraping login-protected or copyrighted content without authorization.

## 3. Upload flow

1. Student chooses a course (optional if not ready).
2. Student adds a title.
3. Student selects a file.
4. Validate size, extension, MIME type, and ownership context.
5. Upload to private storage using a secure method.
6. Create lecture database record with `queued` or equivalent status.
7. Submit processing job through server-side adapter.
8. Poll or receive provider status safely.
9. Store transcript text/segments and update status.
10. Display result and next actions.

Use a robust approach for large files; avoid sending large binary data through a route handler if direct signed upload is more appropriate.

## 4. Processing statuses

Recommended statuses:
- `uploaded`
- `queued`
- `processing`
- `completed`
- `failed`

Document legal transitions and prevent arbitrary client status updates.

## 5. Transcription adapter

Create a provider-neutral interface. Provider-specific code must be server-only.

Responsibilities:
- Verify user authorization.
- Confirm provider configuration.
- Submit job or process file.
- Store provider job reference.
- Fetch result safely.
- Normalize transcript and timestamps.
- Map errors to safe user-facing messages.
- Support retry when appropriate.

Never return provider API keys or internal diagnostic details to the browser.

## 6. PDF/document extraction

- Detect whether the PDF contains extractable text.
- If it is scanned/image-only, tell the user OCR is not supported yet rather than returning an empty “successful” transcript.
- Apply page/text limits.
- Avoid processing encrypted or malformed documents unsafely.
- Store extracted text with source metadata.

## 7. Transcript interface

- Show processing status and error/retry actions.
- Display transcript text in readable sections.
- Show timestamps when available.
- Allow editing and saving.
- Support copying and downloading text where appropriate.
- Allow “Generate summary” and “Create quiz” only when usable text exists.
- Clearly distinguish original transcript from AI-generated summary.

## 8. Privacy and deletion

- Original media is private by default.
- Delete access must be verified server-side.
- Define whether deleting a lecture also deletes derived AI outputs or warns the user first.
- Don't log transcripts or audio contents.
- Tell users that media may be processed by a third-party transcription provider.

## 9. Acceptance criteria

- A supported file can be uploaded and processed when provider credentials are configured.
- Missing provider configuration yields a clear setup message.
- Unsupported file type/size is rejected.
- Failure is recoverable without exposing secrets.
- A second user cannot access the first user's media or transcript.
