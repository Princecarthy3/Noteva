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
          "id, full_name, university, degree, country_code, country_name, academic_level, current_semester, onboarding_complete, onboarding_step, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      adminClient.from("lectures").select("id, user_id"),
    ]);

    // Map lecture counts by user
    const lectureCounts = new Map<string, number>();
    if (lecturesRes.data) {
      for (const l of lecturesRes.data) {
        lectureCounts.set(l.user_id, (lectureCounts.get(l.user_id) || 0) + 1);
      }
    }

    // Map profiles by ID
    const profiles = profilesRes.data ?? [];
    const profilesMap = new Map(profiles.map((p) => [p.id, p]));
    const handledProfileIds = new Set<string>();

    const authUsers = authUsersRes.data?.users ?? [];
    type StudentRecord = {
      id: string;
      fullName: string;
      email: string;
      university: string;
      degree: string;
      academicLevel: string;
      countryName: string;
      countryCode: string | null;
      currentSemester: string | null;
      onboardingComplete: boolean;
      workspaceTourCompleted: boolean;
      lecturesCount: number;
      lastSignIn: string | null;
      emailConfirmed: boolean;
      createdAt: string;
      updatedAt: string;
    };

    const studentList: StudentRecord[] = [];

    // 1. Process all auth accounts
    for (const authUser of authUsers) {
      handledProfileIds.add(authUser.id);
      const profile = profilesMap.get(authUser.id);

      if (profile) {
        studentList.push({
          id: profile.id,
          fullName: profile.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || "Student",
          email: authUser.email || "No email",
          university: profile.university || "Not specified",
          degree: profile.degree || "Not specified",
          academicLevel: profile.academic_level || "Not specified",
          countryName: profile.country_name || "Unknown",
          countryCode: profile.country_code || null,
          currentSemester: profile.current_semester || null,
          onboardingComplete: Boolean(profile.onboarding_complete),
          workspaceTourCompleted: Boolean(profile.onboarding_complete),
          lecturesCount: lectureCounts.get(profile.id) || 0,
          lastSignIn: authUser.last_sign_in_at || null,
          emailConfirmed: Boolean(authUser.email_confirmed_at),
          createdAt: profile.created_at || authUser.created_at,
          updatedAt: profile.updated_at || authUser.created_at,
        });
      } else {
        // Registered auth account without a profile row yet
        studentList.push({
          id: authUser.id,
          fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "New Student",
          email: authUser.email || "No email",
          university: "Pending Setup",
          degree: "—",
          academicLevel: "—",
          countryName: "—",
          countryCode: null,
          currentSemester: null,
          onboardingComplete: false,
          workspaceTourCompleted: false,
          lecturesCount: lectureCounts.get(authUser.id) || 0,
          lastSignIn: authUser.last_sign_in_at || null,
          emailConfirmed: Boolean(authUser.email_confirmed_at),
          createdAt: authUser.created_at,
          updatedAt: authUser.created_at,
        });
      }
    }

    // 2. Include any profile rows that might not be in auth list
    for (const profile of profiles) {
      if (!handledProfileIds.has(profile.id)) {
        studentList.push({
          id: profile.id,
          fullName: profile.full_name || "Student",
          email: "No linked auth email",
          university: profile.university || "Not specified",
          degree: profile.degree || "Not specified",
          academicLevel: profile.academic_level || "Not specified",
          countryName: profile.country_name || "Unknown",
          countryCode: profile.country_code || null,
          currentSemester: profile.current_semester || null,
          onboardingComplete: Boolean(profile.onboarding_complete),
          workspaceTourCompleted: Boolean(profile.onboarding_complete),
          lecturesCount: lectureCounts.get(profile.id) || 0,
          lastSignIn: null,
          emailConfirmed: false,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        });
      }
    }

    // Sort by created date descending
    let users = studentList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

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
