import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      target?: "all" | "user";
      userId?: string;
      title?: string;
      body?: string;
      type?: string;
    };

    const title = body.title?.trim();
    const content = body.body?.trim();
    const type = body.type?.trim() || "announcement";
    const target = body.target || "all";

    if (!title || title.length < 2) {
      return NextResponse.json({ error: "Announcement title is required." }, { status: 400 });
    }
    if (!content || content.length < 2) {
      return NextResponse.json({ error: "Announcement content is required." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    if (target === "user" && body.userId) {
      const { error } = await adminClient.from("notifications").insert({
        user_id: body.userId,
        title,
        body: content,
        type,
      });

      if (error) throw error;
      return NextResponse.json({ ok: true, recipientCount: 1 });
    }

    // Broadcast to all student profiles
    const { data: profiles, error: profileErr } = await adminClient
      .from("profiles")
      .select("id");

    if (profileErr) throw profileErr;

    const userIds = (profiles ?? []).map((p) => p.id);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, recipientCount: 0 });
    }

    // Batch insert notifications in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize).map((uid) => ({
        user_id: uid,
        title,
        body: content,
        type,
      }));
      await adminClient.from("notifications").insert(chunk);
    }

    return NextResponse.json({
      ok: true,
      recipientCount: userIds.length,
      message: `Announcement broadcasted to ${userIds.length} students.`,
    });
  } catch (err) {
    console.error("Admin broadcast notification error:", err);
    return NextResponse.json(
      { error: "Could not broadcast announcement." },
      { status: 500 }
    );
  }
}
