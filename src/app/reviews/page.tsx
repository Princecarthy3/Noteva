"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { Brand } from "@/components/brand";
import { ForceLightTheme } from "@/components/force-light-theme";
import { ReviewsGrid } from "@/components/review-section";

type StudentReview = {
  id: string;
  display_name: string;
  university?: string | null;
  rating: number;
  review: string;
  created_at: string;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<StudentReview[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/reviews?limit=50", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { reviews?: StudentReview[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Reviews could not be loaded.");
        return body;
      })
      .then((body) => {
        if (!active) return;
        setReviews(body.reviews ?? []);
        setLoading(false);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Reviews could not be loaded.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#fbfaff] text-[#17132d]">
      <ForceLightTheme />
      <header className="border-b border-[#ebe8f3] bg-white/90">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <Brand />
          <Link href="/#students" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#676276] hover:bg-[#f5f2fb] hover:text-[#7259e8]">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </div>
      </header>

      <section className="px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-[1140px]">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex justify-center gap-1 text-[#f5a623]">
              {Array.from({ length: 5 }, (_, index) => <Star key={index} className="size-5 fill-current" />)}
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[.16em] text-[#7259e8]">Student voices</p>
            <h1 className="mt-2 text-balance text-[34px] font-black tracking-[-1.6px] sm:text-[44px]">
              All StudyStation reviews
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6c667a]">
              Feedback from signed-in students. To leave a review, sign in and share it from your study space.
            </p>
          </div>

          <div className="mt-12">
            {loading ? (
              <p className="text-center text-sm font-semibold text-[#8a8494]">Loading reviews…</p>
            ) : error ? (
              <div className="rounded-2xl border border-[#f0c9c4] bg-[#fff7f6] p-6 text-center text-sm text-[#a44e48]">
                {error}
              </div>
            ) : (
              <ReviewsGrid reviews={reviews} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
