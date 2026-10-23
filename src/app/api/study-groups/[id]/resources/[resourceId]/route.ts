import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; resourceId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const { id, resourceId } = await context.params;
  if (!uuidPattern.test(id) || !uuidPattern.test(resourceId)) {
    return NextResponse.json({ error: "Shared resource not found." }, { status: 404 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Shared resources are not configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to open this resource." }, { status: 401 });

  const { data: resource, error } = await supabase.from("resources")
    .select("id, title, resource_type, content, storage_path")
    .eq("id", resourceId)
    .eq("shared_group_id", id)
    .eq("visibility", "group")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Shared resource could not be loaded." }, { status: 500 });
  if (!resource) return NextResponse.json({ error: "Shared resource not found." }, { status: 404 });
  if (resource.content && JSON.stringify(resource.content).length > 50_000) {
    return NextResponse.json({ error: "This resource is too large to preview here." }, { status: 413 });
  }

  let downloadUrl: string | null = null;
  if (resource.storage_path) {
    const { data, error: storageError } = await supabase.storage
      .from("study-resources")
      .createSignedUrl(resource.storage_path, 60 * 5, { download: resource.title });
    if (storageError || !data?.signedUrl) {
      console.error("Shared resource signed URL failed", { resourceId, code: storageError?.name });
      return NextResponse.json({ error: "This shared file could not be opened. Check private storage permissions." }, { status: 503 });
    }
    downloadUrl = data.signedUrl;
  }

  return NextResponse.json({
    resource: {
      id: resource.id,
      title: resource.title,
      resourceType: resource.resource_type,
      content: resource.content,
      downloadUrl,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
