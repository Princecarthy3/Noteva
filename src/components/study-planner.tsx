"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Circle,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  createStudyTask,
  deletePlannerEvent,
  deleteStudyTask,
  savePlannerEvent,
  setStudyTaskStatus,
  updateStudyTask,
  type Stage6ActionResult,
} from "@/app/app/stage6-actions";
import type { Stage6Course } from "@/components/stage6-workspace";

export type PlannerTask = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: string;
  priority: string;
  courseId: string | null;
};

export type PlannerEvent = {
  id: string;
  title: string;
  type: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  courseId: string | null;
};

export type PlannerData = {
  asOf: number;
  tasks: PlannerTask[];
  events: PlannerEvent[];
  groupSessions: Array<{ id: string; title: string; groupName: string; startsAt: string; endsAt: string }>;
  preferences: {
    pace: string;
    sessionMinutes: number;
    breakMinutes: number;
    dailyLimitMinutes: number;
    preferredTimes: string[];
    studyDays: number[];
  };
  progress: {
    completedTasks: number;
    processedLectures: number;
    quizAttempts: number;
    recentQuizAverage: number | null;
    recentAttempts: Array<{ id: string; title: string; score: number; total: number; completedAt: string }>;
  };
  errors: {
    tasks: boolean;
    events: boolean;
    groupSessions: boolean;
    progress: boolean;
    preferences: boolean;
  };
};

function formatDate(value: string, timezone: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    weekday: includeTime ? "short" : undefined,
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: timezone || "UTC",
  }).format(date);
}

