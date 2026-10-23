import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthLayout } from "@/app/auth/auth-layout";
import type { Stage6DashboardData, OrganizedNoteData } from "@/components/stage6-workspace";
import type { PlannerData } from "@/components/study-planner";

export const metadata: Metadata = {
  title: "Your study space",
  description: "Capture lectures, review notes and plan your study week with StudyStation.",
};
export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f7f6fb] text-sm font-bold text-[#7259e8]">Opening your study space…</div>}>
      <ProtectedWorkspace />
    </Suspense>
  );
}

async function ProtectedWorkspace() {
  if (!isSupabaseConfigured()) {
    return <SetupState message="Sign-in is not available yet. Add your Supabase project URL and publishable key to .env.local, then restart the app." />;
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return <SetupState message="The Supabase settings could not be read. Check your environment values and reload the app." />;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?next=/app");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, programme, university, current_semester, timezone, avatar_url, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return <SetupState message="Your profile database is not ready. Apply the Stage 4 and Stage 5 migrations to your Supabase project, then reload." />;
  }
  if (!profile?.onboarding_complete) redirect("/onboarding");

  let avatarUrl: string | null = null;
  let avatarPath = "";
  if (profile.avatar_url) {
    if (profile.avatar_url.startsWith(`${user.id}/`)) {
      avatarPath = profile.avatar_url;
      const { data: signedAvatar, error: avatarError } = await supabase.storage
        .from("profile-avatars")
        .createSignedUrl(profile.avatar_url, 60 * 60);
      if (avatarError) console.error("Profile picture URL could not be created", { code: avatarError.name });
      avatarUrl = signedAvatar?.signedUrl ?? null;
    } else if (/^https:\/\//i.test(profile.avatar_url)) {
      avatarUrl = profile.avatar_url;
    }
  }

  const now = new Date();
  const [coursesResult, tasksResult, eventsResult, lecturesResult, plannerTasksResult, plannerEventsResult, groupSessionsResult, completedTasksResult, processedLecturesResult, quizAttemptsResult, recentAttemptsResult, preferencesResult, notesResult] = await Promise.all([
    supabase.from("courses")
      .select("id, title, code, color, term, archived")
      .eq("user_id", user.id)
      .order("title", { ascending: true }),
    supabase.from("study_tasks")
      .select("id, title, due_at, status, course_id")
      .eq("owner_id", user.id)
      .in("status", ["todo", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase.from("timetable_events")
      .select("id, title, type, location, starts_at, ends_at, course_id")
      .eq("user_id", user.id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10),
    supabase.from("lectures")
      .select("id, title, status, created_at, duration_seconds, course_id, transcript")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("study_tasks")
      .select("id, title, description, due_at, status, priority, course_id")
      .eq("owner_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase.from("timetable_events")
      .select("id, title, type, location, starts_at, ends_at, course_id")
      .eq("user_id", user.id)
      .gte("starts_at", new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .lte("starts_at", new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(1500),
    supabase.from("study_sessions")
      .select("id, title, starts_at, ends_at, study_groups!inner(name)")
      .eq("status", "scheduled")
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(10),
    supabase.from("study_tasks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "completed"),
    supabase.from("lectures")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready"),
    supabase.from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("quiz_attempts")
      .select("id, score, total, completed_at, quizzes!inner(title)")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(10),
    supabase.from("study_preferences")
      .select("pace, session_minutes, break_minutes, daily_limit_minutes, preferred_times, study_days")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("notes")
      .select("id, lecture_id, title, summary, content, created_at, updated_at")
      .eq("user_id", user.id)
      .limit(100),
  ]);

  const notesByLectureId = new Map<string, OrganizedNoteData>(
    ((notesResult?.data as Array<{
      id: string;
      lecture_id: string;
      title: string;
      summary: string;
      content: any;
      created_at: string;
      updated_at: string;
    }> | null) ?? []).map((n) => [
      n.lecture_id,
      {
        id: n.id,
        title: n.title,
        summary: n.summary,
        content: n.content,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      },
    ])
  );

  const safeColor = (color: string | null) => color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#7259e8";
  const dashboardData: Stage6DashboardData = {
    courses: (coursesResult.data ?? []).map((course) => ({
      id: course.id,
      title: course.title,
      code: course.code,
      color: safeColor(course.color),
      term: course.term,
      archived: course.archived,
    })),
    tasks: (tasksResult.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.due_at,
      status: task.status,
      courseId: task.course_id,
    })),
    events: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      location: event.location,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      courseId: event.course_id,
    })),
    lectures: (lecturesResult.data ?? []).map((lecture) => ({
      id: lecture.id,
      title: lecture.title,
      status: lecture.status,
      createdAt: lecture.created_at,
      durationSeconds: lecture.duration_seconds,
      courseId: lecture.course_id,
      transcript: lecture.transcript,
      note: notesByLectureId.get(lecture.id) ?? null,
    })),
    errors: {
      courses: Boolean(coursesResult.error),
      tasks: Boolean(tasksResult.error),
      events: Boolean(eventsResult.error),
      lectures: Boolean(lecturesResult.error),
    },
    context: [profile.programme, profile.current_semester, profile.university].filter((part): part is string => Boolean(part)),
    currentSemester: profile.current_semester,
    timezone: profile.timezone || "UTC",
  };

  const recentAttempts = (recentAttemptsResult.data ?? []).map((attempt) => {
    const quizRelation = attempt.quizzes as { title: string } | { title: string }[] | null;
    const quiz = Array.isArray(quizRelation) ? quizRelation[0] : quizRelation;
    return {
      id: attempt.id,
      title: quiz?.title ?? "Quiz",
      score: attempt.score,
      total: attempt.total,
      completedAt: attempt.completed_at,
    };
  });
  const recentAttemptTotals = recentAttempts.reduce((totals, attempt) => ({
    score: totals.score + attempt.score,
    total: totals.total + attempt.total,
  }), { score: 0, total: 0 });
  const plannerData: PlannerData = {
    asOf: now.getTime(),
    tasks: (plannerTasksResult.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.due_at,
      status: task.status,
      priority: task.priority,
      courseId: task.course_id,
    })),
    events: (plannerEventsResult.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      location: event.location,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      courseId: event.course_id,
    })),
    groupSessions: (groupSessionsResult.data ?? []).map((session) => {
      const groupRelation = session.study_groups as { name: string } | { name: string }[];
      const group = Array.isArray(groupRelation) ? groupRelation[0] : groupRelation;
      return {
        id: session.id,
        title: session.title,
        groupName: group?.name ?? "Study group",
        startsAt: session.starts_at,
        endsAt: session.ends_at,
      };
    }),
    preferences: {
      pace: preferencesResult.data?.pace ?? "balanced",
      sessionMinutes: preferencesResult.data?.session_minutes ?? 45,
      breakMinutes: preferencesResult.data?.break_minutes ?? 10,
      dailyLimitMinutes: preferencesResult.data?.daily_limit_minutes ?? 150,
      preferredTimes: Array.isArray(preferencesResult.data?.preferred_times)
        ? preferencesResult.data.preferred_times.filter((item): item is string => typeof item === "string")
        : ["afternoon"],
      studyDays: Array.isArray(preferencesResult.data?.study_days)
        ? preferencesResult.data.study_days.filter((item): item is number => Number.isInteger(item))
        : [1, 2, 3, 4, 5],
    },
    progress: {
      completedTasks: completedTasksResult.count ?? 0,
      processedLectures: processedLecturesResult.count ?? 0,
      quizAttempts: quizAttemptsResult.count ?? 0,
      recentQuizAverage: recentAttemptTotals.total
        ? Math.round(recentAttemptTotals.score / recentAttemptTotals.total * 100)
        : null,
      recentAttempts,
    },
    errors: {
      tasks: Boolean(plannerTasksResult.error || completedTasksResult.error),
      events: Boolean(plannerEventsResult.error),
      groupSessions: Boolean(groupSessionsResult.error),
      progress: Boolean(processedLecturesResult.error || quizAttemptsResult.error || recentAttemptsResult.error),
      preferences: Boolean(preferencesResult.error),
    },
  };

  return <AppShell profile={{
    fullName: profile.full_name,
    email: user.email ?? "",
    programme: profile.programme ?? "",
    university: profile.university ?? "",
    semester: profile.current_semester ?? "",
    timezone: profile.timezone || "UTC",
    avatarUrl,
    avatarPath,
  }} dashboardData={dashboardData} plannerData={plannerData} />;
}

function SetupState({ message }: { message: string }) {
  return (
    <AuthLayout>
      <section className="w-full max-w-[480px] rounded-[28px] border border-[#e8e4ef] bg-white p-7 shadow-[0_24px_80px_rgba(41,31,77,.10)]">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Setup required</p>
        <h1 className="mt-3 text-2xl font-black tracking-[-.7px] text-[#17132d]">Connect your study space.</h1>
        <p className="mt-3 text-sm leading-6 text-[#777180]">{message}</p>
      </section>
    </AuthLayout>
  );
}
