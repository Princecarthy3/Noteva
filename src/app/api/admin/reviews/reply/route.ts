import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { saveAdminReviewReply, deleteAdminReviewReply } from "@/lib/review-replies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: Add or update an official reply to a student review
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { reviewId?: string; replyText?: string };
    const reviewId = body.reviewId?.trim();
    const replyText = body.replyText?.trim();

    if (!reviewId) {
      return NextResponse.json({ error: "Review ID is required." }, { status: 400 });
    }
    if (!replyText || replyText.length < 2) {
      return NextResponse.json({ error: "Please write a response before saving." }, { status: 400 });
    }

    const saved = await saveAdminReviewReply(reviewId, replyText, session.email);
    if (!saved) {
      return NextResponse.json({ error: "Could not save admin reply." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Admin reply saved and published to landing page.",
    });
  } catch (err) {
    console.error("Admin review reply save error:", err);
    return NextResponse.json({ error: "Failed to save reply." }, { status: 500 });
  }
}

/**
 * Admin: Delete an official reply
 */
export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");
    if (!reviewId) {
      return NextResponse.json({ error: "Review ID is required." }, { status: 400 });
    }

    const deleted = await deleteAdminReviewReply(reviewId);
    if (!deleted) {
      return NextResponse.json({ error: "Could not delete reply." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Admin reply removed." });
  } catch (err) {
    console.error("Delete review reply error:", err);
    return NextResponse.json({ error: "Failed to delete reply." }, { status: 500 });
  }
}
