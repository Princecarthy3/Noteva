import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 150 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportedFiles: Record<string, { sourceType: "audio" | "video" | "recording" | "document"; extensions: string[] }> = {
  "audio/mpeg": { sourceType: "audio", extensions: ["mp3"] },
  "audio/mp3": { sourceType: "audio", extensions: ["mp3"] },
  "audio/mp4": { sourceType: "audio", extensions: ["m4a"] },
  "audio/x-m4a": { sourceType: "audio", extensions: ["m4a"] },
  "audio/wav": { sourceType: "audio", extensions: ["wav"] },
  "audio/x-wav": { sourceType: "audio", extensions: ["wav"] },
  "audio/webm": { sourceType: "audio", extensions: ["webm"] },
  "video/mp4": { sourceType: "video", extensions: ["mp4"] },
  "video/webm": { sourceType: "video", extensions: ["webm"] },
  "application/pdf": { sourceType: "document", extensions: ["pdf"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { sourceType: "document", extensions: ["docx"] },
  "application/msword": { sourceType: "document", extensions: ["doc", "docx"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { sourceType: "document", extensions: ["pptx"] },
  "application/vnd.ms-powerpoint": { sourceType: "document", extensions: ["ppt", "pptx"] },
  "text/plain": { sourceType: "document", extensions: ["txt", "text", "md", "markdown"] },
  "text/markdown": { sourceType: "document", extensions: ["md", "markdown", "txt"] },
  "text/x-markdown": { sourceType: "document", extensions: ["md", "markdown"] },
  "text/rtf": { sourceType: "document", extensions: ["rtf"] },
  "application/rtf": { sourceType: "document", extensions: ["rtf"] },
};

const documentExtensions = new Set(["pdf", "docx", "doc", "pptx", "ppt", "txt", "text", "md", "markdown", "rtf"]);

type UploadRequest = {
  title?: unknown;
  courseId?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  sourceType?: unknown;
  durationSeconds?: unknown;
};

export async function POST(request: Request) {
  let body: UploadRequest;
  try {
    body = await request.json() as UploadRequest;
  } catch {
    return NextResponse.json({ error: "The upload details were not valid. Please try again." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Lecture uploads are unavailable until Supabase is configured." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to upload a lecture." }, { status: 401 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.toLowerCase().split(";")[0].trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId : "";
  const fileSize = body.fileSize;

  if (title.length < 2 || title.length > 200) {
    return NextResponse.json({ error: "Enter a lecture title between 2 and 200 characters." }, { status: 400 });
  }
  if (!fileName || fileName.length > 200 || /[\\/]/.test(fileName)) {
    return NextResponse.json({ error: "Choose a valid lecture file." }, { status: 400 });
  }
  if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize < 1) {
    return NextResponse.json({ error: "The selected file is empty or invalid." }, { status: 400 });
  }
  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Lecture files must be 150 MB or smaller." }, { status: 413 });
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isDocumentExt = documentExtensions.has(extension);
  let fileType = supportedFiles[mimeType];

  if (!fileType && isDocumentExt) {
    fileType = { sourceType: "document", extensions: [extension] };
  }

  if (!fileType || !fileType.extensions.includes(extension)) {
    return NextResponse.json({
      error: "Supported formats are audio (MP3, M4A, WAV, WebM), video (MP4, WebM), and documents (PDF, Word, PowerPoint, and Markdown/text files).",
    }, { status: 415 });
  }
  if (body.sourceType !== undefined && body.sourceType !== "recording" && body.sourceType !== "document") {
    return NextResponse.json({ error: "The lecture source type is not supported." }, { status: 400 });
  }
  if (body.sourceType === "recording" && fileType.sourceType !== "audio") {
    return NextResponse.json({ error: "Live recordings must be uploaded as supported audio files." }, { status: 415 });
  }
  if (courseId && !uuidPattern.test(courseId)) {
    return NextResponse.json({ error: "Choose a valid course or leave the lecture unassigned." }, { status: 400 });
  }

  if (courseId) {
    const { data: course, error } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !course) return NextResponse.json({ error: "That course is not available in your account." }, { status: 404 });
  }

  const lectureId = crypto.randomUUID();
  const storagePath = `${user.id}/${lectureId}/${lectureId}.${extension}`;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Lecture records are not configured. Set the server-only Supabase service-role key." }, { status: 503 });
  }
  const { data: signedUpload, error: storageError } = await supabase.storage
    .from("lecture-media")
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (storageError || !signedUpload) {
    return NextResponse.json({ error: "Private lecture storage is unavailable. Check that the Stage 4 migration is applied." }, { status: 503 });
  }

  const durationSeconds =
    typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds) && body.durationSeconds > 0
      ? Math.round(body.durationSeconds)
      : null;

  const { error: insertError } = await admin.from("lectures").insert({
    id: lectureId,
    user_id: user.id,
    course_id: courseId || null,
    title,
    source_type: body.sourceType === "recording" ? "recording" : fileType.sourceType,
    storage_path: storagePath,
    mime_type: mimeType,
    status: "uploaded",
    duration_seconds: durationSeconds,
  });
  if (insertError) {
    const isSchemaMismatch =
      insertError.code === "PGRST204" ||
      insertError.message?.toLowerCase().includes("column") ||
      insertError.message?.toLowerCase().includes("constraint") ||
      insertError.message?.toLowerCase().includes("check");
    const errorMsg = isSchemaMismatch
      ? `Database schema update required (${insertError.message}). Please run the lectures compatibility migration (20261022000000_lectures_legacy_compatibility.sql) in Supabase SQL Editor.`
      : (insertError.message || "The lecture record could not be created. Please try again.");
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  return NextResponse.json({
    lectureId,
    storagePath,
    uploadToken: signedUpload.token,
    bucket: "lecture-media",
    message: "Your original media is stored in a private bucket.",
  }, { status: 201 });
}
