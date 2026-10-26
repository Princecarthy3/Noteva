import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Same-origin media proxy with HTTP Range support so the browser audio element
 * can seek, report duration, and replay reliably (especially for WebM/Opus).
 */
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
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

  const { data: object, error: downloadError } = await supabase.storage
    .from("lecture-media")
    .download(lecture.storage_path);

  if (downloadError || !object) {
    return NextResponse.json({ error: "Media file could not be read." }, { status: 500 });
  }

  const buffer = Buffer.from(await object.arrayBuffer());
  const total = buffer.byteLength;
  const contentType = lecture.mime_type || "audio/webm";
  const filename = encodeURIComponent(lecture.title || "lecture-media");
  const rangeHeader = request.headers.get("range");

  const commonHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${filename}"`,
  };

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start < 0 || start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: {
            ...commonHeaders,
            "Content-Range": `bytes */${total}`,
          },
        });
      }
      const chunk = buffer.subarray(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${start}-${end}/${total}`,
        },
      });
    }
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(total),
    },
  });
}
