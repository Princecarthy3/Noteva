import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Lecture storage is not configured." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to access this media." }, { status: 401 });
  }

  const { data: lecture, error } = await supabase
    .from("lectures")
    .select("id, storage_path, mime_type, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !lecture) {
    return NextResponse.json({ error: "Lecture media not found." }, { status: 404 });
  }
  if (!lecture.storage_path) {
    return NextResponse.json({ error: "No media file associated with this lecture." }, { status: 404 });
  }

  // Generate a signed URL from private bucket
  const { data: signedData, error: signError } = await supabase.storage
    .from("lecture-media")
    .createSignedUrl(lecture.storage_path, 7200);

  if (!signError && signedData?.signedUrl) {
    return NextResponse.redirect(signedData.signedUrl, 302);
  }

  // Fallback: download directly and stream response with Range support
  const { data: object, error: downloadError } = await supabase.storage
    .from("lecture-media")
    .download(lecture.storage_path);

  if (downloadError || !object) {
    return NextResponse.json({ error: "Media file could not be read." }, { status: 500 });
  }

  const mimeType = lecture.mime_type || "audio/webm";
  const filename = encodeURIComponent(lecture.title || "lecture-media");
  const buffer = Buffer.from(await object.arrayBuffer());
  const fileSize = buffer.length;
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const chunk = buffer.subarray(start, end + 1);

    return new Response(chunk, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
