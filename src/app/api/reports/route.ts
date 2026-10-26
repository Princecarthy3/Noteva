import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  createModerationReport,
  getModerationReports,
  updateReportStatus,
  deleteReport,
} from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Submit a new concern report (students or admin)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required to submit a report." }, { status: 401 });
    }

    const body = (await request.json()) as {
      groupId?: string;
      groupName?: string;
      messageId?: string;
      details?: string;
    };

    if (!body.details || body.details.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide a clear description of the concern." },
        { status: 400 }
      );
    }

    const reportId = await createModerationReport({
      reporterId: user.id,
      groupId: body.groupId || "general",
      groupName: body.groupName || "Study Group",
      messageId: body.messageId || null,
      details: body.details,
    });

    if (!reportId) {
      return NextResponse.json({ error: "Could not save report. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reportId,
      message: "Report received. The admin team has been notified at studystation.support@gmail.com.",
    });
  } catch (err) {
    console.error("Report submission failed:", err);
    return NextResponse.json({ error: "Failed to submit report." }, { status: 500 });
  }
}

/**
 * Admin: Get all moderation reports
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const reports = await getModerationReports();
    return NextResponse.json({
      total: reports.length,
      reports,
    });
  } catch (err) {
    console.error("Fetch reports error:", err);
    return NextResponse.json({ error: "Could not retrieve reports." }, { status: 500 });
  }
}

/**
 * Admin: Update report status
 */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      status?: "pending" | "resolved" | "dismissed";
      adminNotes?: string;
    };

    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Report ID and status are required." }, { status: 400 });
    }

    const success = await updateReportStatus(body.id, body.status, body.adminNotes);
    if (!success) {
      return NextResponse.json({ error: "Could not update report." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Report status updated." });
  } catch (err) {
    console.error("Update report error:", err);
    return NextResponse.json({ error: "Failed to update report." }, { status: 500 });
  }
}

/**
 * Admin: Delete a report
 */
export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
    }

    const success = await deleteReport(id);
    if (!success) {
      return NextResponse.json({ error: "Could not delete report." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Report deleted." });
  } catch (err) {
    console.error("Delete report error:", err);
    return NextResponse.json({ error: "Failed to delete report." }, { status: 500 });
  }
}
