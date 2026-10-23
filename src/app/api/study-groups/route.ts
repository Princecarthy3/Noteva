import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authenticatedClient() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { response: errorResponse("Study groups are unavailable until Supabase is configured.", 503) } as const;
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: errorResponse("Sign in to use study groups.", 401) } as const;
  return { supabase, user } as const;
}

export async function GET() {
  const auth = await authenticatedClient();
  if ("response" in auth) return auth.response;

  const [{ data: groups, error: groupsError }, { data: memberships, error: membershipsError }, { data: courses }] = await Promise.all([
    auth.supabase.from("study_groups")
      .select("id, name, description, visibility, course_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    auth.supabase.from("group_members").select("group_id, role").eq("user_id", auth.user.id),
    auth.supabase.from("courses").select("id, title, code").eq("user_id", auth.user.id),
  ]);
  if (groupsError || membershipsError) {
    console.error("Study group list failed", { groupsCode: groupsError?.code, membershipsCode: membershipsError?.code });
    return errorResponse("Study groups could not be loaded. Check that Stage 4 and Stage 9 migrations are applied.", 500);
  }

  const roleByGroup = new Map((memberships ?? []).map((membership) => [membership.group_id, membership.role]));
  const courseNames = new Map((courses ?? []).map((course) => [course.id, `${course.code} · ${course.title}`]));
  return NextResponse.json({
    groups: (groups ?? []).map((group) => ({
      ...group,
      role: roleByGroup.get(group.id) ?? null,
      courseName: group.course_id ? courseNames.get(group.course_id) ?? null : null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if ("response" in auth) return auth.response;

  let body: { name?: unknown; description?: unknown; courseId?: unknown; visibility?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return errorResponse("The group details were not valid JSON.", 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId : "";
  const visibility = body.visibility === "public" ? "public" : body.visibility === "private" ? "private" : null;
  if (name.length < 2 || name.length > 120) return errorResponse("Group names must be between 2 and 120 characters.", 400);
  if (description.length > 2000) return errorResponse("Group descriptions must be 2,000 characters or fewer.", 400);
  if (!visibility) return errorResponse("Choose whether the group is public or private.", 400);
  if (courseId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)) {
    return errorResponse("Choose a valid course or leave the group unassigned.", 400);
  }
  if (courseId) {
    const { data: course, error } = await auth.supabase.from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error || !course) return errorResponse("That course is not available in your account.", 404);
  }

  const { data: group, error } = await auth.supabase.from("study_groups")
    .insert({
      creator_id: auth.user.id,
      course_id: courseId || null,
      name,
      description: description || null,
      visibility,
    })
    .select("id, name, description, visibility, course_id, created_at")
    .single();
  if (error || !group) {
    console.error("Study group creation failed", { code: error?.code });
    return errorResponse("The group could not be created. Check that the Stage 4 migration is applied.", 500);
  }
  return NextResponse.json({ group: { ...group, role: "owner" } }, { status: 201 });
}
