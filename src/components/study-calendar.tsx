"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileImage,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { createPlannerEvents, deletePlannerEvent, savePlannerEvent, type PlannerEventInput, type Stage6ActionResult } from "@/app/app/stage6-actions";
import type { Stage6Course } from "@/components/stage6-workspace";
import type { PlannerData, PlannerEvent } from "@/components/study-planner";

type DraftCalendarEvent = {
  title: string;
  type: string;
  location: string | null;
  course: string | null;
  courseId: string | null;
  startsAtLocal: string;
  endsAtLocal: string;
  included: boolean;
  reason?: string;
};

type ImportResponse = {
  error?: string;
  events?: Array<{
    title: string;
    type: string;
    location: string | null;
    course: string | null;
    startsAtLocal: string | null;
    endsAtLocal: string | null;
    reason?: string;
  }>;
  sourceName?: string;
  disclosure?: string;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayValues = [1, 2, 3, 4, 5, 6, 0];
const timeChoices = ["morning", "afternoon", "evening"];
const eventColors: Record<string, string> = {
  lecture: "#7259e8",
  lab: "#e69b2f",
  seminar: "#36a079",
  study: "#477fca",
  review: "#d76d68",
  exam: "#bd5d58",
  personal: "#817b8e",
};

function dateParts(value: string | number, timezone: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateKey(value: string | number, timezone: string) {
  const fields = dateParts(value, timezone);
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(key: string, amount: number) {
  const date = keyToDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function localInput(value: string | null, timezone: string) {
  if (!value) return "";
  const fields = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

function formatDate(value: string | number, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: timezone || "UTC" }).format(new Date(value));
}

function defaultEvent(dayKey: string): PlannerEvent {
  return {
    id: "",
    title: "",
    type: "study",
    location: "",
    startsAt: `${dayKey}T09:00:00.000Z`,
    endsAt: `${dayKey}T10:00:00.000Z`,
    courseId: null,
  };
}

function eventCourse(course: string | null, courses: Stage6Course[]) {
  if (!course) return null;
  const normalized = course.toLowerCase().trim();
  return courses.find((item) => item.code.toLowerCase() === normalized
    || item.title.toLowerCase() === normalized
    || `${item.code} ${item.title}`.toLowerCase().includes(normalized))?.id ?? null;
}

function displayEventTitle(event: PlannerEvent) {
  return event.type === "exam" ? `Exam: ${event.title}` : event.title;
}

export function StudyCalendar({
  data,
  courses,
  timezone,
}: {
  data: PlannerData;
  courses: Stage6Course[];
  timezone: string;
}) {
  const router = useRouter();
  const todayKey = dateKey(data.asOf, timezone);
  const [anchorKey, setAnchorKey] = useState(todayKey);
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const [eventEditor, setEventEditor] = useState<PlannerEvent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [importSource, setImportSource] = useState("");
  const [importDisclosure, setImportDisclosure] = useState("");
  const [imageConsent, setImageConsent] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [importDraft, setImportDraft] = useState<DraftCalendarEvent[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planDraft, setPlanDraft] = useState<DraftCalendarEvent[]>([]);
  const [planStart, setPlanStart] = useState(todayKey);
  const [planEnd, setPlanEnd] = useState(addDays(todayKey, 13));
  const [preferences, setPreferences] = useState(data.preferences);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const preferencesDirty = preferences.pace !== data.preferences.pace
    || preferences.sessionMinutes !== data.preferences.sessionMinutes
    || preferences.breakMinutes !== data.preferences.breakMinutes
    || preferences.dailyLimitMinutes !== data.preferences.dailyLimitMinutes
    || [...preferences.preferredTimes].sort().join(",") !== [...data.preferences.preferredTimes].sort().join(",")
    || [...preferences.studyDays].sort((a, b) => a - b).join(",") !== [...data.preferences.studyDays].sort((a, b) => a - b).join(",");

  const monthFields = anchorKey.split("-").map(Number);
  const monthKey = `${monthFields[0]}-${monthFields[1].toString().padStart(2, "0")}`;
  const monthStart = `${monthKey}-01`;
  const monthOffset = (keyToDate(monthStart).getUTCDay() + 6) % 7;
  const monthGridStart = addDays(monthStart, -monthOffset);
  const visibleDays = calendarMode === "month"
    ? Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index))
    : (() => {
      const offset = (keyToDate(anchorKey).getUTCDay() + 6) % 7;
      const start = addDays(anchorKey, -offset);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    })();
  const courseLabels = useMemo(() => new Map(courses.map((course) => [course.id, `${course.code} · ${course.title}`])), [courses]);
  const eventsByDay = useMemo(() => {
    const values = new Map<string, Array<{ id: string; title: string; startsAt: string; endsAt: string; kind: "event" | "task" | "group"; item: PlannerEvent | null; type: string }>>();
    const add = (key: string, entry: { id: string; title: string; startsAt: string; endsAt: string; kind: "event" | "task" | "group"; item: PlannerEvent | null; type: string }) => {
      const items = values.get(key) ?? [];
      items.push(entry);
      values.set(key, items);
    };
    data.events.forEach((event) => add(dateKey(event.startsAt, timezone), {
      id: `event-${event.id}`,
      title: displayEventTitle(event),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      kind: "event",
      item: event,
      type: event.type,
    }));
    data.tasks.forEach((task) => {
      if (!task.dueAt || task.status === "cancelled") return;
      add(dateKey(task.dueAt, timezone), {
        id: `task-${task.id}`,
        title: `Due: ${task.title}`,
        startsAt: task.dueAt,
        endsAt: task.dueAt,
        kind: "task",
        item: null,
        type: task.status === "completed" ? "completed" : "task",
      });
    });
    data.groupSessions.forEach((session) => add(dateKey(session.startsAt, timezone), {
      id: `group-${session.id}`,
      title: `${session.groupName}: ${session.title}`,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      kind: "group",
      item: null,
      type: "group",
    }));
    values.forEach((items) => items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)));
    return values;
  }, [data.events, data.groupSessions, data.tasks, timezone]);

  function moveCalendar(direction: number) {
    if (calendarMode === "week") setAnchorKey(addDays(anchorKey, 7 * direction));
    else {
      const date = keyToDate(monthStart);
      date.setUTCMonth(date.getUTCMonth() + direction);
      setAnchorKey(`${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-01`);
    }
  }

  function runEventAction(action: () => Promise<Stage6ActionResult>, close = false) {
    setStatusMessage("");
    startTransition(async () => {
      const result = await action();
      setStatusMessage(result.error ?? result.success ?? "Calendar updated.");
      if (!result.error) {
        if (close) setEventEditor(null);
        router.refresh();
      }
    });
  }

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runEventAction(() => savePlannerEvent(form), true);
  }

  async function savePreferences() {
    setPreferencesBusy(true);
    setPreferencesMessage("");
    try {
      const response = await fetch("/api/planner/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Your preferences could not be saved.");
      setPreferencesMessage("Preferences saved. AI planning will use these settings.");
      router.refresh();
    } catch (error) {
      setPreferencesMessage(error instanceof Error ? error.message : "Your preferences could not be saved.");
    } finally {
      setPreferencesBusy(false);
    }
  }

  async function importSchoolCalendar(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setImportError("Choose a CSV, Excel (.xlsx, .xls), PDF, or image file first.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (["pdf", "png", "jpg", "jpeg", "webp"].includes(extension ?? "") && !imageConsent) {
      setImportError("Confirm the third-party processing notice before extracting a PDF or image.");
      return;
    }
    form.set("timezone", timezone);
    setImportBusy(true);
    setImportError("");
    setImportNotice("");
    setImportDraft([]);
    try {
      const response = await fetch("/api/planner/import", { method: "POST", body: form });
      const result = await response.json().catch(() => null) as ImportResponse | null;
      if (!response.ok || !result?.events) throw new Error(result?.error ?? "The calendar file could not be read.");
      setImportSource(result.sourceName ?? file.name);
      setImportDisclosure(result.disclosure ?? "");
      setImportDraft(result.events.map((item) => ({
        ...item,
        courseId: eventCourse(item.course, courses),
        startsAtLocal: item.startsAtLocal ?? "",
        endsAtLocal: item.endsAtLocal ?? "",
        included: true,
      })));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The calendar file could not be read.");
    } finally {
      setImportBusy(false);
    }
  }

  function saveImportedCalendar() {
    const selected = importDraft.filter((item) => item.included);
    if (!selected.length) {
      setImportError("Select at least one calendar item to import.");
      return;
    }
    if (selected.some((item) => !item.startsAtLocal || !item.endsAtLocal)) {
      setImportError("Add a start and end time for every selected row. The importer will not guess missing times.");
      return;
    }
    const items: PlannerEventInput[] = selected.map((item) => ({
      title: item.title,
      type: item.type,
      location: item.location,
      courseId: item.courseId,
      startsAtLocal: item.startsAtLocal,
      endsAtLocal: item.endsAtLocal,
      source: "manual_import",
    }));
    startTransition(async () => {
      const result = await createPlannerEvents(items, timezone);
      if (result.error) setImportError(result.error);
      else {
        const firstDate = items[0]?.startsAtLocal?.slice(0, 10);
        if (firstDate) {
          setAnchorKey(firstDate);
        }
        setImportNotice(result.success ?? "Calendar imported.");
        setImportDraft([]);
        setImportOpen(false);
        setStatusMessage(result.success ?? "Calendar imported.");
        router.refresh();
      }
    });
  }

  async function generatePersonalPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preferencesDirty) {
      setPlanError("Save your changed study preferences before generating a personal calendar.");
      return;
    }
    setPlanBusy(true);
    setPlanError("");
    setPlanDraft([]);
    try {
      const response = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: planStart, endDate: planEnd }),
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
        blocks?: Array<Omit<DraftCalendarEvent, "included" | "course"> & { courseId: string | null }>;
      } | null;
      if (!response.ok || !result?.blocks) throw new Error(result?.error ?? "The personal plan could not be generated.");
      setPlanDraft(result.blocks.map((block) => ({
        title: block.title,
        type: block.type,
        location: null,
        course: block.courseId ? courseLabels.get(block.courseId) ?? null : null,
        courseId: block.courseId,
        startsAtLocal: block.startsAtLocal,
        endsAtLocal: block.endsAtLocal,
        included: true,
        reason: block.reason,
      })));
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "The personal plan could not be generated.");
    } finally {
      setPlanBusy(false);
    }
  }

  function savePersonalPlan() {
    const selected = planDraft.filter((item) => item.included);
    if (!selected.length) {
      setPlanError("Select at least one suggested study block.");
      return;
    }
    const items: PlannerEventInput[] = selected.map((item) => ({
      title: item.title,
      type: item.type,
      courseId: item.courseId,
      startsAtLocal: item.startsAtLocal,
      endsAtLocal: item.endsAtLocal,
      generated: true,
      source: "ai_study_plan",
    }));
    startTransition(async () => {
      const result = await createPlannerEvents(items, timezone);
      if (result.error) setPlanError(result.error);
      else {
        const firstDate = items[0]?.startsAtLocal?.slice(0, 10);
        if (firstDate) {
          setAnchorKey(firstDate);
        }
        setPlanError(result.success ?? "Personal calendar added.");
        setPlanDraft([]);
        setPlanOpen(false);
        setStatusMessage(result.success ?? "Personal calendar added.");
        router.refresh();
      }
    });
  }

  function updateDraft(
    setter: (value: DraftCalendarEvent[] | ((previous: DraftCalendarEvent[]) => DraftCalendarEvent[])) => void,
    index: number,
    change: Partial<DraftCalendarEvent>,
  ) {
    setter((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  }

  function renderDrafts(
    drafts: DraftCalendarEvent[],
    setter: typeof setImportDraft,
    dialogType: "import" | "plan",
  ) {
    return <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">{drafts.map((item, index) => <article key={`${index}-${item.title}`} className="rounded-xl border border-[#eeeaf2] p-3">
      <div className="flex items-start gap-2"><input type="checkbox" checked={item.included} onChange={(event) => updateDraft(setter, index, { included: event.target.checked })} aria-label={`Include ${item.title}`} className="mt-1 accent-[#7259e8]" />
        <div className="min-w-0 flex-1"><input aria-label="Calendar event title" value={item.title} onChange={(event) => updateDraft(setter, index, { title: event.target.value })} maxLength={160} className="h-8 w-full rounded-lg border border-[#e8e4ed] px-2 text-[10px] font-bold" />{item.reason && <p className="mt-1 text-[9px] leading-4 text-[#7c7489]">{item.reason}</p>}<p className="mt-1 text-[8px] capitalize text-[#928b9a]">{item.type}{item.course ? ` · ${item.course}` : ""}{item.location ? ` · ${item.location}` : ""}</p></div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-[8px] font-bold text-[#756e80]">START<input type="datetime-local" value={item.startsAtLocal} onChange={(event) => updateDraft(setter, index, { startsAtLocal: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[9px]" /></label><label className="text-[8px] font-bold text-[#756e80]">END<input type="datetime-local" value={item.endsAtLocal} onChange={(event) => updateDraft(setter, index, { endsAtLocal: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[9px]" /></label></div>
      {dialogType === "plan" && <label className="mt-2 block text-[8px] font-bold text-[#756e80]">COURSE<select value={item.courseId ?? ""} onChange={(event) => updateDraft(setter, index, { courseId: event.target.value || null, course: event.target.value ? courseLabels.get(event.target.value) ?? null : null })} className="mt-1 h-9 w-full rounded-lg border border-[#e8e4ed] bg-white px-2 text-[9px]"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>}
    </article>)}</div>;
  }

  const title = calendarMode === "month"
    ? formatDate(`${monthKey}-15T12:00:00Z`, timezone, { month: "long", year: "numeric" })
    : (() => {
      const first = visibleDays[0];
      const last = visibleDays[6];
      return `${formatDate(`${first}T12:00:00Z`, timezone, { month: "short", day: "numeric" })} – ${formatDate(`${last}T12:00:00Z`, timezone, { month: "short", day: "numeric", year: "numeric" })}`;
    })();

  return <div className="fade-up space-y-5">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">FULL STUDY CALENDAR</p><h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Your calendar</h1><p className="mt-1.5 text-[12px] leading-5 text-[#7d7789]">School events, exams, tasks, group sessions, and personal study blocks · {timezone}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e5e1eb] bg-white px-3 text-[10px] font-extrabold text-[#5e47c4]"><Upload className="size-3.5" /> Import school calendar</button><button type="button" onClick={() => {setEventEditor(defaultEvent(todayKey)); setStatusMessage("");}} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-3.5 text-[10px] font-extrabold text-white"><Plus className="size-3.5" /> Add event</button></div>
    </header>

    {statusMessage && <p role="status" className={`rounded-xl px-4 py-3 text-xs font-semibold ${statusMessage.includes("could") || statusMessage.includes("valid") ? "bg-[#fff1ef] text-[#a44e48]" : "bg-[#f1efff] text-[#5b47bd]"}`}>{statusMessage}</p>}

    <section className="overflow-hidden rounded-[24px] border border-[#e6e2ea] bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-[#ece9f0] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-2"><button type="button" onClick={() => moveCalendar(-1)} aria-label="Previous calendar range" className="grid size-8 place-items-center rounded-lg border border-[#e6e2ea]"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => setAnchorKey(todayKey)} className="h-8 rounded-lg border border-[#e6e2ea] px-2.5 text-[9px] font-bold">Today</button><button type="button" onClick={() => moveCalendar(1)} aria-label="Next calendar range" className="grid size-8 place-items-center rounded-lg border border-[#e6e2ea]"><ChevronRight className="size-4" /></button><h2 className="ml-1 text-sm font-extrabold">{title}</h2></div>
        <div className="flex items-center gap-2"><div className="flex rounded-lg bg-[#f4f2f7] p-1">{(["month", "week"] as const).map((mode) => <button key={mode} type="button" onClick={() => setCalendarMode(mode)} aria-pressed={calendarMode === mode} className={`rounded-md px-3 py-1.5 text-[9px] font-extrabold capitalize ${calendarMode === mode ? "bg-white text-[#7259e8] shadow-sm" : "text-[#8e8895]"}`}>{mode}</button>)}</div><button type="button" onClick={() => setEventEditor(defaultEvent(anchorKey))} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#f1efff] px-3 text-[9px] font-extrabold text-[#5e47c4]"><Plus className="size-3" /> Add item</button></div>
      </div>
      <div className="overflow-x-auto">
        <div className={`min-w-[720px] ${calendarMode === "week" ? "pb-3" : ""}`}>
          <div className="grid grid-cols-7 border-b border-[#ece9f0]">{weekdayLabels.map((day) => <div key={day} className="py-3 text-center text-[8px] font-black uppercase tracking-wide text-[#aaa4b1]">{day}</div>)}</div>
          <div className={calendarMode === "month" ? "grid grid-cols-7" : "grid min-h-[430px] grid-cols-7 divide-x divide-[#f0edf3]"}>
            {visibleDays.map((day) => {
              const items = eventsByDay.get(day) ?? [];
              const outsideMonth = calendarMode === "month" && !day.startsWith(monthKey);
              const dayNumber = Number(day.slice(-2));
              const isToday = day === todayKey;
              const shown = calendarMode === "month" ? items.slice(0, 3) : items;
              return <div key={day} className={`min-h-[118px] border-b border-r border-[#f0edf3] p-1.5 sm:min-h-[140px] sm:p-2 ${outsideMonth ? "bg-[#fbfaff] text-[#bbb5c2]" : ""} ${calendarMode === "week" ? "min-w-0" : ""}`}>
                <div className="mb-1 flex items-center justify-between"><button type="button" onClick={() => setEventEditor(defaultEvent(day))} className={`grid size-7 place-items-center rounded-full text-[9px] font-extrabold ${isToday ? "bg-[#7259e8] text-white" : outsideMonth ? "text-[#aaa4b1]" : "text-[#514b5d]"}`}>{dayNumber}</button><button type="button" onClick={() => setEventEditor(defaultEvent(day))} aria-label={`Add calendar item on ${day}`} className="grid size-6 place-items-center rounded-md text-[#aaa4b1] hover:bg-[#f3f0ff] hover:text-[#7259e8]"><Plus className="size-3" /></button></div>
                <div className="space-y-1">{shown.map((item) => {
                  const color = item.kind === "task" ? item.type === "completed" ? "#36a079" : "#d76d68" : item.kind === "group" ? "#36a079" : eventColors[item.type] ?? "#7259e8";
                  return <button key={item.id} type="button" onClick={() => item.item && setEventEditor(item.item)} title={`${formatDate(item.startsAt, timezone, { hour: "numeric", minute: "2-digit" })} ${item.title}`} className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[7px] font-bold leading-3 sm:text-[8px]" style={{ color, backgroundColor: `${color}16`, borderLeft: `2px solid ${color}` }}><span className="mr-1">{formatDate(item.startsAt, timezone, { hour: "numeric", minute: "2-digit" })}</span>{item.title}</button>;
                })}{calendarMode === "month" && items.length > shown.length && <button type="button" onClick={() => {setAnchorKey(day); setCalendarMode("week");}} className="px-1 text-[7px] font-bold text-[#7259e8]">+{items.length - shown.length} more</button>}</div>
              </div>;
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#ece9f0] px-4 py-3 sm:px-5">{[["#7259e8", "School"], ["#d76d68", "Tasks"], ["#36a079", "Group sessions"], ["#477fca", "Personal study"]].map(([color, label]) => <span key={label} className="flex items-center gap-1.5 text-[8px] font-bold text-[#898391]"><i className="size-2 rounded-full" style={{ background: color }} />{label}</span>)}</div>
    </section>

    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">PERSONAL STUDY PLAN</p><h2 className="mt-1 text-[15px] font-extrabold">Build around your school calendar</h2><p className="mt-1 text-[10px] leading-4 text-[#8a8494]">AI suggestions use your saved preferences, courses, tasks, exams, and existing events. Review them before anything is added.</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#7259e8]"><Sparkles className="size-4" /></span></div>
          <button type="button" onClick={() => {setPlanOpen(true); setPlanError(""); setPlanDraft([]);}} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#7259e8] px-3.5 text-[9px] font-extrabold text-white"><Sparkles className="size-3.5" /> Generate personal calendar</button>
        </section>
        <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
          <h2 className="text-xs font-extrabold">Import your school&apos;s calendar</h2><p className="mt-1 text-[9px] leading-4 text-[#8a8494]">Add CSV files directly, or extract a timetable from a PDF/image. Extracted items are drafts: check their dates and times before importing.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[8px] font-bold text-[#746d7e]"><span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f5ff] px-2.5 py-2"><FileSpreadsheet className="size-3.5 text-[#36a079]" /> CSV</span><span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f5ff] px-2.5 py-2"><FileText className="size-3.5 text-[#d76d68]" /> PDF</span><span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f5ff] px-2.5 py-2"><FileImage className="size-3.5 text-[#7259e8]" /> Image</span></div>
          <button type="button" onClick={() => setImportOpen(true)} className="mt-3 text-[9px] font-extrabold text-[#7259e8]">Choose a calendar file <ArrowRight className="ml-1 inline size-3" /></button>
        </section>
      </div>

      <section className="rounded-[22px] border border-[#e9e5ef] bg-white p-4 sm:p-5">
        <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">YOUR STUDY PREFERENCES</p><h2 className="mt-1 text-[15px] font-extrabold">Make the plan fit you</h2></div>
        {data.errors.preferences && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] p-2 text-[9px] text-[#a44e48]">Saved preferences could not be loaded. Defaults are shown; check the Stage 4 migration.</p>}
        <label className="mt-4 block text-[9px] font-extrabold text-[#716a7d]">PACE<select value={preferences.pace} onChange={(event) => setPreferences((value) => ({ ...value, pace: event.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-[#e8e4ed] bg-white px-2 text-[10px]"><option value="light">Light</option><option value="balanced">Balanced</option><option value="intense">Intense</option></select></label>
        <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[9px] font-extrabold text-[#716a7d]">SESSION MINUTES<input type="number" min={20} max={120} value={preferences.sessionMinutes} onChange={(event) => setPreferences((value) => ({ ...value, sessionMinutes: Number(event.target.value) }))} className="mt-1.5 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[10px]" /></label><label className="text-[9px] font-extrabold text-[#716a7d]">BREAK MINUTES<input type="number" min={5} max={30} value={preferences.breakMinutes} onChange={(event) => setPreferences((value) => ({ ...value, breakMinutes: Number(event.target.value) }))} className="mt-1.5 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[10px]" /></label><label className="text-[9px] font-extrabold text-[#716a7d]">DAILY STUDY LIMIT<input type="number" min={30} max={600} step={15} value={preferences.dailyLimitMinutes} onChange={(event) => setPreferences((value) => ({ ...value, dailyLimitMinutes: Number(event.target.value) }))} className="mt-1.5 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[10px]" /></label></div>
        <fieldset className="mt-4"><legend className="text-[9px] font-extrabold text-[#716a7d]">PREFERRED TIMES</legend><div className="mt-2 flex flex-wrap gap-1.5">{timeChoices.map((time) => <label key={time} className={`rounded-lg border px-2.5 py-2 text-[8px] font-bold capitalize ${preferences.preferredTimes.includes(time) ? "border-[#b6a8f1] bg-[#f4f1ff] text-[#624bc7]" : "border-[#e8e4ed] text-[#898391]"}`}><input type="checkbox" checked={preferences.preferredTimes.includes(time)} onChange={(event) => setPreferences((value) => ({ ...value, preferredTimes: event.target.checked ? [...value.preferredTimes, time] : value.preferredTimes.filter((item) => item !== time) }))} className="sr-only" />{time}</label>)}</div></fieldset>
        <fieldset className="mt-4"><legend className="text-[9px] font-extrabold text-[#716a7d]">STUDY DAYS</legend><div className="mt-2 flex gap-1">{weekdayLabels.map((label, index) => {
          const day = weekdayValues[index];
          const active = preferences.studyDays.includes(day);
          return <label key={label} className={`grid size-8 cursor-pointer place-items-center rounded-lg border text-[8px] font-bold ${active ? "border-[#b6a8f1] bg-[#f4f1ff] text-[#624bc7]" : "border-[#e8e4ed] text-[#898391]"}`}><input type="checkbox" checked={active} onChange={(event) => setPreferences((value) => ({ ...value, studyDays: event.target.checked ? [...value.studyDays, day] : value.studyDays.filter((item) => item !== day) }))} className="sr-only" />{label.slice(0, 1)}</label>;
        })}</div></fieldset>
        {preferencesMessage && <p role={preferencesMessage.includes("could") ? "alert" : "status"} className="mt-3 text-[9px] leading-4 text-[#746d7e]">{preferencesMessage}</p>}
        <button type="button" disabled={preferencesBusy} onClick={() => void savePreferences()} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#17132d] text-[9px] font-extrabold text-white disabled:opacity-60">{preferencesBusy && <LoaderCircle className="size-3 animate-spin" />}Save preferences</button>
      </section>
    </section>

    {eventEditor && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#17132d]/50 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#7259e8]">{eventEditor.id ? "CALENDAR ITEM" : "NEW CALENDAR ITEM"}</p><h2 id="calendar-event-title" className="mt-1 text-lg font-extrabold">{eventEditor.id ? "Edit calendar item" : "Add to your calendar"}</h2></div><button type="button" aria-label="Close calendar item" onClick={() => setEventEditor(null)} className="grid size-8 place-items-center rounded-lg border border-[#e9e5ef]"><X className="size-4" /></button></div>
      <form onSubmit={submitEvent} className="mt-4 space-y-3"><input type="hidden" name="id" value={eventEditor.id} /><input type="hidden" name="timezone" value={timezone} /><label className="block text-[10px] font-bold">Title<input required minLength={2} maxLength={160} name="title" defaultValue={eventEditor.title} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-bold">Type<select name="type" defaultValue={eventEditor.type} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="lecture">School class</option><option value="lab">Lab</option><option value="seminar">Seminar</option><option value="study">Study block</option><option value="review">Review</option><option value="exam">Exam</option><option value="personal">Personal</option></select></label><label className="block text-[10px] font-bold">Course<select name="courseId" defaultValue={eventEditor.courseId ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-2 text-[10px]"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="block text-[10px] font-bold">Starts<input required name="startsAt" type="datetime-local" defaultValue={eventEditor.id ? localInput(eventEditor.startsAt, timezone) : `${eventEditor.startsAt.slice(0, 10)}T09:00`} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-2 text-[10px]" /></label><label className="block text-[10px] font-bold">Ends<input required name="endsAt" type="datetime-local" defaultValue={eventEditor.id ? localInput(eventEditor.endsAt, timezone) : `${eventEditor.endsAt.slice(0, 10)}T10:00`} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-2 text-[10px]" /></label></div>
        <label className="block text-[10px] font-bold">Location<input name="location" maxLength={200} defaultValue={eventEditor.location ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs" /></label>
        {statusMessage && <p role="alert" className="text-[9px] text-[#a44e48]">{statusMessage}</p>}
        <div className="flex justify-between pt-2">{eventEditor.id ? <button type="button" onClick={() => {if (window.confirm(`Delete “${eventEditor.title}” from your calendar?`)) runEventAction(() => deletePlannerEvent(eventEditor.id), true);}} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[9px] font-bold text-[#a44e48]"><X className="size-3.5" />Delete</button> : <span />}<div className="flex gap-2"><button type="button" onClick={() => setEventEditor(null)} className="h-9 rounded-lg px-3 text-[10px] font-bold text-[#777180]">Cancel</button><button disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#7259e8] px-4 text-[10px] font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3 animate-spin" />}Save</button></div></div>
      </form>
    </section></div>}

    {importOpen && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#17132d]/55 p-3 backdrop-blur-sm sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="calendar-import-title" className="my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-[#eeeaf2] p-4 sm:p-5"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#7259e8]">SCHOOL CALENDAR IMPORT</p><h2 id="calendar-import-title" className="mt-1 text-base font-extrabold">Review before adding</h2></div><button type="button" onClick={() => {setImportOpen(false); setSelectedFileName(""); setImportDraft([]); setImportError(""); setImportNotice("");}} aria-label="Close import dialog" className="grid size-8 place-items-center rounded-lg border border-[#e9e5ef]"><X className="size-4" /></button></header>
      <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
        <form onSubmit={importSchoolCalendar} className="space-y-3"><label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#d8d2e5] bg-[#fbfaff] px-3 py-4 text-center hover:bg-[#f6f3ff] transition"><Upload className="size-5 text-[#7259e8]" /><span className="mt-2 text-[10px] font-extrabold text-[#17132d]">{selectedFileName ? selectedFileName : "Choose CSV, Excel (.xlsx, .xls), PDF, or image (PNG, JPEG, WebP) · Max 15 MB"}</span><span className="mt-0.5 text-[8px] text-[#8a8494]">{selectedFileName ? "Click to pick a different file" : "Click to browse files"}</span><input required name="file" type="file" accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; setSelectedFileName(f ? `${f.name} (${(f.size / 1024).toFixed(0)} KB)` : ""); }} className="sr-only" /></label>
          <p className="text-[9px] leading-4 text-[#8a8494]">CSV and Excel (.xlsx, .xls) files are parsed locally using columns like <code>title,date,start_time,end_time,location,type,course</code>. Schedule screenshots (PNG, JPG, WebP) or PDFs are parsed using AI.</p>
          <label className="flex items-start gap-2 rounded-lg bg-[#fff9e9] p-3 text-[9px] leading-4 text-[#685c41]"><input type="checkbox" checked={imageConsent} onChange={(event) => setImageConsent(event.target.checked)} className="mt-0.5 accent-[#7259e8]" /><span>PDF and timetable screenshot images are processed by AI for calendar extraction. School calendars can contain personal information; upload only files you are comfortable sharing with that provider. CSV and Excel files are parsed directly in-app.</span></label>
          <button type="submit" disabled={importBusy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#7259e8] px-3.5 text-[9px] font-extrabold text-white disabled:opacity-60">{importBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}{importBusy ? "Reading calendar…" : "Extract calendar entries"}</button>
        </form>
        {importError && <p role="alert" className="rounded-lg bg-[#fff1ef] p-2.5 text-[9px] text-[#a44e48]">{importError}</p>}
        {importNotice && <p role="status" className="rounded-lg bg-[#e9f7ef] p-2.5 text-[9px] text-[#287451]">{importNotice}</p>}
        {importDraft.length > 0 && <><div className="border-t border-[#eeeaf2] pt-3"><h3 className="text-[10px] font-extrabold">Review {importDraft.length} entries from {importSource}</h3><p className="mt-1 text-[8px] leading-4 text-[#8a8494]">{importDisclosure}</p><p className="mt-1 text-[8px] leading-4 text-[#8a8494]">Select the items to add. Correct every title and time; items without extracted times must be completed here.</p></div>{renderDrafts(importDraft, setImportDraft, "import")}<button type="button" onClick={saveImportedCalendar} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#17132d] px-3.5 text-[9px] font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3 animate-spin" />}Import selected events</button></>}
      </div>
    </section></div>}

    {planOpen && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#17132d]/55 p-3 backdrop-blur-sm sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="personal-plan-title" className="my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-[#eeeaf2] p-4 sm:p-5"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#7259e8]">AI PERSONAL CALENDAR</p><h2 id="personal-plan-title" className="mt-1 text-base font-extrabold">Generate a reviewable study plan</h2><p className="mt-1 text-[9px] leading-4 text-[#8a8494]">The AI uses your saved schedule and preferences. Nothing is saved until you select and add the draft.</p></div><button type="button" onClick={() => setPlanOpen(false)} aria-label="Close personal plan" className="grid size-8 place-items-center rounded-lg border border-[#e9e5ef]"><X className="size-4" /></button></header>
      <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
        <form onSubmit={generatePersonalPlan} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-[9px] font-bold">FROM<input required type="date" value={planStart} onChange={(event) => setPlanStart(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[10px]" /></label><label className="text-[9px] font-bold">THROUGH<input required type="date" value={planEnd} onChange={(event) => setPlanEnd(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-[#e8e4ed] px-2 text-[10px]" /></label><button disabled={planBusy || preferencesBusy} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#7259e8] px-3 text-[9px] font-extrabold text-white disabled:opacity-60">{planBusy ? <LoaderCircle className="size-3 animate-spin" /> : <Sparkles className="size-3.5" />}{planBusy ? "Generating…" : "Generate draft"}</button></form>
        {planError && <p role="alert" className={`rounded-lg p-2.5 text-[9px] ${planError.includes("added") ? "bg-[#e9f7ef] text-[#287451]" : "bg-[#fff1ef] text-[#a44e48]"}`}>{planError}</p>}
        {!planDraft.length && <p className="rounded-lg bg-[#f7f5ff] p-3 text-[9px] leading-4 text-[#726b80]">Preferences currently set to {preferences.pace} pace, {preferences.sessionMinutes}-minute sessions, {preferences.breakMinutes}-minute breaks, and {preferences.dailyLimitMinutes} minutes per day. Save changes to preferences before generating a draft.</p>}
        {planDraft.length > 0 && <><p className="text-[9px] font-extrabold">Review and choose from {planDraft.length} suggested blocks. You can remove any suggestion before saving.</p>{renderDrafts(planDraft, setPlanDraft, "plan")}<div className="flex flex-wrap gap-2"><button type="button" onClick={savePersonalPlan} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#17132d] px-3.5 text-[9px] font-extrabold text-white disabled:opacity-60">{pending && <LoaderCircle className="size-3 animate-spin" />}Add selected blocks to calendar</button><button type="button" onClick={() => setPlanDraft([])} className="h-9 rounded-lg border border-[#e8e4ed] px-3 text-[9px] font-bold">Discard draft</button></div></>}
      </div>
    </section></div>}
  </div>;
}
