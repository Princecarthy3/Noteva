"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionResult = { error?: string; success?: string };

export async function saveProfile(formData: FormData): Promise<ProfileActionResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Profile settings are unavailable until Supabase is configured." };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Your session has expired. Sign in again to update your profile." };

  const fullName = formData.get("fullName");
  const programme = formData.get("programme");
  const university = formData.get("university");
  const semester = formData.get("semester");
  const timezone = formData.get("timezone");
  const avatarPath = formData.get("avatarPath");

  if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) {
    return { error: "Enter a name between 2 and 100 characters." };
  }
  if (typeof programme !== "string" || programme.trim().length > 160
    || typeof university !== "string" || university.trim().length > 160
    || typeof semester !== "string" || semester.trim().length > 80
    || typeof timezone !== "string" || timezone.length > 80) {
    return { error: "Check your programme, university, semester, and timezone details." };
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone || "UTC" });
  } catch {
    return { error: "Choose a valid timezone." };
  }
  if (typeof avatarPath !== "string"
    || (avatarPath !== "" && !new RegExp(`^${user.id}/avatar-[0-9a-f-]+\\.(jpg|png|webp)$`, "i").test(avatarPath))) {
    return { error: "Choose a valid profile picture and try again." };
  }

  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (profileReadError || !existingProfile) {
    console.error("Profile lookup before update failed", { code: profileReadError?.code });
    return { error: "Your profile could not be loaded. Refresh and try again." };
  }

  const nextAvatarPath = avatarPath || null;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      programme: programme.trim() || null,
      university: university.trim() || null,
      current_semester: semester.trim() || null,
      timezone: timezone || "UTC",
      avatar_url: nextAvatarPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("Profile update failed", { code: error?.code });
    if (avatarPath && avatarPath !== existingProfile.avatar_url) {
      const { error: cleanupError } = await supabase.storage.from("profile-avatars").remove([avatarPath]);
      if (cleanupError) console.error("Unlinked profile picture cleanup failed", { code: cleanupError.name });
    }
    return { error: "Your profile could not be saved. Check that the Stage 4 migration is applied, then try again." };
  }

  const oldAvatarPath = existingProfile.avatar_url;
  if (oldAvatarPath && oldAvatarPath !== nextAvatarPath && !oldAvatarPath.startsWith("http")) {
    const { error: cleanupError } = await supabase.storage.from("profile-avatars").remove([oldAvatarPath]);
    if (cleanupError) {
      console.error("Previous profile picture cleanup failed", { code: cleanupError.name });
      revalidatePath("/app");
      return { success: "Profile saved. Your previous profile picture could not be removed; contact support if you need help cleaning it up." };
    }
  }

  revalidatePath("/app");
  return { success: "Profile updated." };
}
