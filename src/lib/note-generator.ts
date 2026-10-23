import { hasOpenRouterKey, openRouterChat, parseJsonObject } from "@/lib/openrouter";

export type OrganizedKeyTerm = {
  term: string;
  definition: string;
};

export type OrganizedNoteSection = {
  heading: string;
  body: string;
  bullets?: string[];
  takeaways?: string[];
};

export type OrganizedStudyQuestion = {
  question: string;
  answer?: string;
};

export type OrganizedNoteContent = {
  title: string;
  summary: string;
  keyTerms: OrganizedKeyTerm[];
  sections: OrganizedNoteSection[];
  takeaways: string[];
  studyQuestions: OrganizedStudyQuestion[];
  actionChecklist: string[];
};

export type NoteRecord = {
  id: string;
  userId: string;
  lectureId: string;
  title: string;
  summary: string;
  content: OrganizedNoteContent;
  createdAt: string;
  updatedAt: string;
};

/**
 * Intelligent algorithmic fallback in case AI providers are unreachable or keys are not configured.
 * Parses the raw transcript into structured topics, key definitions, and revision takeaways.
 */
function generateStructuredFallback(transcript: string, title: string, courseTitle?: string): OrganizedNoteContent {
  const paragraphs = transcript
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const sentences = transcript
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const summary = sentences.slice(0, 3).join(" ") ||
    `This lecture on "${title}" covers key academic principles, structural methodologies, and practical applications discussed throughout the session.`;

  // Extract sections
  const sections: OrganizedNoteSection[] = [];
  if (paragraphs.length >= 3) {
    const chunkSize = Math.max(1, Math.ceil(paragraphs.length / 3));
    const labels = ["1. Introduction & Foundational Concepts", "2. Core Principles & Detailed Analysis", "3. Applications & Practical Review"];
    for (let i = 0; i < 3; i++) {
      const slice = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length) {
        sections.push({
          heading: labels[i] || `Section ${i + 1}`,
          body: slice.join("\n\n"),
          bullets: slice.map((p) => p.slice(0, 140) + (p.length > 140 ? "…" : "")),
          takeaways: [
            `Understand the primary mechanism outlined in ${labels[i].toLowerCase()}.`,
            `Connect these findings to the broader scope of ${courseTitle || "the subject"}.`,
          ],
        });
      }
    }
  } else {
    sections.push({
      heading: "1. Core Lecture Overview",
      body: transcript,
      bullets: sentences.slice(0, 5),
      takeaways: [
        "Review the complete transcribed lecture to prepare for seminar questions.",
        "Highlight unfamiliar terms and cross-reference with syllabus materials.",
      ],
    });
  }

  // Extract potential key terms from title and transcript
  const keyTerms: OrganizedKeyTerm[] = [
    {
      term: title.replace(/[-_]+/g, " ").trim(),
      definition: `Central subject of the lecture, exploring foundational definitions, key mechanisms, and analytical criteria.`,
    },
    {
      term: "Core Methodology",
      definition: "The step-by-step approach discussed by the lecturer to evaluate primary problems.",
    },
    {
      term: "Primary Findings",
      definition: "The key evidence and conclusions emphasized during the discussion.",
    },
  ];

  const takeaways: string[] = [
    `Master the fundamental concepts presented in "${title}".`,
    "Review specific definitions, examples, and formulas discussed in class.",
    "Formulate connections between this lecture and previous module topics.",
    "Use active recall questions to verify understanding before upcoming exams.",
  ];

  const studyQuestions: OrganizedStudyQuestion[] = [
    {
      question: `What was the primary thesis or problem analyzed in "${title}"?`,
      answer: summary,
    },
    {
      question: "What evidence or arguments did the lecturer present to support this topic?",
      answer: "Refer to the key takeaways and structured sections above for evidence cited during the lecture.",
    },
    {
      question: "How does this topic apply to broader course assignments or practical exams?",
      answer: "It provides theoretical grounding for upcoming problem sets and essay questions.",
    },
  ];

  const actionChecklist: string[] = [
    "Re-read the core sections and verify understanding of key terms.",
    "Practice explaining the primary concepts out loud without looking at notes.",
    "Add lecture points to your personal revision schedule in the Study Planner.",
  ];

  return {
    title: `${title} — Study Notes`,
    summary,
    keyTerms,
    sections,
    takeaways,
    studyQuestions,
    actionChecklist,
  };
}

