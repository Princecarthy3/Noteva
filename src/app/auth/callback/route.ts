import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfigurationError } from "@/lib/supabase/config";

function safeNextPath(value: string | null) {
  if (value === "/app" || value === "/onboarding" || value === "/auth/update-password") return value;
  return "/app";
}

export async function GET(request: NextRequest) {
  const requestedNext = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error_description")
    ?? request.nextUrl.searchParams.get("error");
  const configurationError = getSupabaseConfigurationError();

  if (configurationError) {
    return NextResponse.redirect(new URL(`/auth/login?error=setup`, request.url));
  }
  if (providerError || !code) {
    const destination = requestedNext === "/auth/update-password"
      ? "/auth/update-password"
      : `/auth/login?error=${providerError ? "oauth" : "missing"}`;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = requestedNext === "/auth/update-password"
        ? "/auth/update-password"
        : "/auth/login?error=oauth";
      return NextResponse.redirect(new URL(destination, request.url));
    }

    // Ensure a profile row exists for OAuth (Google) and email users alike.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const metadata = user.user_metadata ?? {};
      const fullName =
        (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
        (typeof metadata.name === "string" && metadata.name.trim()) ||
        (typeof user.email === "string" ? user.email.split("@")[0] : "Student");
      const avatarUrl =
        typeof metadata.avatar_url === "string"
          ? metadata.avatar_url
          : typeof metadata.picture === "string"
            ? metadata.picture
            : null;

      const { data: existing } = await supabase
        .from("profiles")
        .select("id, onboarding_complete")
        .eq("id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("profiles").insert({
          id: user.id,
          full_name: String(fullName).slice(0, 100),
          avatar_url: avatarUrl,
          onboarding_step: 0,
          onboarding_complete: false,
          workspace_tour_completed: false,
        });
      } else if (avatarUrl) {
        await supabase
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("id", user.id)
          .is("avatar_url", null);
      }

      if (requestedNext === "/app" || requestedNext === "/onboarding") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile?.onboarding_complete) {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
        return NextResponse.redirect(new URL("/app", request.url));
      }
    }
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=setup", request.url));
  }

  return NextResponse.redirect(new URL(requestedNext, request.url));
}
