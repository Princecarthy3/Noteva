import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import { AuthLayout } from "@/app/auth/auth-layout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const emptyProfile = {
  fullName: "",
  university: "",
  universityId: "",
  country: "",
  otherCountry: "",
  programme: "",
  academicLevel: "",
  semester: "",
  timezone: "GMT",
};

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AuthLayout>
        <SetupNotice message="Connect a Supabase project to save your account and academic profile. Add the Supabase URL and publishable key to .env.local, then reload this page." />
      </AuthLayout>
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login?next=/onboarding");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, university, university_id, country_code, country_name, programme, academic_level, degree, current_semester, timezone, onboarding_step, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <AuthLayout>
        <SetupNotice message="Your profile database is not ready yet. Apply the Stage 4 and Stage 5 Supabase migrations, then try again." />
      </AuthLayout>
    );
  }
  if (profile?.onboarding_complete) redirect("/app");

  const [{ data: universityRows, error: universityError }, { data: courseRows, error: courseError }] = await Promise.all([
    supabase.from("universities").select("id, name, country_code").order("name").limit(200),
    supabase.from("courses").select("code, title").eq("user_id", user.id).order("code").limit(12),
  ]);

  const storedCountry = profile?.country_code ?? "";
  const country = storedCountry.length === 2 ? storedCountry.toUpperCase() : "OTHER";
  const initialProfile = {
    ...emptyProfile,
    fullName: profile?.full_name ?? (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : ""),
    university: profile?.university ?? "",
    universityId: profile?.university_id ?? "",
    country,
    otherCountry: country === "OTHER" ? profile?.country_name ?? "" : "",
    programme: profile?.programme ?? "",
    academicLevel: profile?.academic_level ?? profile?.degree ?? "",
    semester: profile?.current_semester ?? "",
    timezone: profile?.timezone ?? "GMT",
  };

  return (
    <OnboardingWizard
      initialProfile={initialProfile}
      initialStep={profile?.onboarding_step ?? 0}
      universities={universityRows ?? []}
      catalogUnavailable={Boolean(universityError)}
      initialCourses={courseRows ?? []}
      courseCatalogUnavailable={Boolean(courseError)}
    />
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <section className="w-full max-w-[480px] rounded-[28px] border border-[#e8e4ef] bg-white p-7 shadow-[0_24px_80px_rgba(41,31,77,.10)]">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Setup required</p>
      <h1 className="mt-3 text-2xl font-black tracking-[-.7px] text-[#17132d]">Your study space needs connecting.</h1>
      <p className="mt-3 text-sm leading-6 text-[#777180]">{message}</p>
    </section>
  );
}