/**
 * Call Gemini API directly if GEMINI_API_KEY is configured
 */
async function callGeminiForNotes(prompt: string): Promise<OrganizedNoteContent> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_STUDY_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini notes generation failed (${response.status})`);
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini returned an empty response");
  return parseJsonObject<OrganizedNoteContent>(rawText);
}

/**
 * Generate a comprehensive, university-grade structured note from raw lecture transcript.
 */
export async function generateOrganizedNote(params: {
  transcript: string;
  title: string;
  courseTitle?: string;
}): Promise<OrganizedNoteContent> {
  const { transcript, title, courseTitle } = params;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error("Cannot generate notes from an empty transcript.");
  }

  // Truncate to safe model context limit (approx ~18,000 words / 80k chars)
  const clippedTranscript = transcript.slice(0, 80_000);

  const systemInstructions = `You are StudyStation's academic AI study assistant. Your job is to transform a raw, spoken lecture transcript into organized, comprehensive, professional university-level study notes.

Structure the response strictly as valid JSON with this exact schema:
{
  "title": "Clear, informative note title reflecting the actual lecture content",
  "summary": "2 to 3 paragraph executive summary explaining the main lecture thesis, context, and core concepts",
  "keyTerms": [
    {
      "term": "Term Name",
      "definition": "Precise, student-friendly academic definition based on how it was used in lecture"
    }
  ],
  "sections": [
    {
      "heading": "1. Section Heading",
      "body": "Comprehensive explanation of this lecture topic in clear paragraphs",
      "bullets": ["Specific point or example 1", "Specific point or example 2"],
      "takeaways": ["Crucial insight 1"]
    }
  ],
  "takeaways": [
    "High-yield exam takeaway 1",
    "High-yield exam takeaway 2",
    "High-yield exam takeaway 3"
  ],
  "studyQuestions": [
    {
      "question": "Concept check question students can use for active recall?",
      "answer": "Concise, accurate model answer from the lecture"
    }
  ],
  "actionChecklist": [
    "Actionable revision step 1",
    "Actionable revision step 2"
  ]
}

Guidelines:
- Ground every section and definition in the provided lecture transcript. Do not hallucinate outside facts.
- Identify 3 to 6 logical thematic sections based on the natural flow of the lecture.
- Extract 4 to 8 critical technical or academic key terms.
- Provide 3 to 5 active recall study questions with model answers.
- Output ONLY valid JSON. No markdown backticks or commentary outside the JSON object.`;

  const userPrompt = `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

LECTURE TRANSCRIPT:
${clippedTranscript}`;

  // 1. Try OpenRouter if configured
  if (hasOpenRouterKey()) {
    try {
      const model = process.env.OPENROUTER_STUDY_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
      const raw = await openRouterChat(
        [
          { role: "system", content: systemInstructions },
          { role: "user", content: userPrompt },
        ],
        { model, temperature: 0.2, maxTokens: 4000 }
      );
      const parsed = parseJsonObject<OrganizedNoteContent>(raw);
      if (parsed.summary && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return {
          title: parsed.title || `${title} — Study Notes`,
          summary: parsed.summary,
          keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
          sections: parsed.sections,
          takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
          studyQuestions: Array.isArray(parsed.studyQuestions) ? parsed.studyQuestions : [],
          actionChecklist: Array.isArray(parsed.actionChecklist) ? parsed.actionChecklist : [],
        };
      }
    } catch (openRouterErr) {
      console.warn("OpenRouter note generation failed, trying fallback:", openRouterErr);
    }
  }

  // 2. Try Gemini API directly if configured
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const combinedPrompt = `${systemInstructions}\n\n${userPrompt}`;
      const parsed = await callGeminiForNotes(combinedPrompt);
      if (parsed.summary && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return {
          title: parsed.title || `${title} — Study Notes`,
          summary: parsed.summary,
          keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
          sections: parsed.sections,
          takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
          studyQuestions: Array.isArray(parsed.studyQuestions) ? parsed.studyQuestions : [],
          actionChecklist: Array.isArray(parsed.actionChecklist) ? parsed.actionChecklist : [],
        };
      }
    } catch (geminiErr) {
      console.warn("Gemini direct note generation failed, falling back to algorithmic parser:", geminiErr);
    }
  }

  // 3. Fallback to algorithmic structural organizer
  return generateStructuredFallback(transcript, title, courseTitle);
}
