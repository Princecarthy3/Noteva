import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateStudyOutput, type StudyLabAction, type StudyLabOutput } from "@/lib/study-lab-validation";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedGeneration(id: string) {
  if (!uuidPattern.test(id)) return { response: NextResponse.json({ error: "Study material not found." }, { status: 404 }) } as const;

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { response: NextResponse.json({ error: "The study lab is not configured." }, { status: 503 }) } as const;
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Sign in to access your study material." }, { status: 401 }) } as const;

  const { data: generation, error } = await supabase.from("ai_generations")
    .select("id, status, input_metadata")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return { response: NextResponse.json({ error: "Study material could not be loaded." }, { status: 500 }) } as const;
  if (!generation) return { response: NextResponse.json({ error: "Study material not found." }, { status: 404 }) } as const;
  return { supabase, user, generation } as const;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await getOwnedGeneration(id);
  if ("response" in result) return result.response;
  if (result.generation.status !== "completed") {
    return NextResponse.json({ error: "Only completed study materials can be edited." }, { status: 409 });
  }

  let body: { output?: unknown };
  try {
    body = await request.json() as { output?: unknown };
  } catch {
    return NextResponse.json({ error: "The study material update was not valid JSON." }, { status: 400 });
  }
  const metadata = result.generation.input_metadata as { action?: unknown } | null;
  const action = metadata?.action;
  if (typeof action !== "string" || !["summary", "explain", "ask", "flashcards", "quiz", "simplify"].includes(action)
    || !validateStudyOutput(action as StudyLabAction, body.output)) {
    return NextResponse.json({ error: "Check the output structure and text lengths before saving." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Study material editing is not configured on the server." }, { status: 503 });
  }
  const { data, error } = await admin.from("ai_generations")
    .update({ output: body.output as StudyLabOutput, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", result.user.id)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The study material could not be saved." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "The study material changed while you were editing it. Reload and try again." }, { status: 409 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await getOwnedGeneration(id);
  if ("response" in result) return result.response;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Study material deletion is not configured on the server." }, { status: 503 });
  }
  const { data, error } = await admin.from("ai_generations")
    .delete()
    .eq("id", id)
    .eq("owner_id", result.user.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The study material could not be deleted." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "The study material was not found or has already been deleted." }, { status: 404 });
  return NextResponse.json({ success: true });
}
