import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranscriptionConfigurationError, transcribeLectureMedia, type LectureMediaType } from "@/lib/transcription";
import { extractDocumentText } from "@/lib/document-extractor";
import { MAX_LECTURE_MEDIA_BYTES } from "@/lib/audio-chunker";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_SIZE = MAX_LECTURE_MEDIA_BYTES;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ProcessRequest = { lectureId?: unknown };

async function markFailed(admin: ReturnType<typeof createAdminClient>, lectureId: string, userId: string, errorMessage?: string) {
  const { error } = await admin
    .from("lectures")
    .update({
      status: "failed",
      processing_error: errorMessage || "We couldn’t process this media. Check its format and try again.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lectureId)
    .eq("user_id", userId)
    .eq("status", "processing");
  return error;
}

function hasExpectedMediaHeader(bytes: Buffer, mimeType: string) {
  const cleanMime = mimeType.toLowerCase().split(";")[0].trim();
  if (cleanMime === "audio/wav" || cleanMime === "audio/x-wav") {
    return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE";
  }
  if (cleanMime === "audio/mpeg" || cleanMime === "audio/mp3") {
    return bytes.length >= 3 && (
      bytes.toString("ascii", 0, 3) === "ID3"
      || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  }
  if (cleanMime === "audio/mp4" || cleanMime === "audio/x-m4a" || cleanMime === "video/mp4") {
    return bytes.length >= 8 && (
      (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp")
      || bytes.toString("ascii", 0, 4) === "ftyp"
    );
  }
  if (cleanMime === "audio/webm" || cleanMime === "video/webm") {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  return bytes.length > 0;
}

export async function POST(request: Request) {
  let body: ProcessRequest;
  try {
    body = await request.json() as ProcessRequest;
  } catch {
    return NextResponse.json({ error: "The processing request was not valid." }, { status: 400 });
  }
  if (typeof body.lectureId !== "string" || !uuidPattern.test(body.lectureId)) {
    return NextResponse.json({ error: "Choose a valid lecture to process." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Lecture processing is unavailable until Supabase is configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to process this lecture." }, { status: 401 });

  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .select("id, user_id, course_id, title, source_type, mime_type, storage_path, status")
    .eq("id", body.lectureId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lectureError) return NextResponse.json({ error: "The lecture could not be loaded. Please retry." }, { status: 500 });
  if (!lecture) return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
  if (lecture.status === "ready") return NextResponse.json({ lectureId: lecture.id, status: "ready" });
  if (lecture.status === "processing") return NextResponse.json({ error: "This lecture is already being processed." }, { status: 409 });
  if (!lecture.storage_path || !lecture.mime_type ||
    (lecture.source_type !== "audio" && lecture.source_type !== "recording" && lecture.source_type !== "video" && lecture.source_type !== "document")) {
    return NextResponse.json({ error: "This lecture does not have a supported media or document file." }, { status: 422 });
  }
  if (lecture.source_type !== "document") {
    const configurationError = getTranscriptionConfigurationError(lecture.source_type);
    if (configurationError) {
      return NextResponse.json({ error: configurationError }, { status: 503 });
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Lecture status updates are not configured. Set the server-only Supabase service-role key." }, { status: 503 });
  }

  const { data: claimedLecture, error: claimError } = await admin
    .from("lectures")
    .update({ status: "processing", processing_error: null, updated_at: new Date().toISOString() })
    .eq("id", lecture.id)
    .eq("user_id", user.id)
    .in("status", ["uploaded", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: "The lecture could not be queued. Please retry." }, { status: 500 });
  if (!claimedLecture) return NextResponse.json({ error: "This lecture has already changed. Refresh and try again." }, { status: 409 });

  try {
    const { data: object, error: downloadError } = await supabase.storage
      .from("lecture-media")
      .download(lecture.storage_path);
    if (downloadError || !object) throw new Error("The uploaded file could not be read.");
    if (object.size < 1 || object.size > MAX_FILE_SIZE) throw new Error("The uploaded file is empty or exceeds the 150 MB limit.");

    const bytes = Buffer.from(await object.arrayBuffer());

    if (lecture.source_type === "document") {
      const extracted = await extractDocumentText(bytes, lecture.storage_path, lecture.mime_type);
      const cleanTranscript = extracted.text;
      if (!cleanTranscript) throw new Error("No readable text could be extracted from this document.");
      if (cleanTranscript.length > 1_000_000) throw new Error("The document is larger than the supported limit.");

      const { error: saveDocError } = await admin
        .from("lectures")
        .update({
          transcript: cleanTranscript,
          transcript_segments: [],
          status: "ready",
          processing_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lecture.id)
        .eq("user_id", user.id);
      if (saveDocError) throw new Error(saveDocError.message || "Failed to save document content.");

      return NextResponse.json({ lectureId: lecture.id, status: "ready", wordCount: extracted.wordCount });
    }

    if (!hasExpectedMediaHeader(bytes, lecture.mime_type)) throw new Error("The uploaded file contents do not match the selected media format.");
    let courseTitle = "";
    if (lecture.course_id) {
      const { data: course } = await supabase.from("courses").select("title").eq("id", lecture.course_id).eq("user_id", user.id).maybeSingle();
      courseTitle = course?.title ?? "";
    }

    const result = await transcribeLectureMedia({
      bytes,
      mimeType: lecture.mime_type,
      sourceType: lecture.source_type,
      title: lecture.title,
      courseTitle,
      onProgress: async (message) => {
        await admin
          .from("lectures")
          .update({
            processing_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lecture.id)
          .eq("user_id", user.id)
          .eq("status", "processing");
      },
    });
    const cleanTranscript = result.text;
    if (!cleanTranscript) throw new Error("No speech was detected in the uploaded media.");
    if (cleanTranscript.length > 1_500_000) throw new Error("The transcript is larger than the supported limit.");

    const { error: saveError } = await admin
      .from("lectures")
      .update({
        transcript: cleanTranscript,
        transcript_segments: result.segments,
        language: result.language,
        status: "ready",
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lecture.id)
      .eq("user_id", user.id)
      .eq("status", "processing");
    if (saveError) throw new Error("The transcript could not be saved.");

    return NextResponse.json({ lectureId: lecture.id, status: "ready" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Lecture transcription failed.";
    console.error("Lecture transcription failed", {
      lectureId: lecture.id,
      error: errorMessage,
    });
    const statusError = await markFailed(admin, lecture.id, user.id, errorMessage);
    if (statusError) {
      console.error("Lecture status update failed", { lectureId: lecture.id, code: statusError.code });
      return NextResponse.json({ error: "The lecture could not be processed and its status could not be saved. Refresh before retrying." }, { status: 500 });
    }
    return NextResponse.json({
      error: errorMessage || "We couldn’t process this lecture. Check that the file is a supported audio/video format, then retry.",
    }, { status: 422 });
  }
}
