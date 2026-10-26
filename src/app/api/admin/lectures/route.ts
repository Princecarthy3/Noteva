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
    const query = searchParams.get("q")?.toLowerCase().trim() || "";
    const statusFilter = searchParams.get("status") || "all";
    const sourceFilter = searchParams.get("source") || "all";

    // Query lectures and profiles in parallel
    const [lecturesRes, profilesRes, notesRes] = await Promise.all([
      adminClient
        .from("lectures")
        .select(
          "id, user_id, course_id, title, source_type, source_url, storage_path, mime_type, duration_seconds, language, status, processing_error, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      adminClient.from("profiles").select("id, full_name, university"),
      adminClient.from("notes").select("lecture_id"),
    ]);

    if (lecturesRes.error) {
      throw lecturesRes.error;
    }

    const profilesMap = new Map<string, { fullName: string; university: string | null }>();
    if (profilesRes.data) {
      for (const p of profilesRes.data) {
        profilesMap.set(p.id, {
          fullName: p.full_name || "Unknown Student",
          university: p.university || null,
        });
      }
    }

    const noteLectureIds = new Set<string>();
    if (notesRes.data) {
      for (const n of notesRes.data) {
        noteLectureIds.add(n.lecture_id);
      }
    }

    let lectures = (lecturesRes.data ?? []).map((l) => {
      const student = profilesMap.get(l.user_id);
      return {
        id: l.id,
        userId: l.user_id,
        studentName: student?.fullName || "Anonymous Student",
        studentUniversity: student?.university || "Unknown",
        title: l.title,
        sourceType: l.source_type,
        sourceUrl: l.source_url,
        storagePath: l.storage_path,
        mimeType: l.mime_type,
        durationSeconds: l.duration_seconds,
        status: l.status,
        hasNotes: noteLectureIds.has(l.id),
        processingError: l.processing_error,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      };
    });

    // Filter by status
    if (statusFilter !== "all") {
      lectures = lectures.filter((l) => l.status === statusFilter);
    }

    // Filter by source
    if (sourceFilter !== "all") {
      lectures = lectures.filter((l) => l.sourceType === sourceFilter);
    }

    // Filter by search query
    if (query) {
      lectures = lectures.filter(
        (l) =>
          l.title.toLowerCase().includes(query) ||
          l.studentName.toLowerCase().includes(query) ||
          l.studentUniversity.toLowerCase().includes(query) ||
          l.id.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      total: lectures.length,
      lectures,
    });
  } catch (err) {
    console.error("Admin fetch lectures failed:", err);
    return NextResponse.json(
      { error: "Could not retrieve lectures." },
      { status: 500 }
    );
  }
}
