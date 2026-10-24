"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clipboard,
  Clock3,
  Download,
  FileDown,
  FileText,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { exportNoteToPdf } from "@/lib/pdf-export";
import {
  createStudyTask,
  removeCourse,
  saveCourse,
  setCourseArchived,
  type Stage6ActionResult,
} from "@/app/app/stage6-actions";
import type { PlannerData } from "@/components/study-planner";

export type Stage6Course = {
  id: string;
  title: string;
  code: string;
  color: string;
  term: string | null;
  archived: boolean;
};

export type Stage6Task = {
  id: string;
  title: string;
  dueAt: string | null;
  status: string;
  courseId: string | null;
};

export type Stage6Event = {
  id: string;
  title: string;
  type: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  courseId: string | null;
};

export type OrganizedKeyTerm = {
  term: string;
  definition: string;
};

export type OrganizedNoteSection = {
  heading: string;
  body: string;
  bullets?: string[];
  takeaways?: string[];
};

export type OrganizedStudyQuestion = {
  question: string;
  answer?: string;
};

export type OrganizedNoteContent = {
  title: string;
  summary: string;
  keyTerms?: OrganizedKeyTerm[];
  sections?: OrganizedNoteSection[];
  takeaways?: string[];
  studyQuestions?: OrganizedStudyQuestion[];
  actionChecklist?: string[];
};

export type OrganizedNoteData = {
  id?: string;
  title: string;
  summary: string;
  content: OrganizedNoteContent;
  createdAt?: string;
  updatedAt?: string;
};

export type Stage6Lecture = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  durationSeconds: number | null;
  courseId: string | null;
  transcript?: string | null;
  note?: OrganizedNoteData | null;
  sourceType?: string | null;
  mediaUrl?: string | null;
};

export type Stage6DashboardData = {
  courses: Stage6Course[];
  tasks: Stage6Task[];
  events: Stage6Event[];
  lectures: Stage6Lecture[];
  errors: {
    courses: boolean;
    tasks: boolean;
    events: boolean;
    lectures: boolean;
  };
  context: string[];
  currentSemester: string | null;
  timezone: string;
};

function displayDate(value: string, timezone: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: timezone || "UTC",
  }).format(date);
}

function dateStatus(value: string | null, timezone: string) {
  if (!value) return "No deadline";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "Date unavailable";
  if (due.getTime() < Date.now()) return `Overdue · ${displayDate(value, timezone)}`;
  return `Due ${displayDate(value, timezone)}`;
}

