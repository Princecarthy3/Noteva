import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJitsiDomain } from "@/lib/calls/jitsi";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, sessionId } = await context.params;
  if (!uuidPattern.test(id) || !uuidPattern.test(sessionId)) return fail("Study session not found.", 404);

  const domain = getJitsiDomain() || "meet.jit.si";

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return fail("Study calls are unavailable until Supabase is configured.", 503);
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Sign in to join this study call.", 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Study call authorization is not configured on the server.", 503);
  }
  const { data: membership, error: membershipError } = await admin.from("group_members")
    .select("id")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return fail("Group membership could not be verified.", 500);
  if (!membership) return fail("Only current group members can join this call.", 403);

  const { data, error } = await admin.from("study_sessions")
    .select("id, group_id, title, starts_at, ends_at, status, call_room_id")
    .eq("id", sessionId)
    .eq("group_id", id)
    .maybeSingle();
  if (error) {
    console.error("Study call session lookup failed", { code: error.code });
    return fail("The study call could not be loaded.", 503);
  }
  if (!data) return fail("This study session was not found.", 404);

  const now = Date.now();
  const endsAt = Date.parse(data.ends_at);

  if (data.status === "completed" || (Number.isFinite(endsAt) && now >= endsAt)) {
    return fail("This study call has ended.", 410);
  }

  const { data: group, error: groupError } = await admin.from("study_groups")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (groupError) return fail("The group information could not be loaded.", 500);
  if (!group) return fail("Study group not found.", 404);

  // Fetch current user display name and avatar
  const { data: profile } = await admin.from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name || user.email?.split("@")[0] || "Classmate";
  const rawRoomId = (data.call_room_id || data.id || "").toString().replaceAll("-", "");
  const roomName = `studystation-${rawRoomId}`;

  return NextResponse.json({
    provider: "webrtc",
    roomId: rawRoomId || data.id,
    roomName,
    domain,
    joinUrl: `https://${domain}/${roomName}`,
    session: {
      id: data.id,
      title: data.title,
      groupName: group.name,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
    },
    currentUser: {
      id: user.id,
      name: displayName,
      avatarUrl: profile?.avatar_url || null,
      email: user.email,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
