import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewRequest = { rating?: unknown; review?: unknown };
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

const reviewSelect = "id, display_name, university, rating, review, created_at";

function normalizeUniversity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 160) return null;
  return trimmed;
}

import { getAdminReviewReplies } from "@/lib/review-replies";

export async function GET(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ reviews: [] }, { headers: noStoreHeaders });
  }

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50)
    : 12;

  const [reviewsQuery, repliesMap] = await Promise.all([
    supabase
      .from("student_reviews")
      .select(reviewSelect)
      .order("created_at", { ascending: false })
      .limit(limit),
    getAdminReviewReplies(),
  ]);

  let reviewsList = reviewsQuery.data;

  if (reviewsQuery.error) {
    // Fallback for databases that have not applied the university column yet.
    const fallback = await supabase
      .from("student_reviews")
      .select("id, display_name, rating, review, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fallback.error) {
      console.error("Student reviews could not be loaded", { code: reviewsQuery.error.code, fallback: fallback.error.code });
      return NextResponse.json(
        { error: "Reviews could not be loaded. Apply the student reviews migration and try again." },
        { status: 500, headers: noStoreHeaders },
      );
    }

    reviewsList = (fallback.data ?? []).map((review) => ({
      ...review,
      university: null,
    }));
  }

  const enrichedReviews = (reviewsList ?? []).map((review) => {
    const reply = repliesMap.get(review.id);
    return {
      ...review,
      admin_reply: reply?.replyText || null,
      admin_reply_at: reply?.repliedAt || null,
      admin_reply_by: reply?.adminEmail || null,
    };
  });

  return NextResponse.json({ reviews: enrichedReviews }, { headers: noStoreHeaders });
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
    .select("full_name, university")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Student review author could not be loaded", { code: profileError.code });
    return NextResponse.json({ error: "Your profile could not be loaded. Try again." }, { status: 500 });
  }

  const displayName = typeof profile?.full_name === "string" && profile.full_name.trim().length >= 2
    ? profile.full_name.trim().slice(0, 100)
    : "StudyStation student";
  const university = normalizeUniversity(profile?.university);

  const payload = {
    user_id: user.id,
    display_name: displayName,
    university,
    rating,
    review,
    updated_at: new Date().toISOString(),
  };

  let savedReview: {
    id: string;
    display_name: string;
    university?: string | null;
    rating: number;
    review: string;
    created_at: string;
  } | null = null;

  const withUniversity = await supabase
    .from("student_reviews")
    .upsert(payload, { onConflict: "user_id" })
    .select(reviewSelect)
    .single();

  if (withUniversity.error) {
    // Compatibility path if the university column is not migrated yet.
    const withoutUniversity = await supabase
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

    if (withoutUniversity.error || !withoutUniversity.data) {
      console.error("Student review could not be saved", {
        code: withUniversity.error.code,
        fallback: withoutUniversity.error?.code,
      });
      return NextResponse.json(
        { error: "Your review could not be saved. Apply the student reviews migration and try again." },
        { status: 500 },
      );
    }

    savedReview = { ...withoutUniversity.data, university };
  } else {
    savedReview = withUniversity.data;
  }

  return NextResponse.json({ review: savedReview }, { status: 201, headers: noStoreHeaders });
}
