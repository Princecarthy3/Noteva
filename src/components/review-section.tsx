"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { MessageSquareQuote, Send, Star } from "lucide-react";

type StudentReview = {
  id: string;
  display_name: string;
  rating: number;
  review: string;
  created_at: string;
};

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#f5a623]" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={`${size} ${index < rating ? "fill-current" : "text-[#d7d2e0]"}`} />
      ))}
    </span>
  );
}

export function ReviewSection() {
  const [reviews, setReviews] = useState<StudentReview[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/reviews")
      .then(async (response) => {
        const body = await response.json() as { reviews?: StudentReview[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Reviews could not be loaded.");
        return body;
      })
      .then((body) => {
        if (active) setReviews(body.reviews ?? []);
      })
      .catch(() => {
        if (active) {
          setMessage("Reviews are temporarily unavailable.");
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review: reviewText }),
      });
      const body = await response.json() as { review?: StudentReview; error?: string };
      if (response.status === 401) {
        setMessage("Sign in to share a review.");
        setError(true);
        return;
      }
      if (!response.ok || !body.review) throw new Error(body.error || "Your review could not be saved.");
      setReviews((current) => [body.review!, ...current.filter((item) => item.id !== body.review!.id)].slice(0, 12));
      setReviewText("");
      setMessage("Thanks for sharing your experience. Your review is now on the page.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Your review could not be saved.");
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="students" className="px-5 py-24 lg:py-32">
      <div className="mx-auto max-w-[1140px]">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center gap-1 text-[#f5a623]">
            {Array.from({ length: 5 }, (_, index) => <Star key={index} className="size-5 fill-current" />)}
          </div>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[.16em] text-[#7259e8]">Student voices</p>
          <h2 className="mt-2 text-balance text-[34px] font-black tracking-[-1.8px] sm:text-[46px]">
            Made better by the people who study here.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6c667a]">Share what is helping you learn. Reviews come from signed-in StudyStation users.</p>
        </div>

        {reviews.length > 0 ? (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((item) => (
              <article key={item.id} data-card-reveal className="glass-panel flex min-h-[205px] flex-col justify-between rounded-[24px] p-6 shadow-sm">
                <div>
                  <Stars rating={item.rating} />
                  <MessageSquareQuote className="mt-4 size-5 text-[#7259e8]" />
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#3d374a]">&ldquo;{item.review}&rdquo;</p>
                </div>
                <div className="mt-6 border-t border-[#f0edf5] pt-4">
                  <p className="text-xs font-black text-[#17132d]">{item.display_name}</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#837d8f]">StudyStation student · {new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-[#dcd6e8] bg-white/60 p-6 text-center text-sm text-[#777180]">
            Be the first student to share a StudyStation review.
          </div>
        )}

        <form onSubmit={submitReview} className="mx-auto mt-10 max-w-2xl rounded-[26px] border border-[#e9e5ef] bg-white p-5 shadow-[0_18px_55px_rgba(39,29,74,.07)] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">Write a review</p>
              <h3 className="mt-1 text-lg font-black text-[#17132d]">How has StudyStation helped you?</h3>
            </div>
            <div role="radiogroup" aria-label="Your star rating" className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return (
                  <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} className="rounded-md p-1 text-[#f5a623] transition hover:scale-110 focus-visible:outline-[#7259e8]">
                    <Star className={`size-6 ${value <= rating ? "fill-current" : "text-[#d7d2e0]"}`} />
                  </button>
                );
              })}
            </div>
          </div>
          <label className="mt-4 block text-xs font-bold text-[#625b6d]">
            Your review
            <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} minLength={10} maxLength={600} required rows={4} placeholder="Tell other students what you like or what helped you study…" className="mt-2 w-full resize-y rounded-xl border border-[#e5e1eb] bg-white p-3 text-sm font-medium text-[#302a40] outline-none placeholder:text-[#aaa4b1] focus:border-[#a99aed]" />
          </label>
          <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <span className="text-[10px] text-[#8a8494]">{reviewText.length}/600 · One review per account; you can update it anytime.</span>
            <button type="submit" disabled={saving || reviewText.trim().length < 10} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white transition hover:bg-[#6048d5] disabled:opacity-50">
              <Send className="size-3.5" /> {saving ? "Sharing…" : "Share review"}
            </button>
          </div>
          {message && (
            <p role={error ? "alert" : "status"} className={`mt-4 rounded-xl px-3 py-2.5 text-xs leading-5 ${error ? "bg-[#fff1ef] text-[#a44e48]" : "bg-[#e8f7ef] text-[#2f946f]"}`}>
              {message}
              {error && message.startsWith("Sign in") && <>{" "}<Link className="font-extrabold underline" href="/auth/login">Sign in</Link></>}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
