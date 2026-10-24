"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthRedirectUrl, getSupabaseConfigurationError } from "@/lib/supabase/config";

export type AuthActionState = {
  error?: string;
  success?: string;
  nextStep?: number;
};

function cleanEmail(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeNextPath(value: FormDataEntryValue | null) {
  if (value === "/app" || value === "/onboarding" || value === "/auth/update-password") return value;
  return "/app";
}

function mapAuthError(message: string, action: "login" | "register") {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (normalized.includes("email not confirmed")) return "Verify your email before signing in.";
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("short"))) {
    return "Choose a stronger password with at least 8 characters.";
  }
  if (action === "register" && normalized.includes("error sending confirmation email")) {
    return "Supabase couldn’t send the verification email. Check the project’s Auth email or SMTP settings and try again.";
  }
  if (action === "register" && normalized.includes("signups not allowed")) {
    return "Email registration is disabled in Supabase. Enable sign-ups in the project’s Auth settings.";
  }
  if (normalized.includes("invalid email")) return "Enter a valid email address.";
  if (action === "register" && normalized.includes("redirect")) {
    return "Email verification could not start. Add this app’s /auth/callback URL to the Supabase Auth redirect URL allowlist.";
  }
  return action === "login"
    ? "We couldn’t sign you in. Check your details and try again."
    : "We couldn’t create your account. Check your details and try again.";
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) return { error: configurationError };

  const email = cleanEmail(formData.get("email"));
  const password = formData.get("password");
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (typeof password !== "string" || !password) return { error: "Enter your password." };
  if (password.length > 128) return { error: "Your password is too long." };

  let result;
  try {
    const supabase = await createClient();
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch {
    return { error: "Authentication is temporarily unavailable. Please try again." };
  }

  if (result.error) return { error: mapAuthError(result.error.message, "login") };
  redirect(safeNextPath(formData.get("next")));
}

export async function register(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) return { error: configurationError };

  const name = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";
  const email = cleanEmail(formData.get("email"));
  const password = formData.get("password");
  if (name.length < 2 || name.length > 100) return { error: "Enter a name between 2 and 100 characters." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { error: "Choose a password between 8 and 128 characters." };
  }

  let result;
  try {
    const supabase = await createClient();
    const requestOrigin = (await headers()).get("origin");
    result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: getAuthRedirectUrl("/auth/callback?next=/onboarding", requestOrigin),
      },
    });
  } catch {
    return { error: "Account creation is temporarily unavailable. Please try again." };
  }

  if (result.error) return { error: mapAuthError(result.error.message, "register") };
  if (result.data.session) redirect("/onboarding");

  return {
    success: "Check your inbox for a verification link. Once you verify your email, you can finish setting up your study space.",
  };
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) return { error: configurationError };

  const email = cleanEmail(formData.get("email"));
  if (!isValidEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    const supabase = await createClient();
    const requestOrigin = (await headers()).get("origin");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("/auth/callback?next=/auth/update-password", requestOrigin),
    });
    if (error) return { error: "We couldn’t send a reset link right now. Please try again later." };
    return { success: "If an account uses that email, password reset instructions are on the way." };
  } catch {
    return { error: "We couldn’t send a reset link right now. Please try again later." };
  }
}

export async function updatePassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) return { error: configurationError };

  const password = formData.get("password");
  const confirmation = formData.get("confirmPassword");
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { error: "Choose a password between 8 and 128 characters." };
  }
  if (password !== confirmation) return { error: "The passwords do not match." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: "This password reset link is invalid or has expired. Request a new one to continue." };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "We couldn’t update your password. Request a new reset link and try again." };
  } catch {
    return { error: "We couldn’t update your password. Request a new reset link and try again." };
  }

  redirect("/auth/login?password=updated");
}

export async function signOut() {
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) throw new Error(configurationError);

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("We couldn’t sign you out. Please try again.");
  redirect("/auth/login");
}
