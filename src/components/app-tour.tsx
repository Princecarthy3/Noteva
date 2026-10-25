"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const TOUR_STORAGE_PREFIX = "studystation-app-tour-v2:";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  target: string;
  view?: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "overview",
    target: "dashboard",
    view: "dashboard",
    title: "Your Overview",
    body: "This is your home base. See today’s study pulse, recent lectures, and quick actions to keep your week moving.",
  },
  {
    id: "courses",
    target: "courses",
    view: "courses",
    title: "My courses",
    body: "Add and organize the courses you’re taking. Lectures, tasks, and study work stay grouped by course.",
  },
  {
    id: "lectures",
    target: "lectures",
    view: "lectures",
    title: "Lecture Studio",
    body: "Record or upload class audio, then turn it into a transcript and structured study notes.",
  },
  {
    id: "notes",
    target: "notes",
    view: "notes",
    title: "Notes library",
    body: "All of your organized lecture notes live here — ready to reread, copy, or export when you need them.",
  },
  {
    id: "study-lab",
    target: "study-lab",
    view: "study-lab",
    title: "AI Study Lab",
    body: "Generate flashcards and practice quizzes from your lectures so revision feels lighter and more focused.",
  },
  {
    id: "groups",
    target: "study-groups",
    view: "study-groups",
    title: "Study groups",
    body: "Create or join peer groups, share resources, and study together without leaving StudyStation.",
  },
  {
    id: "planner",
    target: "planner",
    view: "planner",
    title: "Study planner",
    body: "Plan your week with tasks and calendar blocks so deadlines and study sessions stay visible.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
type Phase = "welcome" | "steps";

function storageKey(userId?: string | null) {
  return `${TOUR_STORAGE_PREFIX}${userId || "anon"}`;
}

function readLocalCompleted(userId?: string | null) {
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markLocalCompleted(userId?: string | null) {
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    // ignore
  }
}

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[11px] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function AppTour({
  userId,
  firstName,
  tourCompleted = false,
  onNavigate,
  onOpenSidebar,
}: {
  userId?: string | null;
  firstName?: string;
  /** From the server profile. False for new accounts. */
  tourCompleted?: boolean;
  onNavigate: (view: string) => void;
  onOpenSidebar?: () => void;
}) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const total = TOUR_STEPS.length;
  const greetingName = firstName?.trim() || "there";

  const measure = useCallback(() => {
    if (phase !== "steps" || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${step.target}"]`);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase, step]);

  // Start automatically for accounts that have not finished the tour.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const force = params.get("tour") === "1" || params.get("tour") === "true";
    const localDone = readLocalCompleted(userId);
    const shouldStart = force || (!tourCompleted && !localDone);

    if (!shouldStart) return;

    // Brief delay so the workspace chrome is painted first.
    const timer = window.setTimeout(() => {
      setPhase("welcome");
      setStepIndex(0);
      setActive(true);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [tourCompleted, userId]);

  useEffect(() => {
    if (!active || phase !== "steps" || !step) return;
    onOpenSidebar?.();
    if (step.view) onNavigate(step.view);
    const frame = window.requestAnimationFrame(() => measure());
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, phase, step, measure, onNavigate, onOpenSidebar]);

  useEffect(() => {
    if (!active || phase !== "steps") return;
    const t1 = window.setTimeout(measure, 180);
    const t2 = window.setTimeout(measure, 420);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active, phase, stepIndex, measure]);

  const finish = useCallback(() => {
    markLocalCompleted(userId);
    setActive(false);
    void fetch("/api/workspace-tour", { method: "POST", cache: "no-store" }).catch(() => {
      // local completion is enough to stop reopening on this device
    });
  }, [userId]);

  const startSteps = useCallback(() => {
    setPhase("steps");
    setStepIndex(0);
  }, []);

  const goNext = useCallback(() => {
    if (stepIndex >= total - 1) {
      finish();
      return;
    }
    setStepIndex((value) => value + 1);
  }, [finish, stepIndex, total]);

  const goBack = useCallback(() => {
    if (stepIndex === 0) {
      setPhase("welcome");
      setTargetRect(null);
      return;
    }
    setStepIndex((value) => Math.max(0, value - 1));
  }, [stepIndex]);

  const tooltipStyle = useMemo(() => {
    if (phase === "welcome" || !targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      } as const;
    }

    const gap = 14;
    const tooltipWidth = Math.min(360, window.innerWidth - 32);
    const preferRight = targetRect.left + targetRect.width + gap + tooltipWidth < window.innerWidth;
    const preferBelow = targetRect.top + targetRect.height + gap + 220 < window.innerHeight;

    if (preferRight) {
      return {
        top: Math.max(16, Math.min(targetRect.top, window.innerHeight - 240)),
        left: targetRect.left + targetRect.width + gap,
        transform: "none",
        width: tooltipWidth,
      } as const;
    }

    if (preferBelow) {
      return {
        top: targetRect.top + targetRect.height + gap,
        left: Math.max(16, Math.min(targetRect.left, window.innerWidth - tooltipWidth - 16)),
        transform: "none",
        width: tooltipWidth,
      } as const;
    }

    return {
      top: Math.max(16, targetRect.top - gap - 210),
      left: Math.max(16, Math.min(targetRect.left, window.innerWidth - tooltipWidth - 16)),
      transform: "none",
      width: tooltipWidth,
    } as const;
  }, [phase, targetRect]);

  if (!active) return null;

  const pad = 8;
  const highlight =
    phase === "steps" && targetRect
      ? {
          top: Math.max(8, targetRect.top - pad),
          left: Math.max(8, targetRect.left - pad),
          width: targetRect.width + pad * 2,
          height: targetRect.height + pad * 2,
        }
      : null;

  return (
    <div className="app-tour-root fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="app-tour-title">
      <div className="absolute inset-0 bg-[#120f22]/62 transition-opacity duration-300" onClick={finish} />

      {highlight && (
        <div
          className="app-tour-spotlight pointer-events-none absolute rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(18,15,34,0.62),0_0_0_6px_rgba(114,89,232,0.35)] transition-all duration-300 ease-out"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div
        className="app-tour-card absolute z-[121] max-w-[min(380px,calc(100vw-32px))] rounded-[22px] border border-white/70 bg-white p-5 shadow-[0_28px_80px_rgba(14,10,34,0.35)] sm:p-6"
        style={tooltipStyle}
      >
        {phase === "welcome" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2.5">
                <LogoMark size={40} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#5d48ca]">StudyStation</p>
                  <p className="text-[11px] font-semibold text-[#8a8494]">Your guided workspace tour</p>
                </div>
              </div>
              <button
                type="button"
                onClick={finish}
                className="grid size-8 place-items-center rounded-lg text-[#8a8494] hover:bg-[#f3f0f7] hover:text-[#514a66]"
                aria-label="Skip tour"
              >
                <X className="size-4" />
              </button>
            </div>

            <h2 id="app-tour-title" className="mt-5 text-[22px] font-black tracking-[-0.6px] text-[#17132d]">
              Welcome{greetingName !== "there" ? `, ${greetingName}` : ""}!
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#6c667a]">
              You’re in your study workspace. We’ll take a quick tour of the main tabs so you know where to capture lectures,
              review notes, generate study tools, and plan your week.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={finish} className="order-2 text-[11px] font-semibold text-[#9a94a3] hover:text-[#7259e8] sm:order-1">
                Skip for now
              </button>
              <button
                type="button"
                onClick={startSteps}
                className="order-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(114,89,232,.28)] hover:bg-[#6248d5] sm:order-2"
              >
                Start tour <ArrowRight className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eeeaff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#5d48ca]">
                <LogoMark size={18} />
                Step {stepIndex + 1} of {total}
              </div>
              <button
                type="button"
                onClick={finish}
                className="grid size-8 place-items-center rounded-lg text-[#8a8494] hover:bg-[#f3f0f7] hover:text-[#514a66]"
                aria-label="Skip tour"
              >
                <X className="size-4" />
              </button>
            </div>

            <h2 id="app-tour-title" className="mt-3 text-lg font-black tracking-[-0.4px] text-[#17132d]">
              {step?.title}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#6c667a]">{step?.body}</p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((item, index) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === stepIndex ? "w-5 bg-[#7259e8]" : index < stepIndex ? "w-2.5 bg-[#b7a9f5]" : "w-2.5 bg-[#e4dff2]"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e1ec] bg-white px-3 text-xs font-extrabold text-[#514a66] hover:bg-[#f7f5ff]"
                >
                  <ArrowLeft className="size-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#7259e8] px-3.5 text-xs font-extrabold text-white shadow-[0_10px_24px_rgba(114,89,232,.28)] hover:bg-[#6248d5]"
                >
                  {stepIndex >= total - 1 ? "Finish" : "Next"}
                  {stepIndex < total - 1 && <ArrowRight className="size-3.5" />}
                </button>
              </div>
            </div>

            <button type="button" onClick={finish} className="mt-3 text-[11px] font-semibold text-[#9a94a3] hover:text-[#7259e8]">
              Skip tour
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function resetAppTour(userId?: string | null) {
  try {
    window.localStorage.removeItem(storageKey(userId));
    // legacy key from earlier versions
    window.localStorage.removeItem("studystation-app-tour-v1");
  } catch {
    // ignore
  }
}
