import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAdminReviewReplies } from "@/lib/review-replies";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const [reviewsRes, repliesMap] = await Promise.all([
      adminClient
        .from("student_reviews")
        .select("id, user_id, display_name, university, rating, review, created_at, updated_at")
        .order("created_at", { ascending: false }),
      getAdminReviewReplies(),
    ]);

    if (reviewsRes.error) {
      throw reviewsRes.error;
    }

    const reviews = (reviewsRes.data ?? []).map((r) => {
      const reply = repliesMap.get(r.id);
      return {
        ...r,
        admin_reply: reply?.replyText || null,
        admin_reply_at: reply?.repliedAt || null,
        admin_reply_by: reply?.adminEmail || null,
      };
    });

    return NextResponse.json({
      total: reviews.length,
      reviews,
    });
  } catch (err) {
    console.error("Admin fetch reviews error:", err);
    return NextResponse.json(
      { error: "Could not retrieve student reviews." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Review ID is required." }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from("student_reviews").delete().eq("id", id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, message: "Review deleted successfully." });
  } catch (err) {
    console.error("Admin delete review error:", err);
    return NextResponse.json(
      { error: "Could not delete review." },
      { status: 500 }
    );
  }
}
