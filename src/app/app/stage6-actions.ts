"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Stage6ActionResult = { error?: string; success?: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function localDateTimeToIso(value: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const expected = match.slice(1).map(Number);
  const target = Date.UTC(expected[0], expected[1] - 1, expected[2], expected[3], expected[4]);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const fields = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    const rendered = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
    instant = target - (rendered - instant);
  }

  const finalParts = formatter.formatToParts(new Date(instant));
  const fields = Object.fromEntries(finalParts.map((part) => [part.type, Number(part.value)]));
  const actual = [fields.year, fields.month, fields.day, fields.hour, fields.minute];
  if (actual.some((part, index) => part !== expected[index])) return null;
  return new Date(instant).toISOString();
}

async function getUserClient() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Study actions are unavailable until Supabase is configured." } as const;
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Your session has expired. Sign in again to continue." } as const;
  return { supabase, user } as const;
}

function courseWriteError(error: { code: string }, operation: "add" | "update") {
  console.error("Course write failed", { operation, code: error.code });
  if (error.code === "23505") {
    return "A course with this code already exists in your course list. Choose a different course code.";
  }
  if (error.code === "42501") {
    return "You don’t have permission to save this course. Refresh the page and sign in again.";
  }
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code)) {
    return "Course storage is out of date. Apply the latest Supabase migrations, then try again.";
  }
  return `We couldn’t ${operation} that course because of a database error (code ${error.code}). Please try again.`;
}

export async function saveCourse(formData: FormData): Promise<Stage6ActionResult> {
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const id = value(formData, "id");
  const code = value(formData, "code").toUpperCase();
  const title = value(formData, "title");
  const term = value(formData, "term");
  const color = value(formData, "color") || "#7259e8";

  if (id && !uuidPattern.test(id)) return { error: "That course could not be found. Refresh and try again." };
  if (code.length < 1 || code.length > 30 || title.length < 2 || title.length > 120) {
    return { error: "Enter a course code (up to 30 characters) and title (2–120 characters)." };
  }
  if (term.length > 80 || !/^#[0-9a-f]{6}$/i.test(color)) return { error: "Check the course term and color, then try again." };

  const changes = { code, title, term: term || null, color, updated_at: new Date().toISOString() };
  if (id) {
    const { data, error } = await auth.supabase
      .from("courses")
      .update(changes)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select("id")
      .maybeSingle();
    if (error) return { error: courseWriteError(error, "update") };
    if (!data) return { error: "That course is no longer available in your account." };
  } else {
    const { error } = await auth.supabase.from("courses").insert({
      ...changes,
      user_id: auth.user.id,
      archived: false,
    });
    if (error) return { error: courseWriteError(error, "add") };
  }

  revalidatePath("/app");
  return { success: id ? "Course updated." : "Course added." };
}

export async function setCourseArchived(id: string, archived: boolean): Promise<Stage6ActionResult> {
  if (!uuidPattern.test(id)) return { error: "That course could not be found. Refresh and try again." };
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const { data, error } = await auth.supabase
    .from("courses")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "We couldn’t update that course. Please retry." };
  if (!data) return { error: "That course is no longer available in your account." };

  revalidatePath("/app");
  return { success: archived ? "Course archived." : "Course restored." };
}

export async function removeCourse(id: string): Promise<Stage6ActionResult> {
  if (!uuidPattern.test(id)) return { error: "That course could not be found. Refresh and try again." };
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const { data, error } = await auth.supabase
    .from("courses")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "We couldn’t remove that course. Please retry." };
  if (!data) return { error: "That course is no longer available in your account." };

  revalidatePath("/app");
  return { success: "Course removed from your list." };
}

