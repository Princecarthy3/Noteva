import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CHUNK_MAX_BYTES, CHUNK_SECONDS, MAX_LECTURE_MEDIA_BYTES } from "@/lib/media-limits";

export { CHUNK_MAX_BYTES, CHUNK_SECONDS, MAX_LECTURE_MEDIA_BYTES };

const extensionByMime: Record<string, string> = {
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

function cleanMime(mimeType: string) {
  return mimeType.toLowerCase().split(";")[0].trim();
}

function resolveFfmpegPath(): string | null {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  // On many server images ffmpeg is on PATH.
  return "ffmpeg";
}

function runCommand(bin: string, args: string[], timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Audio segmentation timed out."));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Split long media into ~10 minute chunks for provider limits.
 * Small files are returned as a single chunk.
 */
export async function splitMediaForTranscription(input: {
  bytes: Buffer;
  mimeType: string;
}): Promise<Array<{ bytes: Buffer; mimeType: string; index: number; total: number }>> {
  const mime = cleanMime(input.mimeType);

  // Short enough for a single provider request.
  if (input.bytes.length <= CHUNK_MAX_BYTES) {
    return [{ bytes: input.bytes, mimeType: mime, index: 0, total: 1 }];
  }

  // WAV can be split without ffmpeg.
  if (mime === "audio/wav" || mime === "audio/x-wav") {
    return splitWavBySize(input.bytes, mime);
  }

  const ffmpegPath = resolveFfmpegPath();
  const ext = extensionByMime[mime] || "webm";
  const dir = await mkdtemp(path.join(tmpdir(), "studystation-chunks-"));
  const inputPath = path.join(dir, `source.${ext}`);
  const pattern = path.join(dir, "chunk-%03d.wav");

  try {
    await writeFile(inputPath, input.bytes);

    await runCommand(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "segment",
        "-segment_time",
        String(CHUNK_SECONDS),
        "-reset_timestamps",
        "1",
        pattern,
      ],
      10 * 60_000,
    );

    const files = (await readdir(dir))
      .filter((name) => name.startsWith("chunk-") && name.endsWith(".wav"))
      .sort();

    if (!files.length) {
      throw new Error("Audio segmentation produced no chunks.");
    }

    const chunks: Array<{ bytes: Buffer; mimeType: string; index: number; total: number }> = [];
    for (let i = 0; i < files.length; i += 1) {
      const bytes = await readFile(path.join(dir, files[i]));
      if (bytes.length < 1000) continue;
      chunks.push({
        bytes,
        mimeType: "audio/wav",
        index: chunks.length,
        total: 0,
      });
    }

    if (!chunks.length) {
      throw new Error("Audio segmentation produced empty chunks.");
    }

    return chunks.map((chunk) => ({ ...chunk, total: chunks.length }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // If ffmpeg is unavailable, fall back to a single-pass attempt when still under a hard ceiling.
    if (input.bytes.length <= 25 * 1024 * 1024) {
      console.warn("ffmpeg segmentation unavailable, using single-pass transcription:", message);
      return [{ bytes: input.bytes, mimeType: mime, index: 0, total: 1 }];
    }
    throw new Error(
      "This long lecture needs audio segmentation (ffmpeg) before transcription. Compress the file under 25 MB per part, or ensure ffmpeg is available on the server, then retry.",
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function splitWavBySize(bytes: Buffer, mimeType: string) {
  if (bytes.length < 44) {
    return [{ bytes, mimeType, index: 0, total: 1 }];
  }

  const header = bytes.subarray(0, 44);
  const data = bytes.subarray(44);
  const piece = Math.max(1_000_000, CHUNK_MAX_BYTES - 44);
  const chunks: Array<{ bytes: Buffer; mimeType: string; index: number; total: number }> = [];

  for (let offset = 0; offset < data.length; offset += piece) {
    const body = data.subarray(offset, offset + piece);
    const out = Buffer.alloc(44 + body.length);
    header.copy(out, 0, 0, 44);
    out.writeUInt32LE(36 + body.length, 4);
    out.writeUInt32LE(body.length, 40);
    body.copy(out, 44);
    chunks.push({ bytes: out, mimeType, index: chunks.length, total: 0 });
  }

  return chunks.map((chunk) => ({ ...chunk, total: chunks.length }));
}
