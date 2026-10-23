import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfigurationError } from "@/lib/supabase/config";

function safeNextPath(value: string | null) {
  if (value === "/app" || value === "/onboarding" || value === "/auth/update-password") return value;
  return "/app";
}

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error_description");
  const configurationError = getSupabaseConfigurationError();

  if (configurationError) {
    return NextResponse.redirect(new URL(`/auth/login?error=setup`, request.url));
  }
  if (providerError || !code) {
    const destination = nextPath === "/auth/update-password"
      ? "/auth/update-password"
      : `/auth/login?error=${providerError ? "link" : "missing"}`;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = nextPath === "/auth/update-password"
        ? "/auth/update-password"
        : "/auth/login?error=link";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=setup", request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