export async function createStudyTask(formData: FormData): Promise<Stage6ActionResult> {
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const title = value(formData, "title");
  const description = value(formData, "description");
  const dueAtValue = value(formData, "dueAt");
  const timezone = value(formData, "timezone") || "UTC";
  const courseId = value(formData, "courseId");
  const priority = value(formData, "priority") || "normal";
  if (title.length < 2 || title.length > 160) return { error: "Enter a task title between 2 and 160 characters." };
  if (description.length > 2000) return { error: "Keep task notes under 2,000 characters." };
  if (!["low", "normal", "high"].includes(priority)) return { error: "Choose a valid task priority." };
  if (courseId && !uuidPattern.test(courseId)) return { error: "Choose a valid course or leave it unassigned." };

  let dueAt: string | null = null;
  if (dueAtValue) {
    try {
      dueAt = localDateTimeToIso(dueAtValue, timezone);
    } catch {
      return { error: "Choose a valid task deadline and timezone." };
    }
    if (!dueAt) return { error: "That deadline is not a valid local time. Choose another time." };
  }

  if (courseId) {
    const { data: course, error } = await auth.supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error || !course) return { error: "That course is not available in your account." };
  }

  const { error } = await auth.supabase.from("study_tasks").insert({
    owner_id: auth.user.id,
    course_id: courseId || null,
    title,
    description: description || null,
    due_at: dueAt,
    status: "todo",
    priority,
  });
  if (error) return { error: "We couldn’t save that task. Check that the Stage 4 migration is applied, then retry." };

  revalidatePath("/app");
  return { success: "Task added to your study list." };
}

export async function updateStudyTask(formData: FormData): Promise<Stage6ActionResult> {
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const id = value(formData, "id");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const dueAtValue = value(formData, "dueAt");
  const timezone = value(formData, "timezone") || "UTC";
  const courseId = value(formData, "courseId");
  const priority = value(formData, "priority");
  const status = value(formData, "status");
  if (!uuidPattern.test(id)) return { error: "That task could not be found. Refresh and try again." };
  if (title.length < 2 || title.length > 160) return { error: "Enter a task title between 2 and 160 characters." };
  if (description.length > 2000) return { error: "Keep task notes under 2,000 characters." };
  if (!["low", "normal", "high"].includes(priority)) return { error: "Choose a valid task priority." };
  if (!["todo", "in_progress", "completed", "cancelled"].includes(status)) return { error: "Choose a valid task status." };
  if (courseId && !uuidPattern.test(courseId)) return { error: "Choose a valid course or leave it unassigned." };

  let dueAt: string | null = null;
  if (dueAtValue) {
    try {
      dueAt = localDateTimeToIso(dueAtValue, timezone);
    } catch {
      return { error: "Choose a valid task deadline and timezone." };
    }
    if (!dueAt) return { error: "That deadline is not a valid local time. Choose another time." };
  }
  if (courseId) {
    const { data: course, error } = await auth.supabase.from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error || !course) return { error: "That course is not available in your account." };
  }

  const { data, error } = await auth.supabase.from("study_tasks")
    .update({
      title,
      description: description || null,
      due_at: dueAt,
      course_id: courseId || null,
      priority,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "We couldn’t update that task. Check the deadline and try again." };
  if (!data) return { error: "That task is no longer available in your account." };
  revalidatePath("/app");
  return { success: "Task updated." };
}

export async function setStudyTaskStatus(id: string, status: string): Promise<Stage6ActionResult> {
  if (!uuidPattern.test(id) || !["todo", "in_progress", "completed", "cancelled"].includes(status)) {
    return { error: "That task update is not valid. Refresh and try again." };
  }
  const auth = await getUserClient();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase.from("study_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "The task status could not be changed. Please retry." };
  if (!data) return { error: "That task is no longer available in your account." };
  revalidatePath("/app");
  return { success: status === "completed" ? "Task completed." : "Task reopened." };
}

export async function deleteStudyTask(id: string): Promise<Stage6ActionResult> {
  if (!uuidPattern.test(id)) return { error: "That task could not be found. Refresh and try again." };
  const auth = await getUserClient();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase.from("study_tasks")
    .delete()
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "The task could not be deleted. Please retry." };
  if (!data) return { error: "That task is no longer available in your account." };
  revalidatePath("/app");
  return { success: "Task deleted." };
}

