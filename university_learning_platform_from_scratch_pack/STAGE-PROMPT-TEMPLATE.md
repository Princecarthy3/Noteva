> This is a from-scratch project unless the user explicitly says otherwise. Do not assume reusable app code exists. Preserve the Markdown specification pack.

# Reusable Prompt for Each Stage

Use this template when asking your AI coding agent to implement a stage.

Read:
- `00-MASTER-INSTRUCTIONS.md`
- The relevant numbered stage file
- `PROJECT-STATUS.md`

Implement **only the next incomplete stage**. Inspect the current code before editing. Reuse existing working code and avoid unrelated refactors.

Requirements:
1. Meet every acceptance criterion in the stage file.
2. Validate permissions server-side and with RLS where applicable.
3. Include loading, empty, success, and error states.
4. Do not expose secrets or invent provider configuration.
5. Run the project's typecheck, lint, tests, and production build where available.
6. Fix errors caused by your changes.
7. Update `PROJECT-STATUS.md`.
8. Tell me exactly which environment variables or dashboard settings I must configure.
9. Give beginner-friendly manual test instructions.
10. Stop after this stage and wait for me.

If a critical decision or credential is missing, implement the safe parts and clearly identify the blocker instead of guessing.
