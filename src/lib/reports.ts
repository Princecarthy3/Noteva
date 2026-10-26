import { createAdminClient } from "@/lib/supabase/admin";

export type ModerationReport = {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  groupId: string;
  groupName: string;
  messageId: string | null;
  details: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  adminNotes: string | null;
};

/**
 * Save a new moderation report
 */
export async function createModerationReport(params: {
  reporterId: string;
  groupId: string;
  groupName: string;
  messageId?: string | null;
  details: string;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();

    // Fetch reporter profile & email
    const [profileRes, userRes] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", params.reporterId).maybeSingle(),
      admin.auth.admin.getUserById(params.reporterId),
    ]);

    const reporterName = profileRes.data?.full_name || userRes.data?.user?.email?.split("@")[0] || "Anonymous Student";
    const reporterEmail = userRes.data?.user?.email || "No email available";

    const reportContent: Omit<ModerationReport, "id"> = {
      reporterId: params.reporterId,
      reporterName,
      reporterEmail,
      groupId: params.groupId,
      groupName: params.groupName,
      messageId: params.messageId || null,
      details: params.details.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      adminNotes: null,
    };

    const { data: inserted, error } = await admin
      .from("resources")
      .insert({
        owner_id: params.reporterId,
        title: `Report: ${params.groupName.slice(0, 80)}`,
        resource_type: "moderation_report",
        visibility: "private",
        content: reportContent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to insert moderation report:", error);
      return null;
    }

    return inserted?.id || null;
  } catch (err) {
    console.error("Error creating report:", err);
    return null;
  }
}

/**
 * Fetch all moderation reports for the admin portal
 */
export async function getModerationReports(): Promise<ModerationReport[]> {
  try {
    const admin = createAdminClient();
    const { data: records, error } = await admin
      .from("resources")
      .select("id, title, content, created_at")
      .eq("resource_type", "moderation_report")
      .order("created_at", { ascending: false });

    if (error || !records) return [];

    return records.map((r) => {
      const c = (r.content as Partial<ModerationReport>) || {};
      return {
        id: r.id,
        reporterId: c.reporterId || "unknown",
        reporterName: c.reporterName || "Anonymous Student",
        reporterEmail: c.reporterEmail || "studystation.support@gmail.com",
        groupId: c.groupId || "unknown",
        groupName: c.groupName || r.title || "Study Group",
        messageId: c.messageId || null,
        details: c.details || "No details provided.",
        status: c.status || "pending",
        createdAt: c.createdAt || r.created_at,
        resolvedAt: c.resolvedAt || null,
        adminNotes: c.adminNotes || null,
      };
    });
  } catch (err) {
    console.error("Error loading moderation reports:", err);
    return [];
  }
}

/**
 * Update report status (e.g. resolve or dismiss)
 */
export async function updateReportStatus(
  reportId: string,
  status: "pending" | "resolved" | "dismissed",
  adminNotes?: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: record } = await admin
      .from("resources")
      .select("id, content")
      .eq("id", reportId)
      .eq("resource_type", "moderation_report")
      .maybeSingle();

    if (!record) return false;

    const content = (record.content as Partial<ModerationReport>) || {};
    const updatedContent: Partial<ModerationReport> = {
      ...content,
      status,
      resolvedAt: status === "resolved" ? new Date().toISOString() : content.resolvedAt,
      adminNotes: adminNotes ?? content.adminNotes,
    };

    const { error } = await admin
      .from("resources")
      .update({
        content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    return !error;
  } catch (err) {
    console.error("Error updating report status:", err);
    return false;
  }
}

/**
 * Delete a report
 */
export async function deleteReport(reportId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("resources")
      .delete()
      .eq("id", reportId)
      .eq("resource_type", "moderation_report");
    return !error;
  } catch (err) {
    console.error("Error deleting report:", err);
    return false;
  }
}
