import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyGroupOwnerOfJoin } from "@/lib/study-groups/notifications";
import { getJitsiDomain } from "@/lib/calls/jitsi";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuth() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { response: fail("Study groups are not configured.", 503) } as const;
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: fail("Sign in to use study groups.", 401) } as const;
  return { supabase, user } as const;
}

async function getAdmin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function membershipRole(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data, error } = await admin.from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Membership could not be verified.");
  return data?.role ?? null;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return fail("Study group not found.", 404);
  const auth = await getAuth();
  if ("response" in auth) return auth.response;

  const { data: group, error: groupError } = await auth.supabase.from("study_groups")
    .select("id, name, description, visibility, course_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (groupError) return fail("Study group could not be loaded.", 500);
  if (!group) return fail("Study group not found.", 404);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Study groups require the server-only SUPABASE_SERVICE_ROLE_KEY. Add it to the server environment and restart the app.", 503);
  }
  let role: string | null;
  try {
    role = await membershipRole(admin, id, auth.user.id);
  } catch {
    return fail("Study group access could not be verified.", 500);
  }
  if (!role) {
    return NextResponse.json({
      group,
      role: null,
      messages: [],
      sessions: [],
      resources: [],
      members: [],
      ownResources: [],
      hasMoreMessages: false,
      nextMessageCursor: null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  if (before && Number.isNaN(Date.parse(before))) return fail("The message page cursor is invalid.");
  let messagesQuery = auth.supabase.from("group_messages")
    .select("id, sender_id, body, created_at, reply_to_id, edited_at, deleted_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(51);
  if (before) messagesQuery = messagesQuery.lt("created_at", before);

  const [{ data: messages, error: messagesError }, { data: sessions, error: sessionsError }, { data: resources, error: resourcesError }, { data: ownResources, error: ownResourcesError }, { data: ownNotes, error: ownNotesError }, { data: members, error: membersError }, { count, error: memberCountError }] = await Promise.all([
    messagesQuery,
    auth.supabase.from("study_sessions")
      .select("id, title, starts_at, ends_at, status, notes")
      .eq("group_id", id)
      .order("starts_at", { ascending: true })
      .limit(30),
    auth.supabase.from("resources")
      .select("id, title, resource_type, created_at, owner_id")
      .eq("shared_group_id", id)
      .eq("visibility", "group")
      .order("created_at", { ascending: false })
      .limit(30),
    auth.supabase.from("resources")
      .select("id, title, resource_type")
      .eq("owner_id", auth.user.id)
      .eq("visibility", "private")
      .order("created_at", { ascending: false })
      .limit(50),
    auth.supabase.from("notes")
      .select("id, title, lecture_id")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    auth.supabase.from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", id)
      .order("joined_at", { ascending: true })
      .limit(1000),
    auth.supabase.from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id),
  ]);
  if (messagesError || sessionsError || resourcesError || ownResourcesError || ownNotesError || membersError || memberCountError) {
    console.error("Study group detail load failed", {
      messagesCode: messagesError?.code,
      sessionsCode: sessionsError?.code,
      resourcesCode: resourcesError?.code,
      ownResourcesCode: ownResourcesError?.code,
      ownNotesCode: ownNotesError?.code,
      membersCode: membersError?.code,
      memberCountCode: memberCountError?.code,
    });
    return fail("Group discussions and details could not be loaded.", 500);
  }
  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("id, full_name, avatar_url").in("id", memberIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const orderedMessages = messages ?? [];
  const hasMoreMessages = orderedMessages.length > 50;
  const pageMessages = orderedMessages.slice(0, 50).reverse();
  return NextResponse.json({
    group,
    role,
    memberCount: count ?? 0,
    messages: pageMessages.map((message) => {
      const deleted = Boolean((message as { deleted_at?: string | null }).deleted_at);
      const replyToId = (message as { reply_to_id?: string | null }).reply_to_id ?? null;
      const replySource = replyToId ? pageMessages.find((item) => item.id === replyToId) : null;
      return {
        id: message.id,
        body: deleted ? "" : message.body,
        created_at: message.created_at,
        isMine: message.sender_id === auth.user.id,
        senderName: profileById.get(message.sender_id)?.full_name ?? (message.sender_id === auth.user.id ? "You" : "Group member"),
        editedAt: (message as { edited_at?: string | null }).edited_at ?? null,
        deletedAt: (message as { deleted_at?: string | null }).deleted_at ?? null,
        replyToId,
        replyPreview: replySource
          ? {
              id: replySource.id,
              body: (replySource as { deleted_at?: string | null }).deleted_at ? "Message deleted" : String(replySource.body).slice(0, 140),
              senderName: profileById.get(replySource.sender_id)?.full_name ?? "Group member",
              isMine: replySource.sender_id === auth.user.id,
            }
          : null,
        // Own messages are treated as delivered once persisted (double tick in UI).
        status: message.sender_id === auth.user.id ? "delivered" : "received",
      };
    }),
    hasMoreMessages,
    nextMessageCursor: hasMoreMessages ? pageMessages[0]?.created_at ?? null : null,
    sessions: sessions ?? [],
    resources: (resources ?? []).map(({ id: resourceId, title, resource_type, created_at, owner_id }) => ({
      id: resourceId,
      title,
      resourceType: resource_type,
      createdAt: created_at,
      isMine: owner_id === auth.user.id,
    })),
    ownResources: [
      ...(ownResources ?? []).map((resource) => ({ ...resource, source: "resource" })),
      ...(ownNotes ?? []).map((note) => ({ id: `note:${note.id}`, title: note.title, resource_type: "Generated notes", source: "note" })),
    ],
    callEnabled: Boolean(getJitsiDomain()),
    members: (members ?? []).map((member) => ({
      userId: member.user_id,
      name: profileById.get(member.user_id)?.full_name ?? "StudyStation member",
      avatarUrl: profileById.get(member.user_id)?.avatar_url ?? null,
      role: member.role,
      joinedAt: member.joined_at,
      isSelf: member.user_id === auth.user.id,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return fail("Study group not found.", 404);
  const auth = await getAuth();
  if ("response" in auth) return auth.response;

  let body: {
    action?: unknown;
    text?: unknown;
    title?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    notes?: unknown;
    resourceId?: unknown;
    messageId?: unknown;
    reason?: unknown;
    status?: unknown;
    targetUserId?: unknown;
    newRole?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return fail("The group request was not valid JSON.");
  }
  const { data: group, error: groupError } = await auth.supabase.from("study_groups")
    .select("id, name, visibility")
    .eq("id", id)
    .maybeSingle();
  if (groupError) return fail("Study group could not be loaded.", 500);
  if (!group) return fail("Study group not found.", 404);
  const admin = await getAdmin();
  if (!admin) return fail("Study group actions require the server-only SUPABASE_SERVICE_ROLE_KEY. Add it to the server environment and restart the app.", 503);

  let role: string | null;
  try {
    role = await membershipRole(admin, id, auth.user.id);
  } catch {
    return fail("Study group access could not be verified.", 500);
  }
  const action = body.action;

  if (action === "join_public") {
    if (group.visibility !== "public") return fail("Private groups require a valid invitation.", 403);
    const wasMember = Boolean(role);
    const { error } = await admin.from("group_members").upsert({
      group_id: id,
      user_id: auth.user.id,
      role: "member",
    }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
    if (error) return fail("You could not join this group. Please try again.", 500);
    if (!wasMember) await notifyGroupOwnerOfJoin(id, auth.user.id);
    return NextResponse.json({ success: true, role: "member" });
  }

  if (action === "leave") {
    if (!role) return fail("You are not a member of this group.", 404);
    if (role === "owner") return fail("Transfer ownership before leaving this group.", 409);
    const { data, error } = await admin.from("group_members")
      .delete()
      .eq("group_id", id)
      .eq("user_id", auth.user.id)
      .neq("role", "owner")
      .select("id")
      .maybeSingle();
    if (error) return fail("You could not leave this group.", 500);
    if (!data) return fail("Your membership changed. Refresh and try again.", 409);
    return NextResponse.json({ success: true });
  }

  if (action === "remove_member" || action === "set_member_role") {
    if (role !== "owner" && role !== "moderator") return fail("Only group owners and moderators can manage membership.", 403);
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    if (!uuidPattern.test(targetUserId) || targetUserId === auth.user.id) return fail("Choose another valid group member.");
    let targetRole: string | null;
    try {
      targetRole = await membershipRole(admin, id, targetUserId);
    } catch {
      return fail("The selected member could not be verified.", 500);
    }
    if (!targetRole) return fail("That person is not a member of this group.", 404);
    if (targetRole === "owner") return fail("The group owner cannot be removed or demoted.", 409);

    if (action === "set_member_role") {
      if (role !== "owner") return fail("Only the group owner can assign moderator roles.", 403);
      if (body.newRole !== "member" && body.newRole !== "moderator") return fail("Choose a valid member role.");
      const { data, error } = await admin.from("group_members")
        .update({ role: body.newRole })
        .eq("group_id", id)
        .eq("user_id", targetUserId)
        .neq("role", "owner")
        .select("user_id")
        .maybeSingle();
      if (error) return fail("The member role could not be updated.", 500);
      if (!data) return fail("Membership changed. Refresh and try again.", 409);
      return NextResponse.json({ success: true });
    }

    if (role === "moderator" && targetRole !== "member") return fail("Moderators can only remove regular members.", 403);
    const { data, error } = await admin.from("group_members")
      .delete()
      .eq("group_id", id)
      .eq("user_id", targetUserId)
      .eq("role", targetRole)
      .neq("role", "owner")
      .select("id")
      .maybeSingle();
    if (error) return fail("The member could not be removed.", 500);
    if (!data) return fail("Membership changed. Refresh and try again.", 409);
    return NextResponse.json({ success: true });
  }

  if (action === "delete_group") {
    if (role !== "owner") return fail("Only the group owner can delete this group.", 403);
    const { error } = await auth.supabase.rpc("delete_study_group", { target_group_id: id });
    if (error) return fail("The group could not be deleted. Check that the Stage 9 migration is applied.", 500);
    return NextResponse.json({ success: true });
  }

  if (!role) return fail("Join the group before using its discussions or shared resources.", 403);

  if (action === "start_call") {
    if (!getJitsiDomain()) return fail("Study calls are not configured. Set JITSI_MEET_DOMAIN on the server.", 503);
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const { data, error } = await admin.from("study_sessions")
      .insert({
        group_id: id,
        creator_id: auth.user.id,
        title: "Instant group call",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "scheduled",
      })
      .select("id, title, starts_at, ends_at, status, notes, call_room_id")
      .single();
    if (error || !data) return fail("The group call could not be started. Check that the Stage 10 migration is applied.", 503);
    const { data: members, error: membersError } = await admin.from("group_members")
      .select("user_id")
      .eq("group_id", id)
      .neq("user_id", auth.user.id);
    if (!membersError && members?.length) {
      const { error: notificationError } = await admin.from("notifications").insert(members.map((member) => ({
        user_id: member.user_id,
        type: "study_group_call",
        title: "Group call started",
        body: `${group.name} has started a group call. [call:${id}:${data.id}]`,
      })));
      if (notificationError) console.error("Group call notifications failed", { code: notificationError.code });
    }
    return NextResponse.json({ session: data }, { status: 201 });
  }

  if (action === "message") {
    const message = typeof body.text === "string" ? body.text.trim() : "";
    if (message.length < 1 || message.length > 2000) return fail("Messages must be between 1 and 2,000 characters.");
    const replyToId = typeof body.replyToId === "string" && body.replyToId.trim() ? body.replyToId.trim() : null;
    if (replyToId) {
      const { data: parent, error: parentError } = await admin.from("group_messages")
        .select("id, group_id, body, sender_id, deleted_at")
        .eq("id", replyToId)
        .eq("group_id", id)
        .maybeSingle();
      if (parentError || !parent) return fail("The message you are replying to was not found.", 404);
    }
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: limitError } = await admin.from("group_messages")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id)
      .eq("sender_id", auth.user.id)
      .gte("created_at", oneMinuteAgo);
    if (limitError) return fail("Message rate limit could not be checked. Please retry.", 503);
    if ((count ?? 0) >= 10) return fail("You have sent 10 messages in the last minute. Please wait before posting again.", 429);
    const insertPayload: Record<string, unknown> = { group_id: id, sender_id: auth.user.id, body: message };
    if (replyToId) insertPayload.reply_to_id = replyToId;
    const { data, error } = await admin.from("group_messages")
      .insert(insertPayload)
      .select("id, sender_id, body, created_at, reply_to_id, edited_at, deleted_at")
      .single();
    if (error || !data) {
      // Fallback without reply column if migration not applied yet
      if (replyToId && error) {
        const retry = await admin.from("group_messages")
          .insert({ group_id: id, sender_id: auth.user.id, body: message })
          .select("id, sender_id, body, created_at")
          .single();
        if (retry.error || !retry.data) return fail("Your message could not be sent.", 500);
        return NextResponse.json({
          message: {
            id: retry.data.id,
            body: retry.data.body,
            created_at: retry.data.created_at,
            isMine: true,
            status: "delivered",
            replyToId: null,
            replyPreview: null,
            editedAt: null,
            deletedAt: null,
          },
        }, { status: 201 });
      }
      return fail("Your message could not be sent.", 500);
    }
    let replyPreview = null as null | { id: string; body: string; senderName: string; isMine: boolean };
    if (data.reply_to_id) {
      const { data: parent } = await admin.from("group_messages")
        .select("id, body, sender_id, deleted_at")
        .eq("id", data.reply_to_id)
        .maybeSingle();
      if (parent) {
        replyPreview = {
          id: parent.id,
          body: parent.deleted_at ? "Message deleted" : String(parent.body).slice(0, 140),
          senderName: parent.sender_id === auth.user.id ? "You" : "Group member",
          isMine: parent.sender_id === auth.user.id,
        };
      }
    }
    return NextResponse.json({
      message: {
        id: data.id,
        body: data.body,
        created_at: data.created_at,
        isMine: true,
        status: "delivered",
        replyToId: data.reply_to_id ?? null,
        replyPreview,
        editedAt: data.edited_at ?? null,
        deletedAt: data.deleted_at ?? null,
      },
    }, { status: 201 });
  }

  if (action === "edit_message") {
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const nextBody = typeof body.text === "string" ? body.text.trim() : "";
    if (!messageId) return fail("Choose a message to edit.");
    if (nextBody.length < 1 || nextBody.length > 2000) return fail("Messages must be between 1 and 2,000 characters.");
    const { data: existing, error: existingError } = await admin.from("group_messages")
      .select("id, sender_id, deleted_at")
      .eq("id", messageId)
      .eq("group_id", id)
      .maybeSingle();
    if (existingError || !existing) return fail("Message not found.", 404);
    if (existing.sender_id !== auth.user.id) return fail("You can only edit your own messages.", 403);
    if (existing.deleted_at) return fail("Deleted messages cannot be edited.", 400);
    const editedAt = new Date().toISOString();
    const { data, error } = await admin.from("group_messages")
      .update({ body: nextBody, edited_at: editedAt })
      .eq("id", messageId)
      .eq("group_id", id)
      .select("id, body, created_at, edited_at, deleted_at, reply_to_id")
      .single();
    if (error || !data) return fail("The message could not be edited. Apply the latest chat migration if this keeps failing.", 500);
    return NextResponse.json({
      message: {
        id: data.id,
        body: data.body,
        created_at: data.created_at,
        isMine: true,
        status: "delivered",
        editedAt: data.edited_at,
        deletedAt: data.deleted_at,
        replyToId: data.reply_to_id ?? null,
      },
    });
  }

  if (action === "delete_message") {
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    if (!messageId) return fail("Choose a message to delete.");
    const { data: existing, error: existingError } = await admin.from("group_messages")
      .select("id, sender_id, deleted_at")
      .eq("id", messageId)
      .eq("group_id", id)
      .maybeSingle();
    if (existingError || !existing) return fail("Message not found.", 404);
    const canModerate = role === "owner" || role === "moderator";
    if (existing.sender_id !== auth.user.id && !canModerate) return fail("You can only delete your own messages.", 403);
    if (existing.deleted_at) return NextResponse.json({ success: true });
    const deletedAt = new Date().toISOString();
    const { error } = await admin.from("group_messages")
      .update({ body: "Message deleted", deleted_at: deletedAt })
      .eq("id", messageId)
      .eq("group_id", id);
    if (error) {
      // Hard delete fallback if soft-delete column missing
      const hard = await admin.from("group_messages").delete().eq("id", messageId).eq("group_id", id);
      if (hard.error) return fail("The message could not be deleted.", 500);
      return NextResponse.json({ success: true, hardDeleted: true });
    }
    return NextResponse.json({
      success: true,
      message: { id: messageId, deletedAt, body: "", isMine: existing.sender_id === auth.user.id },
    });
  }


  if (action === "session") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
    const endsAt = typeof body.endsAt === "string" ? body.endsAt : "";
    const startTime = Date.parse(startsAt);
    const endTime = Date.parse(endsAt);
    if (!["owner", "moderator"].includes(role)) return fail("Only group owners and moderators can schedule sessions.", 403);
    if (title.length < 2 || title.length > 160 || notes.length > 2000) return fail("Enter a session title (2–160 characters) and agenda (up to 2,000 characters).");
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime <= Date.now() || endTime <= startTime || endTime - startTime > 12 * 60 * 60 * 1000) {
      return fail("Choose a future start time and an end time within 12 hours of it.");
    }
    const { data, error } = await admin.from("study_sessions")
      .insert({
        group_id: id,
        creator_id: auth.user.id,
        title,
        starts_at: new Date(startTime).toISOString(),
        ends_at: new Date(endTime).toISOString(),
        notes: notes || null,
        status: "scheduled",
      })
      .select("id, title, starts_at, ends_at, status, notes")
      .single();
    if (error || !data) return fail("The study session could not be scheduled.", 500);
    return NextResponse.json({ session: data }, { status: 201 });
  }

  if (action === "cancel_session") {
    if (!["owner", "moderator"].includes(role)) return fail("Only group owners and moderators can cancel sessions.", 403);
    if (typeof body.text !== "string" || !uuidPattern.test(body.text)) return fail("Choose a valid session.");
    const { data, error } = await admin.from("study_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", body.text)
      .eq("group_id", id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (error) return fail("The study session could not be cancelled.", 500);
    if (!data) return fail("The session was not found.", 404);
    return NextResponse.json({ success: true });
  }

  if (action === "share_resource") {
    if (typeof body.resourceId !== "string" || !uuidPattern.test(body.resourceId)) return fail("Choose a valid resource.");
    const { data, error } = await auth.supabase.from("resources")
      .update({ shared_group_id: id, visibility: "group", updated_at: new Date().toISOString() })
      .eq("id", body.resourceId)
      .eq("owner_id", auth.user.id)
      .select("id, title, resource_type, created_at, owner_id")
      .maybeSingle();
    if (error) return fail("The resource could not be shared. Confirm it is yours and try again.", 403);
    if (!data) return fail("That resource is not available in your account.", 404);
    return NextResponse.json({ resource: data });
  }

  if (action === "share_note") {
    if (typeof body.resourceId !== "string" || !uuidPattern.test(body.resourceId)) return fail("Choose a valid generated note.");
    const { data: note, error: noteError } = await auth.supabase.from("notes")
      .select("id, lecture_id, title, summary, content")
      .eq("id", body.resourceId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (noteError) return fail("The generated note could not be loaded.", 500);
    if (!note) return fail("That generated note is not available in your account.", 404);
    const { data, error } = await auth.supabase.from("resources").insert({
      owner_id: auth.user.id,
      shared_group_id: id,
      title: note.title,
      resource_type: "generated_notes",
      content: { summary: note.summary, content: note.content, lectureId: note.lecture_id },
      visibility: "group",
    }).select("id, title, resource_type, created_at, owner_id").single();
    if (error || !data) return fail("The generated note could not be shared.", 500);
    return NextResponse.json({ resource: data }, { status: 201 });
  }

  if (action === "unshare_resource") {
    if (typeof body.resourceId !== "string" || !uuidPattern.test(body.resourceId)) return fail("Choose a valid resource.");
    const { data, error } = await auth.supabase.from("resources")
      .update({ shared_group_id: null, visibility: "private", updated_at: new Date().toISOString() })
      .eq("id", body.resourceId)
      .eq("owner_id", auth.user.id)
      .eq("shared_group_id", id)
      .select("id")
      .maybeSingle();
    if (error) return fail("The resource could not be unshared.", 500);
    if (!data) return fail("That resource is not shared by your account in this group.", 404);
    return NextResponse.json({ success: true });
  }

  if (action === "report") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    if (reason.length < 10 || reason.length > 1000) return fail("Describe the concern in 10–1,000 characters.");
    if (messageId && !uuidPattern.test(messageId)) return fail("Choose a valid message to report.");
    if (messageId) {
      const { data: message, error } = await auth.supabase.from("group_messages")
        .select("id")
        .eq("id", messageId)
        .eq("group_id", id)
        .maybeSingle();
      if (error || !message) return fail("That message is not available in this group.", 404);
    }
    const { error } = await admin.from("group_reports").insert({
      group_id: id,
      reporter_id: auth.user.id,
      message_id: messageId || null,
      reason,
    });
    if (error) return fail("The report could not be submitted.", 500);
    return NextResponse.json({ success: true }, { status: 201 });
  }

  if (action === "create_invite") {
    if (!["owner", "moderator"].includes(role)) return fail("Only group owners and moderators can create invitations.", 403);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("group_invites").insert({
      group_id: id,
      created_by: auth.user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      max_uses: 20,
      use_count: 0,
    });
    if (error) return fail("The invitation could not be created.", 500);
    const inviteUrl = new URL("/app?view=study-groups&invite=" + encodeURIComponent(token), request.url).toString();
    return NextResponse.json({ inviteUrl, expiresAt }, { status: 201 });
  }

  if (action === "revoke_invites") {
    if (role !== "owner" && role !== "moderator") return fail("Only group owners and moderators can revoke invitations.", 403);
    const { error } = await admin.from("group_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("group_id", id)
      .is("revoked_at", null);
    if (error) return fail("Active invitations could not be revoked.", 500);
    return NextResponse.json({ success: true });
  }

  return fail("Choose a supported group action.");
}
