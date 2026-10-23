import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ universities: [] });
  if (query.length > 80 || !/^[\p{L}\p{N} .'-]+$/u.test(query)) {
    return NextResponse.json({ error: "Enter a valid university search." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "University search is unavailable until Supabase is configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to search universities." }, { status: 401 });

  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, country_code")
    .ilike("name", pattern)
    .order("name")
    .limit(12);
  if (error) {
    console.error("University search failed", { code: error.code });
    return NextResponse.json({ error: "University search failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json(
    { universities: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
