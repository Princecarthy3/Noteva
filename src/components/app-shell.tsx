"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock3,
  CloudUpload,
  Copy,
  Download,
  FileAudio,
  FileDown,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  HelpCircle,
  Home,
  Layers3,
  LayoutDashboard,
  Library,
  Link2,
  ListChecks,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquareText,
  Mic2,
  MoreHorizontal,
  NotebookTabs,
  PanelLeftClose,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Target,
  TimerReset,
  Moon,
  Upload,
  Sun,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ProfileSettings } from "@/components/profile-settings";
import { useTheme } from "@/components/theme-provider";
import { useInstallApp } from "@/components/install-app";
import {
  LectureStudio,
  Stage6Courses,
  Stage6Dashboard,
  OrganizedNotesDisplay,
  formatNoteMarkdown,
  type OrganizedNoteData,
  type Stage6DashboardData,
  type Stage6Lecture,
  type Stage6Course,
} from "@/components/stage6-workspace";
import { AiStudyLab } from "@/components/ai-study-lab";
import { StudyGroups } from "@/components/study-groups";
import type { PlannerData } from "@/components/study-planner";
import { StudyCalendar } from "@/components/study-calendar";
import { QuizProgressView } from "@/components/quiz-progress";
import { GeneratedFlashcardsLibrary } from "@/components/study-material-libraries";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AudioPlayer } from "@/components/audio-player";
import { LectureCaptureModal } from "@/components/lecture-capture-modal";
import { ReviewModal } from "@/components/review-section";
import { AppTour } from "@/components/app-tour";
import { exportNoteToPdf } from "@/lib/pdf-export";

type View =
  | "dashboard"
  | "courses"
  | "lectures"
  | "notes"
  | "flashcards"
  | "quizzes"
  | "planner"
  | "study-lab"
  | "study-groups"
  | "assistant"
  | "profile";

type AppNotification = { id: string; type: string; title: string; body: string; read_at: string | null; created_at: string };

type Modal = "capture" | "flashcards" | "note" | null;
type SourceTab = "record" | "upload";
type ChatMessage = { role: "user" | "assistant"; content: string; citation?: string };

type SpeechRecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const navItems: Array<{ id: View; label: string; icon: typeof Home; section?: string }> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "courses", label: "My courses", icon: BookOpen },
  { id: "lectures", label: "Lecture Studio", icon: AudioLines },
  { id: "notes", label: "Notes library", icon: NotebookTabs },
  { id: "flashcards", label: "Flashcards", icon: Layers3, section: "STUDY TOOLS" },
  { id: "quizzes", label: "Practice quizzes", icon: CircleHelp },
  { id: "study-lab", label: "AI Study Lab", icon: Sparkles },
  { id: "study-groups", label: "Study groups", icon: UsersRound },
  { id: "planner", label: "Study planner", icon: CalendarDays, section: "ORGANIZE" },
  { id: "assistant", label: "Ask StudyStation", icon: Bot },
  { id: "profile", label: "Profile & settings", icon: UserRound, section: "ACCOUNT" },
];

