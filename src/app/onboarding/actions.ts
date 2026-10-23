"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/app/auth/actions";

const countryNames: Record<string, string> = {
  GH: "Ghana",
  NG: "Nigeria",
  KE: "Kenya",
  ZA: "South Africa",
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  OTHER: "Other",
};
type CourseInput = { code: string; title: string };

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseCourses(raw: string): CourseInput[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length > 12) return null;

  const courses: CourseInput[] = [];
  const seenCodes = new Set<string>();
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { code, title } = item as Record<string, unknown>;
    if (typeof code !== "string" || typeof title !== "string") return null;
    const cleanCode = code.trim();
    const cleanTitle = title.trim();
    if (!cleanCode && !cleanTitle) continue;
    if (cleanCode.length < 1 || cleanCode.length > 30 || cleanTitle.length < 2 || cleanTitle.length > 120) return null;
    const normalizedCode = cleanCode.toUpperCase();
    if (seenCodes.has(normalizedCode)) return null;
    seenCodes.add(normalizedCode);
    courses.push({ code: normalizedCode, title: cleanTitle });
  }
  return courses;
}

export async function saveOnboarding(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication is not configured. Add your Supabase project settings before saving onboarding." };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Your session has expired. Sign in again to continue." };

  const submittedStep = textValue(formData, "step");
  if (submittedStep !== "0" && submittedStep !== "1" && submittedStep !== "2") {
    return { error: "That onboarding step is not valid. Refresh the page and try again." };
  }

  if (submittedStep === "2") {
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_step: 3, onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "We couldn’t finish your setup. Please retry." };
    redirect("/app");
  }

  if (submittedStep === "1") {
    const rawCourses = textValue(formData, "courses");
    if (rawCourses.length > 20_000) return { error: "Keep the course list to 12 entries or fewer." };
    const courses = formData.get("skip") === "1" ? [] : parseCourses(rawCourses);
    if (courses === null) return { error: "Check your course codes and titles. You can add up to 12 courses." };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_semester")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) return { error: "Your profile could not be loaded. Return to the previous step and try again." };

    if (courses.length > 0) {
      const { error } = await supabase
        .from("courses")
        .upsert(
          courses.map((course) => ({
            user_id: user.id,
            code: course.code,
            title: course.title,
            term: profile.current_semester,
          })),
          { onConflict: "user_id,code" },
        );
      if (error) return { error: "We couldn’t save those courses. Review them and try again." };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_step: 2, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "Your courses were saved, but we couldn’t save your progress. Please retry." };
    return { nextStep: 2 };
  }

  const fullName = textValue(formData, "fullName");
  if (fullName.length < 2 || fullName.length > 100) {
    return { error: "Enter a display name between 2 and 100 characters." };
  }

  const universityIdValue = textValue(formData, "universityId");
  const universityText = textValue(formData, "university");
  const countryValue = textValue(formData, "country");
  const otherCountry = textValue(formData, "otherCountry");
  const programme = textValue(formData, "programme");
  const academicLevel = textValue(formData, "academicLevel");
  const semester = textValue(formData, "semester");
  const timezone = textValue(formData, "timezone");

  if (universityText.length > 160 || programme.length > 160 || academicLevel.length > 80 || semester.length > 80) {
    return { error: "One of your academic details is too long. Shorten it and try again." };
  }
  if (timezone.length > 80) return { error: "Choose a valid timezone." };
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone || "UTC" });
  } catch {
    return { error: "Choose a valid timezone." };
  }

  let verifiedUniversityId: string | null = null;
  let university = universityText || null;
  let countryCode = countryValue && countryValue !== "OTHER" ? countryValue : null;
  let countryName = countryValue === "OTHER" ? otherCountry : countryNames[countryValue] ?? null;

  if (universityIdValue) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(universityIdValue)) return { error: "Choose a university from the available list." };
    const { data, error } = await supabase
      .from("universities")
      .select("id, name, country_code")
      .eq("id", universityIdValue)
      .maybeSingle();
    if (error || !data) return { error: "That university is no longer available. Choose another or enter it manually." };
    verifiedUniversityId = data.id;
    university = data.name;
    countryCode = data.country_code;
    countryName = data.country_code;
  } else if (countryValue && countryValue !== "OTHER" && !Object.prototype.hasOwnProperty.call(countryNames, countryValue)) {
    return { error: "Choose a valid country." };
  } else if (countryValue === "OTHER" && (otherCountry.length < 2 || otherCountry.length > 80)) {
    return { error: "Enter a country name between 2 and 80 characters." };
  }

  const profile = {
    id: user.id,
    full_name: fullName,
    university,
    university_id: verifiedUniversityId,
    country_code: countryCode,
    country_name: countryName,
    programme: programme || null,
    degree: academicLevel || null,
    academic_level: academicLevel || null,
    current_semester: semester || null,
    timezone: timezone || "UTC",
    onboarding_step: 1,
    onboarding_complete: false,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (profileError) return { error: "We couldn’t save your profile. Check that the Stage 4 and Stage 5 database migrations have been applied." };
  return { nextStep: 1 };
}
