import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_EMAIL,
  ADMIN_COOKIE_NAME,
  signAdminToken,
  verifyAdminCredentials,
  getAdminSession,
} from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check current admin auth status
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      role: session.role,
      issuedAt: session.issuedAt,
    },
  });
}

/**
 * Admin Login
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() || "";
    const password = body.password || "";

    if (!verifyAdminCredentials(email, password)) {
      return NextResponse.json(
        { error: "Invalid admin credentials. Access denied." },
        { status: 401 }
      );
    }

    // Generate signed admin session token
    const token = signAdminToken();
    const cookieStore = await cookies();

    // Set secure HttpOnly cookie
    cookieStore.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Also ensure Supabase Auth user is synchronized
    try {
      const adminClient = createAdminClient();
      const { data: users } = await adminClient.auth.admin.listUsers();
      const adminUser = users?.users?.find(
        (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
      if (adminUser) {
        // Ensure email is confirmed
        if (!adminUser.email_confirmed_at) {
          await adminClient.auth.admin.updateUserById(adminUser.id, {
            email_confirm: true,
          });
        }
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      ok: true,
      user: {
        email: ADMIN_EMAIL,
        role: "super_admin",
      },
      message: "Admin authentication successful.",
    });
  } catch (err) {
    console.error("Admin auth error:", err);
    return NextResponse.json(
      { error: "Authentication service encountered an error." },
      { status: 500 }
    );
  }
}

/**
 * Admin Logout
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);

  return NextResponse.json({
    ok: true,
    message: "Admin session ended.",
  });
}
