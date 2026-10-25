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


const PROVIDER_CHUNK_BYTES = 20 * 1024 * 1024;

async function splitLongMedia(bytes: Buffer, mimeType: string): Promise<Array<{ bytes: Buffer; mimeType: string }>> {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (bytes.length <= PROVIDER_CHUNK_BYTES) {
    return [{ bytes, mimeType: mime }];
  }

  // WAV can be split without ffmpeg.
  if ((mime === "audio/wav" || mime === "audio/x-wav") && bytes.length >= 44) {
    const header = bytes.subarray(0, 44);
    const data = bytes.subarray(44);
    const piece = Math.max(1_000_000, PROVIDER_CHUNK_BYTES - 44);
    const chunks: Array<{ bytes: Buffer; mimeType: string }> = [];
    for (let offset = 0; offset < data.length; offset += piece) {
      const body = data.subarray(offset, offset + piece);
      const out = Buffer.alloc(44 + body.length);
      header.copy(out, 0, 0, 44);
      out.writeUInt32LE(36 + body.length, 4);
      out.writeUInt32LE(body.length, 40);
      body.copy(out, 44);
      chunks.push({ bytes: out, mimeType: mime });
    }
    return chunks.length ? chunks : [{ bytes, mimeType: mime }];
  }

  // Try ffmpeg segmentation for compressed formats when available on the server.
  try {
    const { spawn } = await import("node:child_process");
    const { mkdtemp, readFile, rm, writeFile, readdir } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");

    const ext =
      mime.includes("mpeg") || mime.includes("mp3") ? "mp3" :
      mime.includes("mp4") || mime.includes("m4a") ? "m4a" :
      mime.includes("ogg") ? "ogg" :
      mime.includes("flac") ? "flac" :
      mime.includes("wav") ? "wav" : "webm";

    const dir = await mkdtemp(path.join(tmpdir(), "ss-chunks-"));
    const inputPath = path.join(dir, `source.${ext}`);
    const pattern = path.join(dir, "chunk-%03d.wav");
    try {
      await writeFile(inputPath, bytes);
      await new Promise<void>((resolve, reject) => {
        const child = spawn("ffmpeg", [
          "-hide_banner", "-loglevel", "error", "-y",
          "-i", inputPath,
          "-ac", "1", "-ar", "16000",
          "-f", "segment", "-segment_time", "600",
          "-reset_timestamps", "1",
          pattern,
        ], { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("Audio segmentation timed out."));
        }, 8 * 60_000);
        child.stderr.on("data", (c) => { stderr += String(c); });
        child.on("error", (err) => { clearTimeout(timer); reject(err); });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
        });
      });

      const files = (await readdir(dir)).filter((n) => n.startsWith("chunk-") && n.endsWith(".wav")).sort();
      const chunks: Array<{ bytes: Buffer; mimeType: string }> = [];
      for (const file of files) {
        const part = await readFile(path.join(dir, file));
        if (part.length > 1000) chunks.push({ bytes: part, mimeType: "audio/wav" });
      }
      if (chunks.length) return chunks;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch (error) {
    console.warn("Long-media segmentation unavailable:", error instanceof Error ? error.message : error);
  }

  // Fallback: single pass if still under hard provider-ish ceiling, else fail clearly.
  if (bytes.length <= 25 * 1024 * 1024) {
    return [{ bytes, mimeType: mime }];
  }
  throw new Error(
    "This lecture is too long for a single transcription pass and automatic splitting is unavailable. Convert the file to WAV (or split it into parts under ~25 MB each) and upload again. WAV files can be split automatically without extra server tools.",
  );
}

export async function transcribeLectureMedia(input: {
  bytes: Buffer;
  mimeType: string;
  sourceType: LectureMediaType;
  title: string;
  courseTitle: string;
  onProgress?: (message: string) => void | Promise<void>;
}): Promise<NormalizedTranscript> {
  const chunks = await splitLongMedia(input.bytes, input.mimeType);

  async function transcribeOne(bytes: Buffer, cleanMime: string, title: string): Promise<string> {
    let text = "";
    const errors: string[] = [];

    if (process.env.GROQ_API_KEY?.trim()) {
      try {
        text = await transcribeWithGroq({ bytes, cleanMime });
      } catch (groqError) {
        const msg = groqError instanceof Error ? groqError.message : String(groqError);
        console.warn("Groq transcription failed, trying next provider:", msg);
        errors.push(`Groq: ${msg}`);
      }
    }

    if (!text && process.env.GEMINI_API_KEY?.trim()) {
      try {
        text = await transcribeWithGemini({
          bytes,
          cleanMime,
          title,
          courseTitle: input.courseTitle,
        });
      } catch (geminiError) {
        const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        console.warn("Gemini transcription failed, trying next provider:", msg);
        errors.push(`Gemini: ${msg}`);
      }
    }

    if (!text && hasOpenRouterKey()) {
      const whisperModel = process.env.OPENROUTER_TRANSCRIPTION_MODEL;
      const audioFormat = audioFormats[cleanMime];
      if (whisperModel && audioFormat && input.sourceType !== "video") {
        try {
          const result = await openRouterTranscribe(bytes.toString("base64"), audioFormat);
          if (result.text && result.text.trim()) text = result.text.trim();
        } catch (whisperError) {
          const msg = whisperError instanceof Error ? whisperError.message : String(whisperError);
          console.warn("OpenRouter Whisper transcription failed:", msg);
          errors.push(`OpenRouter Whisper: ${msg}`);
        }
      }
      if (!text) {
        try {
          text = await transcribeWithMultimodalAI({
            bytes,
            cleanMime,
            title,
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
      if (errors.length > 0) throw new Error(`Transcription failed: ${errors[0]}`);
      throw new Error("No speech could be detected in this recording, or transcription is not configured. Add a free GROQ_API_KEY in .env.local.");
    }
    return text.trim();
  }

  if (chunks.length === 1) {
    await input.onProgress?.("Transcribing lecture…");
    const text = await transcribeOne(chunks[0].bytes, chunks[0].mimeType, input.title);
    return { text, segments: null, language: null };
  }

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    await input.onProgress?.(`Transcribing part ${i + 1} of ${chunks.length}…`);
    const part = await transcribeOne(
      chunks[i].bytes,
      chunks[i].mimeType,
      `${input.title} (part ${i + 1}/${chunks.length})`,
    );
    if (part) parts.push(part);
  }

  if (!parts.length) {
    throw new Error("No speech could be detected across the lecture chunks.");
  }

  return { text: parts.join("\n\n").trim(), segments: null, language: null };
}