function toLocalInput(value: string | null, timezone: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

function priorityLabel(priority: string) {
  return priority === "high" ? "High priority" : priority === "low" ? "Low priority" : "Normal priority";
}

function dateIsPast(value: string | null, asOf: number) {
  return Boolean(value && new Date(value).getTime() < asOf);
}

export function PlannerOverview({
  data,
  courses,
  timezone,
  asOf,
  onOpenCalendar,
}: {
  data: PlannerData;
  courses: Stage6Course[];
  timezone: string;
  asOf: number;
  onOpenCalendar: () => void;
}) {
  const router = useRouter();
  const [taskEditor, setTaskEditor] = useState<PlannerTask | null | undefined>(undefined);
  const [eventEditor, setEventEditor] = useState<PlannerEvent | null | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState("");
  const [filter, setFilter] = useState<"open" | "all" | "completed">("open");
  const [pending, startTransition] = useTransition();
  const courseLabels = useMemo(() => new Map(courses.map((course) => [course.id, `${course.code} · ${course.title}`])), [courses]);
  const shownTasks = data.tasks.filter((task) => filter === "open"
    ? task.status === "todo" || task.status === "in_progress"
    : filter === "completed" ? task.status === "completed" : true);

  function runAction(action: () => Promise<Stage6ActionResult>, afterSuccess?: () => void) {
    setStatusMessage("");
    startTransition(async () => {
      const result = await action();
      setStatusMessage(result.error ?? result.success ?? "Update completed.");
      if (!result.error) {
        afterSuccess?.();
        router.refresh();
      }
    });
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    runAction(() => taskEditor?.id ? updateStudyTask(formData) : createStudyTask(formData), () => setTaskEditor(undefined));
  }

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(() => savePlannerEvent(formData), () => setEventEditor(undefined));
  }

  const progressCards = [
    { label: "Tasks completed", value: data.progress.completedTasks, detail: "Saved tasks marked complete" },
    { label: "Lectures processed", value: data.progress.processedLectures, detail: "Ready transcripts in your library" },
    { label: "Quiz attempts", value: data.progress.quizAttempts, detail: data.progress.recentQuizAverage === null ? "No scored attempts yet" : `${data.progress.recentQuizAverage}% average · latest 10` },
  ];

  return <div className="fade-up space-y-5">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">YOUR LEARNING OVERVIEW</p><h1 className="mt-1 text-[20px] font-black tracking-[-.7px] text-[#17132d] sm:text-[23px]">Study planner overview</h1><p className="mt-1.5 text-[11px] leading-5 text-[#7d7789]">Tasks, progress, and upcoming commitments in your local timezone ({timezone}).</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => {setTaskEditor(null); setStatusMessage("");}} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e5e1eb] bg-white px-3.5 text-[10px] font-extrabold text-[#5e47c4]"><Plus className="size-3.5" /> Add task</button><button type="button" onClick={onOpenCalendar} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-3.5 text-[10px] font-extrabold text-white"><CalendarDays className="size-3.5" /> Full calendar</button></div>
    </header>

    {statusMessage && <p role="status" className={`rounded-xl px-4 py-3 text-xs font-semibold ${statusMessage.includes("could") || statusMessage.includes("valid") || statusMessage.includes("not available") ? "bg-[#fff1ef] text-[#a44e48]" : "bg-[#f1efff] text-[#5b47bd]"}`}>{statusMessage}</p>}

    <section aria-label="Learning progress from saved records" className="grid gap-3 sm:grid-cols-3">
      {progressCards.map((item) => <article key={item.label} className="rounded-2xl border border-[#e9e5ef] bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#908a98]">{item.label}</p>{data.errors.progress ? <p className="mt-2 text-xs font-bold text-[#a44e48]">Could not load</p> : <><p className="mt-2 text-[24px] font-black tracking-tight text-[#17132d]">{item.value}</p><p className="mt-1 text-[9px] text-[#8a8494]">{item.detail}</p></>}</article>)}
    </section>
    <p className="rounded-xl border border-[#eeeaf2] bg-[#fbfaff] px-4 py-3 text-[10px] leading-5 text-[#766f81]">Progress reflects saved records only; it is not a mastery score. In-app, email, and push reminders are not currently delivered, so check your planner for upcoming deadlines.</p>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">PRIVATE TO YOUR ACCOUNT</p><h2 className="mt-1 text-[16px] font-extrabold">Study tasks</h2></div><div className="flex gap-1 rounded-lg bg-[#f5f3f8] p-1" aria-label="Task filter">{[["open", "Open"], ["all", "All"], ["completed", "Completed"]].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value as typeof filter)} aria-pressed={filter === value} className={`rounded-md px-2.5 py-1.5 text-[9px] font-extrabold ${filter === value ? "bg-white text-[#7259e8] shadow-sm" : "text-[#8a8494]"}`}>{label}</button>)}</div></div>
        {data.errors.tasks ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a44e48]">Tasks could not be loaded. Check the Stage 4 migration and refresh.</p>
          : shownTasks.length ? <ul className="mt-3 divide-y divide-[#f0edf4]">{shownTasks.map((task) => <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <button type="button" onClick={() => runAction(() => setStudyTaskStatus(task.id, task.status === "completed" ? "todo" : "completed"))} aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`} className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${task.status === "completed" ? "bg-[#e6f7ef] text-[#2f946f]" : "bg-[#f3f0ff] text-[#7259e8]"}`}>{task.status === "completed" ? <Check className="size-4" /> : <Circle className="size-4" />}</button>
            <div className="min-w-0 flex-1"><p className={`text-xs font-extrabold ${task.status === "completed" ? "text-[#8a8494] line-through" : "text-[#252033]"}`}>{task.title}</p><p className="mt-1 text-[9px] text-[#85808d]">{task.courseId ? courseLabels.get(task.courseId) ?? "Course" : "Personal task"} · {task.dueAt ? `${dateIsPast(task.dueAt, asOf) && task.status !== "completed" ? "Overdue · " : "Due "}${formatDate(task.dueAt, timezone)}` : "No deadline"} · {priorityLabel(task.priority)}</p>{task.description && <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-4 text-[#817a8c]">{task.description}</p>}</div>
            <div className="flex shrink-0 gap-1"><button type="button" onClick={() => {setTaskEditor(task); setStatusMessage("");}} aria-label={`Edit ${task.title}`} className="grid size-8 place-items-center rounded-lg text-[#7d7687] hover:bg-[#f3f0ff]"><Pencil className="size-3.5" /></button><button type="button" onClick={() => {if (window.confirm(`Delete “${task.title}”?`)) runAction(() => deleteStudyTask(task.id));}} aria-label={`Delete ${task.title}`} className="grid size-8 place-items-center rounded-lg text-[#9b6a68] hover:bg-[#fff1ef]"><Trash2 className="size-3.5" /></button></div>
          </li>)}</ul>
          : <div className="mt-4 rounded-2xl border border-dashed border-[#e3deeb] bg-[#fbfaff] px-4 py-8 text-center"><p className="text-sm font-extrabold text-[#373145]">{filter === "completed" ? "No completed tasks yet" : "Your task list is clear"}</p><p className="mt-1 text-xs leading-5 text-[#8a8494]">Add a task with a due date, course, priority, and notes when you are ready.</p></div>}
      </section>

      <aside className="space-y-4">
        <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2"><CalendarDays className="size-4 text-[#7259e8]" /><h2 className="text-xs font-extrabold">Calendar & exams</h2></div>
          <p className="mt-1 text-[9px] leading-4 text-[#8a8494]">Add study blocks, personal events, or exam dates. Nothing is scheduled automatically.</p>
          {data.errors.events ? <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] p-2.5 text-[10px] text-[#a44e48]">Calendar items could not be loaded.</p>
            : data.events.length ? <ul className="mt-3 space-y-2">{data.events.map((item) => <li key={item.id} className="rounded-xl bg-[#f7f5ff] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-extrabold">{item.title}</p><p className="mt-1 text-[8px] font-bold capitalize text-[#7259e8]">{item.type}{item.courseId ? ` · ${courseLabels.get(item.courseId) ?? "Course"}` : ""}</p><p className="mt-1 text-[9px] leading-4 text-[#726b80]">{formatDate(item.startsAt, timezone, true)} – {formatDate(item.endsAt, timezone, true)}</p>{item.location && <p className="mt-1 text-[8px] text-[#898391]">{item.location}</p>}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => {setEventEditor(item); setStatusMessage("");}} aria-label={`Edit ${item.title}`} className="grid size-7 place-items-center rounded-md text-[#7d7687] hover:bg-white"><Pencil className="size-3" /></button><button type="button" onClick={() => {if (window.confirm(`Delete “${item.title}”?`)) runAction(() => deletePlannerEvent(item.id));}} aria-label={`Delete ${item.title}`} className="grid size-7 place-items-center rounded-md text-[#9b6a68] hover:bg-white"><Trash2 className="size-3" /></button></div></div></li>)}</ul>
            : <p className="mt-3 rounded-xl bg-[#fbfaff] px-3 py-5 text-center text-[10px] text-[#8a8494]">No calendar items in this period. Add your own study time or exam date.</p>}
        </section>

        <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2"><Clock3 className="size-4 text-[#36a079]" /><h2 className="text-xs font-extrabold">Group study sessions</h2></div>
          {data.errors.groupSessions ? <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] p-2.5 text-[10px] text-[#a44e48]">Group sessions could not be loaded.</p>
            : data.groupSessions.length ? <ul className="mt-3 space-y-2">{data.groupSessions.map((item) => <li key={item.id} className="rounded-xl bg-[#f5fbf8] p-3"><p className="text-[10px] font-extrabold">{item.title}</p><p className="mt-1 text-[8px] text-[#527565]">{item.groupName}</p><p className="mt-1 text-[9px] text-[#718178]">{formatDate(item.startsAt, timezone, true)} – {formatDate(item.endsAt, timezone, true)}</p></li>)}</ul>
              : <p className="mt-3 rounded-xl bg-[#fbfaff] px-3 py-5 text-center text-[10px] text-[#8a8494]">No upcoming group sessions.</p>}
        </section>

        <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="text-xs font-extrabold">Recent quiz attempts</h2><span className="text-[8px] text-[#8a8494]">Saved results only</span></div>
          {data.errors.progress ? <p className="mt-3 text-[10px] text-[#a44e48]">Quiz progress could not be loaded.</p>
            : data.progress.recentAttempts.length ? <ul className="mt-3 space-y-2">{data.progress.recentAttempts.map((attempt) => <li key={attempt.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#faf9fc] p-2.5"><div className="min-w-0"><p className="truncate text-[9px] font-extrabold">{attempt.title}</p><p className="mt-1 text-[8px] text-[#8a8494]">{formatDate(attempt.completedAt, timezone)}</p></div><b className="shrink-0 text-[10px] text-[#5d47bd]">{attempt.score}/{attempt.total}</b></li>)}</ul>
              : <p className="mt-3 rounded-xl bg-[#fbfaff] px-3 py-5 text-center text-[10px] leading-4 text-[#8a8494]">No saved quiz attempts yet. When quiz attempts are recorded, their scores will appear here.</p>}
        </section>
      </aside>
    </div>

    {taskEditor !== undefined && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#17132d]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="planner-task-title" className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#7259e8]">{taskEditor ? "EDIT TASK" : "NEW TASK"}</p><h2 id="planner-task-title" className="mt-1 text-lg font-extrabold">{taskEditor ? "Update study task" : "Add a study task"}</h2></div><button type="button" onClick={() => setTaskEditor(undefined)} aria-label="Close task form" className="grid size-8 place-items-center rounded-lg border border-[#e9e5ef]"><X className="size-4" /></button></div>
      <form onSubmit={submitTask} className="mt-4 space-y-3"><input type="hidden" name="id" value={taskEditor?.id ?? ""} /><input type="hidden" name="timezone" value={timezone} />
        <label className="block text-[10px] font-bold text-[#5d5768]">Task title<input required minLength={2} maxLength={160} name="title" defaultValue={taskEditor?.title ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs outline-none focus:border-[#aa9af0]" /></label>
        <label className="block text-[10px] font-bold text-[#5d5768]">Notes<textarea name="description" maxLength={2000} rows={3} defaultValue={taskEditor?.description ?? ""} className="mt-1.5 w-full rounded-xl border border-[#e7e3ec] p-3 text-xs outline-none focus:border-[#aa9af0]" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-bold text-[#5d5768]">Due date and time<input name="dueAt" type="datetime-local" defaultValue={toLocalInput(taskEditor?.dueAt ?? null, timezone)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-2 text-[10px]" /></label>
          <label className="block text-[10px] font-bold text-[#5d5768]">Course<select name="courseId" defaultValue={taskEditor?.courseId ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>
          <label className="block text-[10px] font-bold text-[#5d5768]">Priority<select name="priority" defaultValue={taskEditor?.priority ?? "normal"} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
          {taskEditor && <label className="block text-[10px] font-bold text-[#5d5768]">Status<select name="status" defaultValue={taskEditor.status} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>}
        </div>
        {statusMessage && <p role="alert" className="text-[10px] text-[#a44e48]">{statusMessage}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setTaskEditor(undefined)} className="h-9 rounded-lg px-3 text-[10px] font-bold text-[#777180]">Cancel</button><button disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#7259e8] px-4 text-[10px] font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3 animate-spin" />}{taskEditor ? "Save task" : "Add task"}</button></div>
      </form>
    </section></div>}

    {eventEditor !== undefined && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#17132d]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="planner-event-title" className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#7259e8]">{eventEditor ? "EDIT CALENDAR ITEM" : "NEW CALENDAR ITEM"}</p><h2 id="planner-event-title" className="mt-1 text-lg font-extrabold">{eventEditor ? "Update calendar item" : "Schedule study time or an exam"}</h2></div><button type="button" onClick={() => setEventEditor(undefined)} aria-label="Close calendar form" className="grid size-8 place-items-center rounded-lg border border-[#e9e5ef]"><X className="size-4" /></button></div>
      <form onSubmit={submitEvent} className="mt-4 space-y-3"><input type="hidden" name="id" value={eventEditor?.id ?? ""} /><input type="hidden" name="timezone" value={timezone} />
        <label className="block text-[10px] font-bold text-[#5d5768]">Title<input required minLength={2} maxLength={160} name="title" defaultValue={eventEditor?.title ?? ""} placeholder="e.g. Biology exam" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-bold text-[#5d5768]">Type<select name="type" defaultValue={eventEditor?.type ?? "study"} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="study">Study block</option><option value="review">Review</option><option value="exam">Exam</option><option value="lecture">Lecture</option><option value="lab">Lab</option><option value="seminar">Seminar</option><option value="personal">Personal</option></select></label>
          <label className="block text-[10px] font-bold text-[#5d5768]">Course<select name="courseId" defaultValue={eventEditor?.courseId ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>
          <label className="block text-[10px] font-bold text-[#5d5768]">Starts<input required name="startsAt" type="datetime-local" defaultValue={toLocalInput(eventEditor?.startsAt ?? null, timezone)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-2 text-[10px]" /></label>
          <label className="block text-[10px] font-bold text-[#5d5768]">Ends<input required name="endsAt" type="datetime-local" defaultValue={toLocalInput(eventEditor?.endsAt ?? null, timezone)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-2 text-[10px]" /></label>
        </div>
        <label className="block text-[10px] font-bold text-[#5d5768]">Location (optional)<input name="location" maxLength={200} defaultValue={eventEditor?.location ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs" /></label>
        {statusMessage && <p role="alert" className="text-[10px] text-[#a44e48]">{statusMessage}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setEventEditor(undefined)} className="h-9 rounded-lg px-3 text-[10px] font-bold text-[#777180]">Cancel</button><button disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#7259e8] px-4 text-[10px] font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3 animate-spin" />}{eventEditor ? "Save item" : "Add item"}</button></div>
      </form>
    </section></div>}
  </div>;
}
