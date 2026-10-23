import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { groupId?: unknown; inviteToken?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return fail("The join request was not valid JSON.");
  }
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return fail("Study groups are not configured.", 503);
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Sign in to join a study group.", 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Joining study groups requires the server-only SUPABASE_SERVICE_ROLE_KEY. Add it to the server environment and restart the app.", 503);
  }
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";
  if (inviteToken) {
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(inviteToken)) return fail("That invitation link is invalid or expired.", 404);
    const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
    const { data: invite, error } = await admin.from("group_invites")
      .select("id, group_id, expires_at, max_uses, use_count, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) return fail("The invitation could not be checked.", 500);
    if (!invite || invite.revoked_at || Date.parse(invite.expires_at) <= Date.now()
      || (invite.max_uses !== null && invite.use_count >= invite.max_uses)) {
      return fail("That invitation link is invalid, expired, or has reached its use limit.", 404);
    }
    const { data: existing, error: membershipError } = await admin.from("group_members")
      .select("id, role")
      .eq("group_id", invite.group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) return fail("Your group membership could not be checked.", 500);
    if (existing) return NextResponse.json({ success: true, groupId: invite.group_id, alreadyMember: true });

    let updateQuery = admin.from("group_invites")
      .update({ use_count: invite.use_count + 1 })
      .eq("id", invite.id)
      .eq("use_count", invite.use_count)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    if (invite.max_uses !== null) updateQuery = updateQuery.lt("use_count", invite.max_uses);
    const { data: claimedInvite, error: claimError } = await updateQuery.select("id").maybeSingle();
    if (claimError) return fail("The invitation could not be redeemed.", 500);
    if (!claimedInvite) return fail("That invitation link has expired or reached its use limit.", 409);

    const { error: joinError } = await admin.from("group_members").insert({
      group_id: invite.group_id,
      user_id: user.id,
      role: "member",
    });
    if (joinError) {
      const { error: rollbackError } = await admin.from("group_invites")
        .update({ use_count: invite.use_count })
        .eq("id", invite.id)
        .eq("use_count", invite.use_count + 1);
      if (rollbackError) console.error("Study group invite use count rollback failed", { code: rollbackError.code });
      return fail("You could not join this group. Refresh and try again.", 409);
    }
    return NextResponse.json({ success: true, groupId: invite.group_id });
  }

  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(groupId)) {
    return fail("Choose a valid public study group.");
  }
  const { data: group, error: groupError } = await supabase.from("study_groups")
    .select("id, visibility")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) return fail("The study group could not be loaded.", 500);
  if (!group || group.visibility !== "public") return fail("That group is not available to join publicly.", 403);
  const { error } = await admin.from("group_members").upsert({
    group_id: groupId,
    user_id: user.id,
    role: "member",
  }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  if (error) return fail("You could not join this group.", 500);
  return NextResponse.json({ success: true, groupId });
}
