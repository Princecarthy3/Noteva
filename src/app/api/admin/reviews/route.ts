import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const { data: reviews, error } = await adminClient
      .from("student_reviews")
      .select("id, user_id, display_name, university, rating, review, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      total: reviews?.length ?? 0,
      reviews: reviews ?? [],
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
