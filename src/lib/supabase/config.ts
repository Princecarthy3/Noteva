export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function getSupabaseConfigurationError() {
  if (isSupabaseConfigured()) return null;

  return "Authentication is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy anon key) in .env.local.";
}

export function getAuthRedirectUrl(path: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const baseUrl =
    configuredUrl && !configuredUrl.includes("your-app.vercel.app")
      ? configuredUrl
      : process.env.NODE_ENV === "production"
        ? null
        : "http://localhost:3000";

  if (!baseUrl) {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the verified public app URL before enabling authentication email links.");
  }

  const parsedUrl = new URL(baseUrl);
  if (
    parsedUrl.protocol !== "https:" &&
    !(parsedUrl.protocol === "http:" && parsedUrl.hostname === "localhost")
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS, except for local development.");
  }

  return new URL(path, parsedUrl).toString();
}
