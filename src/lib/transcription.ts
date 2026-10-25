import { hasOpenRouterKey, openRouterChat, openRouterTranscribe, parseJsonObject } from "@/lib/openrouter";

export type LectureMediaType = "audio" | "recording" | "video";
export type NormalizedTranscript = {
  text: string;
  segments: null;
  language: null;
};

const audioFormats: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/flac": "flac",
  "video/webm": "webm",
  "video/mp4": "mp4",
};

export function hasTranscriptionKey(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    hasOpenRouterKey()
  );
}

export function getTranscriptionConfigurationError(_sourceType?: LectureMediaType) {
  if (!hasTranscriptionKey()) {
    return "Voice transcription is not configured yet. Add a free GROQ_API_KEY (from console.groq.com) or GEMINI_API_KEY to your .env.local file, then retry.";
  }
  return null;
}

/**
 * Transcribe audio using Groq Cloud's free Whisper API (https://console.groq.com).
 * Free, extremely fast (~2 seconds), and highly accurate.
 */
async function transcribeWithGroq(input: {
  bytes: Buffer;
  cleanMime: string;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const ext = audioFormats[input.cleanMime] ?? (
    input.cleanMime.includes("wav") ? "wav" :
    input.cleanMime.includes("mp4") || input.cleanMime.includes("m4a") ? "m4a" :
    input.cleanMime.includes("mpeg") || input.cleanMime.includes("mp3") ? "mp3" :
    input.cleanMime.includes("flac") ? "flac" :
    input.cleanMime.includes("ogg") ? "ogg" : "webm"
  );

  const model = process.env.GROQ_TRANSCRIPTION_MODEL?.trim() || "whisper-large-v3-turbo";
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(input.bytes)], { type: input.cleanMime }),
    `recording.${ext}`
  );
  formData.append("model", model);
  formData.append("response_format", "json");
  formData.append("temperature", "0");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(240_000),
  });

  const data = (await response.json()) as { text?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Groq Whisper transcription failed (${response.status})`);
  }
  if (!data.text || !data.text.trim()) {
    throw new Error("Groq Whisper returned an empty transcript");
  }
  return data.text.trim();
}

/**
 * Transcribe audio using Google Gemini API (https://aistudio.google.com).
 * 100% free tier, native multimodal audio understanding.
 */
async function transcribeWithGemini(input: {
  bytes: Buffer;
  cleanMime: string;
  title: string;
  courseTitle: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_TRANSCRIPTION_MODEL?.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are an expert lecture transcription assistant for university students. Accurately transcribe the supplied audio recording word-for-word. Format the transcript into clear, readable paragraphs. Preserve technical and academic terms accurately. Return strictly valid JSON with one key, transcript, containing the transcription text as a string. Do not add commentary or text outside the JSON object. Lecture title: "${input.title}"${input.courseTitle ? ` Course: "${input.courseTitle}"` : ""}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: input.cleanMime,
                data: input.bytes.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(240_000),
  });

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini transcription failed (${response.status})`);
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini returned an empty response");

  try {
    const parsed = parseJsonObject<{ transcript?: unknown }>(rawText);
    if (typeof parsed.transcript === "string" && parsed.transcript.trim()) {
      return parsed.transcript.trim();
    }
  } catch {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    if (cleaned) return cleaned;
  }

  throw new Error("Could not extract transcript from Gemini response");
}

async function transcribeWithMultimodalAI(input: {
  bytes: Buffer;
  cleanMime: string;
  title: string;
  courseTitle: string;
}): Promise<string> {
  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
  const raw = await openRouterChat([
    {
      role: "system",
      content:
        "You are an expert lecture transcription assistant for university students. Accurately transcribe the supplied audio or video recording word-for-word. Format the transcript into clear, readable paragraphs. Preserve technical and academic terms accurately. Return strictly valid JSON with one key, transcript, containing the transcription text as a string. Do not add commentary or text outside the JSON object.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Transcribe the lecture titled "${input.title}"${
            input.courseTitle ? ` for the course "${input.courseTitle}"` : ""
          }. Return JSON only: {"transcript":"..."}.`,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${input.cleanMime};base64,${input.bytes.toString("base64")}`,
          },
        },
      ],
    },
  ], { model, maxTokens: 4000, temperature: 0.1 });

  try {
    const result = parseJsonObject<{ transcript?: unknown }>(raw);
    if (typeof result.transcript === "string" && result.transcript.trim()) {
      return result.transcript.trim();
    }
  } catch {
    const fallbackText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    if (fallbackText) return fallbackText;
  }

  throw new Error("The AI provider did not return a valid transcript.");
}

