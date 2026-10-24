import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxFileSize = 25 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: groupId } = await context.params;
  if (!uuidPattern.test(groupId)) return NextResponse.json({ error: "Study group not found." }, { status: 404 });

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Study groups are not configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to share a file." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase.from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Group membership could not be checked." }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "Join this group before sharing a file." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a file to share." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > maxFileSize) {
    return NextResponse.json({ error: "Choose a non-empty file no larger than 25 MB." }, { status: 413 });
  }

  const filename = file.name.trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "shared-file";
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const storagePath = `${user.id}/${groupId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const { error: uploadError } = await supabase.storage.from("study-resources").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "The file could not be uploaded. Check private storage permissions." }, { status: 503 });

  const { data: resource, error: resourceError } = await supabase.from("resources").insert({
    owner_id: user.id,
    shared_group_id: groupId,
    title: filename,
    resource_type: "file",
    storage_path: storagePath,
    visibility: "group",
    metadata: { mimeType: file.type || "application/octet-stream", size: file.size },
  }).select("id, title, resource_type, created_at, owner_id").single();
  if (resourceError || !resource) {
    await supabase.storage.from("study-resources").remove([storagePath]);
    return NextResponse.json({ error: "The uploaded file could not be added to the group." }, { status: 500 });
  }

  const { error: messageError } = await supabase.from("group_messages").insert({
    group_id: groupId,
    sender_id: user.id,
    body: `Shared a file: ${filename}`,
  });
  if (messageError) console.error("Group file share message could not be posted", { resourceId: resource.id, code: messageError.code });

  return NextResponse.json({
    resource: {
      id: resource.id,
      title: resource.title,
      resourceType: resource.resource_type,
      createdAt: resource.created_at,
      isMine: true,
    },
  }, { status: 201 });
}
