import { redirect } from "next/navigation";
import { AuthForm } from "@/app/auth/auth-form";
import { AuthLayout } from "@/app/auth/auth-layout";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfigurationError, isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) redirect("/app");
  }

  return <AuthLayout><AuthForm mode="register" setupMessage={getSupabaseConfigurationError()} /></AuthLayout>;
}
