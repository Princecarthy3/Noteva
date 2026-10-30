type Message = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string };
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1";

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");

  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
    "X-OpenRouter-Title": "StudyStation",
  };
}

export function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function openRouterChat(messages: Message[], options?: { model?: string; temperature?: number; maxTokens?: number }) {
  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: options?.model ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
      messages,
      temperature: options?.temperature ?? 0.25,
      max_tokens: options?.maxTokens ?? (process.env.OPENROUTER_MAX_TOKENS ? Number(process.env.OPENROUTER_MAX_TOKENS) : 900),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = await response.json().catch(() => null) as OpenRouterResponse | null;
  if (!data) throw new Error(`OpenRouter returned an unreadable response (${response.status})`);
  if (!response.ok) throw new Error(data.error?.message ?? `OpenRouter request failed (${response.status})`);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  throw new Error("OpenRouter returned an empty response");
}

export async function openRouterTranscribe(data: string, format: string) {
  const response = await fetch(`${OPENROUTER_URL}/audio/transcriptions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: process.env.OPENROUTER_TRANSCRIPTION_MODEL ?? "openai/whisper-large-v3",
      input_audio: { data, format },
      response_format: "json",
      temperature: 0,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const result = await response.json() as { text?: string; error?: { message?: string }; usage?: Record<string, number> };
  if (!response.ok) throw new Error(result.error?.message ?? `Transcription failed (${response.status})`);
  if (!result.text) throw new Error("The transcription model returned no text");
  return { ...result, text: result.text };
}

export function parseJsonObject<T>(value: string): T {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response did not contain valid JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