async function transcribeSingleBuffer(input: {
  bytes: Buffer;
  cleanMime: string;
  sourceType: LectureMediaType;
  title: string;
  courseTitle: string;
}): Promise<string> {
  let text = "";
  const errors: string[] = [];

  // 1. Try Groq Cloud Whisper first if GROQ_API_KEY is configured (Fastest, 100% free)
  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      text = await transcribeWithGroq({
        bytes: input.bytes,
        cleanMime: input.cleanMime,
      });
    } catch (groqError) {
      const msg = groqError instanceof Error ? groqError.message : String(groqError);
      console.warn("Groq transcription failed, trying next provider:", msg);
      errors.push(`Groq: ${msg}`);
    }
  }

  // 2. Try Google Gemini API if GEMINI_API_KEY is configured (Free, multimodal)
  if (!text && process.env.GEMINI_API_KEY?.trim()) {
    try {
      text = await transcribeWithGemini({
        bytes: input.bytes,
        cleanMime: input.cleanMime,
        title: input.title,
        courseTitle: input.courseTitle,
      });
    } catch (geminiError) {
      const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.warn("Gemini transcription failed, trying next provider:", msg);
      errors.push(`Gemini: ${msg}`);
    }
  }

  // 3. Fallback to OpenRouter if configured and has credits
  if (!text && hasOpenRouterKey()) {
    const whisperModel = process.env.OPENROUTER_TRANSCRIPTION_MODEL;
    const audioFormat = audioFormats[input.cleanMime];

    if (whisperModel && audioFormat && input.sourceType !== "video") {
      try {
        const result = await openRouterTranscribe(input.bytes.toString("base64"), audioFormat);
        if (result.text && result.text.trim()) {
          text = result.text.trim();
        }
      } catch (whisperError) {
        const msg = whisperError instanceof Error ? whisperError.message : String(whisperError);
        console.warn("OpenRouter Whisper transcription failed:", msg);
        errors.push(`OpenRouter Whisper: ${msg}`);
      }
    }

    if (!text) {
      try {
        text = await transcribeWithMultimodalAI({
          bytes: input.bytes,
          cleanMime: input.cleanMime,
          title: input.title,
          courseTitle: input.courseTitle,
        });
      } catch (multimodalError) {
        const msg = multimodalError instanceof Error ? multimodalError.message : String(multimodalError);
        console.warn("OpenRouter multimodal transcription failed:", msg);
        errors.push(`OpenRouter Multimodal: ${msg}`);
      }
    }
  }

  if (!text || !text.trim()) {
    if (errors.length > 0) {
      throw new Error(`Transcription failed: ${errors[0]}`);
    }
    throw new Error("No speech could be detected in this recording, or transcription is not configured. Add a free GROQ_API_KEY in .env.local.");
  }

  return text.trim();
}

export async function transcribeLectureMedia(input: {
  bytes: Buffer;
  mimeType: string;
  sourceType: LectureMediaType;
  title: string;
  courseTitle: string;
  onProgress?: (message: string) => void | Promise<void>;
}): Promise<NormalizedTranscript> {
  const { splitMediaForTranscription } = await import("@/lib/audio-chunker");
  const chunks = await splitMediaForTranscription({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });

  if (chunks.length === 1) {
    await input.onProgress?.("Transcribing lecture…");
    const text = await transcribeSingleBuffer({
      bytes: chunks[0].bytes,
      cleanMime: chunks[0].mimeType,
      sourceType: input.sourceType,
      title: input.title,
      courseTitle: input.courseTitle,
    });
    return { text, segments: null, language: null };
  }

  const parts: string[] = [];
  for (const chunk of chunks) {
    await input.onProgress?.(
      `Transcribing part ${chunk.index + 1} of ${chunk.total}…`,
    );
    const partTitle = `${input.title} (part ${chunk.index + 1}/${chunk.total})`;
    const text = await transcribeSingleBuffer({
      bytes: chunk.bytes,
      cleanMime: chunk.mimeType,
      sourceType: input.sourceType === "video" ? "audio" : input.sourceType,
      title: partTitle,
      courseTitle: input.courseTitle,
    });
    if (text) parts.push(text);
  }

  if (!parts.length) {
    throw new Error("No speech could be detected across the lecture chunks.");
  }

  return {
    text: parts.join("

").trim(),
    segments: null,
    language: null,
  };
}
