import { redirect } from "next/navigation";
import { AuthForm } from "@/app/auth/auth-form";
import { AuthLayout } from "@/app/auth/auth-layout";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfigurationError, isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string; error?: string; next?: string }>;
}) {
  const { password, error, next } = await searchParams;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) redirect("/app");
  }

  return (
    <AuthLayout>
      <AuthForm
        mode="login"
        nextPath={next ?? "/app"}
        setupMessage={getSupabaseConfigurationError()}
        notice={password === "updated"
          ? "Your password has been updated. Sign in with your new password."
          : error === "setup"
            ? "Authentication settings are missing. Ask the app administrator to configure Supabase."
            : error === "link" || error === "missing"
              ? "That sign-in or verification link is invalid or expired. Try signing in again or request a fresh link."
              : undefined}
      />
    </AuthLayout>
  );
}
