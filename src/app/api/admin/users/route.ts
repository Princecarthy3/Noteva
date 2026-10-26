import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase().trim() || "";
    const filter = searchParams.get("filter") || "all"; // all | onboarded | pending

    // Fetch profiles, auth users, and lecture counts in parallel
    const [profilesRes, authUsersRes, lecturesRes] = await Promise.all([
      adminClient
        .from("profiles")
        .select(
          "id, full_name, university, degree, country_code, country_name, academic_level, current_semester, onboarding_complete, onboarding_step, workspace_tour_completed, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      adminClient.from("lectures").select("id, user_id"),
    ]);

    if (profilesRes.error) {
      throw profilesRes.error;
    }

    const authMap = new Map<string, { email: string; lastSignIn: string | null; confirmedAt: string | null }>();
    if (authUsersRes.data?.users) {
      for (const u of authUsersRes.data.users) {
        authMap.set(u.id, {
          email: u.email ?? "",
          lastSignIn: u.last_sign_in_at ?? null,
          confirmedAt: u.email_confirmed_at ?? null,
        });
      }
    }

    // Map lecture counts by user
    const lectureCounts = new Map<string, number>();
    if (lecturesRes.data) {
      for (const l of lecturesRes.data) {
        lectureCounts.set(l.user_id, (lectureCounts.get(l.user_id) || 0) + 1);
      }
    }

    let users = (profilesRes.data ?? []).map((p) => {
      const authInfo = authMap.get(p.id);
      return {
        id: p.id,
        fullName: p.full_name || "Anonymous Student",
        email: authInfo?.email || "No email",
        university: p.university || "Not specified",
        degree: p.degree || "Not specified",
        academicLevel: p.academic_level || "Not specified",
        countryName: p.country_name || "Unknown",
        countryCode: p.country_code || null,
        currentSemester: p.current_semester || null,
        onboardingComplete: p.onboarding_complete,
        workspaceTourCompleted: p.workspace_tour_completed,
        lecturesCount: lectureCounts.get(p.id) || 0,
        lastSignIn: authInfo?.lastSignIn || null,
        emailConfirmed: Boolean(authInfo?.confirmedAt),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    // Apply filtering
    if (filter === "onboarded") {
      users = users.filter((u) => u.onboardingComplete);
    } else if (filter === "pending") {
      users = users.filter((u) => !u.onboardingComplete);
    }

    // Apply search query
    if (query) {
      users = users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.university.toLowerCase().includes(query) ||
          u.countryName.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      total: users.length,
      users,
    });
  } catch (err) {
    console.error("Admin fetch users failed:", err);
    return NextResponse.json(
      { error: "Could not retrieve student accounts." },
      { status: 500 }
    );
  }
}
