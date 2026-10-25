import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getOwnedLecture(id: string) {
  if (!uuidPattern.test(id)) return { response: NextResponse.json({ error: "Lecture not found." }, { status: 404 }) } as const;

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { response: NextResponse.json({ error: "Lecture storage is not configured." }, { status: 503 }) } as const;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Sign in to access this lecture." }, { status: 401 }) } as const;

  const { data: lecture, error } = await supabase
    .from("lectures")
    .select("id, title, source_type, mime_type, storage_path, status, transcript, processing_error, created_at, updated_at, course_id, duration_seconds")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { response: NextResponse.json({ error: "Lecture could not be loaded. Please retry." }, { status: 500 }) } as const;
  if (!lecture) return { response: NextResponse.json({ error: "Lecture not found." }, { status: 404 }) } as const;

  return { supabase, user, lecture } as const;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await getOwnedLecture(id);
  if ("response" in result) return result.response;

  let mediaUrl: string | null = null;
  if (result.lecture.storage_path) {
    const { data: signedData } = await result.supabase.storage
      .from("lecture-media")
      .createSignedUrl(result.lecture.storage_path, 7200);
    mediaUrl = signedData?.signedUrl ?? `/api/lectures/${result.lecture.id}/media`;
  }

  const { data: note } = await result.supabase
    .from("notes")
    .select("id, title, summary, content, created_at, updated_at")
    .eq("lecture_id", result.lecture.id)
    .maybeSingle();

  return NextResponse.json({
    lecture: {
      id: result.lecture.id,
      title: result.lecture.title,
      sourceType: result.lecture.source_type,
      mimeType: result.lecture.mime_type,
      status: result.lecture.status,
      transcript: result.lecture.transcript,
      durationSeconds: result.lecture.duration_seconds ?? null,
      processingError: result.lecture.processing_error,
      createdAt: result.lecture.created_at,
      updatedAt: result.lecture.updated_at,
      courseId: result.lecture.course_id,
      mediaUrl,
      note: note ?? null,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await getOwnedLecture(id);
  if ("response" in result) return result.response;

  let body: { transcript?: unknown };
  try {
    body = await request.json() as { transcript?: unknown };
  } catch {
    return NextResponse.json({ error: "The transcript update was not valid." }, { status: 400 });
  }
  if (typeof body.transcript !== "string" || body.transcript.trim().length === 0 || body.transcript.length > 1_500_000) {
    return NextResponse.json({ error: "Transcript text must be between 1 and 500,000 characters." }, { status: 400 });
  }
  if (result.lecture.status !== "ready") {
    return NextResponse.json({ error: "Only completed transcripts can be edited." }, { status: 409 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Transcript editing is not configured on the server." }, { status: 503 });
  }
  const { data, error } = await admin
    .from("lectures")
    .update({ transcript: body.transcript.trim(), updated_at: new Date().toISOString() })
    .eq("id", result.lecture.id)
    .eq("user_id", result.user.id)
    .eq("status", "ready")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The transcript could not be saved. Please retry." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This lecture changed while you were editing it. Reload and try again." }, { status: 409 });

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await getOwnedLecture(id);
  if ("response" in result) return result.response;
  if (result.lecture.status === "processing") {
    return NextResponse.json({ error: "This lecture cannot be deleted while transcription is in progress." }, { status: 409 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Lecture deletion is not configured on the server." }, { status: 503 });
  }
  const { data, error } = await admin
    .from("lectures")
    .delete()
    .eq("id", result.lecture.id)
    .eq("user_id", result.user.id)
    .neq("status", "processing")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The lecture record could not be removed." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "The lecture could not be deleted because its status changed. Refresh and try again." }, { status: 409 });

  if (result.lecture.storage_path) {
    const { error: storageError } = await result.supabase.storage
      .from("lecture-media")
      .remove([result.lecture.storage_path]);
    if (storageError) {
      console.error("Lecture media cleanup failed", { lectureId: result.lecture.id, code: storageError.name });
      return NextResponse.json({ error: "The lecture record was removed, but its private media could not be cleaned up. Please contact support." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
