import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function removeOwnedFiles(admin: ReturnType<typeof createAdminClient>, bucket: string, userId: string) {
  const paths: string[] = [];
  const folders = [userId];
  while (folders.length) {
    const folder = folders.pop();
    if (!folder) continue;
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
      if (error) throw new Error(`Could not inspect ${bucket} storage.`);
      for (const entry of data) {
        const path = `${folder}/${entry.name}`;
        if (!entry.id && !entry.metadata) folders.push(path);
        else paths.push(path);
      }
      if (data.length < 100) break;
    }
  }

  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100));
    if (error) throw new Error(`Could not remove ${bucket} storage.`);
  }
}

export async function DELETE(request: Request) {
  let body: { confirmation?: unknown };
  try {
    body = await request.json() as { confirmation?: unknown };
  } catch {
    return NextResponse.json({ error: "The account deletion request was invalid." }, { status: 400 });
  }
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Account management is not configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in again before deleting your account." }, { status: 401 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Account deletion requires the server-only SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  try {
    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) throw new Error("Could not inspect private storage.");
    const ownedBuckets = new Set(["profile-avatars", "lecture-media", "study-resources"]);
    for (const bucket of buckets.filter(({ id }) => ownedBuckets.has(id))) {
      await removeOwnedFiles(admin, bucket.id, user.id);
    }
  } catch (cleanupError) {
    console.error("Account storage cleanup failed", { error: cleanupError instanceof Error ? cleanupError.message : "UnknownError" });
    return NextResponse.json({ error: "Your account was not deleted because its private files could not be cleaned up. Please try again or contact support." }, { status: 503 });
  }

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
  if (deletionError) {
    console.error("Account deletion failed", { code: deletionError.status });
    return NextResponse.json({ error: "Your account could not be deleted. Please contact support and try again later." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
