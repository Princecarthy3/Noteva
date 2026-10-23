# Stage 8 — AI Study Lab

## 1. Goal

Turn the student's authorized course content into useful study materials with predictable, validated outputs.

## 2. Initial tasks

- Summary: structured headings, key concepts, definitions, examples, and revision checklist.
- Explain: explain a selected concept at the student's requested level.
- Ask: answer a question using selected source material.
- Flashcards: front/back pairs.
- Quiz: multiple-choice questions with answer key and explanations.
- Simplify: rephrase difficult material without claiming the source says more than it does.

## 3. OpenRouter integration

- Call OpenRouter only from a server route/action.
- Store the API key in a server-only environment variable.
- Keep the model ID configurable.
- Confirm the chosen model supports the required task before using it.
- Handle unavailable/free models, rate limits, provider errors, malformed output, and timeouts.
- Never promise a model will remain free.
- Set request size and usage limits.
- Do not send unrelated personal data to the provider.

## 4. Context selection

- User chooses the lecture/resources to use.
- Verify the user owns or has explicit access to each source.
- For long transcripts, chunk content and retrieve relevant portions.
- Include source labels or timestamps when feasible.
- Do not send an entire large document if only a small section is needed.
- Make it clear when an answer is based only on the selected materials versus general model knowledge.

## 5. Structured output

Use a strict schema and validate responses server-side.

Example flashcard shape:
```json
{
  "cards": [
    {
      "front": "What is a CPU register?",
      "back": "A small, fast storage location inside the processor."
    }
  ]
}
```

Example quiz shape:
```json
{
  "title": "Computer Architecture Revision",
  "questions": [
    {
      "question": "Which component performs arithmetic operations?",
      "choices": ["ALU", "RAM", "SSD", "Monitor"],
      "correctIndex": 0,
      "explanation": "The ALU performs arithmetic and logical operations."
    }
  ]
}
```

Treat examples as formats, not fixed content. Validate number of cards/questions, text lengths, choices, and correct answer indexes. Do not trust model output without validation.

## 6. User experience

- Task selector and source-material selector.
- Optional instructions and difficulty.
- Progress/status state.
- Editable generated output.
- Save to course or library.
- Share to a group only after explicit confirmation and permission checks.
- Quiz-taking screen with result review.
- Explain incorrect answers.
- Show an AI reliability notice.

## 7. Usage control

- Enforce server-side per-user limits.
- Apply file/text limits.
- Store model identifier, task type, token/usage metadata if returned, and status.
- Avoid storing unnecessary raw prompts or sensitive content.
- Return helpful messages when usage limits are reached.
- Avoid automatic repeated retries that could multiply cost.

## 8. Safety and academic integrity

- Do not market outputs as guaranteed correct.
- Encourage checking against official lecture materials.
- Keep user-generated and AI-generated content distinguishable.
- Do not facilitate cheating on active, restricted assessments. Focus on revision, explanations, and practice.

## 9. Acceptance criteria

- Each task works on a small selected source.
- Malformed AI output is handled safely.
- User cannot use another student's private source by supplying its ID.
- Generated content can be edited, saved, and deleted.
- Rate limits and missing configuration have clear UI states.
