type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
};

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiStudyModel() {
  return process.env.GEMINI_STUDY_MODEL?.trim()
    || process.env.GEMINI_MODEL?.trim()
    || "gemini-3.5-flash-lite";
}

export async function geminiGenerateJson(prompt: string, options?: {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = options?.model ?? getGeminiStudyModel();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxOutputTokens ?? 8192,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: model.includes("flash-lite") ? "minimal" : "low" },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await response.json().catch(() => null) as GeminiResponse | null;
  if (!data) throw new Error(`Gemini returned an unreadable response (${response.status})`);
  if (!response.ok) throw new Error(data.error?.message ?? `Gemini request failed (${response.status})`);

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error(`Gemini returned no text${candidate?.finishReason ? ` (${candidate.finishReason})` : ""}`);
  return { text, model };
}