const timetableEventTypes = ["lecture", "lab", "seminar", "study", "review", "exam", "personal"];

export async function savePlannerEvent(formData: FormData): Promise<Stage6ActionResult> {
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const id = value(formData, "id");
  const title = value(formData, "title");
  const location = value(formData, "location");
  const type = value(formData, "type");
  const startsAtValue = value(formData, "startsAt");
  const endsAtValue = value(formData, "endsAt");
  const timezone = value(formData, "timezone") || "UTC";
  const courseId = value(formData, "courseId");
  if (id && !uuidPattern.test(id)) return { error: "That calendar item could not be found. Refresh and try again." };
  if (title.length < 2 || title.length > 160 || location.length > 200) return { error: "Enter a title (2–160 characters) and keep the location under 200 characters." };
  if (!timetableEventTypes.includes(type)) return { error: "Choose a valid calendar item type." };
  if (courseId && !uuidPattern.test(courseId)) return { error: "Choose a valid course or leave it unassigned." };

  let startsAt: string | null;
  let endsAt: string | null;
  try {
    startsAt = localDateTimeToIso(startsAtValue, timezone);
    endsAt = localDateTimeToIso(endsAtValue, timezone);
  } catch {
    return { error: "Choose valid start and end times for your timezone." };
  }
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return { error: "Choose valid local times and make sure the end is after the start." };
  }
  if (courseId) {
    const { data: course, error } = await auth.supabase.from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error || !course) return { error: "That course is not available in your account." };
  }

  const event = {
    user_id: auth.user.id,
    course_id: courseId || null,
    title,
    location: location || null,
    type,
    starts_at: startsAt,
    ends_at: endsAt,
    generated: false,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { data, error } = await auth.supabase.from("timetable_events")
      .update(event)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select("id")
      .maybeSingle();
    if (error) return { error: "The calendar item could not be updated. Check its times and try again." };
    if (!data) return { error: "That calendar item is no longer available in your account." };
  } else {
    const { error } = await auth.supabase.from("timetable_events").insert(event);
    if (error) return { error: "The calendar item could not be saved. Check that the Stage 4 migration is applied." };
  }
  revalidatePath("/app");
  return { success: id ? "Calendar item updated." : "Calendar item added." };
}

export type PlannerEventInput = {
  title: string;
  type: string;
  location?: string | null;
  courseId?: string | null;
  startsAtLocal: string;
  endsAtLocal: string;
  generated?: boolean;
  source?: string;
};

