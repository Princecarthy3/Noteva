type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiStudyModel(): string {
  return (
    process.env.GEMINI_STUDY_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-3.5-flash-lite"
  );
}

/**
 * Universal chat completion using Google Gemini API.
 * Supports system instructions, multi-turn messages, custom token limits, and JSON mode.
 */
export async function geminiChat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server");

  const model = options?.model ?? getGeminiStudyModel();

  // Extract system messages and conversation messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const systemText = systemMessages
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .filter(Boolean)
    .join("\n\n");

  const contents = conversationMessages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return {
      role,
      parts: [{ text }],
    };
  });

  if (contents.length === 0 && systemText) {
    contents.push({
      role: "user",
      parts: [{ text: systemText }],
    });
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.25,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
      ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      thinkingConfig: { thinkingLevel: model.includes("flash-lite") ? "minimal" : "low" },
    },
  };

  if (systemText && contents.length > 0 && contents[0].parts[0].text !== systemText) {
    payload.systemInstruction = {
      parts: [{ text: systemText }],
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });

  const data = (await response.json().catch(() => null)) as GeminiResponse | null;
  if (!data) throw new Error(`Gemini returned an unreadable response (${response.status})`);
  
  if (!response.ok) {
    // If the configured model is unavailable (e.g., 404), fallback to gemini-2.5-flash or gemini-3.8-flash
    if (response.status === 404 && model !== "gemini-2.5-flash") {
      return geminiChat(messages, { ...options, model: "gemini-2.5-flash" });
    }
    throw new Error(data.error?.message ?? `Gemini request failed (${response.status})`);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) {
    throw new Error(`Gemini returned an empty response${candidate?.finishReason ? ` (${candidate.finishReason})` : ""}`);
  }

  return text;
}

/**
 * Structured JSON generator using Google Gemini.
 */
export async function geminiGenerateJson(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = options?.model ?? getGeminiStudyModel();
  const text = await geminiChat(
    [{ role: "user", content: prompt }],
    {
      model,
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
    }
  );

  return { text, model };
}

/**
 * Robust JSON object parser that safely extracts JSON from AI responses even if wrapped in markdown blocks.
 */
export function parseJsonObject<T>(value: string): T {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response did not contain valid JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
