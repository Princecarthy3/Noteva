import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const taskFilter = searchParams.get("task") || "all";
    const statusFilter = searchParams.get("status") || "all";
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    let query = adminClient
      .from("ai_generations")
      .select(
        "id, owner_id, course_id, lecture_id, task, status, model, usage_metadata, error_code, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (taskFilter !== "all") {
      query = query.eq("task", taskFilter);
    }
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data: runs, error } = await query;
    if (error) {
      throw error;
    }

    // Map owner names
    const ownerIds = Array.from(new Set((runs ?? []).map((r) => r.owner_id)));
    let ownerMap = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      if (profiles) {
        ownerMap = new Map(profiles.map((p) => [p.id, p.full_name || "Student"]));
      }
    }

    const items = (runs ?? []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      ownerName: ownerMap.get(r.owner_id) || "Anonymous",
      courseId: r.course_id,
      lectureId: r.lecture_id,
      task: r.task,
      status: r.status,
      model: r.model || "gemini-2.5-flash",
      usageMetadata: r.usage_metadata,
      errorCode: r.error_code,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({
      total: items.length,
      items,
    });
  } catch (err) {
    console.error("Admin fetch AI generations error:", err);
    return NextResponse.json(
      { error: "Could not retrieve AI generation logs." },
      { status: 500 }
    );
  }
}
