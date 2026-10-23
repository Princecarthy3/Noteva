export type StudyLabAction = "summary" | "explain" | "ask" | "flashcards" | "quiz" | "simplify";

export type SummaryOutput = {
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
  keyTerms: Array<{ term: string; definition: string }>;
  revisionChecklist: string[];
};

export type ExplanationOutput = {
  title: string;
  answer: string;
  keyPoints: string[];
};

export type FlashcardsOutput = {
  cards: Array<{ front: string; back: string }>;
};

export type QuizOutput = {
  title: string;
  questions: Array<{
    question: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
  }>;
};

export type StudyLabOutput = SummaryOutput | ExplanationOutput | FlashcardsOutput | QuizOutput;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function textList(value: unknown, min: number, max: number, maxLength: number) {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every((item) => text(item, maxLength));
}

export function validateStudyOutput(action: StudyLabAction, value: unknown): value is StudyLabOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;

  if (action === "summary") {
    return text(output.title, 160)
      && text(output.summary, 5000)
      && Array.isArray(output.sections)
      && output.sections.length >= 1
      && output.sections.length <= 12
      && output.sections.every((section) => section && typeof section === "object"
        && text((section as Record<string, unknown>).heading, 160)
        && text((section as Record<string, unknown>).body, 3000))
      && Array.isArray(output.keyTerms)
      && output.keyTerms.length <= 20
      && output.keyTerms.every((term) => term && typeof term === "object"
        && text((term as Record<string, unknown>).term, 160)
        && text((term as Record<string, unknown>).definition, 1000))
      && textList(output.revisionChecklist, 1, 15, 500);
  }

  if (action === "explain" || action === "ask" || action === "simplify") {
    return text(output.title, 160)
      && text(output.answer, 6000)
      && textList(output.keyPoints, 1, 12, 500);
  }

  if (action === "flashcards") {
    return Array.isArray(output.cards)
      && output.cards.length >= 3
      && output.cards.length <= 20
      && output.cards.every((card) => card && typeof card === "object"
        && text((card as Record<string, unknown>).front, 500)
        && text((card as Record<string, unknown>).back, 1200));
  }

  return text(output.title, 160)
    && Array.isArray(output.questions)
    && output.questions.length >= 3
    && output.questions.length <= 15
    && output.questions.every((question) => {
      if (!question || typeof question !== "object") return false;
      const item = question as Record<string, unknown>;
      return text(item.question, 600)
        && textList(item.choices, 4, 4, 300)
        && Number.isInteger(item.correctIndex)
        && (item.correctIndex as number) >= 0
        && (item.correctIndex as number) < 4
        && text(item.explanation, 1000);
    });
}
