"use client";

import { ArrowRight, CircleHelp, Target } from "lucide-react";
import type { PlannerData } from "@/components/study-planner";
import { GeneratedQuizLibrary } from "@/components/study-material-libraries";

export function QuizProgressView({
  progress,
  hasError,
  onOpenStudyLab,
  timezone,
}: {
  progress: PlannerData["progress"];
  hasError: boolean;
  onOpenStudyLab: () => void;
  timezone: string;
}) {
  return <div className="fade-up space-y-5">
    <header><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">PRACTICE & PROGRESS</p><h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Quiz yourself</h1><p className="mt-1.5 text-[12px] leading-5 text-[#7d7789]">Generate a practice quiz from your own lecture transcript and save the score to your progress.</p></header>
    <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-[24px] bg-[#17132d] p-6 text-white sm:p-7">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#7259e8]"><Target className="size-5" /></span>
        <h2 className="mt-5 text-[20px] font-black tracking-[-.5px]">Practice from your material</h2>
        <p className="mt-2 text-[10px] leading-5 text-white/60">Create a quiz in AI Study Lab, answer every question, then choose “Check answers and save attempt.” Scores shown here come from saved attempts.</p>
        <button type="button" onClick={onOpenStudyLab} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[10px] font-extrabold text-[#17132d]">Open AI Study Lab <ArrowRight className="size-3.5" /></button>
      </section>
      <section className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">SAVED RESULTS</p><h2 className="mt-1 text-[15px] font-extrabold">Recent quiz attempts</h2></div><span className="rounded-lg bg-[#f3f0ff] px-3 py-2 text-[9px] font-extrabold text-[#624bc7]">{progress.quizAttempts} total</span></div>
        {hasError ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a44e48]">Quiz progress could not be loaded. Refresh to try again.</p>
          : progress.recentAttempts.length ? <><ul className="mt-4 divide-y divide-[#f0edf4]">{progress.recentAttempts.map((attempt) => <li key={attempt.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]"><CircleHelp className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-extrabold">{attempt.title}</p><p className="mt-1 text-[8px] text-[#898391]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: timezone || "UTC" }).format(new Date(attempt.completedAt))}</p></div><b className="shrink-0 text-xs text-[#5d47bd]">{attempt.score}/{attempt.total}</b></li>)}</ul><p className="mt-3 border-t border-[#efecf2] pt-3 text-[9px] text-[#85808d]">{progress.recentQuizAverage === null ? "No scored attempts available." : `Recent average: ${progress.recentQuizAverage}% across up to 10 attempts.`}</p></>
            : <div className="mt-4 rounded-2xl border border-dashed border-[#e3deeb] bg-[#fbfaff] px-4 py-9 text-center"><CircleHelp className="mx-auto size-6 text-[#9c91c2]" /><p className="mt-3 text-sm font-extrabold text-[#373145]">No saved attempts yet</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#8a8494]">Generate a quiz from a completed lecture in AI Study Lab. Your saved score will appear here after you finish.</p></div>}
      </section>
    </div>
    <GeneratedQuizLibrary />
    <p className="rounded-xl border border-[#eeeaf2] bg-[#fbfaff] px-4 py-3 text-[10px] leading-5 text-[#766f81]">Scores are descriptive records of your saved attempts, not a guarantee of mastery. AI-generated questions and explanations may contain errors; compare them with your course materials.</p>
  </div>;
}
