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
    const startTime = Date.now();

    // Run parallel analytical queries using Supabase Admin
    const [
      profilesRes,
      authUsersRes,
      lecturesRes,
      aiGensRes,
      notesRes,
      reviewsRes,
      groupsRes,
      recentSignupsRes,
      recentLecturesRes,
      recentAiRes,
      storageBucketsRes,
    ] = await Promise.all([
      // 1. All profiles count & onboarding stats (only valid columns)
      adminClient.from("profiles").select("id, onboarding_complete, full_name, university"),
      // 2. All auth accounts to accurately count registered students
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      // 3. All lectures status, source, duration
      adminClient.from("lectures").select("id, status, source_type, duration_seconds"),
      // 4. AI generations status & tasks
      adminClient.from("ai_generations").select("id, status, task, model"),
      // 5. Notes count
      adminClient.from("notes").select("id", { count: "exact", head: true }),
      // 6. Student reviews rating
      adminClient.from("student_reviews").select("id, rating"),
      // 7. Study groups count
      adminClient.from("study_groups").select("id", { count: "exact", head: true }),
      // 8. Recent 6 signups
      adminClient
        .from("profiles")
        .select("id, full_name, university, degree, country_name, created_at, onboarding_complete")
        .order("created_at", { ascending: false })
        .limit(6),
      // 9. Recent 6 lectures
      adminClient
        .from("lectures")
        .select("id, user_id, title, source_type, status, duration_seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      // 10. Recent 6 AI generations
      adminClient
        .from("ai_generations")
        .select("id, owner_id, task, status, model, created_at, error_code")
        .order("created_at", { ascending: false })
        .limit(6),
      // 11. Check storage bucket
      adminClient.storage.listBuckets(),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    // Profiles & Auth accounts analytics
    const profiles = profilesRes.data ?? [];
    const authUsers = authUsersRes.data?.users ?? [];
    const totalStudents = Math.max(authUsers.length, profiles.length);
    const onboardedStudents = profiles.filter((p) => p.onboarding_complete).length;
    const pendingOnboarding = Math.max(0, totalStudents - onboardedStudents);
    const tourCompleted = onboardedStudents;

    // Lectures analytics
    const lectures = lecturesRes.data ?? [];
    const totalLectures = lectures.length;
    const lecturesByStatus = {
      ready: lectures.filter((l) => l.status === "ready").length,
      processing: lectures.filter((l) => l.status === "processing").length,
      uploaded: lectures.filter((l) => l.status === "uploaded").length,
      failed: lectures.filter((l) => l.status === "failed").length,
    };
    const lecturesBySource = {
      recording: lectures.filter((l) => l.source_type === "recording").length,
      audio: lectures.filter((l) => l.source_type === "audio").length,
      video: lectures.filter((l) => l.source_type === "video").length,
      document: lectures.filter((l) => l.source_type === "document").length,
      link: lectures.filter((l) => l.source_type === "link").length,
    };
    const totalDurationSeconds = lectures.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
    const totalAudioMinutes = Math.round(totalDurationSeconds / 60);

    // AI generations analytics
    const aiGens = aiGensRes.data ?? [];
    const totalAiGenerations = aiGens.length;
    const completedAiGenerations = aiGens.filter((a) => a.status === "completed").length;
    const failedAiGenerations = aiGens.filter((a) => a.status === "failed").length;
    const aiSuccessRate = totalAiGenerations > 0
      ? Math.round((completedAiGenerations / totalAiGenerations) * 100)
      : 100;
    const aiByTask = {
      summary: aiGens.filter((a) => a.task === "summary").length,
      quiz: aiGens.filter((a) => a.task === "quiz").length,
      flashcards: aiGens.filter((a) => a.task === "flashcards").length,
      question: aiGens.filter((a) => a.task === "question").length,
    };

    // Reviews analytics
    const reviews = reviewsRes.data ?? [];
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
      : 5.0;
    const ratingBreakdown = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    // Storage status
    const buckets = storageBucketsRes.data ?? [];
    const lecturesBucketExists = buckets.some((b) => b.name === "lectures");

    return NextResponse.json({
      metrics: {
        totalStudents,
        onboardedStudents,
        pendingOnboarding: totalStudents - onboardedStudents,
        tourCompleted,
        totalLectures,
        lecturesByStatus,
        lecturesBySource,
        totalAudioMinutes,
        totalNotes: notesRes.count ?? 0,
        totalAiGenerations,
        completedAiGenerations,
        failedAiGenerations,
        aiSuccessRate,
        aiByTask,
        totalStudyGroups: groupsRes.count ?? 0,
        totalReviews,
        averageRating,
        ratingBreakdown,
      },
      recent: {
        signups: recentSignupsRes.data ?? [],
        lectures: recentLecturesRes.data ?? [],
        aiGenerations: recentAiRes.data ?? [],
      },
      system: {
        databaseOnline: !profilesRes.error,
        dbLatencyMs,
        storageOnline: !storageBucketsRes.error && lecturesBucketExists,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        nodeEnv: process.env.NODE_ENV || "development",
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Admin overview fetch failed:", error);
    return NextResponse.json(
      { error: "Could not compile admin metrics." },
      { status: 500 }
    );
  }
}
