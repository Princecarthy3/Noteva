import { AuthForm } from "@/app/auth/auth-form";
import { AuthLayout } from "@/app/auth/auth-layout";
import { getSupabaseConfigurationError, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const hasSession = isSupabaseConfigured()
    ? await (async () => {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        return Boolean(user && !error);
      })()
    : false;

  return (
    <AuthLayout>
      {hasSession ? (
        <AuthForm mode="update" />
      ) : (
        <section className="w-full max-w-[440px] rounded-[28px] border border-[#e8e4ef] bg-white p-6 shadow-[0_24px_80px_rgba(41,31,77,.10)] sm:p-9">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Password reset</p>
          <h1 className="mt-3 text-[28px] font-black tracking-[-1px] text-[#17132d]">This link needs a refresh</h1>
          <p className="mt-2 text-[13px] leading-6 text-[#777180]">{getSupabaseConfigurationError() ?? "The reset link is invalid or has expired. Request a new link and open it from your email."}</p>
          {!getSupabaseConfigurationError() && <a href="/auth/forgot-password" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#7259e8] text-sm font-extrabold text-white hover:bg-[#624bda]">Request a new link</a>}
        </section>
      )}
    </AuthLayout>
  );
}
