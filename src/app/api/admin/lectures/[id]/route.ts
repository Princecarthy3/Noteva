import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    const adminClient = createAdminClient();

    const [lectureRes, noteRes] = await Promise.all([
      adminClient.from("lectures").select("*").eq("id", id).maybeSingle(),
      adminClient.from("notes").select("*").eq("lecture_id", id).maybeSingle(),
    ]);

    if (lectureRes.error || !lectureRes.data) {
      return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
    }

    const lecture = lectureRes.data;

    // Fetch student profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, university, degree")
      .eq("id", lecture.user_id)
      .maybeSingle();

    // Generate signed URL if storagePath exists
    let mediaUrl: string | null = null;
    if (lecture.storage_path) {
      const { data: signed } = await adminClient.storage
        .from("lectures")
        .createSignedUrl(lecture.storage_path, 3600);
      mediaUrl = signed?.signedUrl ?? null;
    } else if (lecture.source_url) {
      mediaUrl = lecture.source_url;
    }

    return NextResponse.json({
      lecture: {
        ...lecture,
        studentName: profile?.full_name || "Anonymous Student",
        studentUniversity: profile?.university || "Unknown",
        mediaUrl,
      },
      note: noteRes.data || null,
    });
  } catch (err) {
    console.error("Admin fetch lecture detail error:", err);
    return NextResponse.json(
      { error: "Could not retrieve lecture details." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    const adminClient = createAdminClient();

    // Get lecture to locate storage file
    const { data: lecture } = await adminClient
      .from("lectures")
      .select("id, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
    }

    // Delete associated storage file if exists
    if (lecture.storage_path) {
      try {
        await adminClient.storage.from("lectures").remove([lecture.storage_path]);
      } catch (storageErr) {
        console.warn("Storage file removal warning:", storageErr);
      }
    }

    // Delete lecture record (cascades to notes, study_materials, etc.)
    const { error } = await adminClient.from("lectures").delete().eq("id", id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, message: "Lecture deleted successfully." });
  } catch (err) {
    console.error("Admin delete lecture error:", err);
    return NextResponse.json(
      { error: "Could not delete lecture." },
      { status: 500 }
    );
  }
}
