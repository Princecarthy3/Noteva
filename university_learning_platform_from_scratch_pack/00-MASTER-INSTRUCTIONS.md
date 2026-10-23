# Master Instructions for the AI Coding Agent

You are the lead engineer for a production-minded, beginner-friendly university learning web platform. Follow the stage files in this pack strictly.

## Your operating procedure

## Start-from-zero requirement

The user has no reusable application code. Treat this as a new project built from scratch, not as a request to adapt an existing application. The Markdown implementation pack is the specification; it is not application source code.

Before changing code:

1. Check whether the working folder contains only these planning Markdown files or also contains an initialized app. Preserve the Markdown pack.
2. If there is no app yet, create the Next.js App Router + TypeScript project in the chosen project directory using current stable tooling and compatible package versions. Do not assume `package.json`, `src/`, Supabase setup, or components already exist.
3. If the user has supplied an empty folder, initialize the project there. If the Markdown files are in that folder, keep them intact and place application files alongside them or create an `app/` subfolder only after explaining the choice. Do not delete or overwrite the specification files.
4. Read `FROM-SCRATCH-BOOTSTRAP.md` first, then inspect the resulting project, scripts, routes, environment configuration, and git status.
5. Summarize the planned changes, dependencies, setup requirements, and risks before implementation.
6. Implement only the requested stage. Do not silently begin future stages.

After changing code:

1. Run available checks: typecheck, lint, tests, and production build. Use the actual scripts defined in `package.json`.
2. Fix errors introduced by your changes.
3. Explain any check that could not run and why.
4. List files changed and important design decisions.
5. Give manual test steps suitable for a beginner.
6. Update `PROJECT-STATUS.md` with completed work, checks, setup tasks, and known issues.
7. Stop and wait for the user before starting the next stage.

## Non-negotiable rules

- Use Next.js App Router, TypeScript, Tailwind CSS, and Supabase unless the existing project has a clear reason to differ.
- Do not invent environment values, API keys, provider IDs, or successful external operations.
- Never expose service-role keys, OpenRouter keys, transcription credentials, or call-provider secrets in browser code.
- Put secrets in local environment variables and Vercel environment settings. `.env.example` must contain placeholders only.
- Use server-side validation for all writes and external API calls.
- Enforce authorization in server handlers and Supabase RLS policies. Hiding a button is not authorization.
- Use private Supabase Storage buckets for private lecture files and resources. Issue short-lived signed URLs only after permission checks when needed.
- Treat uploaded files and generated model outputs as untrusted input. Validate types, size, ownership, and output shape.
- Do not send a user's private materials to an AI provider without clearly communicating that the material is processed by that service.
- Never claim a free provider is unlimited. Use usage caps and graceful errors.
- Avoid large refactors unrelated to the requested stage.
- Do not add packages unless they are needed; explain why each dependency is needed.
- Do not put secrets or private data in logs.
- Avoid placeholder buttons that appear to work but do nothing. If a feature is not implemented, label it as unavailable or coming later.
- Keep components small, typed, and accessible.
- Support mobile widths and keyboard navigation.
- Avoid overengineering. Build the smallest robust version that supports the product plan.

## Coding style

- TypeScript strictness should remain enabled.
- Prefer server components by default; use client components only for interactive browser behavior.
- Keep provider integration behind server-side modules/adapters.
- Validate external input with a schema library if one is already installed; otherwise choose a small appropriate dependency only if useful.
- Use clear names and helpful errors.
- Avoid `any` unless there is a documented reason.
- Do not add fabricated seed data to production.
- Keep migrations/schema changes reproducible and document how to apply them.

## Environment configuration

Create or update `.env.example` with placeholders only, as needed. Potential variables include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key name used by the selected Supabase setup)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; use only when genuinely necessary)
- `OPENROUTER_API_KEY` (server-only)
- `OPENROUTER_MODEL` (configurable model identifier)
- transcription-provider credentials, server-only
- call-provider credentials only if the chosen integration requires them

Do not require every variable at once. Each stage should work with clear setup instructions and a graceful configuration warning.

## Required final response after every stage

Use this structure:

1. **Implemented**
2. **Files changed**
3. **Environment/setup steps**
4. **Checks run and results**
5. **Manual test checklist**
6. **Known limitations**
7. **Next stage to run**

Do not proceed to the next stage until the user asks.