function TitleBlock({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return (
    <div>
      {eyebrow && <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">{eyebrow}</p>}
      <h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">{title}</h1>
      {copy && <p className="mt-1.5 text-[12px] leading-5 text-[#7d7789] sm:text-[13px]">{copy}</p>}
    </div>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#dcd6e8] bg-white/70 p-12 text-center backdrop-blur-md">
      <Search className="mx-auto size-7 text-[#b4aebb]" />
      <p className="mt-4 text-sm font-extrabold text-[#28213f]">No results for “{query}”</p>
      <p className="mt-1 text-xs text-[#8a8494]">Try another keyword, course code, or lecture title.</p>
    </div>
  );
}

export function AppShell({
  profile,
  dashboardData,
  plannerData,
}: {
  profile: {
    fullName: string;
    email: string;
    programme: string;
    university: string;
    semester: string;
    timezone: string;
    avatarUrl: string | null;
    avatarPath: string;
  };
  dashboardData: Stage6DashboardData;
  plannerData: PlannerData;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<View>("dashboard");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [sourceTab, setSourceTab] = useState<SourceTab>("record");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notifiedIds = useRef<Set<string> | null>(null);
  const notificationAudioRef = useRef<AudioContext | null>(null);
  const { theme, setTheme } = useTheme();
  const { openInstallInstructions } = useInstallApp();
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; tone?: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, tone: "success" | "error" | "info" = "success") => {
    setToast({ message, tone });
  }, []);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [captionStatus, setCaptionStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [autoOpenLectureId, setAutoOpenLectureId] = useState<string | null>(null);
  const clearAutoOpenLecture = useCallback(() => setAutoOpenLectureId(null), []);

  // Active note selected from real lectures
  const [activeLectureNote, setActiveLectureNote] = useState<Stage6Lecture | null>(null);

  // Assistant Chat State
  const firstName = profile.fullName.trim().split(/\s+/)[0] || "Student";
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatLectureId, setSelectedChatLectureId] = useState<string>("all");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi ${firstName} — I’m StudyStation, your personal AI university tutor grounded in your courses and lecture materials. What concept, lecture, or problem can I help you understand today?`,
    },
  ]);

  const [courseValue, setCourseValue] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingPausedRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const liveTranscriptRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const courseMap = useMemo(
    () => new Map(dashboardData.courses.map((course) => [course.id, course])),
    [dashboardData.courses]
  );

  const userInitials = useMemo(() => {
    const parts = profile.fullName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "ST";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile.fullName]);

  useEffect(() => {
    const requestedView = params.get("view") as View | null;
    if (requestedView && navItems.some((item) => item.id === requestedView)) setView(requestedView);
    if (params.has("invite")) setView("study-groups");
    if (params.get("action") === "record") {
      setModal("capture");
      setSourceTab("record");
    }
  }, [params]);

  useEffect(() => {
    const enableNotificationSound = () => {
      if (typeof AudioContext === "undefined") return;
      notificationAudioRef.current ??= new AudioContext();
      if (notificationAudioRef.current.state === "suspended") void notificationAudioRef.current.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", enableNotificationSound, { once: true });
    return () => window.removeEventListener("pointerdown", enableNotificationSound);
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { notifications?: AppNotification[] };
        if (!active || !Array.isArray(data.notifications)) return;
        const next = data.notifications;
        const previousIds = notifiedIds.current;
        if (previousIds) {
          const hasNewAlert = next.some((item) => ["study_group_join", "study_group_call"].includes(item.type) && !previousIds.has(item.id));
          if (hasNewAlert) {
            try {
              const audio = notificationAudioRef.current;
              if (!audio || audio.state !== "running") throw new Error("Notification sound is not enabled.");
              const oscillator = audio.createOscillator();
              const gain = audio.createGain();
              oscillator.type = "sine";
              oscillator.frequency.value = 880;
              gain.gain.setValueAtTime(0.0001, audio.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.22);
              oscillator.connect(gain);
              gain.connect(audio.destination);
              oscillator.start();
              oscillator.stop(audio.currentTime + 0.23);
            } catch {}
          }
          const newCall = previousIds
            ? next.find((item) => item.type === "study_group_call" && !previousIds.has(item.id))
            : next.find((item) => item.type === "study_group_call" && !item.read_at
              && Date.now() - Date.parse(item.created_at) < 2 * 60 * 60 * 1000);
          const callInfo = newCall?.body.match(/\[call:([0-9a-f-]{36}):([0-9a-f-]{36})\]/i);
          if (callInfo) {
            router.push(`/app?view=study-groups&group=${callInfo[1]}&call=${callInfo[2]}`);
            setView("study-groups");
          }
        }
        notifiedIds.current = new Set(next.map((item) => item.id));
        setNotifications(next);
      } catch { return; }
    };
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 8000);
    return () => { active = false; window.clearInterval(interval); };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.tone === "error" ? 5200 : 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!isRecording || isRecordingPaused) return;
    const interval = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRecording, isRecordingPaused]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const navigate = useCallback((next: View) => {
    setView(next);
    setSelectedCourseId(null);
    setSidebarOpen(false);
    setSearch("");
  }, []);

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        showToast("Live recording isn’t supported in this browser. Try uploading a file instead.", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      liveTranscriptRef.current = "";
      setLiveTranscript("");
      setInterimTranscript("");
      const preferredType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setIsRecordingPaused(false);
        recordingPausedRef.current = false;
      };
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setRecordedBlob(null);
      recordingPausedRef.current = false;
      setIsRecordingPaused(false);
      recorder.start(1000);
      setIsRecording(true);

      const speechWindow = window as SpeechRecognitionWindow;
      const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setCaptionStatus("Live captions are not supported in this browser. The recording can still be transcribed after you stop.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.onresult = (event) => {
        let finalized = "";
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalized += result[0].transcript;
          else interim += result[0].transcript;
        }
        if (finalized) {
          liveTranscriptRef.current = `${liveTranscriptRef.current}${liveTranscriptRef.current ? " " : ""}${finalized.trim()}`.trim();
          setLiveTranscript(liveTranscriptRef.current);
        }
        setInterimTranscript(interim);
      };
      recognition.onerror = (event) => {
        const status = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Allow speech recognition in your browser to see live captions. Your recording is still in progress."
          : event.error === "network"
            ? "Live captions lost their connection. Your recording is still in progress."
            : "Live captions stopped. Your recording is still in progress.";
        setCaptionStatus(status);
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        if (recordingPausedRef.current) return;
        if (mediaRecorderRef.current?.state === "recording") {
          try {
            recognition.start();
            return;
          } catch {}
        }
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      setCaptionStatus("Live captions are on. Captions use your browser's speech recognition service.");
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setCaptionStatus("Live captions could not start in this browser. The recording can still be transcribed after you stop.");
      }
    } catch {
      showToast("Microphone access was blocked. Allow access or upload a lecture file.", "error");
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state !== "recording") return;
    mediaRecorderRef.current.pause();
    recordingPausedRef.current = true;
    setIsRecordingPaused(true);
    recognitionRef.current?.stop();
    setInterimTranscript("");
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state !== "paused") return;
    mediaRecorderRef.current.resume();
    recordingPausedRef.current = false;
    setIsRecordingPaused(false);
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.start();
      } catch {
        setCaptionStatus("Recording resumed. Live captions could not restart, but the audio is still being recorded.");
      }
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.stop();
  }

  function resetRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    chunksRef.current = [];
    setRecordedBlob(null);
    setIsRecording(false);
    setIsRecordingPaused(false);
    recordingPausedRef.current = false;
    setRecordingSeconds(0);
    setLiveTranscript("");
    setInterimTranscript("");
  }

  async function submitLecture(file: File, requestedTitle?: string, sourceType?: "recording") {
    setProcessing(true);
    try {
      const derivedFromFile = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      const isGenericFileName = !derivedFromFile || /^live recording$/i.test(derivedFromFile);
      const course = courseValue ? courseMap.get(courseValue) : null;
      const stamp = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
      const smartFallback = course
        ? `${course.code} lecture · ${stamp}`
        : `Lecture · ${stamp}`;
      const title =
        requestedTitle?.trim() ||
        lectureTitle.trim() ||
        (!isGenericFileName ? derivedFromFile : "") ||
        smartFallback;
      const createResponse = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || smartFallback,
          courseId: courseValue || null,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          sourceType,
        }),
      });
      const created = (await createResponse.json()) as {
        error?: string;
        lectureId?: string;
        storagePath?: string;
        uploadToken?: string;
        bucket?: string;
      };
      if (!createResponse.ok || !created.lectureId || !created.storagePath || !created.uploadToken || !created.bucket) {
        throw new Error(created.error || "The lecture upload could not be initialized.");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(created.bucket)
        .uploadToSignedUrl(created.storagePath, created.uploadToken, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        const cleanupResponse = await fetch(`/api/lectures/${created.lectureId}`, { method: "DELETE" });
        if (!cleanupResponse.ok) router.refresh();
        throw new Error("The file could not be uploaded to private storage. Check your connection and try again.");
      }

      const processResponse = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: created.lectureId }),
      });
      const processed = (await processResponse.json()) as { error?: string; status?: string };
      const isDoc = /\.(pdf|docx|doc|pptx|ppt|txt|md|rtf)$/i.test(file.name);
      if (!processResponse.ok) {
        setModal(null);
        setView("lectures");
        setAutoOpenLectureId(created.lectureId);
        showToast(processed.error || (isDoc ? "The document was uploaded but could not be parsed yet. Retry it from Lecture Studio." : "The lecture was uploaded but could not be transcribed yet. Retry it from Lecture Studio."), "error");
        setLectureTitle("");
        router.refresh();
        return;
      }
      // Automatically trigger AI note organization upon successful transcription / extraction
      showToast(isDoc ? "Document extracted! Organizing into structured notes with AI..." : "Transcription finished! Organizing into structured notes with AI...", "info");
      try {
        const noteResponse = await fetch(`/api/lectures/${created.lectureId}/notes`, {
          method: "POST",
        });
        if (noteResponse.ok) {
          showToast(isDoc ? "Lecture document organized into study notes!" : "Lecture transcribed and organized into study notes!", "success");
        } else {
          showToast(isDoc ? "Lecture text ready. You can generate notes from the lecture view." : "Lecture transcript ready. You can generate notes from the lecture view.", "success");
        }
      } catch {
        showToast(isDoc ? "Lecture text ready. You can generate notes anytime from the lecture view." : "Lecture transcript ready. You can generate notes anytime from the lecture view.", "success");
      }
      setModal(null);
      setView("lectures");
      setAutoOpenLectureId(created.lectureId);
      setRecordedBlob(null);
      setLectureTitle("");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "We couldn’t process that lecture.", "error");
      router.refresh();
    } finally {
      setProcessing(false);
    }
  }

  async function processRecording(title?: string) {
    if (!recordedBlob) return;
    const extension = recordedBlob.type.includes("mp4") ? "m4a" : "webm";
    const course = courseValue ? courseMap.get(courseValue) : null;
    const stamp = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    const fallbackTitle = course
      ? `${course.code} lecture · ${stamp}`
      : `Lecture · ${stamp}`;
    await submitLecture(
      new File([recordedBlob], `live-recording.${extension}`, { type: recordedBlob.type }),
      title?.trim() || lectureTitle.trim() || fallbackTitle,
      "recording"
    );
  }

  async function handleUpload(file?: File, title?: string) {
    if (!file) return;
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("Lecture files must be 25 MB or smaller.", "error");
      return;
    }
    await submitLecture(file, title);
  }

  async function askAssistant(question?: string, specificLectureId?: string) {
    const prompt = (question ?? chatInput).trim();
    if (!prompt || chatLoading) return;

    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setChatInput("");
    setChatLoading(true);

    const targetLectureId = specificLectureId || selectedChatLectureId;
    const targetLecture =
      targetLectureId !== "all" ? dashboardData.lectures.find((l) => l.id === targetLectureId) : null;
    const targetCourse = targetLecture?.courseId ? courseMap.get(targetLecture.courseId) : null;

    const contextPayload = targetLecture
      ? {
          lectureTitle: targetLecture.title,
          course: targetCourse ? `${targetCourse.code} - ${targetCourse.title}` : "Course Lecture",
          status: targetLecture.status,
          transcript: targetLecture.transcript?.slice(0, 5000) ?? "No transcript available.",
        }
      : {
          studentName: firstName,
          courses: dashboardData.courses.map((c) => `${c.code}: ${c.title}`),
          recentLectures: dashboardData.lectures.slice(0, 5).map((l) => ({
            title: l.title,
            course: l.courseId ? courseMap.get(l.courseId)?.code : undefined,
            transcriptSnippet: l.transcript?.slice(0, 600) ?? undefined,
          })),
        };

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", question: prompt, context: contextPayload }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No answer returned");

      const citationTag = targetLecture
        ? `${targetCourse ? targetCourse.code : "Lecture"} · ${targetLecture.title}`
        : dashboardData.courses.length
        ? `${dashboardData.courses[0].code} · Course Material`
        : undefined;

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer ?? "I couldn’t form an answer from your notes.",
          citation: citationTag,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "I’m having trouble connecting to AI services right now.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function openNote(lecture: Stage6Lecture) {
    setActiveLectureNote(lecture);
    setModal("note");
  }

  return (
    <div className="workspace-shell min-h-screen bg-[#f7f6fb] text-[#17132d]">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-[#17132d]/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sleek Dark Glassmorphic Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col glass-panel-dark px-4 py-5 text-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Brand inverse />
          <button
            onClick={() => setSidebarOpen(false)}
            className="grid size-8 place-items-center rounded-lg bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <button
          onClick={() => {
            setModal("capture");
            setSourceTab("record");
            setSidebarOpen(false);
          }}
          className="mt-7 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7259e8] to-[#6045df] text-[12px] font-extrabold shadow-[0_8px_25px_rgba(114,89,232,.35)] transition hover:shadow-[0_12px_30px_rgba(114,89,232,.45)] hover:brightness-105"
          type="button"
        >
          <Plus className="size-4" /> New lecture
        </button>

        <nav className="mt-6 flex-1 overflow-y-auto hide-scrollbar" aria-label="Workspace navigation">
          {navItems.map((item, index) => (
            <div key={item.id}>
              {item.section && (
                <p className={`${index > 0 ? "mt-5" : ""} mb-2 px-3 text-[9px] font-black tracking-[.18em] text-white/30`}>
                  {item.section}
                </p>
              )}
              <button
                data-tour-id={item.id}
                onClick={() => navigate(item.id)}
                className={`mb-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[12px] font-bold transition ${
                  view === item.id
                    ? "bg-[#7259e8]/30 border border-[#7259e8]/40 text-white shadow-sm"
                    : "text-white/50 hover:bg-white/5 hover:text-white/85"
                }`}
                type="button"
              >
                <item.icon className={`size-[17px] ${view === item.id ? "text-[#a794ff]" : ""}`} />
                {item.label}
                {item.id === "assistant" && <Sparkles className="ml-auto size-3 text-[#ffd768]" />}
              </button>
            </div>
          ))}
        </nav>

        {/* Real Profile Card */}
        <button type="button" onClick={() => navigate("profile")} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left backdrop-blur-md transition hover:bg-white/10">
          <div className="flex items-center gap-2.5">
            {profile.avatarUrl
              ? <Image src={profile.avatarUrl} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-xl object-cover" />
              : <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-[#7259e8] to-[#9b83ff] text-[11px] font-black text-white shadow-sm">{userInitials}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-extrabold text-white">{profile.fullName}</p>
              <p className="mt-0.5 truncate text-[9px] text-white/45">{profile.programme || "Student Account"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-white/40">
            <span>{dashboardData.courses.length} courses</span>
            <span>{dashboardData.lectures.length} lectures</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReviewModalOpen(true);
            setSidebarOpen(false);
          }}
          className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold text-white/55 transition hover:bg-white/5 hover:text-white"
        >
          <Star className="size-3.5 text-[#ffd768]" /> Share a StudyStation review
        </button>

        <div className="mt-3 flex gap-1">
          <button
            onClick={openInstallInstructions}
            className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold text-white/45 hover:bg-white/5 hover:text-white/80"
          >
            <Download className="size-3.5" /> Install app
          </button>
          <button
            aria-label="Open profile and settings"
            onClick={() => navigate("profile")}
            className="grid size-8 place-items-center rounded-lg text-white/35 hover:bg-white/5 hover:text-white"
          >
            <UserRound className="size-3.5" />
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="min-h-screen lg:pl-[252px]">
        {/* Glass Header */}
        <header className="sticky top-0 z-30 flex h-[66px] items-center border-b border-[#e9e6ef] bg-[#fbfaff]/95 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 grid size-9 place-items-center rounded-xl border border-[#e8e4ef] bg-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>

          {/* Search bar */}
          <div className="relative hidden max-w-[420px] flex-1 sm:block">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#aaa4b1]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lectures, courses, or notes…"
              className="h-10 w-full rounded-xl border border-transparent bg-[#f3f0f7]/90 pl-10 pr-4 text-[12px] font-medium outline-none transition placeholder:text-[#aaa4b1] focus:border-[#cfc6f5] focus:bg-white"
            />
          </div>

          {/* Header Right Actions */}
          <div className="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="grid size-9 place-items-center rounded-xl border border-[#e3dff0] bg-white text-[#5e47c4] shadow-sm transition hover:bg-[#f3f0ff]"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            {/* Notifications and study tasks */}
            <div className="relative">
              <button
                onClick={() => {
                  const opening = !notificationsOpen;
                  setNotificationsOpen(opening);
                  if (opening) {
                    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
                    void fetch("/api/notifications", { method: "PATCH" });
                  }
                }}
                className="relative grid size-9 place-items-center rounded-xl border border-[#ebe7f1] bg-white text-[#2a2440] hover:bg-[#f8f6fb] shadow-sm"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {notifications.filter((item) => !item.read_at).length > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#7259e8] px-1 text-[8px] font-black text-white">{notifications.filter((item) => !item.read_at).length}</span>}
              </button>

              {notificationsOpen && (
                <div className="glass-panel absolute right-0 top-12 z-50 w-[min(320px,calc(100vw-24px))] rounded-[24px] p-4 shadow-[0_20px_60px_rgba(35,28,68,.16)]">
                  <div className="flex items-center justify-between border-b border-[#f0edf5] pb-2.5">
                    <b className="text-xs font-black text-[#17132d]">Notifications</b>
                    <span className="text-[10px] font-extrabold text-[#7259e8]">
                      {notifications.filter((item) => !item.read_at).length} unread
                    </span>
                  </div>

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto hide-scrollbar">
                    {notifications.length ? notifications.slice(0, 8).map((item) => (
                      <button type="button" key={item.id} onClick={() => {
                        setNotificationsOpen(false);
                        const callInfo = item.type === "study_group_call" ? item.body.match(/\[call:([0-9a-f-]{36}):([0-9a-f-]{36})\]/i) : null;
                        if (callInfo) router.push(`/app?view=study-groups&group=${callInfo[1]}&call=${callInfo[2]}`);
                        navigate("study-groups");
                      }} className={`block w-full rounded-xl border p-2.5 text-left ${item.read_at ? "border-[#eeeaf5] bg-[#faf9fd]" : "border-[#dcd4ff] bg-[#f5f2ff]"}`}>
                        <p className="text-[11px] font-extrabold text-[#17132d]">{item.title}</p>
                        <p className="mt-0.5 break-words text-[9px] leading-4 text-[#777183]">{item.body.replace(/\s*\[call:[0-9a-f-]{36}:[0-9a-f-]{36}\]/i, "")}</p>
                        <time className="mt-1 block text-[8px] font-bold text-[#96909f]">{new Date(item.created_at).toLocaleString()}</time>
                      </button>
                    )) : <p className="py-3 text-center text-[10px] text-[#868093]">No new notifications.</p>}
                  </div>

                  <div className="my-3 border-t border-[#f0edf5]" />
                  <p className="mb-2 text-[9px] font-black uppercase tracking-wide text-[#8e8895]">Study tasks</p>
                  {dashboardData.tasks.length === 0 ? <p className="text-center text-[10px] text-[#868093]">No upcoming deadlines or pending tasks.</p> : dashboardData.tasks.slice(0, 3).map((task) => (
                    <p key={task.id} className="truncate py-1 text-[10px] font-semibold text-[#514b5e]">{task.title}</p>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      navigate("planner");
                    }}
                    className="mt-3 block w-full text-center text-[11px] font-black text-[#7259e8] hover:underline"
                  >
                    Open Study Planner →
                  </button>
                </div>
              )}
            </div>

            {/* User Initials Avatar */}
            <button type="button" onClick={() => navigate("profile")} aria-label="Open your profile" className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-tr from-[#eeeaff] to-[#d8ceff] text-[11px] font-black text-[#624bc7] shadow-sm transition hover:ring-2 hover:ring-[#b6a8f3]">
              {profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={36} height={36} unoptimized className="size-full object-cover" /> : userInitials}
            </button>
          </div>
        </header>

        {/* View Router */}
        <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {view === "dashboard" && (
            <Stage6Dashboard
              data={dashboardData}
              plannerData={plannerData}
              fullName={profile.fullName}
              onCapture={() => {
                setModal("capture");
                setSourceTab("upload");
              }}
              onAssistant={() => navigate("assistant")}
              onGroups={() => navigate("study-groups")}
              onOpenCourse={(id) => {
                setSelectedCourseId(id);
                setView("courses");
                setSearch("");
              }}
              onOpenCourses={() => navigate("courses")}
              onOpenLectures={() => navigate("lectures")}
              onOpenPlanner={() => navigate("planner")}
            />
          )}

          {view === "profile" && (
            <ProfileSettings
              profile={profile}
              theme={theme}
              onThemeChange={setTheme}
            />
          )}

          {view === "courses" && (
            <Stage6Courses
              data={dashboardData}
              search={search}
              selectedCourseId={selectedCourseId}
              onOpenCourse={setSelectedCourseId}
            onOpenLecture={openNote}
              onCapture={() => {
                setModal("capture");
                setSourceTab("upload");
              }}
            />
          )}

          {view === "lectures" && (
            <LectureStudio
              lectures={dashboardData.lectures}
              courses={dashboardData.courses}
              timezone={dashboardData.timezone}
              loadError={dashboardData.errors.lectures}
              autoOpenLectureId={autoOpenLectureId}
              onAutoOpen={clearAutoOpenLecture}
              onToast={showToast}
              onUpload={() => {
                setModal("capture");
                setSourceTab("upload");
              }}
            />
          )}

          {view === "notes" && (
            <FunctionalNotesView
              lectures={dashboardData.lectures}
              courses={dashboardData.courses}
              timezone={dashboardData.timezone}
              search={search}
              onNote={openNote}
              onCapture={() => setModal("capture")}
              onOpenStudyLab={() => navigate("study-lab")}
            />
          )}

          {view === "flashcards" && (
            <FunctionalFlashcardsView
              courses={dashboardData.courses}
              lectures={dashboardData.lectures}
              progress={plannerData.progress}
              onOpenStudyLab={() => navigate("study-lab")}
            />
          )}

          {view === "quizzes" && (
            <QuizProgressView
              progress={plannerData.progress}
              hasError={plannerData.errors.progress}
              onOpenStudyLab={() => navigate("study-lab")}
              timezone={dashboardData.timezone}
            />
          )}

          {view === "planner" && (
            <StudyCalendar data={plannerData} courses={dashboardData.courses} timezone={dashboardData.timezone} />
          )}

          {view === "study-lab" && <AiStudyLab />}

          {view === "study-groups" && (
            <StudyGroups
              courses={dashboardData.courses
                .filter((course) => !course.archived)
                .map(({ id, title, code }) => ({ id, title, code }))}
              inviteToken={params.get("invite")}
              initialGroupId={params.get("group")}
              callSessionId={params.get("call")}
            />
          )}

          {view === "assistant" && (
            <FunctionalAssistantView
              studentName={firstName}
              lectures={dashboardData.lectures}
              courses={dashboardData.courses}
              selectedLectureId={selectedChatLectureId}
              setSelectedLectureId={setSelectedChatLectureId}
              messages={messages}
              input={chatInput}
              setInput={setChatInput}
              loading={chatLoading}
              ask={askAssistant}
            />
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Bar */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 flex h-[64px] items-center justify-around rounded-[24px] border border-[#e5e1ec]/90 bg-white/95 px-1 shadow-[0_12px_40px_rgba(27,21,51,.18)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        {[
          { id: "dashboard" as View, label: "Home", icon: Home },
          { id: "lectures" as View, label: "Studio", icon: AudioLines },
          { id: "capture" as const, label: "Record", icon: Mic2 },
          { id: "study-lab" as View, label: "AI Lab", icon: Sparkles },
          { id: "study-groups" as View, label: "Groups", icon: UsersRound },
        ].map((item) =>
          item.id === "capture" ? (
            <button
              key={item.id}
              onClick={() => setModal("capture")}
              className="-mt-5 flex flex-col items-center gap-1 text-[9px] font-black text-[#7259e8]"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-[#7259e8] to-[#9278ff] text-white shadow-[0_8px_20px_rgba(114,89,232,.36)]">
                <Mic2 className="size-5" />
              </span>
              {item.label}
            </button>
          ) : (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex w-12 flex-col items-center gap-1.5 text-[9px] font-bold ${
                view === item.id ? "text-[#7259e8]" : "text-[#8e8897]"
              }`}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </button>
          )
        )}
      </nav>

      {/* Modals */}
      {modal === "capture" && (
        <LectureCaptureModal
          tab={sourceTab}
          setTab={setSourceTab}
          close={() => {
            if (!isRecording && !processing) setModal(null);
          }}
          courseId={courseValue}
          setCourseId={setCourseValue}
          courses={dashboardData.courses.filter((course) => !course.archived)}
          title={lectureTitle}
          setTitle={setLectureTitle}
          recording={isRecording}
          paused={isRecordingPaused}
          seconds={recordingSeconds}
          recorded={recordedBlob}
          liveTranscript={liveTranscript}
          interimTranscript={interimTranscript}
          captionStatus={captionStatus}
          start={startRecording}
          pause={pauseRecording}
          resume={resumeRecording}
          stop={stopRecording}
          processRecording={processRecording}
          processing={processing}
          fileInputRef={fileInputRef}
          handleUpload={handleUpload}
          resetRecording={resetRecording}
        />
      )}

      {modal === "note" && activeLectureNote && (
        <FunctionalNoteModal
          lecture={activeLectureNote}
          course={activeLectureNote.courseId ? courseMap.get(activeLectureNote.courseId) : undefined}
          timezone={dashboardData.timezone}
          close={() => setModal(null)}
          onNoteUpdated={(note) => {
            setActiveLectureNote((prev) => (prev ? { ...prev, note } : null));
          }}
          onStudyLab={() => {
            setModal(null);
            navigate("study-lab");
          }}
          onAskAssistant={() => {
            setModal(null);
            setSelectedChatLectureId(activeLectureNote.id);
            navigate("assistant");
            setTimeout(
              () =>
                askAssistant(
                  `Explain the central concept and main takeaways from ${activeLectureNote.title}`,
                  activeLectureNote.id
                ),
              50
            );
          }}
        />
      )}

      {processing && !modal && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#17132d]/40">
          <div className="rounded-[28px] border border-[#e9e5ef] bg-white p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto size-8 animate-spin text-[#7259e8]" />
            <p className="mt-4 text-base font-extrabold text-[#17132d]">Processing Lecture…</p>
            <p className="mt-1 text-xs text-[#8a8494]">Uploading to private cloud storage and initializing transcription</p>
          </div>
        </div>
      )}

      {reviewModalOpen && <ReviewModal onClose={() => setReviewModalOpen(false)} />}

      <AppTour
        onNavigate={(next) => {
          setView(next as View);
          setSelectedCourseId(null);
        }}
        onOpenSidebar={() => setSidebarOpen(true)}
      />


      {toast && (
        <div
          role="status"
          className={`fixed bottom-24 left-1/2 z-[100] flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl px-4 py-3.5 text-white shadow-2xl lg:bottom-7 ${
            toast.tone === "error"
              ? "bg-[#7a2430]"
              : toast.tone === "info"
                ? "bg-[#2f2a4a]"
                : "bg-[#17132d]"
          }`}
        >
          <span className={`grid size-6 shrink-0 place-items-center rounded-full ${
            toast.tone === "error" ? "bg-[#c44b57]" : "bg-[#7259e8]"
          }`}>
            {toast.tone === "error" ? <X className="size-3.5" /> : <Check className="size-3.5" />}
          </span>
          <p className="pt-0.5 text-[11px] font-semibold leading-5">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="ml-auto text-white/50 hover:text-white" aria-label="Dismiss notification">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// 1. FUNCTIONAL NOTES VIEW
// -------------------------------------------------------------------------------------------------
function FunctionalNotesView({
  lectures,
  courses,
  timezone,
  search,
  onNote,
  onCapture,
  onOpenStudyLab,
}: {
  lectures: Stage6Lecture[];
  courses: Stage6Course[];
  timezone: string;
  search: string;
  onNote: (lecture: Stage6Lecture) => void;
  onCapture: () => void;
  onOpenStudyLab: () => void;
}) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const filteredLectures = useMemo(() => {
    return lectures.filter((lecture) => {
      const course = lecture.courseId ? courseMap.get(lecture.courseId) : undefined;
      const matchesCourse = selectedCourseFilter === "all" || lecture.courseId === selectedCourseFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        lecture.title.toLowerCase().includes(query) ||
        (course && `${course.code} ${course.title}`.toLowerCase().includes(query)) ||
        (lecture.transcript && lecture.transcript.toLowerCase().includes(query));
      return matchesCourse && matchesSearch;
    });
  }, [lectures, selectedCourseFilter, search, courseMap]);

  return (
    <div className="fade-up space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <TitleBlock
          eyebrow="KNOWLEDGE REPOSITORY"
          title="Lecture Notes Library"
          copy="Search, revisit, and turn your transcribed lectures into structured revision sets."
        />
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[#e5e1eb] bg-white p-1 shadow-sm">
            <button
              onClick={() => setLayout("grid")}
              className={`grid size-8 place-items-center rounded-lg transition ${
                layout === "grid" ? "bg-[#eeeaff] text-[#7259e8]" : "text-[#918b99]"
              }`}
              aria-label="Grid view"
            >
              <LayoutDashboard className="size-3.5" />
            </button>
            <button
              onClick={() => setLayout("list")}
              className={`grid size-8 place-items-center rounded-lg transition ${
                layout === "list" ? "bg-[#eeeaff] text-[#7259e8]" : "text-[#918b99]"
              }`}
              aria-label="List view"
            >
              <ListChecks className="size-3.5" />
            </button>
          </div>
          <button
            onClick={onCapture}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[11px] font-extrabold text-white shadow-sm hover:bg-[#6247de]"
          >
            <Plus className="size-4" /> Add lecture
          </button>
        </div>
      </div>

      {/* Dynamic Course Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          onClick={() => setSelectedCourseFilter("all")}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-[11px] font-extrabold transition ${
            selectedCourseFilter === "all"
              ? "bg-[#17132d] text-white shadow-sm"
              : "border border-[#e5e1ea] bg-white text-[#736d7b] hover:bg-[#faf9fe]"
          }`}
        >
          All courses ({lectures.length})
        </button>
        {courses.map((course) => {
          const count = lectures.filter((l) => l.courseId === course.id).length;
          return (
            <button
              key={course.id}
              onClick={() => setSelectedCourseFilter(course.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-[11px] font-extrabold transition ${
                selectedCourseFilter === course.id
                  ? "bg-[#7259e8] text-white shadow-sm"
                  : "border border-[#e5e1ea] bg-white text-[#736d7b] hover:bg-[#faf9fe]"
              }`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: course.color }} />
              {course.code} ({count})
            </button>
          );
        })}
      </div>

      {/* Results / Empty state */}
      {filteredLectures.length === 0 ? (
        lectures.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#dcd6e8] bg-white/70 p-12 text-center backdrop-blur-md">
            <FileText className="mx-auto size-10 text-[#7259e8]/50" />
            <h3 className="mt-4 text-base font-black text-[#17132d]">Your notes library is ready</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#868093]">
              Capture or upload your first lecture in Lecture Studio. StudyStation automatically transcribes the recording and organizes it into your notes.
            </p>
            <button
              onClick={onCapture}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-5 text-xs font-black text-white shadow-sm hover:bg-[#6247de]"
            >
              <Upload className="size-4" /> Upload your first lecture
            </button>
          </div>
        ) : (
          <EmptySearch query={search} />
        )
      ) : (
        <div
          className={`grid gap-4 ${
            layout === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
          }`}
        >
          {filteredLectures.map((lecture) => {
            const course = lecture.courseId ? courseMap.get(lecture.courseId) : undefined;
            const sourceLabel = lecture.sourceType === "document"
              ? "Document"
              : lecture.sourceType === "video"
                ? "Video"
                : lecture.sourceType === "audio"
                  ? "Audio"
                  : "Recording";

            return (
              <button
                key={lecture.id}
                onClick={() => onNote(lecture)}
                className={`group rounded-[24px] border border-[#e8e4f1] bg-white p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#cfc5f3] hover:shadow-[0_12px_30px_rgba(43,32,77,0.06)] ${
                  layout === "list" ? "sm:flex sm:items-center sm:gap-5" : ""
                }`}
              >
                <div className={`flex items-center justify-between ${layout === "list" ? "sm:w-48 sm:shrink-0" : ""}`}>
                  <span
                    className="rounded-lg px-2.5 py-1 text-[9px] font-black text-white"
                    style={{ backgroundColor: course?.color || "#7259e8" }}
                  >
                    {course?.code || "GENERAL"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-[#f3f0f7] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#6b6577]">
                      {sourceLabel}
                    </span>
                    {lecture.note && (
                      <span className="rounded-full bg-[#f3eeff] px-2 py-0.5 text-[9px] font-black text-[#7259e8]">
                        ✨ Notes ready
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        lecture.status === "ready"
                          ? "bg-[#def7ec] text-[#047857]"
                          : lecture.status === "processing"
                          ? "bg-[#fef3c7] text-[#92400e]"
                          : lecture.status === "failed"
                          ? "bg-[#fee2e2] text-[#991b1b]"
                          : "bg-[#f3f0f7] text-[#6b6577]"
                      }`}
                    >
                      {lecture.status}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    className={`text-[15px] font-extrabold text-[#17132d] group-hover:text-[#7259e8] ${
                      layout === "grid" ? "mt-4" : "mt-2 sm:mt-0"
                    }`}
                  >
                    {lecture.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#756f82]">
                    {lecture.note?.summary
                      ? lecture.note.summary
                    : lecture.sourceType === "document"
                    ? "Original document uploaded. Open this lecture to view the source file and generate study notes."
                    : lecture.transcript
                      ? lecture.transcript.slice(0, 160) + "…"
                      : lecture.status === "ready"
                      ? "Transcript indexed. Tap to explore structured takeaways and practice quizzes."
                      : "Processing lecture audio with Whisper AI."}
                  </p>

                  <div className="mt-4 flex items-center gap-3 border-t border-[#f2edf8] pt-3 text-[10px] font-bold text-[#918b9c]">
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3 text-[#7259e8]" /> {lecture.durationSeconds ? `${Math.round(lecture.durationSeconds / 60)} min` : sourceLabel}
                    </span>
                    <span>
                      {new Date(lecture.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: timezone || "UTC",
                      })}
                    </span>
                    <span className="ml-auto flex items-center gap-1 font-black text-[#7259e8]">
                      <Sparkles className="size-3" /> Study Lab
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// 2. FUNCTIONAL NOTE MODAL
// -------------------------------------------------------------------------------------------------
function FunctionalNoteModal({
  lecture,
  course,
  timezone,
  close,
  onStudyLab,
  onAskAssistant,
  onNoteUpdated,
}: {
  lecture: Stage6Lecture;
  course?: Stage6Course;
  timezone: string;
  close: () => void;
  onStudyLab: () => void;
  onAskAssistant: () => void;
  onNoteUpdated?: (note: OrganizedNoteData) => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState<OrganizedNoteData | null>(lecture.note ?? null);
  const [modalTab, setModalTab] = useState<"notes" | "transcript">(lecture.note ? "notes" : "notes");
  const [generating, setGenerating] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);

  async function generateNotes() {
    if (!lecture.transcript) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/lectures/${lecture.id}/notes`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to organize lecture notes.");
      }
      setNote(data.note);
      setModalTab("notes");
      onNoteUpdated?.(data.note);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate organized notes.");
    } finally {
      setGenerating(false);
    }
  }

  function copyTranscript() {
    if (!lecture.transcript) return;
    navigator.clipboard.writeText(lecture.transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  }

  function copyNoteMarkdown() {
    if (!note) return;
    const md = formatNoteMarkdown(note, lecture.title, course?.title);
    navigator.clipboard.writeText(md);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  }

  function exportNotePdf() {
    if (!note) return;
    try {
      exportNoteToPdf(note, lecture.title, course?.title);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not export PDF.");
    }
  }

  function downloadNoteMarkdown() {
    if (!note) return;
    const md = formatNoteMarkdown(note, lecture.title, course?.title);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lecture.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-study-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTranscript() {
    if (!lecture.transcript) return;
    const blob = new Blob(
      [
        `Lecture: ${lecture.title}\nCourse: ${course ? `${course.code} - ${course.title}` : "General"}\nDate: ${lecture.createdAt}\n\n=== TRANSCRIPT ===\n\n${lecture.transcript}`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lecture.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#17132d]/60 p-3 backdrop-blur-sm sm:p-5">
      <div className="my-auto max-h-[92vh] w-full max-w-[960px] overflow-hidden rounded-[30px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ece8f2] px-6 py-4.5 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <span
              className="rounded-lg px-2.5 py-1 text-[10px] font-black text-white"
              style={{ backgroundColor: course?.color || "#7259e8" }}
            >
              {course?.code || "NOTE"}
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-[#17132d]">{lecture.title}</h2>
              <p className="mt-0.5 text-[10px] text-[#868093]">
                {course ? course.title : "Unassigned course"} ·{" "}
                {new Date(lecture.createdAt).toLocaleDateString("en-US", { timeZone: timezone || "UTC" })}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="grid size-9 place-items-center rounded-xl bg-[#f4f2f7] hover:bg-[#eae6f0]"
            aria-label="Close note"
          >
            <X className="size-4 text-[#443e52]" />
          </button>
        </div>

        {/* Modal Tabs */}
        {lecture.transcript && (
          <div className="flex items-center justify-between border-b border-[#ece8f2] px-6 sm:px-8 bg-white">
            <div className="flex gap-2">
              <button
                onClick={() => setModalTab("notes")}
                className={`flex items-center gap-2 border-b-2 py-3 text-xs font-black transition ${
                  modalTab === "notes"
                    ? "border-[#7259e8] text-[#7259e8]"
                    : "border-transparent text-[#7a7486] hover:text-[#17132d]"
                }`}
              >
                <Sparkles className="size-3.5" />
                Generated Notes
                {note && (
                  <span className="rounded-full bg-[#10b981]/15 px-2 py-0.5 text-[9px] font-black text-[#047857]">
                    Ready
                  </span>
                )}
              </button>
              <button
                onClick={() => setModalTab("transcript")}
                className={`flex items-center gap-2 border-b-2 py-3 text-xs font-black transition ${
                  modalTab === "transcript"
                    ? "border-[#7259e8] text-[#7259e8]"
                    : "border-transparent text-[#7a7486] hover:text-[#17132d]"
                }`}
              >
                <FileText className="size-3.5" />
                {lecture.sourceType === "document" ? "Original File" : "Transcript"}
              </button>
            </div>
            {note && (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={exportNotePdf}
                  className="flex items-center gap-1.5 rounded-lg border border-[#cfc4f6] bg-[#f5f2ff] px-2.5 py-1 text-[10px] font-black text-[#7259e8] shadow-sm hover:bg-[#eae3fc]"
                >
                  <FileDown className="size-3" />
                  Export PDF
                </button>
                <button
                  onClick={copyNoteMarkdown}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e1eb] bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#534e60] shadow-sm hover:bg-[#faf9fe]"
                >
                  {copiedNote ? <Check className="size-3 text-[#10b981]" /> : <Copy className="size-3" />}
                  {copiedNote ? "Copied Markdown" : "Copy Markdown"}
                </button>
                <button
                  onClick={generateNotes}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg bg-[#f3eeff] px-2.5 py-1 text-[10px] font-extrabold text-[#7259e8] hover:bg-[#eae3fc] disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 ${generating ? "animate-spin" : ""}`} />
                  {generating ? "Updating..." : "Regenerate"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content body */}
        <div className="grid max-h-[calc(92vh-120px)] overflow-y-auto lg:grid-cols-[1fr_250px]">
          <div className="p-6 sm:p-8 space-y-6">
            {/* Audio Recording Player or Document Card */}
            {lecture.sourceType === "document" ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[#e4ddfa] bg-[#faf8ff] p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-[#ede8ff] text-[#7259e8]">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1e1730]">Document Lecture Material</p>
                  <p className="text-[10px] text-[#7e778b]">Extracted directly into study notes, flashcards, and quizzes</p>
                </div>
                {lecture.mediaUrl && (
                  <a
                    href={lecture.mediaUrl || `/api/lectures/${lecture.id}/media`}
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
                src={`/api/lectures/${lecture.id}/media`}
                title={lecture.title}
                variant="card"
              />
            )}

            {modalTab === "notes" ? (
              note ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between sm:hidden">
                    <button
                      onClick={generateNotes}
                      disabled={generating}
                      className="flex items-center gap-1.5 rounded-lg bg-[#f3eeff] px-3 py-1.5 text-[11px] font-black text-[#7259e8]"
                    >
                      <RefreshCw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
                      {generating ? "Organizing with AI..." : "Regenerate Notes"}
                    </button>
                  </div>
                  <OrganizedNotesDisplay note={note} />
                </div>
              ) : lecture.transcript ? (
                <div className="rounded-3xl border-2 border-dashed border-[#dcd6e8] bg-gradient-to-br from-[#faf9fe] to-[#f4f0ff] p-8 text-center sm:p-10">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eeeaff] text-[#7259e8] shadow-sm">
                    <Sparkles className="size-7" />
                  </div>
                  <h4 className="mt-4 text-base font-black text-[#17132d]">
                    Organize this lecture into structured notes
                  </h4>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#736d7e]">
                    Our AI will analyze the transcription and extract an executive summary, definitions of core terms, section-by-section lecture breakdowns, key exam takeaways, and active recall study questions.
                  </p>
                  <button
                    onClick={generateNotes}
                    disabled={generating}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#7259e8] px-6 py-3 text-xs font-black text-white shadow-lg shadow-[#7259e8]/25 hover:bg-[#6247de] disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Analyzing & organizing notes...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Generate Organized Notes with AI
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#ece8f2] p-8 text-center bg-[#faf9fc]">
                  <Clock3 className="mx-auto size-8 text-[#9b95a5]" />
                  <h4 className="mt-3 text-sm font-extrabold text-[#17132d]">Transcript status: {lecture.status}</h4>
                  <p className="mt-1 text-xs text-[#827c8e]">
                    {lecture.status === "processing"
                      ? "Audio is currently being transcribed with Whisper AI. Please check back shortly."
                      : "No transcript generated yet for this recording. You can retry it from Lecture Studio."}
                  </p>
                </div>
              )
            ) : (
              /* Raw transcript tab */
              lecture.sourceType === "document" ? (
                <div className="overflow-hidden rounded-2xl border border-[#e4ddfa] bg-[#faf8ff]">
                  <iframe title={`Original file: ${lecture.title}`} src={lecture.mediaUrl || `/api/lectures/${lecture.id}/media`} className="h-[min(65vh,700px)] w-full bg-white" />
                </div>
              ) : lecture.transcript ? (
                <div className="rounded-2xl bg-[#f7f5ff] p-5 border border-[#e4ddfa]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[11px] font-extrabold text-[#7259e8]">
                      <Sparkles className="size-4" /> Whisper AI Transcript
                    </span>
                    <button
                      onClick={copyTranscript}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-[#7259e8] shadow-sm hover:bg-[#faf9fe]"
                    >
                      {copiedTranscript ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copiedTranscript ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-3.5 max-h-[460px] overflow-y-auto rounded-xl bg-white p-4 text-[13px] leading-relaxed text-[#3a3447] border border-[#ece8f5] whitespace-pre-wrap">
                    {lecture.transcript}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#ece8f2] p-8 text-center bg-[#faf9fc]">
                  <Clock3 className="mx-auto size-8 text-[#9b95a5]" />
                  <h4 className="mt-3 text-sm font-extrabold text-[#17132d]">Transcript status: {lecture.status}</h4>
                  <p className="mt-1 text-xs text-[#827c8e]">
                    {lecture.status === "processing"
                      ? "Audio is currently being transcribed with Whisper AI. Please check back shortly."
                      : "No transcript generated yet for this recording. You can retry it from Lecture Studio."}
                  </p>
                </div>
              )
            )}
          </div>

          {/* Modal Sidebar Actions */}
          <aside className="border-t border-[#ece8f2] bg-[#faf9fc] p-6 lg:border-l lg:border-t-0 space-y-4">
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#868093]">Actions</p>

            {/* Note generation / regeneration action */}
            {lecture.transcript && (
              <button
                onClick={generateNotes}
                disabled={generating}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm border border-[#ece8f2] hover:border-[#cfc6f4] transition disabled:opacity-50"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                  <Sparkles className={`size-4 ${generating ? "animate-spin" : ""}`} />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold text-[#17132d]">
                    {note ? "Regenerate AI Notes" : "Generate AI Notes"}
                  </p>
                  <p className="text-[9px] text-[#868093]">
                    {note ? "Re-structure with AI" : "Organize into notes"}
                  </p>
                </div>
              </button>
            )}

            {note && (
              <>
                <button
                  onClick={exportNotePdf}
                  className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-white to-[#fbfaff] p-3.5 text-left shadow-sm border border-[#cfc6f4] hover:border-[#7259e8] transition"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                    <FileDown className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-extrabold text-[#17132d]">Export PDF Guide</p>
                    <p className="text-[9px] text-[#868093]">Download printable study guide</p>
                  </div>
                </button>

                <button
                  onClick={downloadNoteMarkdown}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm border border-[#ece8f2] hover:border-[#cfc6f4] transition"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-[#def7ec] text-[#047857]">
                    <Download className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-extrabold text-[#17132d]">Download Study Notes</p>
                    <p className="text-[9px] text-[#868093]">Export structured .md file</p>
                  </div>
                </button>
              </>
            )}

            <button
              onClick={onStudyLab}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm border border-[#ece8f2] hover:border-[#cfc6f4] transition"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                <Layers3 className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-extrabold text-[#17132d]">AI Study Lab</p>
                <p className="text-[9px] text-[#868093]">Generate quizzes & flashcards</p>
              </div>
            </button>

            <button
              onClick={onAskAssistant}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm border border-[#ece8f2] hover:border-[#cfc6f4] transition"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                <MessageSquareText className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-extrabold text-[#17132d]">Ask StudyStation</p>
                <p className="text-[9px] text-[#868093]">Ask questions on this lecture</p>
              </div>
            </button>

            <button
              onClick={downloadTranscript}
              disabled={!lecture.transcript}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm border border-[#ece8f2] hover:border-[#cfc6f4] transition disabled:opacity-40"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-[#f0edf5] text-[#554e63]">
                <Download className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-extrabold text-[#17132d]">Download Transcript</p>
                <p className="text-[9px] text-[#868093]">Save raw text document</p>
              </div>
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// 3. FUNCTIONAL FLASHCARDS VIEW
// -------------------------------------------------------------------------------------------------
function FunctionalFlashcardsView({
  courses,
  lectures,
  progress,
  onOpenStudyLab,
}: {
  courses: Stage6Course[];
  lectures: Stage6Lecture[];
  progress: PlannerData["progress"];
  onOpenStudyLab: () => void;
}) {
  return (
    <div className="fade-up space-y-6">
      <TitleBlock
        eyebrow="ACTIVE RECALL & SPACED RETENTION"
        title="Flashcard Decks"
        copy="Practice your lecture concepts at the optimal time to reinforce long-term memory."
      />

      {/* Progress Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ready Lectures", `${progress.processedLectures}`, "Available for revision", BookOpen, "#eeeaff", "#7259e8"],
          ["Completed Tasks", `${progress.completedTasks}`, "Total semester tasks", Check, "#def7ec", "#047857"],
          ["Saved Quiz Attempts", `${progress.quizAttempts}`, "Graded attempts", Target, "#fff0c7", "#9a6a09"],
          [
            "Quiz Average",
            progress.recentQuizAverage !== null ? `${progress.recentQuizAverage}%` : "—",
            "Last 10 quizzes",
            Sparkles,
            "#fce7f3",
            "#be185d",
          ],
        ].map(([label, val, sub, Icon, bg, color]) => (
          <div key={label as string} className="glass-panel rounded-2xl p-4.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#868093]">{label as string}</span>
              <span
                className="grid size-8 place-items-center rounded-xl text-white text-[10px]"
                style={{ backgroundColor: color as string }}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-[#17132d]">{val as string}</p>
            <p className="mt-1 text-[10px] text-[#868093]">{sub as string}</p>
          </div>
        ))}
      </div>

      <GeneratedFlashcardsLibrary onOpenStudyLab={onOpenStudyLab} />

      {/* Course Decks List */}
      <div>
        <h3 className="text-sm font-extrabold text-[#17132d]">Your Course Decks</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const courseLectures = lectures.filter((l) => l.courseId === course.id);
            return (
              <div key={course.id} className="glass-panel rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-lg px-2.5 py-1 text-[9px] font-black text-white"
                    style={{ backgroundColor: course.color }}
                  >
                    {course.code}
                  </span>
                  <span className="text-[10px] font-bold text-[#868093]">{courseLectures.length} lectures</span>
                </div>
                <h4 className="mt-3 text-sm font-extrabold text-[#17132d]">{course.title}</h4>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={onOpenStudyLab}
                    className="flex-1 rounded-xl bg-[#eeeaff] py-2 text-[10px] font-extrabold text-[#7259e8] hover:bg-[#e4ddff]"
                  >
                    Generate Cards
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// 4. FUNCTIONAL ASSISTANT VIEW (Ask StudyStation)
// -------------------------------------------------------------------------------------------------
function FunctionalAssistantView({
  studentName,
  lectures,
  courses,
  selectedLectureId,
  setSelectedLectureId,
  messages,
  input,
  setInput,
  loading,
  ask,
}: {
  studentName: string;
  lectures: Stage6Lecture[];
  courses: Stage6Course[];
  selectedLectureId: string;
  setSelectedLectureId: (id: string) => void;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  ask: (question?: string) => void;
}) {
  const readyLectures = useMemo(() => lectures.filter((l) => l.status === "ready"), [lectures]);

  return (
    <div className="fade-up mx-auto max-w-[1040px] space-y-6">
      <div className="flex items-end justify-between">
        <TitleBlock
          eyebrow="GROUNDED IN YOUR REAL COURSEWORK"
          title="Ask StudyStation"
          copy="Get clear, cited answers and explanations based strictly on the lectures and materials you have captured."
        />
        <span className="hidden items-center gap-1.5 rounded-full bg-[#def7ec] px-3.5 py-1.5 text-[10px] font-extrabold text-[#047857] sm:flex">
          <i className="size-2 rounded-full bg-[#10b981]" /> {courses.length} courses · {readyLectures.length} lectures connected
        </span>
      </div>

      <div className="grid min-h-[640px] overflow-hidden rounded-[28px] border border-[#e5e1e9] bg-white shadow-sm lg:grid-cols-[240px_1fr]">
        {/* Source Sidebar */}
        <aside className="hidden border-r border-[#ece8f0] bg-[#faf9fd] p-5 lg:block space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#868093]">Knowledge Focus</p>
            <select
              value={selectedLectureId}
              onChange={(e) => setSelectedLectureId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#ded8ea] bg-white px-2.5 py-2 text-[11px] font-bold text-[#17132d] outline-none"
            >
              <option value="all">All course materials</option>
              {readyLectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#868093]">Active Courses</p>
            <div className="mt-2 space-y-1.5">
              {courses.map((course) => (
                <div key={course.id} className="flex items-center gap-2 rounded-lg bg-white p-2 border border-[#eeeaf5]">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: course.color }} />
                  <span className="truncate text-[10px] font-extrabold text-[#17132d]">{course.code}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#eeeaff] p-3 text-[10px] text-[#5540b8]">
            <p className="font-extrabold">Accurate Citations</p>
            <p className="mt-1 leading-4">
              Answers cite your actual lecture titles and course notes. Critical facts should always be checked against course slides.
            </p>
          </div>
        </aside>

        {/* Chat Thread */}
        <div className="flex min-w-0 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 max-h-[500px]">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && (
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-[#7259e8] to-[#9b83ff] text-white shadow-sm">
                    <Sparkles className="size-4" />
                  </span>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#17132d] text-white"
                      : "rounded-bl-md bg-[#f4f1fb] text-[#2c2638] border border-[#e8e4f1]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.citation && (
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-[#ded6ee] pt-2">
                      <span className="rounded-md bg-white px-2 py-0.5 text-[9px] font-black text-[#7259e8] shadow-xs">
                        [Citation: {message.citation}]
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#7259e8] text-white">
                  <Sparkles className="size-4" />
                </span>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-[#f4f1fb] px-4 py-3.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-[#7259e8]"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat Inputs */}
          <div className="border-t border-[#ece8f0] p-3 sm:p-4 bg-white">
            <div className="mb-2.5 flex gap-2 overflow-x-auto hide-scrollbar">
              {[
                "Summarize main concepts from my lectures",
                "Explain like I'm new to this subject",
                "Generate 3 practice recall questions",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="whitespace-nowrap rounded-lg border border-[#e4e0e9] bg-[#faf9fd] px-3 py-1.5 text-[10px] font-bold text-[#6a6378] hover:border-[#7259e8] hover:text-[#7259e8] transition"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="flex items-end gap-2 rounded-2xl border border-[#ded8e8] bg-[#faf9fd] p-2 focus-within:border-[#7259e8] focus-within:bg-white"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                rows={1}
                placeholder="Ask StudyStation anything about your coursework…"
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[12px] outline-none placeholder:text-[#aaa4b1]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#7259e8] text-white disabled:opacity-40 hover:bg-[#6247df] transition"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
