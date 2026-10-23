import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  let body: {
    pace?: unknown;
    sessionMinutes?: unknown;
    breakMinutes?: unknown;
    dailyLimitMinutes?: unknown;
    preferredTimes?: unknown;
    studyDays?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Study preferences were not valid JSON." }, { status: 400 });
  }
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Study preferences are unavailable until Supabase is configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to save study preferences." }, { status: 401 });

  const validTimes = ["morning", "afternoon", "evening"];
  if (typeof body.pace !== "string" || !["light", "balanced", "intense"].includes(body.pace)
    || !Number.isInteger(body.sessionMinutes) || (body.sessionMinutes as number) < 20 || (body.sessionMinutes as number) > 120
    || !Number.isInteger(body.breakMinutes) || (body.breakMinutes as number) < 5 || (body.breakMinutes as number) > 30
    || !Number.isInteger(body.dailyLimitMinutes) || (body.dailyLimitMinutes as number) < 30 || (body.dailyLimitMinutes as number) > 600
    || !Array.isArray(body.preferredTimes) || !body.preferredTimes.length || body.preferredTimes.some((time) => typeof time !== "string" || !validTimes.includes(time))
    || !Array.isArray(body.studyDays) || !body.studyDays.length || body.studyDays.some((day) => !Number.isInteger(day) || (day as number) < 0 || (day as number) > 6)) {
    return NextResponse.json({ error: "Check your pace, duration, breaks, daily limit, preferred times, and study days." }, { status: 400 });
  }
  const { error } = await supabase.from("study_preferences").upsert({
    user_id: user.id,
    pace: body.pace,
    session_minutes: body.sessionMinutes,
    break_minutes: body.breakMinutes,
    daily_limit_minutes: body.dailyLimitMinutes,
    preferred_times: [...new Set(body.preferredTimes)],
    study_days: [...new Set(body.studyDays)],
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) {
    console.error("Study preferences save failed", { code: error.code });
    return NextResponse.json({ error: "Study preferences could not be saved. Apply the Stage 4 migration and retry." }, { status: 500 });
  }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
}
