import { AuthForm } from "@/app/auth/auth-form";
import { AuthLayout } from "@/app/auth/auth-layout";
import { getSupabaseConfigurationError } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <AuthLayout><AuthForm mode="forgot" setupMessage={getSupabaseConfigurationError()} /></AuthLayout>;
}
