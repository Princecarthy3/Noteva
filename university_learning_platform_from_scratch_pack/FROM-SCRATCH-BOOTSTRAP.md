# Build the Application From Scratch

This file is the required starting point when the project contains no reusable application code.

## Goal

Create a brand-new, working foundation for the university learning platform. Do not assume that any application source code, package configuration, database schema, or components already exist. The Markdown files in this pack are planning instructions, not reusable application code.

## Stage A — Choose and inspect the project folder

1. Ask the user for the intended project folder only if it is not clear from the current task.
2. List the folder contents before writing anything.
3. Preserve this implementation pack and all `.md` files.
4. If the folder is empty apart from planning documents, initialize the app in that folder without deleting the documents. If that would mix concerns, create the app in a clearly named child folder such as `web/` and explain that choice first.
5. Never overwrite an existing unrelated project.

## Stage B — Initialize the application

Use the current stable Next.js App Router, TypeScript, and Tailwind CSS setup supported by the official create-next-app tool. Enable strict TypeScript and ESLint. Use the package manager already installed/selected by the user; otherwise use npm for beginner-friendly commands. Do not copy a stale package manifest from a tutorial.

Before running the initializer, explain the exact command and target directory. Run it, then verify that the app starts locally. If the initializer asks interactive questions, choose App Router, TypeScript, Tailwind CSS, and the recommended current defaults unless a compatibility issue requires another choice.

## Stage C — Establish a minimal running baseline

Create only the initial foundation:

- a clean landing page that identifies the project as a university learning platform;
- a responsive layout and basic navigation shell;
- a small, consistent design-token setup;
- accessible loading, empty, and error patterns where relevant;
- `.env.example` with placeholders only;
- a README with install, development, lint, typecheck (if configured), and build commands;
- an updated `PROJECT-STATUS.md`.

Do not build fake sign-in, fake transcription, fake AI answers, or pretend integrations. Features requiring credentials should show a clear setup state until configured.

## Stage D — Verify before proceeding

Run the scripts that actually exist in `package.json`, at minimum development startup and production build, plus lint/typecheck when configured. Fix errors introduced by the work. Report exact results and any checks that could not run.

## Stage E — Stop

Stop after the minimal baseline. Do not implement the database, authentication, lecture transcription, AI tools, groups, calls, or planner until the user asks for the corresponding stage. Keep `PROJECT-STATUS.md` accurate.

## Important constraints

- Never put API keys in client-side code or commit real secrets.
- Do not assume paid services are available.
- Keep the architecture compatible with deployment to Vercel, but do not claim deployment is complete unless it was actually performed.
- Prefer small changes and beginner-friendly explanations.
