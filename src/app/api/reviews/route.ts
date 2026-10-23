import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewRequest = { rating?: unknown; review?: unknown };
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ reviews: [] }, { headers: noStoreHeaders });
  }

  const { data, error } = await supabase
    .from("student_reviews")
    .select("id, display_name, rating, review, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Student reviews could not be loaded", { code: error.code });
    return NextResponse.json(
      { error: "Reviews could not be loaded. Apply the student reviews migration and try again." },
      { status: 500, headers: noStoreHeaders },
    );
  }
  return NextResponse.json({ reviews: data ?? [] }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  let body: ReviewRequest;
  try {
    body = await request.json() as ReviewRequest;
  } catch {
    return NextResponse.json({ error: "The review details were not valid JSON." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Reviews are unavailable until Supabase is configured." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to share a review." }, { status: 401 });
  }

  const rating = body.rating;
  const review = typeof body.review === "string" ? body.review.trim() : "";
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Choose a star rating from 1 to 5." }, { status: 400 });
  }
  if (review.length < 10 || review.length > 600) {
    return NextResponse.json({ error: "Reviews must be between 10 and 600 characters." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Student review author could not be loaded", { code: profileError.code });
    return NextResponse.json({ error: "Your profile could not be loaded. Try again." }, { status: 500 });
  }
  const displayName = typeof profile?.full_name === "string" && profile.full_name.trim().length >= 2
    ? profile.full_name.trim().slice(0, 100)
    : "StudyStation student";

  const { data: savedReview, error } = await supabase
    .from("student_reviews")
    .upsert({
      user_id: user.id,
      display_name: displayName,
      rating,
      review,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("id, display_name, rating, review, created_at")
    .single();

  if (error || !savedReview) {
    console.error("Student review could not be saved", { code: error?.code });
    return NextResponse.json({ error: "Your review could not be saved. Apply the student reviews migration and try again." }, { status: 500 });
  }

  return NextResponse.json({ review: savedReview }, { status: 201, headers: noStoreHeaders });
}
