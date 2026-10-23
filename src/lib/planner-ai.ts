import { createAdminClient } from "@/lib/supabase/admin";

const hourlyLimit = 20;

export async function startPlannerAiRequest(userId: string, feature: "planner_import" | "planner_generation") {
  const admin = createAdminClient();
  const { count, error: countError } = await admin.from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("status", "succeeded")
    .contains("input_metadata", { feature })
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (countError) {
    console.error("Planner AI rate-limit check failed", { code: countError.code, feature });
    throw new Error("AI calendar requests could not be checked. Please try again.");
  }
  if ((count ?? 0) >= hourlyLimit) return { limited: true as const };

  const generationId = crypto.randomUUID();
  const { error: insertError } = await admin.from("ai_generations").insert({
    id: generationId,
    owner_id: userId,
    task: "question",
    status: "processing",
    input_metadata: { feature },
  });
  if (insertError) {
    console.error("Planner AI request tracking failed", { code: insertError.code, feature });
    throw new Error("AI calendar requests could not be tracked. Check the Stage 4 migration and service-role configuration.");
  }
  return { limited: false as const, admin, generationId };
}

export async function finishPlannerAiRequest(
  request: { admin: ReturnType<typeof createAdminClient>; generationId: string },
  status: "succeeded" | "failed",
) {
  const { error } = await request.admin.from("ai_generations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", request.generationId);
  if (error) console.error("Planner AI request status update failed", { code: error.code, status });
}
