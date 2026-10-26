import { createAdminClient } from "@/lib/supabase/admin";

export type AdminReplyData = {
  reviewId: string;
  replyText: string;
  repliedAt: string;
  adminEmail: string;
};

/**
 * Fetch all admin review replies as a Map<reviewId, AdminReplyData>
 */
export async function getAdminReviewReplies(): Promise<Map<string, AdminReplyData>> {
  const map = new Map<string, AdminReplyData>();
  try {
    const admin = createAdminClient();
    const { data: records, error } = await admin
      .from("resources")
      .select("id, title, content")
      .eq("resource_type", "admin_review_reply");

    if (error || !records) return map;

    for (const record of records) {
      if (record.title && record.content) {
        const content = record.content as {
          reviewId?: string;
          replyText?: string;
          repliedAt?: string;
          adminEmail?: string;
        };
        const reviewId = record.title;
        if (content.replyText) {
          map.set(reviewId, {
            reviewId,
            replyText: content.replyText,
            repliedAt: content.repliedAt || new Date().toISOString(),
            adminEmail: content.adminEmail || "studystation.support@gmail.com",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error reading admin review replies:", err);
  }
  return map;
}

/**
 * Upsert an admin reply to a review
 */
export async function saveAdminReviewReply(
  reviewId: string,
  replyText: string,
  adminEmail = "studystation.support@gmail.com"
): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // Check if reply already exists for this review
    const { data: existing } = await admin
      .from("resources")
      .select("id")
      .eq("resource_type", "admin_review_reply")
      .eq("title", reviewId)
      .maybeSingle();

    const payload = {
      reviewId,
      replyText: replyText.trim(),
      repliedAt: new Date().toISOString(),
      adminEmail,
    };

    if (existing) {
      const { error } = await admin
        .from("resources")
        .update({
          content: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return !error;
    } else {
      // Create new resource row using a system owner ID or review ID
      const { data: users } = await admin.auth.admin.listUsers();
      const adminUser = users?.users?.find(
        (u) => u.email?.toLowerCase() === "studystation.support@gmail.com"
      );
      const ownerId = adminUser?.id || "00000000-0000-0000-0000-000000000000";

      const { error } = await admin.from("resources").insert({
        owner_id: ownerId,
        title: reviewId,
        resource_type: "admin_review_reply",
        visibility: "private",
        content: payload,
      });
      return !error;
    }
  } catch (err) {
    console.error("Error saving admin review reply:", err);
    return false;
  }
}

/**
 * Delete an admin reply to a review
 */
export async function deleteAdminReviewReply(reviewId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("resources")
      .delete()
      .eq("resource_type", "admin_review_reply")
      .eq("title", reviewId);
    return !error;
  } catch (err) {
    console.error("Error deleting admin review reply:", err);
    return false;
  }
}
