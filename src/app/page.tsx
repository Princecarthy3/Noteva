"use client";

import Link from "next/link";
import { useState } from "react";
import { useEffect } from "react";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  CirclePlay,
  Clock3,
  CloudUpload,
  FileAudio,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  Languages,
  Layers3,
  Link2,
  LockKeyhole,
  MessageCircleQuestion,
  MessageSquare,
  Mic2,
  PhoneCall,
  Play,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UploadCloud,
  UsersRound,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { footerLinkGroups } from "@/components/info-page";
import { landingUniversities } from "@/lib/universities";
import { ReviewSection } from "@/components/review-section";
import { ForceLightTheme } from "@/components/force-light-theme";

const waveform = [18, 30, 46, 22, 58, 36, 68, 42, 24, 52, 76, 44, 62, 26, 54, 70, 40, 22, 48, 32, 64, 42, 26, 38];

type InteractiveTab = "studio" | "lab" | "planner" | "groups" | "calls";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<InteractiveTab>("studio");
  const [activeQuizOption, setActiveQuizOption] = useState<number | null>(1);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const root = document.documentElement;
    root.classList.add("motion-ready");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal], [data-card-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbfaff] text-[#17132d]">
      <ForceLightTheme />
      <SiteHeader />

      {/* Hero Section */}
      <section className="hero-glow soft-grid relative border-b border-[#ebe8f3]/80 px-5 pb-20 pt-16 sm:pt-24 lg:pb-32 lg:pt-28">
        <div className="relative z-10 mx-auto max-w-[1240px] text-center">
          {/* Glass Top Badge */}
          <div className="fade-up mx-auto inline-flex items-center gap-2.5 rounded-full border border-[#dcd6ff]/80 bg-white px-4 py-2 text-[12px] font-extrabold text-[#5d48ca] shadow-[0_8px_30px_rgba(114,89,232,0.12)]">
            <span className="grid size-5 place-items-center rounded-full bg-gradient-to-tr from-[#7259e8] to-[#9b83ff] text-white shadow-sm">
              <Sparkles className="size-3" />
            </span>
            <span>Next-Gen University Study Platform</span>
            <span className="hidden text-[#a29bbf] sm:inline">|</span>
            <span className="hidden font-semibold text-[#665e7d] sm:inline">Lectures • Study Tools • Peer Groups</span>
            <ArrowRight className="size-3.5 text-[#7259e8]" />
          </div>

          {/* Hero Headline */}
          <h1 className="fade-up mx-auto mt-7 max-w-[960px] text-balance text-[44px] font-black leading-[1.02] tracking-[-2.8px] text-[#17132d] sm:text-[66px] sm:tracking-[-4.2px] lg:text-[84px]">
            Every lecture, class & study group.{" "}
            <span className="relative inline-block whitespace-nowrap text-[#7259e8]">
              turned into mastery
              <span className="absolute -bottom-1.5 left-0 h-3 w-full -rotate-1 rounded-full bg-gradient-to-r from-[#ffd868]/80 via-[#ffdf78]/60 to-[#ffd457]/80 -z-10" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="fade-up-delay mx-auto mt-6 max-w-[740px] text-balance text-[16px] leading-relaxed text-[#605a72] sm:text-[19px]">
            Record or upload your lectures and turn them into clear notes, flashcards, and practice quizzes. Organize your semester with a personal study calendar, peer groups, and study calls.
          </p>

          {/* CTAs */}
          <div className="fade-up-delay mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <Link
              href="/auth/register"
              className="group inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#7259e8] to-[#6147dd] px-8 text-[15px] font-extrabold text-white shadow-[0_18px_40px_rgba(114,89,232,.34)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(114,89,232,.44)] sm:w-auto"
            >
              Start learning free
              <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <a
              href="#interactive-demo"
              className="glass-pill inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl px-7 text-[15px] font-extrabold text-[#28213f] shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#c7bdf3] hover:bg-white/90 sm:w-auto"
            >
              <CirclePlay className="size-4.5 text-[#7259e8]" />
              Explore all features
            </a>
          </div>

          {/* Trust points */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-bold text-[#6a6479]">
            {/* <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-[#2ea874]" /> No credit card required
            </span> */}
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-[#2ea874]" /> Your own private study space
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-[#2ea874]" /> Study on phone, tablet, or computer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-[#2ea874]" /> Helpful AI study tools
            </span>
          </div>

          {/* Interactive Glassmorphism Hero Showcase */}
          <div id="interactive-demo" data-reveal className="relative mx-auto mt-16 w-full max-w-[420px] text-left sm:mt-20 sm:max-w-[1080px]">
            {/* Ambient Background Glow behind Glass Panel */}
            <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-tr from-[#7259e8]/20 via-[#a78bfa]/15 to-[#60a5fa]/20 blur-2xl -z-10" />

            {/* Floating Glass Pill Left */}
            <div className="absolute -left-8 top-20 z-20 hidden rounded-2xl border border-white/80 bg-white/80 p-3.5 shadow-[0_20px_50px_rgba(43,35,83,.14)] backdrop-blur-xl lg:block float-slow">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-[#34d399] to-[#059669] text-white shadow-sm">
                  <Check className="size-4.5" />
                </span>
                <div>
                  <p className="text-[12px] font-black text-[#17132d]">Lecture notes are ready</p>
                  <p className="text-[10px] font-semibold text-[#7b7589]">BIO 202 · Ready to review</p>
                </div>
              </div>
            </div>

            {/* Floating Glass Pill Right */}
            <div className="absolute -right-8 bottom-24 z-20 hidden rounded-2xl border border-white/80 bg-white/80 p-3.5 shadow-[0_20px_50px_rgba(43,35,83,.14)] backdrop-blur-xl lg:block float-slow" style={{ animationDelay: "-2.5s" }}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-[#fbbf24] to-[#d97706] text-white shadow-sm">
                  <Flame className="size-4.5 fill-current" />
                </span>
                <div>
                  <p className="text-[12px] font-black text-[#17132d]">Quiz Scored: 92%</p>
                  <p className="text-[10px] font-semibold text-[#7b7589]">5/5 Correct · AI Study Lab</p>
                </div>
              </div>
            </div>

            {/* Main Glass Workspace Window */}
            <div className="glass-panel-dark overflow-hidden rounded-[32px] p-2.5 sm:p-3.5">
              {/* Window Header */}
              <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-[#1e1939]/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-[#ff5f56]" />
                  <span className="size-3 rounded-full bg-[#ffbd2e]" />
                  <span className="size-3 rounded-full bg-[#27c93f]" />
                  <span className="ml-3 font-mono text-[11px] font-bold tracking-wider text-white/50">
                    studystation.workspace • student-os
                  </span>
                </div>

                {/* Tab selector */}
                <div className="flex w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab("studio")}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                      activeTab === "studio"
                        ? "bg-[#7259e8] text-white shadow-[0_4px_16px_rgba(114,89,232,0.4)]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <AudioLines className="size-3.5" /> Lecture Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("lab")}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                      activeTab === "lab"
                        ? "bg-[#7259e8] text-white shadow-[0_4px_16px_rgba(114,89,232,0.4)]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <Sparkles className="size-3.5 text-[#ffd768]" /> AI Study Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("planner")}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                      activeTab === "planner"
                        ? "bg-[#7259e8] text-white shadow-[0_4px_16px_rgba(114,89,232,0.4)]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <CalendarDays className="size-3.5" /> Smart Planner
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("groups")}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                      activeTab === "groups"
                        ? "bg-[#7259e8] text-white shadow-[0_4px_16px_rgba(114,89,232,0.4)]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <UsersRound className="size-3.5" /> Groups & Calls
                  </button>
                </div>
              </div>

              {/* Window Body (Interactive Tab Content) */}
              <div className="relative mt-2 h-[460px] min-h-0 overflow-y-auto rounded-[24px] bg-[#f8f7fc] p-4 text-[#17132d] sm:h-auto sm:min-h-[460px] sm:overflow-hidden sm:p-7">
                {/* 1. LECTURE STUDIO TAB */}
                {activeTab === "studio" && (
                  <div className="fade-up space-y-6">
                    <div className="flex flex-col justify-between gap-4 border-b border-[#e9e5f0] pb-5 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#eeeaff] px-2.5 py-1 text-[10px] font-black text-[#7259e8]">
                            BIO 202 · CELL BIOLOGY
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-[#def7ec] px-2.5 py-1 text-[10px] font-black text-[#047857]">
                            <Check className="size-3" /> Transcript ready
                          </span>
                        </div>
                        <h3 className="mt-2 text-[22px] font-black tracking-tight text-[#17132d]">
                          Cellular Respiration & ATP Synthase Mechanism
                        </h3>
                        <p className="mt-1 text-[12px] font-medium text-[#7a7488]">
                          Captured today · 48m 22s audio file (MP3) · Saved to private storage
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Link
                          href="/app"
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[12px] font-extrabold text-white shadow-sm hover:bg-[#6247df]"
                        >
                          <Sparkles className="size-3.5" /> Generate in Study Lab
                        </Link>
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[1.4fr_.9fr]">
                      {/* Transcript stream */}
                      <div className="rounded-2xl border border-[#e8e4f1] bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between border-b border-[#f0edf5] pb-3">
                          <span className="flex items-center gap-2 text-[12px] font-extrabold text-[#17132d]">
                            <AudioLines className="size-4 text-[#7259e8]" /> Interactive Transcript
                          </span>
                          <span className="text-[11px] font-bold text-[#868093]">5,420 words indexed</span>
                        </div>
                        <div className="space-y-3.5 text-[13px] leading-relaxed text-[#4d475a]">
                          <div className="rounded-xl bg-[#faf9fd] p-3 border border-[#ebe7f5]">
                            <span className="font-mono text-[10px] font-black text-[#7259e8]">[00:14 - Dr. Vance]</span>
                            <p className="mt-1">
                              &ldquo;Today we delve into oxidative phosphorylation. Keep in mind that cells do not release all the energy in glucose at once; it is staggered through the electron transport chain to establish a proton gradient across the inner mitochondrial membrane.&rdquo;
                            </p>
                          </div>
                          <div className="rounded-xl bg-[#f5f1ff] p-3 border border-[#ded5f8]">
                            <span className="font-mono text-[10px] font-black text-[#7259e8]">[04:32 - Dr. Vance]</span>
                            <p className="mt-1 font-medium text-[#261f43]">
                              &ldquo;ATP synthase behaves literally like a rotary motor. As hydrogen ions flow down their electrochemical gradient through the F₀ subunit, it spins the central stalk, synthesizing ATP from ADP and inorganic phosphate.&rdquo;
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Studio Action Cards */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#e8e4f1] bg-white p-5 shadow-sm">
                          <p className="text-[11px] font-black uppercase tracking-wider text-[#7259e8]">Instant Key Takeaways</p>
                          <ul className="mt-3 space-y-2 text-[12px] font-medium text-[#554e63]">
                            <li className="flex items-start gap-2">
                              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[#7259e8] text-[9px] font-bold">1</span>
                              <span>Proton-motive force powers ATP phosphorylation</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[#7259e8] text-[9px] font-bold">2</span>
                              <span>Oxygen acts as terminal electron acceptor</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[#7259e8] text-[9px] font-bold">3</span>
                              <span>Rotary catalytic cycle of ATP synthase (Boyer model)</span>
                            </li>
                          </ul>
                        </div>

                        <div className="rounded-2xl bg-gradient-to-tr from-[#1f193d] to-[#34275f] p-5 text-white shadow-md">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#ffd868]">Supported Formats</span>
                            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold">Up to 25MB</span>
                          </div>
                          <p className="mt-2 text-[12px] text-white/70">
                            Upload MP3, WAV, M4A, WebM audio, or MP4 & WebM lecture videos.
                          </p>
                          <div className="mt-4 flex gap-2">
                            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold">Audio Upload</span>
                            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold">Video Upload</span>
                            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold">Live Mic</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. AI STUDY LAB TAB */}
                {activeTab === "lab" && (
                  <div className="fade-up space-y-6">
                    <div className="flex flex-col justify-between gap-3 border-b border-[#e9e5f0] pb-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#ffdf78]/40 px-2.5 py-1 text-[10px] font-black text-[#855e09]">
                            5 STUDY MODES
                          </span>
                          <span className="text-[12px] font-extrabold text-[#7259e8]">Your personal study space</span>
                        </div>
                        <h3 className="mt-1 text-[22px] font-black tracking-tight text-[#17132d]">
                          Interactive Practice Quiz & Active Recall
                        </h3>
                      </div>
                      <span className="text-[12px] font-extrabold text-[#38a169]">
                        Practice • Learn • Improve
                      </span>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
                      {/* Quiz simulator */}
                      <div className="rounded-2xl border border-[#e8e4f1] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#868093]">
                          <span>QUESTION 1 OF 5</span>
                          <span className="rounded-full bg-[#def7ec] px-2.5 py-0.5 font-black text-[#047857]">
                            CELLULAR BIO
                          </span>
                        </div>

                        <h4 className="mt-4 text-[16px] font-extrabold text-[#17132d]">
                          What provides the direct driving force for ATP synthase to generate ATP from ADP and Pi?
                        </h4>

                        <div className="mt-5 space-y-2.5">
                          {[
                            "Direct transfer of electrons from NADH to ATP synthase",
                            "The flow of protons down their electrochemical gradient across the membrane",
                            "Hydrolysis of GTP in the mitochondrial matrix",
                            "Active transport of pyruvate into the mitochondria",
                          ].map((option, index) => {
                            const isSelected = activeQuizOption === index;
                            const isCorrect = index === 1;
                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setActiveQuizOption(index)}
                                className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-[13px] font-bold transition ${
                                  isSelected
                                    ? isCorrect
                                      ? "border-[#34d399] bg-[#ecfdf5] text-[#065f46]"
                                      : "border-[#f87171] bg-[#fef2f2] text-[#991b1b]"
                                    : "border-[#ece8f4] bg-white text-[#453f52] hover:bg-[#faf9fd]"
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  <span
                                    className={`grid size-6 place-items-center rounded-lg text-[11px] font-black ${
                                      isSelected
                                        ? isCorrect
                                          ? "bg-[#10b981] text-white"
                                          : "bg-[#ef4444] text-white"
                                        : "bg-[#f0edf6] text-[#716a80]"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  {option}
                                </span>
                                {isSelected && isCorrect && <Check className="size-4 text-[#10b981]" />}
                              </button>
                            );
                          })}
                        </div>

                        {activeQuizOption === 1 && (
                          <div className="mt-4 rounded-xl bg-[#ecfdf5] p-3.5 border border-[#a7f3d0] text-[12px] text-[#065f46]">
                            <span className="font-extrabold">Correct! Explanation:</span> The electrochemical proton gradient established by the electron transport chain pushes H⁺ ions through the F₀ subunit, mechanically turning ATP synthase.
                          </div>
                        )}
                      </div>

                      {/* Interactive Flashcard */}
                      <div className="flex flex-col justify-between rounded-2xl border border-[#e8e4f1] bg-white p-6 shadow-sm">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#7259e8]">
                              Active Recall Card
                            </span>
                            <span className="text-[10px] font-bold text-[#868093]">Tap to flip</span>
                          </div>

                          <div
                            onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                            className="mt-4 flex min-h-[170px] cursor-pointer flex-col justify-center rounded-2xl bg-gradient-to-tr from-[#fbfaff] to-[#f4f0ff] p-5 text-center border border-[#e5ddfa] transition hover:shadow-md"
                          >
                            <span className="mx-auto rounded-full bg-[#eeeaff] px-2.5 py-0.5 text-[9px] font-black text-[#7259e8]">
                              {flashcardFlipped ? "ANSWER" : "QUESTION"}
                            </span>
                            <p className="mt-3 text-[15px] font-extrabold text-[#17132d]">
                              {flashcardFlipped
                                ? "In the cytosol. Glycolysis does not require an organelle and generates a net of 2 ATP and 2 NADH."
                                : "Where in eukaryotic cells does glycolysis take place?"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            className="flex-1 rounded-xl bg-[#fee2e2] py-2 text-[11px] font-extrabold text-[#991b1b] hover:bg-[#fecaca]"
                          >
                            Again
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-xl bg-[#fef3c7] py-2 text-[11px] font-extrabold text-[#92400e] hover:bg-[#fde68a]"
                          >
                            Hard
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-xl bg-[#d1fae5] py-2 text-[11px] font-extrabold text-[#065f46] hover:bg-[#a7f3d0]"
                          >
                            Mastered
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. SMART PLANNER TAB */}
                {activeTab === "planner" && (
                  <div className="fade-up space-y-6">
                    <div className="flex flex-col justify-between gap-3 border-b border-[#e9e5f0] pb-4 sm:flex-row sm:items-center">
                      <div>
                        <span className="rounded-full bg-[#def7ec] px-2.5 py-1 text-[10px] font-black text-[#047857]">
                          ADAPTIVE STUDY TIMETABLE
                        </span>
                        <h3 className="mt-1 text-[22px] font-black tracking-tight text-[#17132d]">
                          Weekly Schedule with Syllabus & Timetable Import
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl border border-[#e5e1ef] bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#615973]">
                          CSV • PDF • Image Import
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-5">
                      {[
                        { day: "MON", date: "14", events: [{ title: "BIO 202 Lecture", time: "09:00", type: "class", color: "#7259e8" }, { title: "Cellular Flashcards", time: "16:00", type: "study", color: "#34d399" }] },
                        { day: "TUE", date: "15", active: true, events: [{ title: "CHEM 114 Lab", time: "11:30", type: "class", color: "#f59e0b" }, { title: "AI Quiz Practice", time: "18:00", type: "review", color: "#7259e8" }] },
                        { day: "WED", date: "16", events: [{ title: "Research Methods", time: "14:00", type: "class", color: "#ec4899" }, { title: "Study Group Prep", time: "19:00", type: "study", color: "#06b6d4" }] },
                        { day: "THU", date: "17", events: [{ title: "BIO 202 Seminar", time: "10:00", type: "class", color: "#7259e8" }] },
                        { day: "FRI", date: "18", events: [{ title: "Midterm Review", time: "15:00", type: "exam", color: "#ef4444" }] },
                      ].map((item) => (
                        <div
                          key={item.day}
                          className={`rounded-2xl border p-3.5 transition ${
                            item.active
                              ? "border-[#7259e8] bg-[#fbfaff] shadow-md ring-2 ring-[#7259e8]/20"
                              : "border-[#eae6f2] bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-[#f2edf8] pb-2">
                            <span className="text-[11px] font-black text-[#857e93]">{item.day}</span>
                            <span
                              className={`grid size-6 place-items-center rounded-full text-[11px] font-black ${
                                item.active ? "bg-[#7259e8] text-white" : "text-[#17132d]"
                              }`}
                            >
                              {item.date}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {item.events.map((ev, i) => (
                              <div
                                key={i}
                                className="rounded-xl p-2 text-left"
                                style={{ backgroundColor: `${ev.color}15`, borderLeft: `3px solid ${ev.color}` }}
                              >
                                <p className="truncate text-[11px] font-extrabold text-[#17132d]">{ev.title}</p>
                                <p className="text-[9px] font-bold text-[#7a7488]">{ev.time}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl bg-[#f0edff] p-4 text-[#17132d] sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-[#7259e8] text-white">
                          <WandSparkles className="size-4.5" />
                        </span>
                        <div>
                          <p className="text-[13px] font-extrabold">Generate Balanced Study Plan</p>
                          <p className="text-[11px] text-[#69617d]">
                            AI analyzes your course load and suggests optimal review slots based on your preferred hours and pace.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/auth/register"
                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-[#7259e8] px-4 text-[12px] font-extrabold text-white hover:bg-[#6046de]"
                      >
                        Try AI Scheduling
                      </Link>
                    </div>
                  </div>
                )}

                {/* 4. STUDY GROUPS & CALLS TAB */}
                {activeTab === "groups" && (
                  <div className="fade-up space-y-6">
                    <div className="flex flex-col justify-between gap-3 border-b border-[#e9e5f0] pb-4 sm:flex-row sm:items-center">
                      <div>
                        <span className="rounded-full bg-[#def7ec] px-2.5 py-1 text-[10px] font-black text-[#047857]">
                          COLLABORATION & LIVE CALLS
                        </span>
                        <h3 className="mt-1 text-[22px] font-black tracking-tight text-[#17132d]">
                          Study Rooms, Peer Notes & Synchronized Video
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#7259e8]">
                          <LockKeyhole className="size-3.5" /> 7-Day High Entropy Invites
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                      {/* Live Call Preview */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#191433] to-[#271d4b] p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[12px] font-black text-[#34d399]">
                            <span className="size-2 animate-ping rounded-full bg-[#34d399]" /> LIVE SESSION IN PROGRESS
                          </span>
                          <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold">Jitsi Integrated</span>
                        </div>

                        <h4 className="mt-3 text-[18px] font-extrabold text-white">
                          Organic Chemistry Prep · Group Room
                        </h4>
                        <p className="mt-1 text-[12px] text-white/60">
                          3 classmates connected · Muted-by-default join for privacy
                        </p>

                        <div className="mt-6 grid grid-cols-3 gap-2.5">
                          {["Sarah (Host)", "Alex", "Marcus"].map((name, i) => (
                            <div key={name} className="relative flex h-24 flex-col justify-between rounded-xl bg-white/10 p-2.5 border border-white/10">
                              <span className="text-[10px] font-bold text-white/80">{name}</span>
                              <div className="mx-auto grid size-8 place-items-center rounded-full bg-[#7259e8] font-bold text-[11px]">
                                {name[0]}
                              </div>
                              <span className="text-[8px] text-white/50">{i === 0 ? "Mic On" : "Audio Only"}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                          <div className="flex gap-2">
                            <span className="grid size-9 place-items-center rounded-xl bg-white/15 text-white">
                              <Headphones className="size-4" />
                            </span>
                            <span className="grid size-9 place-items-center rounded-xl bg-white/15 text-white">
                              <Video className="size-4" />
                            </span>
                          </div>
                          <span className="rounded-xl bg-[#22c55e] px-4 py-2 text-[11px] font-black text-white shadow-md">
                            Join Study Room
                          </span>
                        </div>
                      </div>

                      {/* Discussion & Resource Sharing */}
                      <div className="flex flex-col justify-between rounded-2xl border border-[#e8e4f1] bg-white p-5 shadow-sm">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wider text-[#7259e8]">Group Discussions</p>
                          <div className="mt-3 space-y-3">
                            <div className="rounded-xl bg-[#f8f7fc] p-3 text-[12px] text-[#332c45]">
                              <p className="font-extrabold text-[#7259e8]">Chloe M.</p>
                              <p className="mt-0.5">I uploaded the chapter 4 synthesis notes. Check the shared resources tab!</p>
                            </div>
                            <div className="rounded-xl bg-[#f8f7fc] p-3 text-[12px] text-[#332c45]">
                              <p className="font-extrabold text-[#38a169]">David P.</p>
                              <p className="mt-0.5">Thanks Chloe! Are we running practice questions on Thursday at 4 PM?</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-[#e8e4f1] p-3 bg-[#faf9fe]">
                          <span className="text-[11px] font-extrabold text-[#17132d]">Secure Shared File</span>
                          <p className="text-[10px] text-[#716982]">Stereochemistry-Summary.pdf · Shared with your group</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campus Logo Ribbon */}
      {/* <section className="border-b border-[#ebe8f3] bg-white/80 py-7 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <p className="text-center text-[11px] font-extrabold uppercase tracking-[.18em] text-[#8e889b] sm:text-left">
            Built for ambitious students worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-mono text-[13px] font-black text-[#a6a0b3]">
            <span>STANFORD</span>
            <span>OXFORD</span>
            <span>CAMBRIDGE</span>
            <span>UMAT</span>
            <span>TORONTO</span>
            <span>MELBOURNE</span>
          </div>
        </div>
      </section> */}


<section className="overflow-hidden border-b border-[#ebe8f3] bg-white/80 py-7 backdrop-blur-md">
  <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 px-5 sm:flex-row sm:gap-10">

    {/* Left heading */}
    <p className="w-full shrink-0 text-center text-[11px] font-extrabold uppercase tracking-[.18em] text-[#8e889b] sm:w-[310px] sm:text-left">
      Built for ambitious students Nationwide
    </p>

    {/* Moving universities */}
    <div className="relative w-full min-w-0 overflow-hidden">
      <div className="university-marquee flex w-max items-center">

        {/* First group */}
        <div className="flex shrink-0 items-center gap-8 pr-8">
          {landingUniversities.map((university) => (
            <div
              key={university.name}
              className="flex shrink-0 items-center gap-3"
            >
              <img
                src={university.logo}
                alt=""
                aria-hidden="true"
                className="h-7 w-7 shrink-0 object-contain"
              />
              <span className="university-name">
                {university.name}
              </span>
              <span className="university-star">✦</span>
            </div>
          ))}
        </div>

        {/* Duplicate group for seamless looping */}
        <div
          className="flex shrink-0 items-center gap-8 pr-8"
          aria-hidden="true"
        >
          {landingUniversities.map((university) => (
            <div
              key={university.name}
              className="flex shrink-0 items-center gap-3"
            >
              <img
                src={university.logo}
                alt=""
                className="h-7 w-7 shrink-0 object-contain"
              />
              <span className="university-name">
                {university.name}
              </span>
              <span className="university-star">✦</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  </div>
</section>



      {/* ALL-IN-ONE SYSTEM: What StudyStation Actually Does */}
      <section id="features" className="px-5 py-24 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div data-reveal className="mx-auto max-w-[760px] text-center">
            <span className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#7259e8]">
              Comprehensive Workspace
            </span>
            <h2 className="mt-4 text-balance text-[36px] font-black leading-[1.05] tracking-[-2px] sm:text-[52px]">
              Everything you need between the first class and the final exam.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-[#686278]">
              No more juggling four disconnected apps for recording, notes, scheduling, flashcards, and group study. StudyStation brings the entire academic lifecycle into one cohesive, private workspace.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Lecture Studio */}
            <article data-card-reveal className="glass-card-hover rounded-[28px] border border-[#e6e2f0] bg-white p-7 shadow-[0_12px_36px_rgba(31,24,66,.04)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#eeeaff] text-[#7259e8]">
                <AudioLines className="size-6" />
              </span>
              <h3 className="mt-6 text-xl font-black text-[#17132d]">Lecture Studio</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#686276]">
                Record a lecture or upload audio or video to create a searchable transcript and organized notes you can revisit while studying.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#7259e8]">
                <span className="rounded-md bg-[#f3f0ff] px-2 py-1">Lecture transcripts</span>
                <span className="rounded-md bg-[#f3f0ff] px-2 py-1">Audio & Video</span>
                <span className="rounded-md bg-[#f3f0ff] px-2 py-1">Instant Playback</span>
              </div>
            </article>

            {/* 2. AI Study Lab */}
            <article data-card-reveal className="glass-card-hover rounded-[28px] border border-[#e6e2f0] bg-white p-7 shadow-[0_12px_36px_rgba(31,24,66,.04)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#fff0c7] text-[#9a6a09]">
                <Sparkles className="size-6" />
              </span>
              <h3 className="mt-6 text-xl font-black text-[#17132d]">AI Study Lab</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#686276]">
                Generate structured revision summaries, concept deep-dives, simplified breakdowns, flashcard decks, and practice tests grounded directly in your lecture transcripts.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#9a6a09]">
                <span className="rounded-md bg-[#fef3c7] px-2 py-1">Personalized study help</span>
                <span className="rounded-md bg-[#fef3c7] px-2 py-1">5 Study Modes</span>
                <span className="rounded-md bg-[#fef3c7] px-2 py-1">Source Citations</span>
              </div>
            </article>

            {/* 3. Practice Quizzes */}
            <article data-card-reveal className="glass-card-hover rounded-[28px] border border-[#e6e2f0] bg-white p-7 shadow-[0_12px_36px_rgba(31,24,66,.04)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#def7ec] text-[#047857]">
                <Target className="size-6" />
              </span>
              <h3 className="mt-6 text-xl font-black text-[#17132d]">Graded Practice Exams</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#686276]">
                Test your understanding with multiple-choice quizzes, get feedback on your answers, and revisit your progress throughout the semester.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#047857]">
                <span className="rounded-md bg-[#e6f8ef] px-2 py-1">Answer feedback</span>
                <span className="rounded-md bg-[#e6f8ef] px-2 py-1">Instant Rationales</span>
                <span className="rounded-md bg-[#e6f8ef] px-2 py-1">Progress History</span>
              </div>
            </article>

            {/* 4. Smart Planner & Calendar */}
            <article data-card-reveal className="glass-card-hover rounded-[28px] border border-[#e6e2f0] bg-white p-7 shadow-[0_12px_36px_rgba(31,24,66,.04)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#def7ec] text-[#0f766e]">
                <CalendarDays className="size-6" />
              </span>
              <h3 className="mt-6 text-xl font-black text-[#17132d]">Smart Study Calendar</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#686276]">
                Month and week calendar views. Import timetables via local CSV, PDF syllabus extraction, or photos. Request personalized AI study schedules tailored to your pace and exam dates.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#0f766e]">
                <span className="rounded-md bg-[#e0f2fe] px-2 py-1">CSV & PDF Import</span>
                <span className="rounded-md bg-[#e0f2fe] px-2 py-1">AI Scheduler</span>
                <span className="rounded-md bg-[#e0f2fe] px-2 py-1">Conflict Detection</span>
              </div>
            </article>

            {/* 5. Study Groups & Discussions */}
            <article data-card-reveal className="glass-card-hover rounded-[28px] border border-[#e6e2f0] bg-white p-7 shadow-[0_12px_36px_rgba(31,24,66,.04)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#fce7f3] text-[#be185d]">
                <UsersRound className="size-6" />
              </span>
              <h3 className="mt-6 text-xl font-black text-[#17132d]">Peer Study Groups</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#686276]">
                Create public or private study groups, share resources with members, discuss coursework, plan meetups, and invite classmates to join.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#be185d]">
                <span className="rounded-md bg-[#fdf2f8] px-2 py-1">Member Rosters</span>
                <span className="rounded-md bg-[#fdf2f8] px-2 py-1">Secure Resource Sharing</span>
                <span className="rounded-md bg-[#fdf2f8] px-2 py-1">Easy invitations</span>
              </div>
            </article>

            {/* 6. Live Study Calls */}
            <article data-card-reveal className="glass-card-hover rounded-[28px] border border-[#e6e2f0] bg-white p-7 shadow-[0_12px_36px_rgba(31,24,66,.04)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#fee2e2] text-[#b91c1c]">
                <PhoneCall className="size-6" />
              </span>
              <h3 className="mt-6 text-xl font-black text-[#17132d]">Live Study Calls</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#686276]">
                Meet classmates for audio or video study sessions. Check your microphone and camera before joining, and choose when to turn them on.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#b91c1c]">
                <span className="rounded-md bg-[#fef2f2] px-2 py-1">Audio & video sessions</span>
                <span className="rounded-md bg-[#fef2f2] px-2 py-1">Prejoin Hardware Check</span>
                <span className="rounded-md bg-[#fef2f2] px-2 py-1">Audio-Only Mode</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 4-Step Interactive Workflow */}
      <section id="how-it-works" className="relative border-y border-[#ebe8f3] bg-gradient-to-b from-[#f8f6fd] to-[#fbfaff] px-5 py-24 lg:py-32">
        <div className="mx-auto max-w-[1140px]">
          <div data-reveal className="mx-auto max-w-[680px] text-center">
            <span className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#7259e8]">
              How StudyStation Works
            </span>
            <h2 className="mt-4 text-balance text-[36px] font-black leading-[1.05] tracking-[-2px] sm:text-[50px]">
              From live lecture to exam confidence in 4 steps.
            </h2>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                icon: Mic2,
                title: "Capture Class",
                desc: "Record a class or upload a lecture to create notes you can review whenever you study.",
                color: "bg-[#7259e8] text-white",
              },
              {
                step: "02",
                icon: WandSparkles,
                title: "AI Synthesis",
                desc: "Turn your lecture into a clear transcript, key concepts, definitions, and takeaways.",
                color: "bg-[#f59e0b] text-white",
              },
              {
                step: "03",
                icon: BrainCircuit,
                title: "Active Recall",
                desc: "Review with flashcards and practice quizzes that help you spot what to study next.",
                color: "bg-[#10b981] text-white",
              },
              {
                step: "04",
                icon: UsersRound,
                title: "Group & Sync",
                desc: "Schedule study sessions on your smart calendar, share resources with peers, and hop on live video calls together.",
                color: "bg-[#6366f1] text-white",
              },
            ].map((item) => (
              <div key={item.step} data-card-reveal className="glass-panel relative rounded-[26px] p-6 text-left shadow-sm">
                <span className="text-[12px] font-black text-[#b4adc1]">{item.step}</span>
                <div className={`mt-4 grid size-12 place-items-center rounded-2xl ${item.color} shadow-sm`}>
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-6 text-lg font-black text-[#17132d]">{item.title}</h3>
                <p className="mt-2 text-[12px] leading-5 text-[#6c667a]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ReviewSection />

      {/* Frequently Asked Questions */}
      <section id="faq" className="border-t border-[#ebe8f3] bg-[#fbfaff] px-5 py-24">
        <div className="mx-auto max-w-[780px]">
          <div data-reveal className="text-center">
            <span className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#7259e8]">
              Got Questions?
            </span>
            <h2 className="mt-4 text-[38px] font-black tracking-[-2px] text-[#17132d]">
              Everything you need to know
            </h2>
          </div>

          <div data-reveal className="mt-12 divide-y divide-[#e7e3ed] border-y border-[#e7e3ed]">
            {[
              [
                "What file formats can I upload for transcription?",
                "You can record a lecture or upload an audio or video file to turn it into study notes. You can also add your school's timetable to your calendar.",
              ],
              [
                "How does the AI Study Lab generate quizzes and flashcards?",
                "The Study Lab uses your lecture material to help create summaries, explanations, flashcards, and practice quizzes for review.",
              ],
              [
                "Are my study notes and recordings private?",
                "Your personal lectures, notes, and tasks stay in your study space. Anything you choose to share is available to members of that study group.",
              ],
              [
                "Can I import my school timetable or course syllabus?",
                "Yes! StudyStation allows local CSV timetable parsing and supports PDF or image syllabus extraction with your explicit consent, creating editable draft study events for your review.",
              ],
              [
                "Does StudyStation work on smartphones and tablets?",
                "Yes. StudyStation works on phones, tablets, and computers, so you can keep your study materials close wherever you are.",
              ],
            ].map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex list-none items-center justify-between gap-5 text-[15px] font-black text-[#17132d] marker:hidden">
                  <span>{question}</span>
                  <ChevronDown className="size-4.5 shrink-0 text-[#7259e8] transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="max-w-[700px] pt-3 text-[13px] leading-6 text-[#696277]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final Glass CTA Section */}
      <section className="px-5 pb-16 pt-8">
        <div data-reveal className="card-shine relative mx-auto max-w-[1140px] overflow-hidden rounded-[36px] bg-gradient-to-tr from-[#654ad8] via-[#7259e8] to-[#8d76ff] px-6 py-16 text-center text-white shadow-[0_25px_60px_rgba(114,89,232,0.3)] sm:px-12 sm:py-20">
          <div className="absolute -left-16 -top-24 size-80 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-16 size-80 rounded-full bg-[#ffdf78]/20 blur-xl pointer-events-none" />

          <Sparkles className="mx-auto size-8 text-[#ffdf78]" />
          <h2 className="relative mx-auto mt-5 max-w-[720px] text-balance text-[38px] font-black leading-[1.05] tracking-[-2px] sm:text-[56px]">
            Master your courses this semester with StudyStation.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/75">
            Turn every lecture into crystal-clear transcripts, smart flashcards, and graded practice quizzes in seconds.
          </p>

          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/register"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 text-[15px] font-black text-[#654ad8] shadow-2xl transition hover:-translate-y-1 hover:bg-[#faf9ff] sm:w-auto"
            >
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-8 text-[15px] font-black text-white backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/20 sm:w-auto"
            >
              Sign in to workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#ebe8f3] bg-white px-5 pb-12 pt-14">
        <div className="mx-auto max-w-[1140px]">
          <div className="grid gap-10 border-b border-[#ece8f4] pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-4 max-w-xs text-xs leading-6 text-[#756f82]">
                StudyStation is the modern university learning workspace built to turn lectures into comprehension, retention, and academic excellence.
              </p>
            </div>
            {footerLinkGroups.map(({ title, links }) => (
              <div key={title}>
                <p className="text-xs font-black uppercase tracking-wider text-[#17132d]">{title}</p>
                <div className="mt-4 space-y-2.5">
                  {links.map(({ href, label }) => (
                    <Link key={href} href={href} className="block text-xs font-medium text-[#7a7388] transition hover:text-[#7259e8]">
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 pt-6 text-[11px] font-bold text-[#8c8699] sm:flex-row">
            <p>© 2026 StudyStation. Made for your learning journey.</p>
            <p>Your study space, organized around you.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