function SectionError({ children }: { children: string }) {
  return <p role="status" className="rounded-xl bg-[#fff1ef] px-3 py-2.5 text-xs leading-5 text-[#a44e48]">{children}</p>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#e3deeb] bg-[#fbfaff] px-4 py-7 text-center">
    <p className="text-sm font-extrabold text-[#373145]">{title}</p>
    <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#8a8494]">{copy}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

function QuickAction({ icon: Icon, title, copy, onClick, disabled = false }: {
  icon: typeof Upload;
  title: string;
  copy: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = <><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#7259e8]"><Icon className="size-4" /></span><span className="min-w-0 text-left"><span className="block text-xs font-extrabold">{title}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#8a8494]">{copy}</span></span>{disabled && <span className="ml-auto shrink-0 rounded-full bg-[#f1eff5] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#85808d]">Later</span>}</>;
  const className = `flex min-h-[72px] items-center gap-3 rounded-2xl border border-[#e9e5ef] bg-white p-3 text-left transition ${disabled ? "cursor-not-allowed opacity-75" : "hover:-translate-y-0.5 hover:border-[#cfc5f3] hover:shadow-[0_10px_25px_rgba(39,29,74,.07)]"}`;
  return disabled ? <div aria-disabled="true" className={className}>{content}</div> : <button type="button" onClick={onClick} className={className}>{content}</button>;
}

export function Stage6Dashboard({
  data,
  plannerData,
  fullName,
  onCapture,
  onAssistant,
  onGroups,
  onOpenCourse,
  onOpenCourses,
  onOpenLectures,
  onOpenPlanner,
}: {
  data: Stage6DashboardData;
  plannerData: PlannerData;
  fullName: string;
  onCapture: () => void;
  onAssistant: () => void;
  onGroups: () => void;
  onOpenCourse: (id: string) => void;
  onOpenCourses: () => void;
  onOpenLectures: () => void;
  onOpenPlanner: () => void;
}) {
  const router = useRouter();
  const [taskDialog, setTaskDialog] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const firstName = fullName.trim().split(/\s+/)[0] || "Student";
  const activeCourses = useMemo(() => data.courses.filter((course) =>
    !course.archived && (!data.currentSemester || !course.term || course.term === data.currentSemester)), [data.courses, data.currentSemester]);
  const courseNames = useMemo(() => new Map(data.courses.map((course) => [course.id, `${course.code} · ${course.title}`])), [data.courses]);
  const calendarItems = [
    ...data.events
      .map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        startsAt: event.startsAt,
        detail: event.location || (event.type === "review" ? "Review block" : event.type === "exam" ? "Exam" : event.type === "lab" ? "Lab" : event.type === "lecture" ? "Class lecture" : "Study block"),
      })),
    ...plannerData.groupSessions.map((session) => ({
      id: `group-${session.id}`,
      title: session.title,
      startsAt: session.startsAt,
      detail: `Study group · ${session.groupName}`,
    })),
  ].sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt)).slice(0, 5);
  const progressCards = [
    { label: "Tasks completed", value: plannerData.progress.completedTasks, detail: "Saved tasks marked complete" },
    { label: "Lectures processed", value: plannerData.progress.processedLectures, detail: "Ready transcripts in your library" },
    {
      label: "Quiz attempts",
      value: plannerData.progress.quizAttempts,
      detail: plannerData.progress.recentQuizAverage === null
        ? "No scored attempts yet"
        : `${plannerData.progress.recentQuizAverage}% average · latest 10`,
    },
  ];

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const result = await createStudyTask(new FormData(form));
      setMessage(result.error ?? result.success ?? "Task update completed.");
      if (!result.error) {
        form.reset();
        setTaskDialog(false);
        router.refresh();
      }
    });
  }

  return <div className="fade-up space-y-5">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">Your study space</p>
        <h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Welcome back, {firstName}</h1>
        <p className="mt-1.5 text-[12px] leading-5 text-[#7d7789]">{data.context.length ? data.context.join(" · ") : "Your courses, study tasks, and lectures in one place."}</p>
      </div>
      <button type="button" onClick={() => setTaskDialog(true)} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-[#7259e8] px-4 text-[11px] font-extrabold text-white transition hover:bg-[#8069ed] sm:self-auto"><Plus className="size-4" /> Add a task</button>
    </section>

    <section aria-label="Quick actions" className="grid gap-2 sm:grid-cols-3">
      <QuickAction icon={Upload} title="Upload a lecture" copy="Turn class material into notes" onClick={onCapture} />
      <QuickAction icon={Sparkles} title="Ask StudyStation" copy="Get help with your studies" onClick={onAssistant} />
      <QuickAction icon={UsersRound} title="Study groups" copy="Find classmates and plan sessions" onClick={onGroups} />
    </section>

    {message && <p role="status" className="rounded-xl bg-[#f1efff] px-4 py-3 text-xs font-semibold text-[#5b47bd]">{message}</p>}

    <section aria-label="Learning progress from saved records" className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Your learning overview</p><h2 className="mt-1 text-[16px] font-extrabold">Progress at a glance</h2></div>
        <button type="button" onClick={onOpenPlanner} className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-xl bg-[#f3f0ff] px-3 text-[10px] font-extrabold text-[#7259e8] transition hover:bg-[#ebe6ff] sm:self-auto"><CalendarDays className="size-3.5" /> Open planner</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {progressCards.map((item) => <article key={item.label} className="rounded-2xl border border-[#f0edf4] bg-[#fbfaff] p-3.5">
          <p className="text-[9px] font-black uppercase tracking-[.1em] text-[#908a98]">{item.label}</p>
          {plannerData.errors.progress
            ? <p className="mt-2 text-xs font-bold text-[#a44e48]">Could not load</p>
            : <><p className="mt-1.5 text-[22px] font-black tracking-tight text-[#17132d]">{item.value}</p><p className="mt-0.5 text-[9px] text-[#8a8494]">{item.detail}</p></>}
        </article>)}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Your next steps</p><h2 className="mt-1 text-[16px] font-extrabold">Upcoming tasks</h2></div><button type="button" onClick={() => setTaskDialog(true)} className="text-[10px] font-extrabold text-[#7259e8]">Add task</button></div>
        {data.errors.tasks ? <SectionError>Tasks could not be loaded. Check that the Stage 4 migration is applied, then refresh.</SectionError> : data.tasks.length ? <ul className="divide-y divide-[#f0edf4]">{data.tasks.slice(0, 5).map((task) => <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]"><Check className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{task.title}</p><p className="mt-1 text-[10px] text-[#85808d]">{task.courseId ? courseNames.get(task.courseId) ?? "Course" : "Personal task"} · {dateStatus(task.dueAt, data.timezone)}</p></div></li>)}</ul> : <EmptyState title="Nothing due yet" copy="Add a study task or deadline and it will appear here." action={<button type="button" onClick={() => setTaskDialog(true)} className="text-xs font-extrabold text-[#7259e8]">Create your first task</button>} />}
      </div>

      <div className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#e6f7ef] text-[#2f946f]"><CalendarDays className="size-4" /></span><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">On your calendar</p><h2 className="mt-1 text-[16px] font-extrabold">Next up</h2></div></div><button type="button" onClick={onOpenPlanner} className="text-[10px] font-extrabold text-[#7259e8]">View planner</button></div>
        {data.errors.events || plannerData.errors.groupSessions
          ? <SectionError>Some calendar items could not be loaded. Open the planner or refresh to try again.</SectionError>
          : calendarItems.length
            ? <ul className="divide-y divide-[#f0edf4]">{calendarItems.map((item) => <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#e6f7ef] text-[#2f946f]"><Clock3 className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{item.title}</p><p className="mt-1 text-[10px] text-[#85808d]">{displayDate(item.startsAt, data.timezone, true)} · {item.detail}</p></div></li>)}</ul>
            : <EmptyState title="Nothing scheduled yet" copy="Your study blocks, review time, and group sessions will appear here." />}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Your semester</p><h2 className="mt-1 text-[16px] font-extrabold">Active courses</h2></div><button type="button" onClick={onOpenCourses} className="text-[10px] font-extrabold text-[#7259e8]">View all</button></div>
        {data.errors.courses ? <SectionError>Your courses could not be loaded. Refresh to try again.</SectionError> : activeCourses.length ? <div className="space-y-2">{activeCourses.slice(0, 4).map((course) => <button type="button" key={course.id} onClick={() => onOpenCourse(course.id)} className="flex w-full items-center gap-3 rounded-xl border border-[#f0edf4] p-3 text-left transition hover:border-[#cfc5f3] hover:bg-[#fbfaff]"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: course.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold">{course.title}</span><span className="mt-0.5 block truncate text-[10px] text-[#85808d]">{course.code}{course.term ? ` · ${course.term}` : ""}</span></span><ArrowRight className="size-3.5 shrink-0 text-[#9993a0]" /></button>)}</div> : <EmptyState title="Your course list is empty" copy="Add your first course to keep its study work organized." action={<button type="button" onClick={onOpenCourses} className="text-xs font-extrabold text-[#7259e8]">Add your first course</button>} />}
      </div>

      <div className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Pick up where you left off</p><h2 className="mt-1 text-[16px] font-extrabold">Recent lectures</h2></div><button type="button" onClick={onOpenLectures} className="text-[10px] font-extrabold text-[#7259e8]">View all</button></div>
        {data.errors.lectures ? <SectionError>Your recent lectures could not be loaded. Refresh to try again.</SectionError> : data.lectures.length ? <div className="space-y-2">{data.lectures.slice(0, 4).map((lecture) => <button key={lecture.id} type="button" onClick={onOpenLectures} className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-[#f0edf4] p-3 text-left transition hover:border-[#cfc5f3] hover:bg-[#fbfaff]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold">{lecture.title}</span><span className="mt-1 block truncate text-[10px] text-[#85808d]">{lecture.courseId ? courseNames.get(lecture.courseId) ?? "Course" : "Unassigned lecture"} · {lecture.status} · {displayDate(lecture.createdAt, data.timezone)}</span></span><ArrowRight className="size-3.5 shrink-0 text-[#9993a0]" /></button>)}</div> : <EmptyState title="No lectures yet" copy="Imported recordings and materials will appear here." action={<button type="button" onClick={onCapture} className="text-xs font-extrabold text-[#7259e8]">Upload your first lecture</button>} />}
      </div>
    </section>

    {taskDialog && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#17132d]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" className="w-full max-w-[440px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">Stay on track</p><h2 id="task-dialog-title" className="mt-1 text-xl font-black">Add a study task</h2></div><button type="button" aria-label="Close" onClick={() => setTaskDialog(false)} className="grid size-8 place-items-center rounded-lg bg-[#f4f2f7]"><X className="size-4" /></button></div><form onSubmit={submitTask} className="mt-5 space-y-3"><label className="block text-xs font-bold">Task title<input name="title" required minLength={2} maxLength={160} className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] px-3 text-sm outline-none focus:border-[#a99aed]" placeholder="e.g. Review lecture notes" /></label><label className="block text-xs font-bold">Course (optional)<select name="courseId" defaultValue="" className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] bg-white px-3 text-sm outline-none focus:border-[#a99aed]"><option value="">Personal task</option>{activeCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="block text-xs font-bold">Deadline (optional)<input name="dueAt" type="datetime-local" className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] px-3 text-sm outline-none focus:border-[#a99aed]" /></label><input type="hidden" name="timezone" value={data.timezone} />{message && <p role="status" className="text-xs font-semibold text-[#a44e48]">{message}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setTaskDialog(false)} className="h-10 rounded-xl px-4 text-xs font-bold text-[#777180]">Cancel</button><button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3.5 animate-spin" />}Add task</button></div></form></section></div>}
  </div>;
}

export function Stage6Courses({
  data,
  search,
  selectedCourseId,
  onOpenCourse,
  onCapture,
}: {
  data: Stage6DashboardData;
  search: string;
  selectedCourseId: string | null;
  onOpenCourse: (id: string | null) => void;
  onCapture: () => void;
}) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const terms = useMemo(() => [...new Set(data.courses.map((course) => course.term).filter((term): term is string => Boolean(term)))].sort(), [data.courses]);
  const currentTerm = data.currentSemester && terms.includes(data.currentSemester) ? data.currentSemester : "all";
  const [selectedTerm, setSelectedTerm] = useState(currentTerm);
  const [editing, setEditing] = useState<Stage6Course | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const listedCourses = useMemo(() => data.courses
    .filter((course) => course.archived === showArchived)
    .filter((course) => selectedTerm === "all" || !course.term || course.term === selectedTerm)
    .filter((course) => `${course.code} ${course.title} ${course.term ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data.courses, search, selectedTerm, showArchived]);
  const selectedCourse = data.courses.find((course) => course.id === selectedCourseId) ?? null;
  const courseLectures = selectedCourse ? data.lectures.filter((lecture) => lecture.courseId === selectedCourse.id) : [];

  function runAction(action: () => Promise<Stage6ActionResult>, successCallback?: () => void) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ?? result.success ?? "Update completed.");
      if (!result.error) {
        successCallback?.();
        router.refresh();
      }
    });
  }

  function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    runAction(() => saveCourse(new FormData(form)), () => setEditing(undefined));
  }

  const selectedTab = selectedCourse ? <CourseDetail course={selectedCourse} lectures={courseLectures} lectureError={data.errors.lectures} timezone={data.timezone} onBack={() => onOpenCourse(null)} onCapture={onCapture} /> : null;

  return <div className="fade-up">
    {selectedTab ? selectedTab : <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">Your semester</p><h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">{showArchived ? "Archived courses" : "My courses"}</h1><p className="mt-1.5 text-[12px] leading-5 text-[#7d7789]">Keep your lectures and study work organized by course.</p></div>
        <div className="flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor="course-term-filter">Filter courses by term</label><select id="course-term-filter" value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)} className="h-10 max-w-[180px] rounded-xl border border-[#e5e1eb] bg-white px-3 text-[10px] font-extrabold text-[#625b6d]"><option value="all">All terms</option>{terms.map((term) => <option key={term} value={term}>{term}</option>)}</select><button type="button" onClick={() => {setShowArchived((value) => !value); setSelectedTerm(showArchived ? currentTerm : "all"); setMessage("");}} className="h-10 rounded-xl border border-[#e5e1eb] bg-white px-3 text-[10px] font-extrabold text-[#625b6d]">{showArchived ? "View active courses" : "View archived"}</button>{!showArchived && <button type="button" onClick={() => setEditing(null)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[10px] font-extrabold text-white"><Plus className="size-4" /> Add course</button>}</div>
      </div>
      {message && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-xs font-semibold ${message.includes("couldn’t") || message.includes("no longer") || message.includes("could not") ? "bg-[#fff1ef] text-[#a44e48]" : "bg-[#f1efff] text-[#5b47bd]"}`}>{message}</p>}
      <div className="mt-5">
        {data.errors.courses ? <SectionError>Courses could not be loaded. Check that the Stage 4 migration is applied, then refresh.</SectionError> : listedCourses.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{listedCourses.map((course) => <article key={course.id} className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-2xl text-sm font-black" style={{ color: course.color, backgroundColor: `${course.color}18` }}><BookOpen className="size-5" /></span><div className="flex items-center gap-1"><button type="button" aria-label={`Edit ${course.title}`} onClick={() => setEditing(course)} className="grid size-8 place-items-center rounded-lg text-[#85808d] hover:bg-[#f3f0ff] hover:text-[#7259e8]"><Pencil className="size-3.5" /></button><button type="button" aria-label={showArchived ? `Restore ${course.title}` : `Archive ${course.title}`} onClick={() => runAction(() => setCourseArchived(course.id, !showArchived))} className="grid size-8 place-items-center rounded-lg text-[#85808d] hover:bg-[#f3f0ff] hover:text-[#7259e8]"><Archive className="size-3.5" /></button><button type="button" aria-label={`Remove ${course.title}`} onClick={() => { if (window.confirm(`Remove ${course.code} from your course list? Its lectures will remain in your account.`)) runAction(() => removeCourse(course.id)); }} className="grid size-8 place-items-center rounded-lg text-[#85808d] hover:bg-[#fff1ef] hover:text-[#a44e48]"><Trash2 className="size-3.5" /></button></div></div><p className="mt-4 text-[10px] font-black uppercase tracking-[.1em] text-[#85808d]">{course.code}{course.term ? ` · ${course.term}` : ""}</p><h2 className="mt-1 truncate text-base font-extrabold">{course.title}</h2><button type="button" onClick={() => onOpenCourse(course.id)} className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-extrabold text-[#7259e8]">Open course <ArrowRight className="size-3.5" /></button></article>)}</div> : search ? <EmptyState title={`No courses match “${search}”`} copy="Try a different code, title, or term." /> : showArchived ? <EmptyState title="No archived courses" copy="Courses you archive will be listed here, ready to restore later." /> : <EmptyState title="Your course list is empty" copy="Add your first course to organize lectures, tasks, and study work." action={<button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-[#7259e8] px-4 py-2.5 text-xs font-extrabold text-white"><Plus className="size-4" /> Add your first course</button>} />}
      </div>
    </>}

    {editing !== undefined && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#17132d]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="course-dialog-title" className="w-full max-w-[440px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">{editing ? "Course details" : "Build your course list"}</p><h2 id="course-dialog-title" className="mt-1 text-xl font-black">{editing ? "Edit course" : "Add a course"}</h2></div><button type="button" aria-label="Close" onClick={() => setEditing(undefined)} className="grid size-8 place-items-center rounded-lg bg-[#f4f2f7]"><X className="size-4" /></button></div><form onSubmit={submitCourse} className="mt-5 space-y-3"><input type="hidden" name="id" value={editing?.id ?? ""} /><label className="block text-xs font-bold">Course code<input name="code" required maxLength={30} defaultValue={editing?.code ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] px-3 text-sm outline-none focus:border-[#a99aed]" placeholder="e.g. BIO 202" /></label><label className="block text-xs font-bold">Course title<input name="title" required minLength={2} maxLength={120} defaultValue={editing?.title ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] px-3 text-sm outline-none focus:border-[#a99aed]" placeholder="e.g. Cell Biology" /></label><label className="block text-xs font-bold">Term or semester (optional)<input name="term" maxLength={80} defaultValue={editing?.term ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] px-3 text-sm outline-none focus:border-[#a99aed]" placeholder="e.g. Fall 2026" /></label><label className="block text-xs font-bold">Course color<input name="color" type="color" defaultValue={editing?.color ?? "#7259e8"} className="mt-1.5 h-10 w-full rounded-xl border border-[#e5e1eb] bg-white px-2" /></label>{message && <p role="status" className="text-xs font-semibold text-[#a44e48]">{message}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setEditing(undefined)} className="h-10 rounded-xl px-4 text-xs font-bold text-[#777180]">Cancel</button><button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3.5 animate-spin" />}{editing ? "Save changes" : "Add course"}</button></div></form></section></div>}
  </div>;
}

type LectureDetail = Stage6Lecture & {
  sourceType: string;
  mimeType: string | null;
  transcript: string | null;
  processingError: string | null;
  updatedAt: string;
  mediaUrl?: string | null;
  note?: OrganizedNoteData | null;
};

export function formatNoteMarkdown(note: OrganizedNoteData, lectureTitle: string, courseName?: string) {
  let md = `# ${note.title || lectureTitle}\n\n`;
  if (courseName) md += `**Course**: ${courseName}\n\n`;
  md += `## Executive Summary\n${note.summary}\n\n`;

  const terms = note.content?.keyTerms ?? [];
  if (terms.length > 0) {
    md += `## Key Concepts & Vocabulary\n`;
    for (const t of terms) {
      md += `- **${t.term}**: ${t.definition}\n`;
    }
    md += `\n`;
  }

  const sections = note.content?.sections ?? [];
  if (sections.length > 0) {
    md += `## Lecture Breakdown\n`;
    for (const sec of sections) {
      md += `### ${sec.heading}\n${sec.body}\n\n`;
      if (sec.bullets && sec.bullets.length > 0) {
        for (const b of sec.bullets) md += `- ${b}\n`;
        md += `\n`;
      }
      if (sec.takeaways && sec.takeaways.length > 0) {
        md += `> **Key Takeaway**: ${sec.takeaways.join("; ")}\n\n`;
      }
    }
  }

  const takeaways = note.content?.takeaways ?? [];
  if (takeaways.length > 0) {
    md += `## High-Yield Exam Takeaways\n`;
    for (const t of takeaways) md += `- ${t}\n`;
    md += `\n`;
  }

  const questions = note.content?.studyQuestions ?? [];
  if (questions.length > 0) {
    md += `## Active Recall Questions\n`;
    for (let i = 0; i < questions.length; i++) {
      md += `**Q${i + 1}: ${questions[i].question}**\n`;
      if (questions[i].answer) md += `*Answer*: ${questions[i].answer}\n\n`;
    }
  }

  return md;
}

export function OrganizedNotesDisplay({ note }: { note: OrganizedNoteData }) {
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  const terms = note.content?.keyTerms ?? [];
  const sections = note.content?.sections ?? [];
  const takeaways = note.content?.takeaways ?? [];
  const questions = note.content?.studyQuestions ?? [];
  const checklist = note.content?.actionChecklist ?? [];

  return (
    <div className="mt-4 space-y-6">
      {/* Executive Summary */}
      <div className="rounded-2xl border border-[#e2daf8] bg-gradient-to-br from-[#faf8ff] via-[#f7f5ff] to-[#f2efff] p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[#7259e8] text-white">
            <Sparkles className="size-3.5" />
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#7259e8]">Executive Summary</h3>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#352e46]">{note.summary}</p>
      </div>

      {/* Key Concepts / Vocabulary */}
      {terms.length > 0 && (
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-[#efe9fb] text-[#7259e8]">
              <BookOpen className="size-3.5" />
            </span>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#17132d]">Key Concepts & Vocabulary</h4>
            <span className="rounded-full bg-[#f0edf7] px-2 py-0.5 text-[9px] font-bold text-[#767082]">{terms.length}</span>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {terms.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-[#eae5f2] bg-white p-3.5 transition hover:border-[#cfc3f5] hover:shadow-sm">
                <p className="text-[11px] font-black text-[#7259e8]">{item.term}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#564e65]">{item.definition}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Structured Sections */}
      {sections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-[#efe9fb] text-[#7259e8]">
              <Layers3 className="size-3.5" />
            </span>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#17132d]">Lecture Breakdown</h4>
          </div>
          {sections.map((section, idx) => (
            <div key={idx} className="rounded-2xl border border-[#ebe7f2] bg-white p-5 shadow-sm">
              <h5 className="text-[13px] font-black text-[#17132d]">{section.heading}</h5>
              <p className="mt-2 text-xs leading-relaxed text-[#403950] whitespace-pre-line">{section.body}</p>
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-l-2 border-[#7259e8]/30 pl-3">
                  {section.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="text-[11px] leading-relaxed text-[#5a5367]">
                      • {bullet}
                    </li>
                  ))}
                </ul>
              )}
              {section.takeaways && section.takeaways.length > 0 && (
                <div className="mt-3 rounded-xl bg-[#f5f3fc] px-3.5 py-2 text-[10px] text-[#634cc7]">
                  <span className="font-extrabold uppercase tracking-wide">Key Insight: </span>
                  {section.takeaways.join("; ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* High-Yield Exam Takeaways */}
      {takeaways.length > 0 && (
        <div className="rounded-2xl border border-[#cbe9d8] bg-[#f4fbf7] p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-[#d4f2e1] text-[#22774d]">
              <Check className="size-3.5" />
            </span>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1d6b43]">High-Yield Exam Takeaways</h4>
          </div>
          <ul className="mt-3 space-y-2">
            {takeaways.map((takeaway, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-[#2a5d40]">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#2da365]" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Recall Questions */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-[#efe9fb] text-[#7259e8]">
              <Clock3 className="size-3.5" />
            </span>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#17132d]">Active Recall Questions</h4>
            <span className="text-[10px] text-[#868093]">(Test yourself before reading the answer)</span>
          </div>
          <div className="space-y-2.5">
            {questions.map((q, idx) => {
              const isRevealed = Boolean(revealedQuestions[idx]);
              return (
                <div key={idx} className="rounded-xl border border-[#ebe7f2] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-[#17132d]">
                      <span className="font-black text-[#7259e8]">Q{idx + 1}. </span>
                      {q.question}
                    </p>
                    {q.answer && (
                      <button
                        type="button"
                        onClick={() => setRevealedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className="shrink-0 rounded-lg bg-[#f4f1fa] px-2.5 py-1 text-[9px] font-extrabold text-[#7259e8] hover:bg-[#eae4f7]"
                      >
                        {isRevealed ? "Hide answer" : "Show answer"}
                      </button>
                    )}
                  </div>
                  {isRevealed && q.answer && (
                    <div className="mt-3 rounded-lg border border-[#e5def7] bg-[#faf8ff] p-3 text-[11px] leading-relaxed text-[#4e4560]">
                      <span className="font-black text-[#7259e8]">Answer: </span>
                      {q.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Study Action Checklist */}
      {checklist.length > 0 && (
        <div className="rounded-2xl border border-[#ebe7f2] bg-[#faf9fd] p-4.5">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#5f586d]">Next Revision Steps</h4>
          <div className="mt-2.5 space-y-2">
            {checklist.map((item, idx) => {
              const isDone = Boolean(checkedActions[idx]);
              return (
                <label key={idx} className="flex cursor-pointer items-start gap-2 text-xs text-[#40384f]">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => setCheckedActions((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    className="mt-0.5 accent-[#7259e8]"
                  />
                  <span className={isDone ? "line-through opacity-60" : ""}>{item}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function LectureStudio({
  lectures,
  courses,
  timezone,
  loadError,
  autoOpenLectureId,
  onAutoOpen,
  onUpload,
  onToast,
}: {
  lectures: Stage6Lecture[];
  courses: Stage6Course[];
  timezone: string;
  loadError: boolean;
  autoOpenLectureId: string | null;
  onAutoOpen: () => void;
  onUpload: () => void;
  onToast?: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<LectureDetail | null>(null);
  const [studioTab, setStudioTab] = useState<"notes" | "transcript">("notes");
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const courseNames = useMemo(() => new Map(courses.map((course) => [course.id, `${course.code} · ${course.title}`])), [courses]);

  const fetchLectureDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/lectures/${id}`);
    const body = await response.json() as { lecture?: LectureDetail; error?: string };
    if (!response.ok || !body.lecture) throw new Error(body.error || "Lecture could not be loaded.");
    return body.lecture;
  }, []);

  const openLecture = useCallback(async (id: string) => {
    if (selected?.id === id && !error && !busy) return;

    const preview = lectures.find((lecture) => lecture.id === id);
    // Optimistic selection so the right panel reacts immediately.
    if (preview) {
      setSelected({
        id: preview.id,
        title: preview.title,
        status: preview.status,
        createdAt: preview.createdAt,
        durationSeconds: preview.durationSeconds,
        courseId: preview.courseId,
        transcript: preview.transcript ?? null,
        note: preview.note ?? null,
        sourceType: preview.sourceType ?? "recording",
        mediaUrl: preview.mediaUrl ?? null,
        mimeType: null,
        processingError: null,
        updatedAt: preview.createdAt,
      } as LectureDetail);
      setTranscriptDraft(preview.transcript ?? "");
      setStudioTab(preview.note ? "notes" : "transcript");
      setDirty(false);
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const lecture = await fetchLectureDetail(id);
      setSelected(lecture);
      setTranscriptDraft(lecture.transcript ?? "");
      setStudioTab(lecture.note ? "notes" : "transcript");
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lecture could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, [busy, error, fetchLectureDetail, lectures, selected?.id]);

  useEffect(() => {
    if (!autoOpenLectureId || !lectures.some((lecture) => lecture.id === autoOpenLectureId)) return;
    onAutoOpen();
    void openLecture(autoOpenLectureId);
  }, [autoOpenLectureId, lectures, onAutoOpen, openLecture]);

  // Auto-open the most recent ready lecture once when the studio mounts with data.
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (didAutoOpenRef.current || selected || busy || autoOpenLectureId || !lectures.length) return;
    const firstReady = [...lectures]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find((lecture) => lecture.status === "ready");
    if (firstReady) {
      didAutoOpenRef.current = true;
      void openLecture(firstReady.id);
    }
  }, [autoOpenLectureId, busy, lectures, openLecture, selected]);

  async function saveTranscript() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/lectures/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptDraft }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Transcript could not be saved.");
      setSelected({ ...selected, transcript: transcriptDraft });
      setDirty(false);
      setNotice("Transcript saved.");
      onToast?.("Transcript saved.", "success");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Transcript could not be saved.";
      setError(message);
      onToast?.(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function generateNotes() {
    if (!selected) return;
    setGeneratingNotes(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/lectures/${selected.id}/notes`, {
        method: "POST",
      });
      const body = (await response.json()) as { note?: OrganizedNoteData; error?: string; message?: string };
      if (!response.ok || !body.note) throw new Error(body.error || "Could not generate organized notes.");
      setSelected({ ...selected, note: body.note });
      setStudioTab("notes");
      const successMessage = body.message || "Organized study notes generated successfully!";
      setNotice(successMessage);
      onToast?.(successMessage, "success");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Note generation failed.";
      setError(message);
      onToast?.(message, "error");
    } finally {
      setGeneratingNotes(false);
    }
  }

  async function retryLecture(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Lecture processing could not start.");
      await openLecture(id);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lecture processing could not start.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteLecture(lecture: Stage6Lecture) {
    if (!window.confirm(`Delete "${lecture.title}" and its transcript? This also deletes its derived notes and study materials.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/lectures/${lecture.id}`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Lecture could not be deleted.");
      if (selected?.id === lecture.id) {
        setSelected(null);
        setTranscriptDraft("");
      }
      setNotice("Lecture and associated study content deleted.");
      onToast?.("Lecture deleted.", "success");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lecture could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function copyTranscript() {
    if (!selected?.transcript) return;
    void navigator.clipboard.writeText(transcriptDraft).then(
      () => {
        setNotice("Transcript copied.");
        onToast?.("Transcript copied.", "success");
      },
      () => {
        setError("Clipboard access was unavailable. Select and copy the transcript manually.");
        onToast?.("Clipboard access was unavailable.", "error");
      },
    );
  }

  function downloadTranscript() {
    if (!selected) return;
    const blob = new Blob([transcriptDraft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.title.replace(/[^\w.-]+/g, "-").slice(0, 80) || "lecture"}-transcript.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function copyNoteMarkdownAction() {
    if (!selected?.note) return;
    const courseName = selected.courseId ? courseNames.get(selected.courseId) : undefined;
    const md = formatNoteMarkdown(selected.note, selected.title, courseName);
    void navigator.clipboard.writeText(md).then(
      () => {
        setNotice("Organized study notes copied as Markdown!");
        onToast?.("Notes copied as Markdown.", "success");
      },
      () => {
        setError("Clipboard access unavailable.");
        onToast?.("Clipboard access unavailable.", "error");
      }
    );
  }

  function exportNotePdfAction() {
    if (!selected?.note) return;
    const courseName = selected.courseId ? courseNames.get(selected.courseId) : undefined;
    try {
      exportNoteToPdf(selected.note, selected.title, courseName);
      setNotice("Organized study guide PDF downloaded!");
      onToast?.("Study guide PDF downloaded.", "success");
      onToast?.("Study guide PDF downloaded.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PDF.");
    }
  }

  function downloadNoteMarkdownAction() {
    if (!selected?.note) return;
    const courseName = selected.courseId ? courseNames.get(selected.courseId) : undefined;
    const md = formatNoteMarkdown(selected.note, selected.title, courseName);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.title.replace(/[^\w.-]+/g, "-").slice(0, 80) || "lecture"}-study-notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const sortedLectures = useMemo(() => [...lectures].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [lectures]);

  return <div className="fade-up">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">Lecture Studio</p><h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Your lecture library</h1><p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7d7789]">Upload authorized audio or video recordings, or lecture documents (PDF, Word, PPT, text). Content is parsed and organized into comprehensive study notes with AI.</p></div>
      <button type="button" onClick={onUpload} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-[#7259e8] px-4 text-[11px] font-extrabold text-white sm:self-auto"><Upload className="size-4" /> Add a lecture</button>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <section className="rounded-[24px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-extrabold">Recent lectures</h2><span className="text-[10px] text-[#8a8494]">{sortedLectures.length}</span></div>
        {loadError ? <SectionError>Lecture history could not be loaded. Check the Stage 4 migration and refresh.</SectionError> : sortedLectures.length ? <ul className="space-y-2">{sortedLectures.map((lecture) => {
            const isActive = selected?.id === lecture.id;
            return (
              <li key={lecture.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void openLecture(lecture.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openLecture(lecture.id);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-3 transition ${isActive ? "border-[#c8bcf2] bg-[#f8f6ff] shadow-sm" : "border-[#f0edf4] hover:border-[#d9d0f5] hover:bg-[#fbfaff]"}`}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-extrabold">{lecture.title}</span>
                    <span className="mt-1 block truncate text-[10px] text-[#85808d]">{lecture.sourceType === "document" ? "Document" : lecture.sourceType === "video" ? "Video" : lecture.sourceType === "audio" ? "Audio" : "Recording"} · {lecture.courseId ? courseNames.get(lecture.courseId) ?? "Course" : "Unassigned"} · {displayDate(lecture.createdAt, timezone)}</span>
                    {lecture.note && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#f3f0ff] px-1.5 py-0.5 text-[8px] font-extrabold text-[#7259e8]">
                        <Sparkles className="size-2.5" /> Notes ready
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black uppercase ${lecture.status === "ready" ? "bg-[#e5f7ed] text-[#2f946f]" : lecture.status === "failed" ? "bg-[#fff0ee] text-[#ae544d]" : "bg-[#fff4db] text-[#9b741f]"}`}>{lecture.status}</span>
                  {lecture.status !== "ready" && lecture.status !== "processing" && (
                    <button type="button" disabled={busy} aria-label={`Retry ${lecture.title}`} onClick={(event) => { event.stopPropagation(); void retryLecture(lecture.id); }} className="grid size-7 shrink-0 place-items-center rounded-lg text-[#7259e8] hover:bg-[#f1edff] disabled:opacity-50">
                      <RefreshCw className="size-3.5" />
                    </button>
                  )}
                  <button type="button" disabled={busy || lecture.status === "processing"} aria-label={`Delete ${lecture.title}`} onClick={(event) => { event.stopPropagation(); void deleteLecture(lecture); }} className="grid size-7 shrink-0 place-items-center rounded-lg text-[#85808d] hover:bg-[#fff1ef] hover:text-[#a44e48] disabled:opacity-50">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}</ul> : <EmptyState title="No lectures yet" copy="Upload an authorized audio or video recording, or lecture document to create your first notes." action={<button type="button" onClick={onUpload} className="text-xs font-extrabold text-[#7259e8]">Upload a lecture</button>} />}
      </section>

      <section className="min-h-[420px] rounded-[24px] border border-[#e9e5ef] bg-white p-4 sm:p-6">
        {!selected ? (
          <div className="grid h-full min-h-[360px] place-items-center text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f0edff] text-[#7259e8]">
                {busy ? <LoaderCircle className="size-5 animate-spin" /> : <FileText className="size-5" />}
              </span>
              <h2 className="mt-4 text-sm font-extrabold">{busy ? "Opening lecture…" : "Transcript & notes workspace"}</h2>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[#8a8494]">
                {busy
                  ? "Loading transcript and notes for the selected lecture."
                  : "Choose a completed lecture to view its generated notes and original source."}
              </p>
              {error && <p role="alert" className="mx-auto mt-4 max-w-sm rounded-xl bg-[#fff1ef] px-3 py-2.5 text-xs text-[#a44e48]">{error}</p>}
            </div>
          </div>
        ) : <>
          <div className="flex flex-col justify-between gap-3 border-b border-[#eeeaf2] pb-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#7259e8]">{selected.sourceType} · {selected.status}</p>
              <h2 className="mt-1 truncate text-lg font-black">{selected.title}</h2>
              <p className="mt-1 text-[10px] text-[#85808d]">{displayDate(selected.createdAt, timezone, true)}{selected.courseId ? ` · ${courseNames.get(selected.courseId) ?? "Course"}` : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {selected.status === "ready" && selected.transcript && (
                <>
                  {selected.note ? (
                    <>
                      <button type="button" onClick={exportNotePdfAction} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cfc4f6] bg-[#f5f2ff] px-2.5 text-[9px] font-extrabold text-[#7259e8] hover:bg-[#ece7ff] shadow-sm"><FileDown className="size-3.5" /> Export PDF</button>
                      <button type="button" onClick={copyNoteMarkdownAction} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e6e2eb] px-2.5 text-[9px] font-bold hover:bg-[#faf9fd]"><Clipboard className="size-3.5" /> Copy Notes</button>
                      <button type="button" onClick={downloadNoteMarkdownAction} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e6e2eb] px-2.5 text-[9px] font-bold hover:bg-[#faf9fd]"><Download className="size-3.5" /> Download .md</button>
                      <button type="button" disabled={generatingNotes} onClick={() => void generateNotes()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e6e2eb] px-2.5 text-[9px] font-bold hover:bg-[#faf9fd] disabled:opacity-50">
                        {generatingNotes ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Regenerate Notes
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={generatingNotes} onClick={() => void generateNotes()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#7259e8] px-3 text-[9px] font-black text-white shadow-sm hover:bg-[#6045de] disabled:opacity-50">
                      {generatingNotes ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Generate AI Notes
                    </button>
                  )}
                </>
              )}
              {selected.status !== "ready" && <button type="button" disabled={busy} onClick={() => void retryLecture(selected.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#7259e8] px-2.5 text-[9px] font-extrabold text-white disabled:opacity-50"><RefreshCw className="size-3.5" /> Retry</button>}
            </div>
          </div>

          {/* Media Audio / Video Player or Document Card */}
          <div className="mt-4">
            {selected.sourceType === "video" ? (
              <div className="overflow-hidden rounded-2xl border border-[#e4ddfa] bg-black shadow-sm">
                <video
                  src={selected.mediaUrl || `/api/lectures/${selected.id}/media`}
                  controls
                  className="max-h-[260px] w-full"
                />
              </div>
            ) : selected.sourceType === "document" ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[#e4ddfa] bg-[#faf8ff] p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-[#ede8ff] text-[#7259e8]">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1e1730]">Document Lecture Material</p>
                  <p className="text-[10px] text-[#7e778b]">View the original uploaded file alongside its generated notes</p>
                </div>
                {selected.mediaUrl && (
                  <a
                    href={selected.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cfc4f6] bg-white px-2.5 text-[9px] font-bold text-[#7259e8] hover:bg-[#f5f2ff]"
                  >
                    <Download className="size-3.5" /> Download original
                  </a>
                )}
              </div>
            ) : (
              <AudioPlayer
                src={selected.mediaUrl || `/api/lectures/${selected.id}/media`}
                title={selected.title}
                variant="card"
                durationHintSeconds={selected.durationSeconds ?? undefined}
              />
            )}
          </div>

          {selected.status === "processing" && <p className="mt-4 rounded-xl bg-[#fff5df] px-3 py-2.5 text-xs text-[#8e6d25]">Transcription is in progress. Refresh this page in a moment to check its status.</p>}
          {selected.status === "uploaded" && <p className="mt-4 rounded-xl bg-[#f2efff] px-3 py-2.5 text-xs text-[#5d4cb7]">Your upload is private and ready to process. Configure your server transcription key (GROQ_API_KEY) if processing is not set up yet.</p>}
          {selected.status === "failed" && <p className="mt-4 rounded-xl bg-[#fff1ef] px-3 py-2.5 text-xs leading-5 text-[#a44e48]">{selected.processingError || "This lecture could not be processed. Your private media is retained; retry when the provider is available."}</p>}

          {selected.status === "ready" && selected.transcript && (
            <div className="mt-5">
              {/* Studio Tabs Switcher */}
              <div className="flex items-center justify-between border-b border-[#ece8f4] pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStudioTab("notes")}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                      studioTab === "notes" ? "bg-[#7259e8] text-white shadow-sm" : "text-[#767082] hover:bg-[#f6f4fa]"
                    }`}
                  >
                    <Sparkles className="size-3.5" /> Generated Notes
                    {selected.note && <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[8px] font-extrabold">Ready</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioTab("transcript")}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                      studioTab === "transcript" ? "bg-[#7259e8] text-white shadow-sm" : "text-[#767082] hover:bg-[#f6f4fa]"
                    }`}
                  >
                    <FileText className="size-3.5" /> {selected.sourceType === "document" ? "Original File" : "Transcript"}
                  </button>
                </div>
                {studioTab === "transcript" && selected.sourceType !== "document" && (
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={!selected.transcript || busy} onClick={copyTranscript} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e6e2eb] px-2 text-[9px] font-bold"><Clipboard className="size-3" /> Copy</button>
                    <button type="button" disabled={!selected.transcript || busy} onClick={downloadTranscript} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e6e2eb] px-2 text-[9px] font-bold"><Download className="size-3" /> Download</button>
                  </div>
                )}
              </div>

              {/* Tab 1: Organized Notes */}
              {studioTab === "notes" && (
                <div>
                  {selected.note ? (
                    <OrganizedNotesDisplay note={selected.note} />
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-[#d8d0ee] bg-[#faf8ff] p-8 text-center">
                      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eee7ff] text-[#7259e8]">
                        <Sparkles className="size-6" />
                      </div>
                      <h3 className="mt-3 text-base font-black text-[#17132d]">Organize this lecture into notes</h3>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#736c81]">
                        Turn this lecture into an executive summary, topic breakdown, key vocabulary glossary, and active-recall test questions.
                      </p>
                      <button
                        type="button"
                        disabled={generatingNotes}
                        onClick={() => void generateNotes()}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7259e8] px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#6045de] disabled:opacity-60"
                      >
                        {generatingNotes ? (
                          <>
                            <LoaderCircle className="size-4 animate-spin" /> Organizing lecture notes with AI…
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" /> Generate Organized Notes with AI
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Raw Transcript */}
              {studioTab === "transcript" && selected.sourceType === "document" && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#e9e5ef] bg-[#fdfcff]">
                  {selected.mediaUrl ? (
                    <iframe title={`Original file: ${selected.title}`} src={selected.mediaUrl} className="h-[min(65vh,700px)] w-full bg-white" />
                  ) : (
                    <p className="p-6 text-xs text-[#7e778b]">The original file preview is unavailable.</p>
                  )}
                </div>
              )}
              {studioTab === "transcript" && selected.sourceType !== "document" && (
                <>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#8a8494]">Original transcript · editable</p>
                    {dirty && <span className="text-[9px] font-bold text-[#a16b17]">Unsaved changes</span>}
                  </div>
                  <textarea
                    aria-label="Lecture transcript"
                    value={transcriptDraft}
                    onChange={(event) => {
                      setTranscriptDraft(event.target.value);
                      setDirty(true);
                    }}
                    maxLength={500_000}
                    className="mt-2 min-h-[310px] w-full resize-y rounded-2xl border border-[#e9e5ef] bg-[#fdfcff] p-4 text-xs leading-6 text-[#403b4b] outline-none focus:border-[#c9bdf1]"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[9px] text-[#8a8494]">{transcriptDraft.length.toLocaleString()} / 500,000 characters</span>
                    <button
                      type="button"
                      disabled={!dirty || busy || !transcriptDraft.trim()}
                      onClick={() => void saveTranscript()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#7259e8] px-3 text-[10px] font-extrabold text-white disabled:opacity-50"
                    >
                      {busy && <LoaderCircle className="size-3.5 animate-spin" />} Save transcript
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ef] px-3 py-2.5 text-xs text-[#a44e48]">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-xl bg-[#e8f7ef] px-3 py-2.5 text-xs text-[#2f946f]">{notice}</p>}
      </section>
    </div>
    <p className="mt-4 text-[10px] leading-5 text-[#8a8494]">Only upload lecture materials you have permission to use. Original files are kept in your private account; audio and video are sent to your configured transcription provider.</p>
  </div>;
}

function CourseDetail({ course, lectures, lectureError, timezone, onBack, onCapture }: {
  course: Stage6Course;
  lectures: Stage6Lecture[];
  lectureError: boolean;
  timezone: string;
  onBack: () => void;
  onCapture: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "lectures">("overview");
  return <div>
    <button type="button" onClick={onBack} className="mb-4 text-xs font-extrabold text-[#7259e8]">← All courses</button>
    <div className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
      <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ color: course.color, backgroundColor: `${course.color}18` }}><BookOpen className="size-6" /></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#85808d]">{course.code}{course.term ? ` · ${course.term}` : ""}</p><h1 className="mt-1 truncate text-2xl font-black tracking-[-.7px]">{course.title}</h1><p className="mt-1 text-xs text-[#85808d]">Your personal course workspace</p></div></div>
      <div className="mt-6 flex gap-2 border-b border-[#eeeaf2]"><button type="button" onClick={() => setTab("overview")} className={`border-b-2 px-3 py-2 text-xs font-extrabold ${tab === "overview" ? "border-[#7259e8] text-[#7259e8]" : "border-transparent text-[#85808d]"}`}>Overview</button><button type="button" onClick={() => setTab("lectures")} className={`border-b-2 px-3 py-2 text-xs font-extrabold ${tab === "lectures" ? "border-[#7259e8] text-[#7259e8]" : "border-transparent text-[#85808d]"}`}>Lectures</button></div>
      {tab === "overview" ? <div className="grid gap-3 py-5 sm:grid-cols-2"><div className="rounded-2xl bg-[#f8f6ff] p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#85808d]">Lectures</p><p className="mt-2 text-2xl font-black">{lectures.length}</p><p className="mt-1 text-[10px] text-[#85808d]">saved to this course</p></div><div className="rounded-2xl bg-[#f7fbf8] p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#85808d]">Study resources</p><p className="mt-2 text-sm font-extrabold">Available in upcoming stages</p><p className="mt-1 text-[10px] leading-4 text-[#85808d]">Resources, flashcards, quizzes, course tasks, and groups will appear as those features are implemented.</p></div><div className="sm:col-span-2"><button type="button" onClick={onCapture} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white"><Plus className="size-4" /> Add a lecture</button></div></div> : <div className="py-5">{lectureError ? <SectionError>Course lectures could not be loaded. Refresh to try again.</SectionError> : lectures.length ? <ul className="divide-y divide-[#f0edf4]">{lectures.map((lecture) => <li key={lecture.id} className="flex items-center gap-3 py-3 first:pt-0"><span className="grid size-9 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{lecture.title}</p><p className="mt-1 text-[10px] text-[#85808d]">{lecture.status} · {displayDate(lecture.createdAt, timezone)}</p></div></li>)}</ul> : <EmptyState title="No lectures in this course yet" copy="Add a lecture to build a course-specific study space." action={<button type="button" onClick={onCapture} className="text-xs font-extrabold text-[#7259e8]">Upload a lecture</button>} />}</div>}
      <div className="mt-2 border-t border-[#eeeaf2] pt-4"><p className="mb-3 text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Planned workspace sections</p><div className="flex flex-wrap gap-2">{[[Layers3, "Flashcards"], [Sparkles, "Resources"], [Check, "Quizzes"], [CalendarDays, "Tasks"], [UsersRound, "Study groups"]].map(([Icon, label]) => <span key={label as string} className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f2f7] px-3 py-1.5 text-[10px] font-bold text-[#85808d]"><Icon className="size-3" />{label as string} · later</span>)}</div></div>
    </div>
  </div>;
}