export async function createPlannerEvents(
  items: PlannerEventInput[],
  timezone: string,
): Promise<Stage6ActionResult> {
  if (!Array.isArray(items) || items.length < 1 || items.length > 200) {
    return { error: "Choose between 1 and 200 calendar items to import." };
  }
  if (typeof timezone !== "string" || timezone.length > 100) return { error: "Choose a valid calendar timezone." };
  const auth = await getUserClient();
  if ("error" in auth) return auth;

  const normalized: Array<{
    user_id: string;
    course_id: string | null;
    type: string;
    title: string;
    location: string | null;
    starts_at: string;
    ends_at: string;
    generated: boolean;
    source_metadata: Record<string, string>;
  }> = [];
  const courseIds = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== "object") return { error: "A calendar item was invalid." };
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const location = typeof item.location === "string" ? item.location.trim() : "";
    const courseId = typeof item.courseId === "string" && item.courseId ? item.courseId : null;
    const source = typeof item.source === "string" && ["manual_import", "ai_study_plan"].includes(item.source)
      ? item.source : "manual_import";
    if (title.length < 2 || title.length > 160 || location.length > 200
      || !timetableEventTypes.includes(item.type)
      || (courseId && !uuidPattern.test(courseId))) {
      return { error: "Check calendar titles, event types, locations, and course selections before saving." };
    }
    if (courseId) courseIds.add(courseId);
    let startLocal = item.startsAtLocal;
    let endLocal = item.endsAtLocal;
    const nowYear = new Date().getFullYear();
    if (startLocal && parseInt(startLocal.slice(0, 4), 10) < 2000) {
      startLocal = `${nowYear}${startLocal.slice(4)}`;
    }
    if (endLocal && parseInt(endLocal.slice(0, 4), 10) < 2000) {
      endLocal = `${nowYear}${endLocal.slice(4)}`;
    }

    let startsAt: string | null;
    let endsAt: string | null;
    try {
      startsAt = localDateTimeToIso(startLocal, timezone);
      endsAt = localDateTimeToIso(endLocal, timezone);
    } catch {
      return { error: "The calendar timezone is not valid." };
    }
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
      return { error: "Every calendar item needs a valid start and an end after it in your timezone." };
    }
    normalized.push({
      user_id: auth.user.id,
      course_id: courseId,
      type: item.type,
      title,
      location: location || null,
      starts_at: startsAt,
      ends_at: endsAt,
      generated: item.generated === true,
      source_metadata: { source },
    });
  }

  if (courseIds.size) {
    const { data: ownedCourses, error } = await auth.supabase.from("courses")
      .select("id")
      .eq("user_id", auth.user.id)
      .in("id", [...courseIds]);
    if (error || ownedCourses?.length !== courseIds.size) return { error: "One or more selected courses are not available in your account." };
  }

  const { error } = await auth.supabase.from("timetable_events").insert(normalized);
  if (error) return { error: "Calendar items could not be saved. Check that the Stage 4 migration is applied and retry." };
  revalidatePath("/app");
  return { success: `${normalized.length} calendar ${normalized.length === 1 ? "item" : "items"} added.` };
}

export type StudyPreferencesInput = {
  pace: string;
  sessionMinutes: number;
  breakMinutes: number;
  dailyLimitMinutes: number;
  preferredTimes: string[];
  studyDays: number[];
};

export async function saveStudyPreferences(preferences: StudyPreferencesInput): Promise<Stage6ActionResult> {
  const auth = await getUserClient();
  if ("error" in auth) return auth;
  if (!preferences || !["light", "balanced", "intense"].includes(preferences.pace)
    || !Number.isInteger(preferences.sessionMinutes) || preferences.sessionMinutes < 20 || preferences.sessionMinutes > 120
    || !Number.isInteger(preferences.breakMinutes) || preferences.breakMinutes < 5 || preferences.breakMinutes > 30
    || !Number.isInteger(preferences.dailyLimitMinutes) || preferences.dailyLimitMinutes < 30 || preferences.dailyLimitMinutes > 600
    || !Array.isArray(preferences.preferredTimes) || preferences.preferredTimes.length < 1
    || preferences.preferredTimes.some((time) => !["morning", "afternoon", "evening"].includes(time))
    || !Array.isArray(preferences.studyDays) || preferences.studyDays.length < 1
    || preferences.studyDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return { error: "Check your pace, session length, breaks, daily limit, preferred times, and study days." };
  }
  const { error } = await auth.supabase.from("study_preferences").upsert({
    user_id: auth.user.id,
    pace: preferences.pace,
    session_minutes: preferences.sessionMinutes,
    break_minutes: preferences.breakMinutes,
    daily_limit_minutes: preferences.dailyLimitMinutes,
    preferred_times: [...new Set(preferences.preferredTimes)],
    study_days: [...new Set(preferences.studyDays)],
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return { error: "Your study preferences could not be saved. Check that the Stage 4 migration is applied." };
  revalidatePath("/app");
  return { success: "Study preferences saved." };
}

export async function deletePlannerEvent(id: string): Promise<Stage6ActionResult> {
  if (!uuidPattern.test(id)) return { error: "That calendar item could not be found. Refresh and try again." };
  const auth = await getUserClient();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase.from("timetable_events")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "The calendar item could not be deleted. Please retry." };
  if (!data) return { error: "That calendar item is no longer available in your account." };
  revalidatePath("/app");
  return { success: "Calendar item deleted." };
}
