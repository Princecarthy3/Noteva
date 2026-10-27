"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Copy,
  Globe2,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Plus,
  Send,
  Trash2,
  Reply,
  Pencil,
  ShieldAlert,
  Share2,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { StudyCallDialog } from "@/components/study-call-dialog";

type Course = { id: string; title: string; code: string };
type Group = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  course_id: string | null;
  created_at: string;
  role: string | null;
  courseName?: string | null;
};
type GroupMessage = { id: string; body: string; created_at: string; isMine: boolean; senderName?: string; editedAt?: string | null; deletedAt?: string | null; replyToId?: string | null; replyPreview?: { id: string; body: string; senderName: string; isMine: boolean } | null; status?: "sent" | "delivered" | "received" };
type GroupSession = { id: string; title: string; starts_at: string; ends_at: string; status: string; notes: string | null };
type SharedResource = { id: string; title: string; resourceType: string; createdAt: string; isMine: boolean };
type OwnResource = { id: string; title: string; resource_type: string; source?: "resource" | "note" };
type GroupMember = { userId: string; name: string; avatarUrl: string | null; role: string; joinedAt: string; isSelf: boolean };
type GroupDetail = {
  group: Omit<Group, "role">;
  role: string | null;
  memberCount?: number;
  messages: GroupMessage[];
  sessions: GroupSession[];
  resources: SharedResource[];
  ownResources?: OwnResource[];
  members: GroupMember[];
  hasMoreMessages: boolean;
  nextMessageCursor: string | null;
  callEnabled?: boolean;
};
type ResourcePreview = { title: string; content: unknown; downloadUrl: string | null };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "The request could not be completed.");
  return data as T;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function StudyGroups({ courses, inviteToken, initialGroupId, callSessionId }: { courses: Course[]; inviteToken?: string | null; initialGroupId?: string | null; callSessionId?: string | null }) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine" | "discover">("all");
  const [inviteUrl, setInviteUrl] = useState("");
  const [resourcePreview, setResourcePreview] = useState<ResourcePreview | null>(null);
  const [callSession, setCallSession] = useState<GroupSession | null>(null);
  const [callClock, setCallClock] = useState(0);
  const [showMembers, setShowMembers] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showGroupTools, setShowGroupTools] = useState(false);
  const [showShareResources, setShowShareResources] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [resourceToShare, setResourceToShare] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knownCallSessionIds = useRef<Set<string> | null>(null);
  const visibleGroups = groups.filter((group) => filter === "mine" ? Boolean(group.role) : filter === "discover" ? !group.role && group.visibility === "public" : true);

  useEffect(() => {
    const initialClock = window.setTimeout(() => setCallClock(Date.now()), 0);
    const interval = window.setInterval(() => setCallClock(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialClock);
      window.clearInterval(interval);
    };
  }, []);

  const loadGroups = useCallback(async (preferredId?: string) => {
    setError("");
    try {
      const data = await api<{ groups: Group[] }>("/api/study-groups", { cache: "no-store" });
      setGroups(data.groups);
      const nextId = preferredId && data.groups.some((group) => group.id === preferredId)
        ? preferredId
        : data.groups.some((group) => group.id === selectedId) ? selectedId : "";
      setSelectedId(nextId);
      if (!nextId) setDetail(null);
      return data.groups;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Study groups could not be loaded.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (groupId: string) => {
    setDetailLoading(true);
    setError("");
    try {
      const data = await api<GroupDetail>(`/api/study-groups/${groupId}`, { cache: "no-store" });
      setDetail(data);
      knownCallSessionIds.current = new Set(data.sessions.map((session) => session.id));
      if (callSessionId) setCallSession(data.sessions.find((session) => session.id === callSessionId) ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The group could not be opened.");
    } finally {
      setDetailLoading(false);
    }
  }, [callSessionId]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        let data = await api<{ groups: Group[] }>("/api/study-groups", { cache: "no-store" });
        let preferredId = initialGroupId && data.groups.some((group) => group.id === initialGroupId)
          ? initialGroupId
          : data.groups.find((group) => group.role)?.id ?? "";
        if (inviteToken) {
          setNotice("Checking your group invitation…");
          try {
            const joined = await api<{ groupId: string }>("/api/study-groups/join", {
              method: "POST",
              body: JSON.stringify({ inviteToken }),
            });
            preferredId = joined.groupId;
            setNotice("You joined the invited study group.");
            data = await api<{ groups: Group[] }>("/api/study-groups", { cache: "no-store" });
          } finally {
            router.replace("/app?view=study-groups");
          }
        }
        if (!active) return;
        setGroups(data.groups);
        const nextId = preferredId && data.groups.some((group) => group.id === preferredId) ? preferredId : "";
        setSelectedId(nextId);
        if (nextId) {
          setDetailLoading(true);
          const groupDetail = await api<GroupDetail>(`/api/study-groups/${nextId}`, { cache: "no-store" });
          if (active) {
            setDetail(groupDetail);
            knownCallSessionIds.current = new Set(groupDetail.sessions.map((session) => session.id));
            if (callSessionId) setCallSession(groupDetail.sessions.find((session) => session.id === callSessionId) ?? null);
          }
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Study groups could not be loaded.");
          if (inviteToken) setNotice("");
        }
      } finally {
        if (active) {
          setDetailLoading(false);
          setLoading(false);
        }
      }
    }
    void initialize();
    return () => { active = false; };
  }, [callSessionId, initialGroupId, inviteToken, router]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const refreshGroupState = async () => {
      try {
        const [groupData, detailData] = await Promise.all([
          api<{ groups: Group[] }>("/api/study-groups", { cache: "no-store" }),
          api<GroupDetail>(`/api/study-groups/${selectedId}`, { cache: "no-store" }),
        ]);
        if (!active) return;
        setGroups(groupData.groups);
        setDetail(detailData);
        const knownCalls = knownCallSessionIds.current;
        if (knownCalls) {
          const newCall = detailData.sessions.find((session) => session.title === "Instant group call"
            && session.status === "scheduled"
            && Date.parse(session.ends_at) > Date.now()
            && !knownCalls.has(session.id));
          if (newCall) setCallSession(newCall);
        }
        knownCallSessionIds.current = new Set(detailData.sessions.map((session) => session.id));
      } catch {
        return;
      }
    };
    const interval = window.setInterval(() => void refreshGroupState(), 8000);
    return () => { active = false; window.clearInterval(interval); };
  }, [selectedId]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setCreating(true);
    setError("");
    try {
      const data = await api<{ group: Group }>("/api/study-groups", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          courseId: form.get("courseId"),
          visibility: form.get("visibility"),
        }),
      });
      setShowCreate(false);
      setNotice("Study group created.");
      await loadGroups(data.group.id);
      await loadDetail(data.group.id);
      formElement.reset();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The group could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function groupAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedId) return;
    setError("");
    try {
      const data = await api<{ success?: boolean; inviteUrl?: string }>(`/api/study-groups/${selectedId}`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
        setNotice("Invitation created. It expires in seven days and can be used up to 20 times.");
      } else if (action === "leave") {
        setNotice("You left the study group.");
        setSelectedId("");
        setDetail(null);
        await loadGroups();
      } else if (action === "delete_group") {
        setNotice("Study group deleted.");
        setSelectedId("");
        setDetail(null);
        await loadGroups();
      } else {
        const silent = action === "message" || action === "edit_message" || action === "delete_message";
        setNotice(silent ? "" : "Group updated.");
        if (!silent) await loadDetail(selectedId);
      }
      return data;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The group action could not be completed.");
      return null;
    }
  }

  async function joinPublic(group: Group) {
    setError("");
    try {
      await api("/api/study-groups/join", { method: "POST", body: JSON.stringify({ groupId: group.id }) });
      setNotice(`You joined ${group.name}.`);
      await loadGroups(group.id);
      await loadDetail(group.id);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "You could not join this group.");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    if (editingId) {
      const result = await groupAction("edit_message", { messageId: editingId, text: body }) as { message?: GroupMessage } | null;
      if (result?.message) {
        setDetail((previous) => previous ? { ...previous, messages: previous.messages.map((item) => item.id === editingId ? { ...item, body: result.message!.body, editedAt: result.message!.editedAt ?? new Date().toISOString() } : item) } : previous);
        setEditingId(null);
        setMessage("");
        setReplyTo(null);
      }
      return;
    }
    const result = await groupAction("message", { text: body, replyToId: replyTo?.id }) as { message?: GroupMessage } | null;
    if (result?.message) {
      setDetail((previous) => previous ? { ...previous, messages: [...previous.messages, { ...result.message!, status: "delivered" as const, replyPreview: result.message!.replyPreview ?? (replyTo ? { id: replyTo.id, body: replyTo.body.slice(0, 140), senderName: replyTo.senderName ?? (replyTo.isMine ? "You" : "Group member"), isMine: replyTo.isMine } : null) }] } : previous);
      setMessage("");
      setReplyTo(null);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("Delete this message for everyone in the group?")) return;
    const result = await groupAction("delete_message", { messageId }) as { success?: boolean; hardDeleted?: boolean; message?: { deletedAt?: string } } | null;
    if (!result) return;
    setDetail((previous) => {
      if (!previous) return previous;
      if (result.hardDeleted) return { ...previous, messages: previous.messages.filter((item) => item.id !== messageId) };
      return { ...previous, messages: previous.messages.map((item) => item.id === messageId ? { ...item, body: "", deletedAt: result.message?.deletedAt ?? new Date().toISOString() } : item) };
    });
    if (editingId === messageId) { setEditingId(null); setMessage(""); }
  }

  function beginReply(item: GroupMessage) {
    if (item.deletedAt) return;
    setReplyTo(item);
    setEditingId(null);
  }

  function beginEdit(item: GroupMessage) {
    if (!item.isMine || item.deletedAt) return;
    setEditingId(item.id);
    setMessage(item.body);
    setReplyTo(null);
  }

  async function loadOlderMessages() {
    if (!selectedId || !detail?.nextMessageCursor) return;
    try {
      const data = await api<GroupDetail>(`/api/study-groups/${selectedId}?before=${encodeURIComponent(detail.nextMessageCursor)}`, { cache: "no-store" });
      setDetail((previous) => previous ? {
        ...previous,
        messages: [...data.messages, ...previous.messages],
        hasMoreMessages: data.hasMoreMessages,
        nextMessageCursor: data.nextMessageCursor,
      } : previous);
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : "Earlier messages could not be loaded.");
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startLocal = String(form.get("startsAt") ?? "");
    const endLocal = String(form.get("endsAt") ?? "");
    const startDate = new Date(startLocal);
    const endDate = new Date(endLocal);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      setError("Choose a valid session start and end time.");
      return;
    }
    try {
      const data = await api<{ session: GroupSession }>(`/api/study-groups/${selectedId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "session",
          title: form.get("title"),
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          notes: form.get("notes"),
        }),
      });
      setDetail((previous) => previous ? { ...previous, sessions: [...previous.sessions, data.session].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) } : previous);
      setShowSession(false);
      setNotice("Study session scheduled.");
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "The study session could not be scheduled.");
    }
  }

  async function startGroupCall() {
    const result = await groupAction("start_call") as { session?: GroupSession } | null;
    if (result?.session) {
      knownCallSessionIds.current?.add(result.session.id);
      setCallSession(result.session);
      setNotice("Starting your group call. Your microphone and camera begin muted.");
    }
  }

  async function uploadGroupFile(file: File | undefined) {
    if (!file || !selectedId) return;
    setUploadingFile(true);
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const response = await fetch(`/api/study-groups/${selectedId}/resources`, { method: "POST", body: formData });
      const data = await response.json().catch(() => null) as { resource?: SharedResource; error?: string } | null;
      if (!response.ok || !data?.resource) throw new Error(data?.error ?? "The file could not be shared.");
      await loadDetail(selectedId);
      setNotice(`${file.name} was shared with the group.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The file could not be shared.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function reportMessage(messageId?: string) {
    setReportMessageId(messageId ?? null);
    setReportDetails("");
    setShowReport(true);
  }

  async function submitReportConcern(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!reportDetails.trim()) {
      event.preventDefault();
      setError("Please describe the issue before sending your report.");
      return;
    }
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedId || "unknown",
          groupName: detail?.group.name || "Study Group",
          messageId: reportMessageId,
          details: reportDetails.trim(),
        }),
      });
      setNotice("Report submitted directly to StudyStation administrators.");
      setTimeout(() => setShowReport(false), 800);
    } catch {
      // Fallback: mailto will open email client
    }
  }

  const reportMailto = `mailto:studystation.support@gmail.com?subject=${encodeURIComponent(`StudyStation report: ${detail?.group.name ?? "Study group"}`)}&body=${encodeURIComponent(`Please describe the issue:\n${reportDetails.trim()}\n\nGroup: ${detail?.group.name ?? "Unknown"}\nGroup ID: ${selectedId || "Unknown"}${reportMessageId ? `\nMessage ID: ${reportMessageId}` : ""}`)}`;

  async function openResource(resource: SharedResource) {
    try {
      const data = await api<{ resource: ResourcePreview }>(`/api/study-groups/${selectedId}/resources/${resource.id}`, { cache: "no-store" });
      setResourcePreview(data.resource);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "The shared resource could not be opened.");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Invitation link copied.");
    } catch {
      setError("The invitation could not be copied. Select and copy the link manually.");
    }
  }

  return <div className={selectedId ? "h-full w-full min-w-0 max-w-full" : "fade-up w-full min-w-0 max-w-full space-y-5"}>
    <header className={selectedId ? "hidden" : "flex flex-col justify-between gap-3 sm:flex-row sm:items-end"}>
      <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">LEARN TOGETHER</p><h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Study groups</h1><p className="mt-1.5 text-[12px] leading-5 text-[#7d7789]">Find classmates, discuss course material, and plan focused sessions.</p></div>
      <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-[#7259e8] px-4 text-[11px] font-extrabold text-white"><Plus className="size-4" /> Create group</button>
    </header>

    {error && <p role="alert" className="rounded-xl bg-[#fff1ef] px-4 py-3 text-xs leading-5 text-[#a44e48]">{error}</p>}
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-[#f1efff] px-4 py-3 text-xs font-semibold text-[#5b47bd]"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice"><X className="size-3.5" /></button></div>}

    {showCreate && !selectedId && <form onSubmit={createGroup} className="grid gap-3 rounded-[22px] border border-[#e9e5ef] bg-white p-5 sm:grid-cols-2 sm:p-6">
      <label className="text-[10px] font-extrabold text-[#5d5768]">GROUP NAME<input name="name" required minLength={2} maxLength={120} placeholder="e.g. Cell Biology study circle" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs font-medium outline-none focus:border-[#aa9af0]" /></label>
      <label className="text-[10px] font-extrabold text-[#5d5768]">COURSE (OPTIONAL)<select name="courseId" defaultValue="" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]"><option value="">No course linked</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>
      <label className="text-[10px] font-extrabold text-[#5d5768]">VISIBILITY<select name="visibility" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]"><option value="private">Private · invite required</option><option value="public">Public · discoverable</option></select></label>
      <label className="text-[10px] font-extrabold text-[#5d5768]">DESCRIPTION<input name="description" maxLength={2000} placeholder="What will your group focus on?" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs font-medium outline-none focus:border-[#aa9af0]" /></label>
      <div className="flex gap-2 sm:col-span-2"><button disabled={creating} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#17132d] px-4 text-[10px] font-extrabold text-white disabled:opacity-60">{creating && <LoaderCircle className="size-3.5 animate-spin" />}Create study group</button><button type="button" onClick={() => setShowCreate(false)} className="h-9 rounded-lg border border-[#e7e3ec] px-4 text-[10px] font-extrabold">Cancel</button></div>
    </form>}

    <div className={selectedId ? "fixed inset-0 z-[100] grid h-[100dvh] w-full grid-cols-1 overflow-hidden bg-[#f8f7fb] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "grid w-full min-w-0 max-w-full grid-cols-1 items-start gap-5"}>
      <aside className={selectedId ? "hidden" : "min-w-0 rounded-[22px] border border-[#e9e5ef] bg-white p-4"}>
        <div className="flex gap-1 rounded-xl bg-[#f5f3f8] p-1">{[["all", "All"], ["mine", "Joined"], ["discover", "Discover"]].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key as typeof filter)} className={`flex-1 rounded-lg py-2 text-[9px] font-extrabold ${filter === key ? "bg-white text-[#7259e8] shadow-sm" : "text-[#8e8895]"}`}>{label}</button>)}</div>
        {loading ? <p className="flex items-center gap-2 px-2 py-8 text-xs text-[#8a8494]"><LoaderCircle className="size-4 animate-spin" /> Loading groups…</p>
          : visibleGroups.length ? <div className="mt-3 divide-y divide-[#f0edf4]">{visibleGroups.map((group) => <button key={group.id} type="button" onClick={() => {setSelectedId(group.id); setInviteUrl(""); setNotice(""); void loadDetail(group.id);}} className="w-full rounded-xl px-2 py-3 text-left transition hover:bg-[#faf9fc]"><span className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[#7259e8]"><UsersRound className="size-5" /></span><span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{group.name}</b><span className="mt-1 block truncate text-[10px] text-[#918b99]">{group.courseName ?? (group.visibility === "public" ? "Open group" : "Private group")}</span></span><span className="shrink-0 text-[9px] font-bold text-[#8a8494]">{group.role ? "Joined" : group.visibility === "public" ? "Discover" : "Invite only"}</span></span></button>)}</div>
            : <div className="px-3 py-8 text-center"><p className="text-xs font-extrabold">No groups here yet</p><p className="mt-1 text-[10px] leading-4 text-[#8a8494]">{filter === "discover" ? "Public study groups will appear here." : "Create a group or switch filters to explore."}</p></div>}
      </aside>

      <section className={selectedId ? "h-full w-full min-w-0 overflow-y-auto bg-[#f8f7fb]" : "hidden"}>
        {detailLoading ? <p className="flex items-center justify-center gap-2 py-24 text-xs text-[#8a8494]"><LoaderCircle className="size-4 animate-spin" /> Opening group…</p>
          : detail ? <div className="min-h-full bg-white">
            <div className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-3 border-b border-[#eeeaf2] bg-white/95 px-4 py-3 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => {setSelectedId(""); setDetail(null); setShowGroupInfo(false);}} aria-label="Back to study groups" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-[#f5f3f8]"><ArrowLeft className="size-5" /></button><button type="button" onClick={() => setShowGroupInfo(true)} className="flex min-w-0 items-center gap-3 text-left"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[#7259e8]"><UsersRound className="size-5" /></span><span className="min-w-0"><b className="block truncate text-[13px]">{detail.group.name}</b><span className="mt-0.5 block truncate text-[9px] text-[#8a8494]">{detail.memberCount ?? detail.members.length} members · Tap for group info</span></span></button></div><button type="button" onClick={() => setShowGroupInfo(true)} aria-label="View group description and info" className="grid size-9 shrink-0 place-items-center rounded-full text-[#7259e8] hover:bg-[#f5f3f8]"><Info className="size-5" /></button></div>
            <div className="px-4 pb-6 pt-3 sm:px-6">
            <div className="flex min-w-0 flex-col justify-between gap-3 border-b border-[#eeeaf2] pb-4 sm:flex-row sm:items-start"><div className="min-w-0"><p className="break-words text-[9px] font-bold capitalize text-[#7259e8]">{detail.group.visibility} group · <button type="button" onClick={() => setShowMembers(true)} className="underline underline-offset-2">{detail.memberCount ?? detail.members.length} members</button> {detail.role ? `· You are ${detail.role}` : ""}</p></div>
              <div className="flex flex-wrap gap-2">{detail.role ? <><button type="button" onClick={() => void startGroupCall()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#7259e8] px-2.5 text-[9px] font-extrabold text-white"><Phone className="size-3" /> Call</button>{["owner", "moderator"].includes(detail.role) && <><button type="button" onClick={() => void groupAction("create_invite")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e8e3f0] px-2.5 text-[9px] font-extrabold"><Copy className="size-3" /> Invite</button><button type="button" onClick={() => {if (window.confirm("Revoke every active invitation to this group?")) void groupAction("revoke_invites");}} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e8e3f0] px-2.5 text-[9px] font-extrabold">Revoke invites</button></>}<button type="button" onClick={() => void reportMessage()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e8e3f0] px-2.5 text-[9px] font-extrabold"><ShieldAlert className="size-3" /> Report</button>{detail.role !== "owner" ? <button type="button" onClick={() => void groupAction("leave")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#f0d7d4] px-2.5 text-[9px] font-extrabold text-[#a44e48]">Leave</button> : <button type="button" onClick={() => {if (window.confirm("Delete this group and all its discussions, sessions, and invitations? Shared resources will become private again.")) void groupAction("delete_group");}} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#f0d7d4] px-2.5 text-[9px] font-extrabold text-[#a44e48]">Delete group</button>}</> : detail.group.visibility === "public" ? <button type="button" onClick={() => void joinPublic({ ...detail.group, role: null })} className="h-8 rounded-lg bg-[#7259e8] px-3 text-[9px] font-extrabold text-white">Join group</button> : <span className="rounded-lg bg-[#f5f3f8] px-3 py-2 text-[9px] font-bold text-[#8a8494]">Invite required</span>}</div>
            </div>

            {inviteUrl && <div className="mt-3 flex flex-col gap-2 rounded-xl bg-[#f7f5ff] p-3 sm:flex-row"><p className="min-w-0 flex-1 break-all text-[9px] leading-4 text-[#655d74]">{inviteUrl}</p><button type="button" onClick={() => void copyInvite()} className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[9px] font-extrabold text-[#5d47bd]"><Copy className="size-3" /> Copy link</button></div>}

            {detail.role ? <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="relative flex h-[calc(100dvh-185px)] min-h-[420px] min-w-0 flex-col rounded-2xl border border-[#eeeaf2] p-3 sm:p-4"><div className="flex items-center gap-2"><MessageCircle className="size-4 text-[#7259e8]" /><h3 className="text-xs font-extrabold">Group discussion</h3></div>
                {detail.hasMoreMessages && <button type="button" onClick={() => void loadOlderMessages()} className="mx-auto mt-3 rounded-lg bg-[#f4f2f7] px-3 py-2 text-[9px] font-extrabold text-[#6d6678]">Load earlier messages</button>}
                <div className="mt-3 flex-1 space-y-3 overflow-y-auto">{detail.messages.length ? detail.messages.map((item) => <article key={item.id} className={`max-w-[92%] rounded-xl p-3 ${item.isMine ? "ml-auto bg-[#f1efff]" : "bg-[#f7f6f9]"}`}><div className="flex items-center justify-between gap-3"><span className="text-[8px] font-extrabold text-[#7259e8]">{item.senderName ?? (item.isMine ? "You" : "Group member")}</span><span className="inline-flex items-center gap-1"><time className="text-[8px] text-[#9a94a3]">{formatDate(item.created_at)}</time>{item.isMine && !item.deletedAt && <span className="inline-flex text-[#7259e8]" aria-label="Delivered"><Check className="size-3" /><Check className="-ml-1.5 size-3" /></span>}</span></div>{item.replyPreview && <div className="mt-1.5 rounded-lg border-l-2 border-[#7259e8] bg-white/70 px-2 py-1.5"><p className="text-[8px] font-extrabold text-[#7259e8]">{item.replyPreview.senderName}</p><p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-[#6d6678]">{item.replyPreview.body}</p></div>}{item.deletedAt ? <p className="mt-1 text-[10px] italic leading-4 text-[#9a94a3]">This message was deleted</p> : <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-4">{item.body}</p>}<div className="mt-1.5 flex flex-wrap gap-2">{item.editedAt && !item.deletedAt && <span className="text-[8px] font-semibold text-[#9a94a3]">Edited</span>}{!item.deletedAt && <button type="button" onClick={() => beginReply(item)} className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#5d47bd]"><Reply className="size-3" /> Reply</button>}{item.isMine && !item.deletedAt && <button type="button" onClick={() => beginEdit(item)} className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#5d47bd]"><Pencil className="size-3" /> Edit</button>}{(item.isMine || detail.role === "owner" || detail.role === "moderator") && !item.deletedAt && <button type="button" onClick={() => void deleteMessage(item.id)} className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#a44e48]"><Trash2 className="size-3" /> Delete</button>}{!item.isMine && !item.deletedAt && <button type="button" onClick={() => void reportMessage(item.id)} className="text-[8px] font-bold text-[#a44e48]">Report message</button>}</div></article>) : <p className="rounded-xl bg-[#fbfaff] px-3 py-7 text-center text-[10px] text-[#8a8494]">Start the discussion with a question, study tip, or announcement.</p>}</div>
                {showGroupTools && <div className="absolute bottom-[76px] left-3 z-30 w-56 rounded-2xl border border-[#e9e5ef] bg-white p-2 shadow-[0_12px_40px_rgba(35,28,68,.18)]"><button type="button" onClick={() => {setShowGroupTools(false); setShowShareResources(true);}} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold hover:bg-[#f7f5ff]"><Share2 className="size-4 text-[#7259e8]" /> Share a resource</button>{["owner", "moderator"].includes(detail.role!) && <button type="button" onClick={() => {setShowGroupTools(false); setShowSession(true);}} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold hover:bg-[#f7f5ff]"><CalendarPlus className="size-4 text-[#7259e8]" /> Schedule a session</button>}</div>}
                <form onSubmit={sendMessage} className="sticky bottom-0 z-10 mt-3 flex shrink-0 flex-col gap-2 border-t border-[#eeeaf2] bg-white/95 pt-3 pb-1">{(replyTo || editingId) && <div className="flex items-start gap-2 rounded-xl border border-[#e6e0f7] bg-[#f7f5ff] px-3 py-2"><div className="min-w-0 flex-1"><p className="text-[9px] font-extrabold text-[#7259e8]">{editingId ? "Editing message" : `Replying to ${replyTo?.senderName ?? "message"}`}</p><p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-[#6d6678]">{editingId ? message : (replyTo?.body || "")}</p></div><button type="button" onClick={() => { setReplyTo(null); setEditingId(null); if (editingId) setMessage(""); }} className="grid size-7 shrink-0 place-items-center rounded-lg text-[#7a7386]" aria-label="Cancel"><X className="size-3.5" /></button></div>}<div className="flex gap-2"><input ref={fileInputRef} type="file" className="hidden" onChange={(event) => void uploadGroupFile(event.target.files?.[0])} /><button type="button" onClick={() => setShowGroupTools((value) => !value)} aria-label="More group actions" aria-expanded={showGroupTools} className="grid size-10 shrink-0 place-items-center rounded-full text-[#7259e8] hover:bg-[#f3f0ff]"><Plus className="size-6" /></button><button type="button" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()} aria-label="Attach a file" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#e8e4ed] text-[#7259e8] disabled:opacity-50">{uploadingFile ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}</button><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder={editingId ? "Edit your message…" : replyTo ? "Write a reply…" : "Write a group message…"} className="h-10 min-w-0 flex-1 rounded-xl border border-[#e8e4ed] px-3 text-[10px] outline-none focus:border-[#aa9af0]" /><button disabled={!message.trim()} className="grid size-10 shrink-0 place-items-center rounded-full bg-[#7259e8] text-white disabled:opacity-50" aria-label="Send message"><Send className="size-4" /></button></div></form>
              </section>

            </div> : <div className="mt-5 rounded-2xl bg-[#fbfaff] px-4 py-9 text-center"><LockKeyhole className="mx-auto size-6 text-[#9c91c2]" /><p className="mt-3 text-sm font-extrabold">Join to view group activity</p><p className="mt-1 text-[10px] leading-4 text-[#8a8494]">Discussions, members, sessions, and shared resources are only shown to group members.</p></div>}
            </div>
          </div>
          : <div className="grid min-h-[460px] place-items-center text-center"><div><UsersRound className="mx-auto size-8 text-[#b0a8c0]" /><h2 className="mt-3 text-sm font-extrabold">Choose a study group</h2><p className="mt-1 max-w-sm text-[10px] leading-4 text-[#8a8494]">Select a group to see discussions and sessions, or discover an open group to join.</p></div></div>}
      </section>
    </div>
    {showGroupInfo && detail && <div className="fixed inset-0 z-[110] grid place-items-center bg-[#17132d]/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setShowGroupInfo(false);}}><section role="dialog" aria-modal="true" aria-labelledby="group-info-title" className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#eeeaf2] px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">GROUP INFO</p><h2 id="group-info-title" className="mt-1 text-base font-extrabold">{detail.group.name}</h2></div><button type="button" onClick={() => setShowGroupInfo(false)} aria-label="Close group information" className="grid size-9 place-items-center rounded-xl bg-[#f4f2f7]"><X className="size-4" /></button></header><div className="space-y-4 p-5"><div><p className="text-[9px] font-extrabold uppercase tracking-wide text-[#8a8494]">DESCRIPTION</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#4e4859]">{detail.group.description || "No group description has been added."}</p></div><div className="flex items-center justify-between rounded-xl bg-[#f7f5ff] p-3"><span><b className="block text-xs">{detail.memberCount ?? detail.members.length} members</b><span className="text-[9px] capitalize text-[#8a8494]">{detail.group.visibility} group</span></span><button type="button" onClick={() => {setShowGroupInfo(false); setShowMembers(true);}} className="text-[10px] font-extrabold text-[#7259e8]">View members</button></div></div></section></div>}
    {showReport && detail && <div className="fixed inset-0 z-[120] grid place-items-center bg-[#17132d]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setShowReport(false);}}><section role="dialog" aria-modal="true" aria-labelledby="report-group-title" className="w-full max-w-lg overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_24px_80px_rgba(23,19,45,.28)]"><header className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#f5f2ff] to-white px-5 py-5 sm:px-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#7259e8] shadow-sm"><Mail className="size-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">CONTACT STUDYSTATION</p><h2 id="report-group-title" className="mt-1 text-base font-extrabold text-[#17132d]">Report a concern</h2><p className="mt-1 text-[10px] leading-4 text-[#817a8d]">Our administration team will review this report and take appropriate actions.</p></div></div><button type="button" onClick={() => setShowReport(false)} aria-label="Close report form" className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[#777080]"><X className="size-4" /></button></header><div className="space-y-4 px-5 py-5 sm:px-6"><div className="rounded-xl border border-[#eeeaf5] bg-[#fbfaff] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-[#918b9a]">Sending to Admin</p><a href="mailto:studystation.support@gmail.com" className="mt-1 block break-all text-xs font-extrabold text-[#5d47bd]">studystation.support@gmail.com</a></div><label className="block text-[10px] font-extrabold text-[#5d5768]">WHAT HAPPENED?<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={3000} rows={5} placeholder="Tell us what happened and what you were doing…" className="mt-1.5 w-full resize-y rounded-xl border border-[#e7e3ec] p-3 text-xs font-medium leading-5 outline-none focus:border-[#aa9af0]" /></label><p className="text-[9px] leading-4 text-[#8a8494]">Group: {detail.group.name}{reportMessageId ? " · Message report" : ""}</p><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowReport(false)} className="h-10 rounded-xl border border-[#e7e3ec] px-4 text-[10px] font-extrabold text-[#655d74]">Cancel</button><a href={reportMailto} onClick={submitReportConcern} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[10px] font-extrabold text-white cursor-pointer"><Mail className="size-3.5" /> Submit report</a></div></div></section></div>}
    {showSession && detail && <div className="fixed inset-0 z-[110] grid place-items-center bg-[#17132d]/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setShowSession(false);}}><section role="dialog" aria-modal="true" aria-labelledby="schedule-session-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#eeeaf2] px-5 py-4"><h2 id="schedule-session-title" className="text-sm font-extrabold">Study sessions</h2><button type="button" onClick={() => setShowSession(false)} aria-label="Close sessions" className="grid size-9 place-items-center rounded-xl bg-[#f4f2f7]"><X className="size-4" /></button></header><div className="space-y-4 p-5">{["owner", "moderator"].includes(detail.role ?? "") && <form onSubmit={createSession} className="space-y-2"><input required name="title" minLength={2} maxLength={160} placeholder="Session title" className="h-10 w-full rounded-lg border border-[#e8e4ed] px-3 text-xs" /><label className="block text-[9px] font-bold text-[#8a8494]">START<input required name="startsAt" type="datetime-local" className="mt-1 h-10 w-full rounded-lg border border-[#e8e4ed] px-3 text-xs" /></label><label className="block text-[9px] font-bold text-[#8a8494]">END<input required name="endsAt" type="datetime-local" className="mt-1 h-10 w-full rounded-lg border border-[#e8e4ed] px-3 text-xs" /></label><textarea name="notes" maxLength={2000} rows={2} placeholder="Agenda (optional)" className="w-full rounded-lg border border-[#e8e4ed] p-3 text-xs" /><button className="h-10 w-full rounded-lg bg-[#17132d] text-xs font-extrabold text-white">Schedule session</button></form>}<div className="space-y-2">{detail.sessions.filter((session) => session.status === "scheduled").map((session) => {const startsAt = Date.parse(session.starts_at); const endsAt = Date.parse(session.ends_at); const isCallTime = Number.isFinite(startsAt) && Number.isFinite(endsAt) && callClock >= startsAt - 30 * 60 * 1000 && callClock < endsAt; return <div key={session.id} className="rounded-xl bg-[#f7f5ff] p-3"><b className="block break-words text-xs">{session.title}</b><p className="mt-1 text-[10px] text-[#726b80]">{formatDate(session.starts_at)} – {formatDate(session.ends_at)}</p>{session.notes && <p className="mt-1 text-[10px] leading-4 text-[#898391]">{session.notes}</p>}{detail.callEnabled && isCallTime && <button type="button" onClick={() => setCallSession(session)} className="mt-2 rounded-lg bg-[#7259e8] px-3 py-2 text-[9px] font-extrabold text-white">Join call</button>}{["owner", "moderator"].includes(detail.role ?? "") && <button type="button" onClick={() => void groupAction("cancel_session", { text: session.id })} className="mt-2 block text-[9px] font-bold text-[#a44e48]">Cancel session</button>}</div>;})}{detail.sessions.every((session) => session.status !== "scheduled") && <p className="py-3 text-center text-[10px] text-[#8a8494]">No upcoming sessions scheduled.</p>}</div></div></section></div>}
    {showShareResources && detail && <div className="fixed inset-0 z-[110] grid place-items-center bg-[#17132d]/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setShowShareResources(false);}}><section role="dialog" aria-modal="true" aria-labelledby="share-resources-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#eeeaf2] px-5 py-4"><h2 id="share-resources-title" className="text-sm font-extrabold">Share resources</h2><button type="button" onClick={() => setShowShareResources(false)} aria-label="Close shared resources" className="grid size-9 place-items-center rounded-xl bg-[#f4f2f7]"><X className="size-4" /></button></header><div className="space-y-4 p-5">{detail.ownResources?.length ? <div className="flex gap-2"><select value={resourceToShare} onChange={(event) => setResourceToShare(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[#e8e4ed] bg-white px-2 text-[10px]"><option value="">Choose a saved resource or note</option>{detail.ownResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} · {resource.resource_type}</option>)}</select><button type="button" disabled={!resourceToShare} onClick={async () => {const isNote = resourceToShare.startsWith("note:"); const result = await groupAction(isNote ? "share_note" : "share_resource", { resourceId: isNote ? resourceToShare.slice(5) : resourceToShare }); if (result) {setResourceToShare(""); setShowShareResources(false);}}} className="h-10 rounded-lg bg-[#7259e8] px-4 text-[10px] font-extrabold text-white disabled:opacity-50">Share</button></div> : <p className="rounded-xl bg-[#f7f5ff] p-3 text-[10px] leading-4 text-[#8a8494]">Your saved resources and generated notes will appear here when available.</p>}<div className="space-y-2">{detail.resources.map((resource) => <div key={resource.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#f7f6f9] px-3 py-2"><span className="min-w-0"><b className="block truncate text-[10px]">{resource.title}</b><span className="text-[8px] text-[#938d9b]">{resource.resourceType}</span></span><span className="flex shrink-0 items-center gap-3"><button type="button" onClick={() => {setShowShareResources(false); void openResource(resource);}} className="text-[9px] font-bold text-[#5d47bd]">Open</button>{resource.isMine && <button type="button" onClick={async () => {const result = await groupAction("unshare_resource", { resourceId: resource.id }); if (result) setShowShareResources(false);}} className="text-[9px] font-bold text-[#a44e48]">Unshare</button>}</span></div>)}{!detail.resources.length && <p className="text-[10px] text-[#8a8494]">No resources have been shared yet.</p>}</div></div></section></div>}
    {showMembers && detail && <div className="fixed inset-0 z-[110] grid place-items-center bg-[#17132d]/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setShowMembers(false);}}><section role="dialog" aria-modal="true" aria-labelledby="group-members-title" className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#eeeaf2] px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">{detail.group.name}</p><h2 id="group-members-title" className="mt-1 text-base font-extrabold">{detail.memberCount ?? detail.members.length} members</h2></div><button type="button" onClick={() => setShowMembers(false)} aria-label="Close members" className="grid size-9 place-items-center rounded-xl bg-[#f4f2f7]"><X className="size-4" /></button></header><ul className="max-h-[65vh] divide-y divide-[#f0edf4] overflow-y-auto px-5">{detail.members.map((member) => <li key={member.userId} className="flex items-center gap-3 py-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-xs font-black text-[#7259e8]">{member.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs">{member.isSelf ? `${member.name} (You)` : member.name}</b><span className="mt-0.5 block text-[9px] capitalize text-[#8a8494]">{member.role} · Joined {formatDate(member.joinedAt)}</span></span>{detail.role === "owner" && !member.isSelf && member.role !== "owner" ? <span className="flex items-center gap-2"><select aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => void groupAction("set_member_role", { targetUserId: member.userId, newRole: event.target.value })} className="h-8 rounded-lg border border-[#e8e4ed] bg-white px-2 text-[9px] capitalize"><option value="member">Member</option><option value="moderator">Moderator</option></select><button type="button" onClick={() => {if (window.confirm(`Remove ${member.name} from this group?`)) void groupAction("remove_member", { targetUserId: member.userId });}} className="text-[9px] font-bold text-[#a44e48]">Remove</button></span> : <span className="rounded-full bg-[#f4f2f7] px-2.5 py-1 text-[8px] font-bold capitalize text-[#716a7c]">{member.role}</span>}</li>)}</ul><footer className="border-t border-[#eeeaf2] px-5 py-3 text-[9px] text-[#8a8494]">Only current group members can view this list.</footer></section></div>}
    {callSession && selectedId && <StudyCallDialog groupId={selectedId} session={callSession} onClose={() => setCallSession(null)} />}
    {resourcePreview && <div className="fixed inset-0 z-[80] grid place-items-center bg-[#17132d]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="shared-resource-title"><section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#7259e8]">SHARED RESOURCE</p><h2 id="shared-resource-title" className="mt-1 text-base font-extrabold">{resourcePreview.title}</h2></div><button type="button" onClick={() => setResourcePreview(null)} aria-label="Close resource preview" className="grid size-8 place-items-center rounded-lg border border-[#e9e5ef]"><X className="size-4" /></button></div>{resourcePreview.downloadUrl && <a href={resourcePreview.downloadUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#7259e8] px-3 text-[10px] font-extrabold text-white">Open private file</a>}{resourcePreview.content ? <pre className="mt-4 max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#f7f6f9] p-4 text-[10px] leading-5">{typeof resourcePreview.content === "string" ? resourcePreview.content : JSON.stringify(resourcePreview.content, null, 2)}</pre> : !resourcePreview.downloadUrl && <p className="mt-4 text-xs text-[#8a8494]">This shared resource does not include a preview or file.</p>}</section></div>}
    {notice && <div className="sr-only" aria-live="polite"><Check className="size-3" />{notice}</div>}
  </div>;
}
