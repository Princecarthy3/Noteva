import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const ADMIN_EMAIL = "studystation.support@gmail.com";
export const ADMIN_PASSWORD = "Omega006";
export const ADMIN_COOKIE_NAME = "studystation_admin_session";

// 7 days expiration
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecretKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DATABASE_URL ||
    "studystation-admin-secret-omega006-2026"
  );
}

export type AdminSession = {
  email: string;
  role: "super_admin";
  issuedAt: number;
  expiresAt: number;
};

/**
 * Signs an HMAC-SHA256 session token for the admin.
 */
export function signAdminToken(): string {
  const now = Date.now();
  const payload: AdminSession = {
    email: ADMIN_EMAIL,
    role: "super_admin",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", getSecretKey());
  hmac.update(payloadB64);
  const signature = hmac.digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Validates a signed session token.
 */
export function verifyAdminToken(token: string | undefined | null): AdminSession | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  try {
    const hmac = crypto.createHmac("sha256", getSecretKey());
    hmac.update(payloadB64);
    const expectedSignature = hmac.digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const json = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as AdminSession;

    if (payload.email !== ADMIN_EMAIL) return null;
    if (payload.role !== "super_admin") return null;
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current admin session from incoming cookies.
 * Also checks Supabase auth session as fallback.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  const verified = verifyAdminToken(cookieToken);
  if (verified) return verified;

  // Fallback: check Supabase auth user
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const supabase = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check auth cookies if present
    const sbToken =
      cookieStore.get("sb-access-token")?.value ||
      cookieStore.getAll().find((c) => c.name.endsWith("-auth-token"))?.value;

    if (sbToken) {
      const { data: { user } } = await supabase.auth.getUser(sbToken);
      if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        return {
          email: ADMIN_EMAIL,
          role: "super_admin",
          issuedAt: Date.now(),
          expiresAt: Date.now() + SESSION_TTL_MS,
        };
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return null;
}

/**
 * Checks if the provided email and password match the admin credentials.
 */
export function verifyAdminCredentials(email: string, password: string): boolean {
  if (typeof email !== "string" || typeof password !== "string") return false;
  return (
    email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    password === ADMIN_PASSWORD
  );
}
