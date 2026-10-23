import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrganizedNote } from "@/lib/note-generator";

export const runtime = "nodejs";
export const maxDuration = 180;

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid lecture ID." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Database service unavailable." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to access notes." }, { status: 401 });
  }

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id, user_id, lecture_id, title, summary, content, created_at, updated_at")
    .eq("lecture_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (noteError) {
    console.error("Failed to load note:", noteError);
    return NextResponse.json({ error: "Could not load notes." }, { status: 500 });
  }

  return NextResponse.json({ note: note ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid lecture ID." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Database service unavailable." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to generate notes." }, { status: 401 });
  }

  // 1. Fetch lecture details
  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .select("id, user_id, course_id, title, status, transcript")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lectureError || !lecture) {
    return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
  }

  if (!lecture.transcript || lecture.transcript.trim().length === 0) {
    return NextResponse.json({
      error: "This lecture does not have a transcript yet. Please wait for transcription to complete, or click Retry.",
    }, { status: 400 });
  }

  // 2. Fetch course title if lecture is associated with a course
  let courseTitle = "";
  if (lecture.course_id) {
    const { data: course } = await supabase
      .from("courses")
      .select("title, code")
      .eq("id", lecture.course_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (course) {
      courseTitle = `${course.code} · ${course.title}`;
    }
  }

  // 3. Generate structured notes using AI
  let organizedNote;
  try {
    organizedNote = await generateOrganizedNote({
      transcript: lecture.transcript,
      title: lecture.title,
      courseTitle,
    });
  } catch (genError) {
    console.error("AI Note generation failed:", genError);
    return NextResponse.json({
      error: genError instanceof Error ? genError.message : "Note generation failed.",
    }, { status: 500 });
  }

  // 4. Save into public.notes table
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server admin client unavailable." }, { status: 503 });
  }

  const { data: savedNote, error: saveError } = await admin
    .from("notes")
    .upsert(
      {
        user_id: user.id,
        lecture_id: lecture.id,
        title: organizedNote.title,
        summary: organizedNote.summary,
        content: organizedNote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lecture_id" }
    )
    .select("id, user_id, lecture_id, title, summary, content, created_at, updated_at")
    .single();

  if (saveError) {
    console.error("Failed to save note record:", saveError);
    return NextResponse.json({
      error: "Organized notes were generated, but could not be saved to your database. Please retry.",
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    note: savedNote,
    message: "Organized study notes generated successfully.",
  }, { status: 201 });
}
