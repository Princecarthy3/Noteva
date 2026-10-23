# First Prompt to Give Your AI Coding Agent

We are building a brand-new university learning platform from scratch. I have **no reusable application code**. The Markdown files in this folder are specifications and instructions only; they are not an existing app. Do not assume there is a `package.json`, `src/` directory, working UI, database, or authentication setup.

Read these files first:
1. `00-MASTER-INSTRUCTIONS.md`
2. `FROM-SCRATCH-BOOTSTRAP.md`
3. `01-PRODUCT-SPEC.md`
4. `02-ARCHITECTURE.md`
5. `03-DESIGN-SYSTEM.md`
6. `PROJECT-STATUS.md`

First inspect the target folder and preserve all Markdown files. If no application exists, initialize a fresh Next.js App Router + TypeScript + Tailwind CSS project using current stable tooling. Explain the target directory and commands before running them. Then create only the minimal running foundation described in `FROM-SCRATCH-BOOTSTRAP.md`.

Do **not** attempt to implement the whole platform in one response. Do not start Supabase, authentication, transcription, AI features, groups, or calls until the foundation runs and I ask for the next stage.

After implementation, run the checks available in the project, update `PROJECT-STATUS.md`, and explain:
- what was created;
- the files changed;
- the exact commands I should run on Windows;
- which checks passed or failed;
- how I can verify the app in my browser;
- the next stage to request.

Never invent credentials, claim an external service works unless tested, or expose secret keys in browser code.
