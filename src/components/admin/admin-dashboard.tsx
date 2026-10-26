"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  FileText,
  Sparkles,
  Star,
  Activity,
  Radio,
  Search,
  RefreshCw,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Trash2,
  Eye,
  Download,
  Server,
  Layers,
  ChevronRight,
  X,
  Play,
  Volume2,
  FileCode,
  Globe,
  Filter,
  ShieldAlert,
  MessageSquare,
  CornerDownRight,
  Mail,
  Check,
} from "lucide-react";

type OverviewData = {
  metrics: {
    totalStudents: number;
    onboardedStudents: number;
    pendingOnboarding: number;
    tourCompleted: number;
    totalLectures: number;
    lecturesByStatus: { ready: number; processing: number; uploaded: number; failed: number };
    lecturesBySource: { recording: number; audio: number; video: number; document: number; link: number };
    totalAudioMinutes: number;
    totalNotes: number;
    totalAiGenerations: number;
    completedAiGenerations: number;
    failedAiGenerations: number;
    aiSuccessRate: number;
    aiByTask: { summary: number; quiz: number; flashcards: number; question: number };
    totalStudyGroups: number;
    totalReviews: number;
    averageRating: number;
    ratingBreakdown: Record<string, number>;
  };
  recent: {
    signups: Array<{
      id: string;
      full_name: string;
      university: string | null;
      country_name: string | null;
      created_at: string;
      onboarding_complete: boolean;
    }>;
    lectures: Array<{
      id: string;
      title: string;
      source_type: string;
      status: string;
      duration_seconds: number | null;
      created_at: string;
    }>;
  };
  system: {
    databaseOnline: boolean;
    dbLatencyMs: number;
    storageOnline: boolean;
    geminiConfigured: boolean;
    openRouterConfigured: boolean;
    nodeEnv: string;
    serverTimestamp: string;
  };
};

type Student = {
  id: string;
  fullName: string;
  email: string;
  university: string;
  degree: string;
  academicLevel: string;
  countryName: string;
  onboardingComplete: boolean;
  workspaceTourCompleted: boolean;
  lecturesCount: number;
  lastSignIn: string | null;
  createdAt: string;
};

type LectureItem = {
  id: string;
  userId: string;
  studentName: string;
  studentUniversity: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  storagePath: string | null;
  durationSeconds: number | null;
  status: string;
  hasNotes: boolean;
  processingError: string | null;
  createdAt: string;
};

type AiRun = {
  id: string;
  ownerId: string;
  ownerName: string;
  task: string;
  status: string;
  model: string;
  errorCode: string | null;
  createdAt: string;
};

type Review = {
  id: string;
  display_name: string;
  university: string | null;
  rating: number;
  review: string;
  created_at: string;
  admin_reply?: string | null;
  admin_reply_at?: string | null;
  admin_reply_by?: string | null;
};

type ModerationReport = {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  groupId: string;
  groupName: string;
  messageId: string | null;
  details: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  adminNotes: string | null;
};

type SystemDiagnostics = {
  database: { status: string; latencyMs: number };
  storage: { status: string; sampleFilesCount: number };
  memory: { rssMb: number; heapTotalMb: number; heapUsedMb: number };
  uptimeSeconds: number;
  envAudit: Record<string, unknown>;
  timestamp: string;
};

type LectureDetail = {
  lecture: {
    id: string;
    title: string;
    source_type: string;
    status: string;
    duration_seconds: number | null;
    transcript: string | null;
    mediaUrl: string | null;
    studentName: string;
    studentUniversity: string;
    created_at: string;
    processing_error: string | null;
  };
  note: {
    title: string;
    summary: string;
    content: {
      overview: string;
      keyTerms?: Array<{ term: string; definition: string }>;
      takeaways?: string[];
    };
  } | null;
};

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "students" | "lectures" | "ai" | "reviews" | "reports" | "broadcast" | "system"
  >("overview");

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRun[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "resolved" | "dismissed">("all");
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);

  // Review reply state & modal
  const [replyModalReview, setReplyModalReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Search & Filter states
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const [lectureSearch, setLectureSearch] = useState("");
  const [lectureStatusFilter, setLectureStatusFilter] = useState("all");
  const [lectureSourceFilter, setLectureSourceFilter] = useState("all");

  // Modals
  const [inspectLectureId, setInspectLectureId] = useState<string | null>(null);
  const [inspectLectureData, setInspectLectureData] = useState<LectureDetail | null>(null);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // Broadcast Announcement Form
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "user">("all");
  const [broadcastTargetUserId, setBroadcastTargetUserId] = useState<string>("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastType, setBroadcastType] = useState("announcement");
  const [broadcasting, setBroadcasting] = useState(false);

  // Delete lecture confirm
  const [deleteConfirmLecture, setDeleteConfirmLecture] = useState<LectureItem | null>(null);
  const [deletingLecture, setDeletingLecture] = useState(false);

  // Show banner alert
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4500);
  };

  // Fetch overview
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (data.metrics) setOverview(data);
    } catch (err) {
      console.error("Overview error", err);
    }
  }, [router]);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (studentSearch) params.set("q", studentSearch);
      if (studentFilter !== "all") params.set("filter", studentFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.users) setStudents(data.users);
    } catch (err) {
      console.error("Students error", err);
    }
  }, [studentSearch, studentFilter]);

  // Fetch lectures
  const fetchLectures = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lectureSearch) params.set("q", lectureSearch);
      if (lectureStatusFilter !== "all") params.set("status", lectureStatusFilter);
      if (lectureSourceFilter !== "all") params.set("source", lectureSourceFilter);

      const res = await fetch(`/api/admin/lectures?${params.toString()}`);
      const data = await res.json();
      if (data.lectures) setLectures(data.lectures);
    } catch (err) {
      console.error("Lectures error", err);
    }
  }, [lectureSearch, lectureStatusFilter, lectureSourceFilter]);

  // Fetch AI runs
  const fetchAiRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-generations?limit=60");
      const data = await res.json();
      if (data.items) setAiRuns(data.items);
    } catch (err) {
      console.error("AI error", err);
    }
  }, []);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reviews");
      const data = await res.json();
      if (data.reviews) setReviews(data.reviews);
    } catch (err) {
      console.error("Reviews error", err);
    }
  }, []);

  // Fetch moderation reports
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch (err) {
      console.error("Reports error", err);
    }
  }, []);

  // Fetch system diagnostics
  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system");
      const data = await res.json();
      if (data.diagnostics) setDiagnostics(data.diagnostics);
    } catch (err) {
      console.error("Diagnostics error", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchOverview(),
        fetchStudents(),
        fetchLectures(),
        fetchAiRuns(),
        fetchReviews(),
        fetchReports(),
        fetchDiagnostics(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [fetchOverview, fetchStudents, fetchLectures, fetchAiRuns, fetchReviews, fetchReports, fetchDiagnostics]);

  // Refresh active tab
  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "overview") await fetchOverview();
    else if (activeTab === "students") await fetchStudents();
    else if (activeTab === "lectures") await fetchLectures();
    else if (activeTab === "ai") await fetchAiRuns();
    else if (activeTab === "reviews") await fetchReviews();
    else if (activeTab === "reports") await fetchReports();
    else if (activeTab === "system") await fetchDiagnostics();
    setRefreshing(false);
    showToast("Data refreshed.");
  };

  // Sign out
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    }
  };

  // Inspect lecture
  const handleInspectLecture = async (id: string) => {
    setInspectLectureId(id);
    setLoadingInspect(true);
    setInspectLectureData(null);
    try {
      const res = await fetch(`/api/admin/lectures/${id}`);
      const data = await res.json();
      if (data.lecture) {
        setInspectLectureData(data);
      } else {
        showToast("Lecture details could not be loaded.", "error");
      }
    } catch {
      showToast("Failed to fetch lecture.", "error");
    } finally {
      setLoadingInspect(false);
    }
  };

  // Delete lecture
  const handleDeleteLecture = async () => {
    if (!deleteConfirmLecture) return;
    setDeletingLecture(true);
    try {
      const res = await fetch(`/api/admin/lectures/${deleteConfirmLecture.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Lecture deleted successfully.");
        setDeleteConfirmLecture(null);
        await Promise.all([fetchLectures(), fetchOverview()]);
      } else {
        showToast(data.error || "Could not delete lecture.", "error");
      }
    } catch {
      showToast("Error deleting lecture.", "error");
    } finally {
      setDeletingLecture(false);
    }
  };

  // Delete review
  const handleDeleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to remove this review?")) return;
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Review deleted.");
        await Promise.all([fetchReviews(), fetchOverview()]);
      } else {
        showToast("Failed to delete review.", "error");
      }
    } catch {
      showToast("Failed to delete review.", "error");
    }
  };

  // Review reply handlers
  const openReplyModal = (r: Review) => {
    setReplyModalReview(r);
    setReplyText(r.admin_reply || "");
  };

  const handleSaveReviewReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyModalReview || !replyText.trim()) return;
    setSavingReply(true);
    try {
      const res = await fetch("/api/admin/reviews/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: replyModalReview.id,
          replyText: replyText.trim(),
          adminEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Official reply published and now live on the landing page!");
        setReplyModalReview(null);
        setReplyText("");
        await fetchReviews();
      } else {
        showToast(data.error || "Failed to save reply.", "error");
      }
    } catch {
      showToast("Failed to save reply.", "error");
    } finally {
      setSavingReply(false);
    }
  };

  const handleDeleteReviewReply = async (reviewId: string) => {
    if (!confirm("Remove the official admin reply to this review?")) return;
    setSavingReply(true);
    try {
      const res = await fetch("/api/admin/reviews/reply", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Official reply removed.");
        await fetchReviews();
      } else {
        showToast(data.error || "Failed to remove reply.", "error");
      }
    } catch {
      showToast("Failed to remove reply.", "error");
    } finally {
      setSavingReply(false);
    }
  };

  // Moderation Report actions
  const handleUpdateReportStatus = async (reportId: string, status: "pending" | "resolved" | "dismissed") => {
    setUpdatingReportId(reportId);
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, status }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(`Report marked as ${status}.`);
        await fetchReports();
      } else {
        showToast(data.error || "Failed to update report.", "error");
      }
    } catch {
      showToast("Error updating report.", "error");
    } finally {
      setUpdatingReportId(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this concern report?")) return;
    setUpdatingReportId(reportId);
    try {
      const res = await fetch(`/api/reports?id=${reportId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Report deleted.");
        await fetchReports();
      } else {
        showToast(data.error || "Failed to delete report.", "error");
      }
    } catch {
      showToast("Error deleting report.", "error");
    } finally {
      setUpdatingReportId(null);
    }
  };

  // Broadcast Announcement
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast("Title and message body are required.", "error");
      return;
    }
    setBroadcasting(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: broadcastTarget,
          userId: broadcastTarget === "user" ? broadcastTargetUserId : undefined,
          title: broadcastTitle,
          body: broadcastBody,
          type: broadcastType,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(`Broadcast sent to ${data.recipientCount} student(s)!`);
        setBroadcastTitle("");
        setBroadcastBody("");
      } else {
        showToast(data.error || "Failed to broadcast message.", "error");
      }
    } catch {
      showToast("Failed to broadcast message.", "error");
    } finally {
      setBroadcasting(false);
    }
  };

  // Export CSV helpers
  const exportStudentsCsv = () => {
    const headers = ["ID", "Full Name", "Email", "University", "Country", "Lectures", "Onboarded", "Created At"];
    const rows = students.map((s) => [
      s.id,
      `"${s.fullName.replace(/"/g, '""')}"`,
      s.email,
      `"${s.university.replace(/"/g, '""')}"`,
      `"${s.countryName.replace(/"/g, '""')}"`,
      s.lecturesCount,
      s.onboardingComplete ? "Yes" : "No",
      s.createdAt,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `studystation-students-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportLecturesCsv = () => {
    const headers = ["ID", "Title", "Student", "Source", "Status", "Duration (s)", "Created At"];
    const rows = lectures.map((l) => [
      l.id,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.studentName.replace(/"/g, '""')}"`,
      l.sourceType,
      l.status,
      l.durationSeconds || 0,
      l.createdAt,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `studystation-lectures-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const formatSeconds = (sec: number | null | undefined) => {
    if (!sec || isNaN(sec)) return "—";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#07090F] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`fixed top-5 right-5 z-[150] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            actionMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200"
              : "bg-red-950/90 border-red-500/30 text-red-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0B0E17]/80 backdrop-blur-md border-b border-white/[0.08] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black text-white text-base">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">StudyStation</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Command Center
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Master Platform Intelligence & Administration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Link to Main App */}
          <Link
            href="/app"
            target="_blank"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Student App</span>
          </Link>

          {/* Admin profile pill */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              Ω
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-white leading-tight truncate max-w-[180px]">{adminEmail}</p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Super Admin
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 bg-[#090C14] border-b lg:border-b-0 lg:border-r border-white/[0.06] p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible shrink-0">
          {[
            { id: "overview", label: "Overview", icon: Activity, count: null },
            { id: "students", label: "Students", icon: Users, count: overview?.metrics?.totalStudents ?? (students.length > 0 ? students.length : null) },
            { id: "lectures", label: "Lectures & Audio", icon: FileText, count: overview?.metrics?.totalLectures ?? (lectures.length > 0 ? lectures.length : null) },
            { id: "ai", label: "AI Engine", icon: Sparkles, count: overview?.metrics?.totalAiGenerations ?? (aiRuns.length > 0 ? aiRuns.length : null) },
            { id: "reviews", label: "Reviews", icon: Star, count: overview?.metrics?.totalReviews ?? (reviews.length > 0 ? reviews.length : null) },
            {
              id: "reports",
              label: "Concern Reports",
              icon: ShieldAlert,
              count: reports.filter((r) => r.status === "pending").length > 0 ? reports.filter((r) => r.status === "pending").length : null,
              alert: reports.some((r) => r.status === "pending"),
            },
            { id: "broadcast", label: "Announcements", icon: Radio, count: null },
            { id: "system", label: "System Health", icon: Server, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-white border border-indigo-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${tab.alert && !isActive ? "text-amber-400" : isActive ? "text-indigo-400" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== null && tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tab.alert
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                        : isActive
                        ? "bg-indigo-500/30 text-indigo-200"
                        : "bg-white/[0.05] text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="hidden lg:block mt-auto p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Database:</span>
              <span className="text-emerald-400 font-semibold">Online ({overview?.system.dbLatencyMs ?? 0}ms)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Storage:</span>
              <span className="text-emerald-400 font-semibold">Mounted</span>
            </div>
            <div className="flex items-center justify-between">
              <span>AI Engine:</span>
              <span className="text-indigo-400 font-semibold">Gemini 2.5</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">System Overview & Intelligence</h1>
                <p className="text-xs text-slate-400 mt-1">Real-time statistics across all registered university students and content</p>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Students */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-5 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Students</span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {overview?.metrics?.totalStudents ?? (students.length > 0 ? students.length : "—")}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-semibold">
                      {overview?.metrics?.onboardedStudents ?? students.filter((s) => s.onboardingComplete).length} onboarded
                    </span>
                    <span>•</span>
                    <span>
                      {overview?.metrics?.pendingOnboarding ?? students.filter((s) => !s.onboardingComplete).length} pending
                    </span>
                  </div>
                </div>

                {/* Total Lectures */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-5 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lectures & Media</span>
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {overview?.metrics.totalLectures ?? "—"}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="text-purple-300 font-semibold">{overview?.metrics.totalAudioMinutes ?? 0} mins recorded</span>
                    <span>•</span>
                    <span>{overview?.metrics.totalNotes ?? 0} AI notes</span>
                  </div>
                </div>

                {/* AI Generations */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-5 backdrop-blur-xl relative overflow-hidden group hover:border-pink-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Generations</span>
                    <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {overview?.metrics.totalAiGenerations ?? "—"}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-semibold">{overview?.metrics.aiSuccessRate ?? 100}% success</span>
                    <span>•</span>
                    <span>{overview?.metrics.completedAiGenerations ?? 0} completed</span>
                  </div>
                </div>

                {/* Student Satisfaction */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-5 backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Rating</span>
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Star className="w-4 h-4 fill-amber-400" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {overview?.metrics.averageRating ? `${overview.metrics.averageRating} ★` : "5.0 ★"}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="text-amber-300 font-semibold">{overview?.metrics.totalReviews ?? 0} reviews</span>
                    <span>•</span>
                    <span>{overview?.metrics.totalStudyGroups ?? 0} study groups</span>
                  </div>
                </div>
              </div>

              {/* Analytics Section: Sources & Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Lecture Sources Breakdown */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-6 backdrop-blur-xl">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Lecture Content Sources
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Live Recordings", count: overview?.metrics.lecturesBySource.recording || 0, color: "bg-indigo-500" },
                      { label: "Audio Files Uploaded", count: overview?.metrics.lecturesBySource.audio || 0, color: "bg-purple-500" },
                      { label: "Document Materials (PDF / PPTX)", count: overview?.metrics.lecturesBySource.document || 0, color: "bg-blue-500" },
                      { label: "Video Files", count: overview?.metrics.lecturesBySource.video || 0, color: "bg-pink-500" },
                      { label: "External Links", count: overview?.metrics.lecturesBySource.link || 0, color: "bg-emerald-500" },
                    ].map((item) => {
                      const total = overview?.metrics.totalLectures || 1;
                      const percent = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{item.label}</span>
                            <span className="font-semibold text-white">
                              {item.count} <span className="text-slate-500">({percent}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Tasks Breakdown */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-6 backdrop-blur-xl">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    AI Generation Tasks
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Summaries & Structured Notes", count: overview?.metrics.aiByTask.summary || 0, color: "bg-indigo-500" },
                      { label: "Practice Quizzes & MCQs", count: overview?.metrics.aiByTask.quiz || 0, color: "bg-purple-500" },
                      { label: "Spaced Repetition Flashcards", count: overview?.metrics.aiByTask.flashcards || 0, color: "bg-pink-500" },
                      { label: "Study Questions & Explanations", count: overview?.metrics.aiByTask.question || 0, color: "bg-amber-500" },
                    ].map((item) => {
                      const total = overview?.metrics.totalAiGenerations || 1;
                      const percent = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{item.label}</span>
                            <span className="font-semibold text-white">
                              {item.count} <span className="text-slate-500">({percent}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent Activity: Students & Lectures */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Recent Student Signups */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Recent Student Registrations
                    </h3>
                    <button
                      onClick={() => setActiveTab("students")}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {overview?.recent.signups.map((s) => (
                      <div key={s.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-white">{s.full_name || "New Student"}</p>
                          <p className="text-[11px] text-slate-400">{s.university || "University not set"}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              s.onboarding_complete
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            }`}
                          >
                            {s.onboarding_complete ? "Onboarded" : "Pending"}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Lectures */}
                <div className="rounded-2xl bg-[#0f1320]/80 border border-white/[0.08] p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-400" />
                      Recent Uploaded Lectures
                    </h3>
                    <button
                      onClick={() => setActiveTab("lectures")}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                    >
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {overview?.recent.lectures.map((l) => (
                      <div key={l.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                        <div className="truncate max-w-[240px]">
                          <p className="text-xs font-semibold text-white truncate">{l.title}</p>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wider">{l.source_type}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              l.status === "ready"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : l.status === "processing"
                                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 animate-pulse"
                                : "bg-red-500/10 text-red-300 border border-red-500/20"
                            }`}
                          >
                            {l.status}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {formatSeconds(l.duration_seconds)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS */}
          {activeTab === "students" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Student Accounts & Profiles</h1>
                  <p className="text-xs text-slate-400 mt-1">Total {students.length} registered students across all campuses</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportStudentsCsv}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by student name, email, university or country..."
                    className="w-full bg-[#101422] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {["all", "onboarded", "pending"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setStudentFilter(f)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all cursor-pointer ${
                        studentFilter === f
                          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                          : "bg-white/[0.04] text-slate-400 hover:text-white border border-white/10"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl bg-[#0f1320]/90 border border-white/[0.08] overflow-hidden backdrop-blur-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] border-b border-white/[0.06] text-slate-400 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">University & Country</th>
                        <th className="py-3 px-4">Lectures</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Registered</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[11px] shrink-0">
                                {student.fullName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-white truncate max-w-[150px]">{student.fullName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px] truncate max-w-[180px]">
                            {student.email}
                          </td>
                          <td className="py-3 px-4 text-slate-300 truncate max-w-[200px]">
                            <p className="truncate">{student.university}</p>
                            <p className="text-[10px] text-slate-500">{student.countryName}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10">
                              {student.lecturesCount}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                student.onboardingComplete
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              }`}
                            >
                              {student.onboardingComplete ? "Onboarded" : "Incomplete"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(student.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setBroadcastTarget("user");
                                setBroadcastTargetUserId(student.id);
                                setBroadcastTitle(`Notice for ${student.fullName}`);
                                setActiveTab("broadcast");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 hover:text-indigo-200 transition-colors text-[11px] cursor-pointer"
                            >
                              Notify
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LECTURES & MEDIA */}
          {activeTab === "lectures" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Lectures & Media Studio</h1>
                  <p className="text-xs text-slate-400 mt-1">Total {lectures.length} recorded, uploaded and transcribed lectures</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportLecturesCsv}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={lectureSearch}
                    onChange={(e) => setLectureSearch(e.target.value)}
                    placeholder="Search by lecture title, student name, or ID..."
                    className="w-full bg-[#101422] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Status select */}
                <select
                  value={lectureStatusFilter}
                  onChange={(e) => setLectureStatusFilter(e.target.value)}
                  className="bg-[#101422] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="ready">Ready</option>
                  <option value="processing">Processing</option>
                  <option value="uploaded">Uploaded</option>
                  <option value="failed">Failed</option>
                </select>

                {/* Source select */}
                <select
                  value={lectureSourceFilter}
                  onChange={(e) => setLectureSourceFilter(e.target.value)}
                  className="bg-[#101422] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Sources</option>
                  <option value="recording">Recording</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>
              </div>

              {/* Table */}
              <div className="rounded-2xl bg-[#0f1320]/90 border border-white/[0.08] overflow-hidden backdrop-blur-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] border-b border-white/[0.06] text-slate-400 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Lecture Title</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {lectures.map((lecture) => (
                        <tr key={lecture.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white truncate max-w-[260px]">{lecture.title}</p>
                            <p className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{lecture.id}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <p className="truncate max-w-[140px] font-medium">{lecture.studentName}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[140px]">{lecture.studentUniversity}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/10 uppercase tracking-wider text-slate-300">
                              {lecture.sourceType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono">
                            {formatSeconds(lecture.durationSeconds)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                lecture.status === "ready"
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : lecture.status === "processing"
                                  ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 animate-pulse"
                                  : "bg-red-500/10 text-red-300 border border-red-500/20"
                              }`}
                            >
                              {lecture.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(lecture.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleInspectLecture(lecture.id)}
                                title="Inspect Transcript & Media"
                                className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmLecture(lecture)}
                                title="Delete Lecture"
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI ENGINE */}
          {activeTab === "ai" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">AI Engine Operations & Performance</h1>
                <p className="text-xs text-slate-400 mt-1">Audit trail of all automated generation tasks: notes, summaries, flashcards, quizzes</p>
              </div>

              {/* Status Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Runs</p>
                  <p className="text-2xl font-bold text-white mt-1">{overview?.metrics.totalAiGenerations ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-[11px] font-semibold text-emerald-400 uppercase">Completed</p>
                  <p className="text-2xl font-bold text-emerald-300 mt-1">{overview?.metrics.completedAiGenerations ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-[11px] font-semibold text-red-400 uppercase">Failed</p>
                  <p className="text-2xl font-bold text-red-300 mt-1">{overview?.metrics.failedAiGenerations ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-[11px] font-semibold text-indigo-400 uppercase">Success Rate</p>
                  <p className="text-2xl font-bold text-indigo-300 mt-1">{overview?.metrics.aiSuccessRate ?? 100}%</p>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl bg-[#0f1320]/90 border border-white/[0.08] overflow-hidden backdrop-blur-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] border-b border-white/[0.06] text-slate-400 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Task</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Model</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Error Code</th>
                        <th className="py-3 px-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {aiRuns.map((run) => (
                        <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-semibold text-white capitalize">
                            {run.task}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                run.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : "bg-red-500/10 text-red-300 border border-red-500/20"
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                            {run.model}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {run.ownerName}
                          </td>
                          <td className="py-3 px-4 text-red-300 font-mono text-[11px]">
                            {run.errorCode || "—"}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                            {new Date(run.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REVIEWS */}
          {activeTab === "reviews" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Student Testimonials & Reviews</h1>
                  <p className="text-xs text-slate-400 mt-1">Review moderation, sentiment and student feedback</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span className="text-base font-bold text-white">{overview?.metrics.averageRating ?? "5.0"} / 5.0</span>
                  <span className="text-xs text-amber-300">({reviews.length} total)</span>
                </div>
              </div>

              {/* Reviews Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reviews.map((r) => (
                  <div key={r.id} className="p-5 rounded-2xl bg-[#0f1320] border border-white/[0.08] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < r.rating ? "fill-amber-400" : "text-slate-600"}`}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => handleDeleteReview(r.id)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                          title="Remove review"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed italic mb-4">
                        &ldquo;{r.review}&rdquo;
                      </p>

                      {/* Official Admin Reply display */}
                      {r.admin_reply && (
                        <div className="mb-4 p-3 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-indigo-300 flex items-center gap-1 text-[11px]">
                              <CornerDownRight className="w-3 h-3 text-indigo-400" />
                              Official Admin Response:
                            </span>
                            <button
                              onClick={() => handleDeleteReviewReply(r.id)}
                              className="text-[10px] text-slate-400 hover:text-red-400 underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                          <p className="text-slate-200 text-xs leading-relaxed">{r.admin_reply}</p>
                          {r.admin_reply_at && (
                            <p className="text-[10px] text-indigo-300/60 mt-1">
                              Replied on {new Date(r.admin_reply_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">{r.display_name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{r.university || "University Student"}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>

                      <button
                        onClick={() => openReplyModal(r)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <MessageSquare className="w-3 h-3" />
                        {r.admin_reply ? "Edit Reply" : "Reply"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: CONCERN & MODERATION REPORTS */}
          {activeTab === "reports" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">Campus Safety & Concern Reports</h1>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Moderation
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Student reports submitted from Study Groups. Primary support inbox:{" "}
                    <span className="text-indigo-400 font-mono font-semibold">studystation.support@gmail.com</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchReports}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Reports
                  </button>
                </div>
              </div>

              {/* Status Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Reports</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{reports.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1320] border border-amber-500/20 bg-amber-500/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pending Action</p>
                  <p className="text-2xl font-extrabold text-amber-300 mt-1">
                    {reports.filter((r) => r.status === "pending").length}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1320] border border-emerald-500/20 bg-emerald-500/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Resolved</p>
                  <p className="text-2xl font-extrabold text-emerald-300 mt-1">
                    {reports.filter((r) => r.status === "resolved").length}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1320] border border-slate-500/20 bg-slate-500/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dismissed</p>
                  <p className="text-2xl font-extrabold text-slate-300 mt-1">
                    {reports.filter((r) => r.status === "dismissed").length}
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
                {(["all", "pending", "resolved", "dismissed"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setReportFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      reportFilter === filter
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:text-white bg-white/[0.02] border border-transparent"
                    }`}
                  >
                    {filter === "all" ? `All (${reports.length})` : `${filter} (${reports.filter((r) => r.status === filter).length})`}
                  </button>
                ))}
              </div>

              {/* Reports List */}
              {reports.filter((r) => reportFilter === "all" || r.status === reportFilter).length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-[#0f1320] border border-white/[0.08] text-slate-400">
                  <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-500 opacity-60" />
                  <p className="text-sm font-semibold text-slate-300">No reports found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {reportFilter === "all"
                      ? "Great news! No student reports have been logged yet."
                      : `No reports currently matching status '${reportFilter}'.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports
                    .filter((r) => reportFilter === "all" || r.status === reportFilter)
                    .map((report) => (
                      <div
                        key={report.id}
                        className={`p-5 rounded-2xl bg-[#0f1320] border transition-all ${
                          report.status === "pending"
                            ? "border-amber-500/30 shadow-lg shadow-amber-500/5"
                            : report.status === "resolved"
                            ? "border-emerald-500/20"
                            : "border-white/[0.06] opacity-80"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Status Badge */}
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                  report.status === "pending"
                                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                    : report.status === "resolved"
                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                    : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                }`}
                              >
                                {report.status}
                              </span>

                              <span className="text-xs font-bold text-white">{report.groupName}</span>
                              <span className="text-[11px] text-slate-500">•</span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(report.createdAt).toLocaleString()}
                              </span>
                            </div>

                            {/* Details block */}
                            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {report.details}
                            </div>

                            {/* Reporter metadata */}
                            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                              <div>
                                Reporter: <strong className="text-slate-200">{report.reporterName}</strong>
                              </div>
                              <div>
                                Email: <span className="text-indigo-300 font-mono">{report.reporterEmail}</span>
                              </div>
                              {report.messageId && (
                                <div>
                                  Target Message ID: <span className="font-mono text-slate-400">{report.messageId}</span>
                                </div>
                              )}
                              {report.resolvedAt && (
                                <div className="text-emerald-400/80">
                                  Resolved on {new Date(report.resolvedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0 pt-2 md:pt-0">
                            {/* Email reporter */}
                            <a
                              href={`mailto:${report.reporterEmail}?subject=${encodeURIComponent(
                                `StudyStation Admin Support: Regarding your report on ${report.groupName}`
                              )}`}
                              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                            >
                              <Mail className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Email Student</span>
                            </a>

                            {report.status !== "resolved" && (
                              <button
                                onClick={() => handleUpdateReportStatus(report.id, "resolved")}
                                disabled={updatingReportId === report.id}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Resolved</span>
                              </button>
                            )}

                            {report.status !== "dismissed" && (
                              <button
                                onClick={() => handleUpdateReportStatus(report.id, "dismissed")}
                                disabled={updatingReportId === report.id}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            )}

                            {report.status !== "pending" && (
                              <button
                                onClick={() => handleUpdateReportStatus(report.id, "pending")}
                                disabled={updatingReportId === report.id}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-semibold text-amber-300 cursor-pointer disabled:opacity-50"
                              >
                                Reopen
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              disabled={updatingReportId === report.id}
                              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete Report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: BROADCAST ANNOUNCEMENTS */}
          {activeTab === "broadcast" && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Broadcast In-App Announcement</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Deliver direct system notifications to all student dashboards or a specific targeted student
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0f1320] border border-white/[0.08] backdrop-blur-xl">
                <form onSubmit={handleBroadcast} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Target Audience
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBroadcastTarget("all");
                          setBroadcastTargetUserId("");
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          broadcastTarget === "all"
                            ? "bg-indigo-500/20 border-indigo-500 text-white"
                            : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        All Campus Students ({students.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBroadcastTarget("user")}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          broadcastTarget === "user"
                            ? "bg-indigo-500/20 border-indigo-500 text-white"
                            : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        Specific Student ID
                      </button>
                    </div>
                  </div>

                  {broadcastTarget === "user" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Target Student UUID
                      </label>
                      <input
                        type="text"
                        required
                        value={broadcastTargetUserId}
                        onChange={(e) => setBroadcastTargetUserId(e.target.value)}
                        placeholder="e.g. ad0ddaec-fc3b-48f8-b17c-d5aa0fa8869e"
                        className="w-full bg-[#151a2b] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Notification Type
                      </label>
                      <select
                        value={broadcastType}
                        onChange={(e) => setBroadcastType(e.target.value)}
                        className="w-full bg-[#151a2b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="announcement">Platform Announcement</option>
                        <option value="system">System Maintenance</option>
                        <option value="tip">Study Tip / Feature Guide</option>
                        <option value="urgent">Urgent Alert</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Announcement Title
                      </label>
                      <input
                        type="text"
                        required
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="e.g. New AI Lecture Summaries are Live!"
                        className="w-full bg-[#151a2b] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Message Content
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={broadcastBody}
                      onChange={(e) => setBroadcastBody(e.target.value)}
                      placeholder="Write your announcement details here. Students will see this in their in-app notification center..."
                      className="w-full bg-[#151a2b] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={broadcasting}
                    className="w-full py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {broadcasting ? "Broadcasting..." : "Dispatch Notification Now"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 7: SYSTEM DIAGNOSTICS */}
          {activeTab === "system" && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">System Infrastructure & Diagnostics</h1>
                  <p className="text-xs text-slate-400 mt-1">Real-time health telemetry, storage buckets, and server runtime status</p>
                </div>
                <button
                  onClick={fetchDiagnostics}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Diagnostics Ping
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Database Latency</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {diagnostics?.database.latencyMs ?? 0} ms
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Status: {diagnostics?.database.status}</p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Storage Bucket (Lectures)</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">
                    {diagnostics?.storage.status === "healthy" ? "Mounted" : "Degraded"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Sample Files: {diagnostics?.storage.sampleFilesCount ?? 0}</p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f1320] border border-white/[0.08]">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Server Memory (Heap)</p>
                  <p className="text-2xl font-bold text-pink-400 mt-1">
                    {diagnostics?.memory.heapUsedMb ?? 0} MB
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Total RSS: {diagnostics?.memory.rssMb ?? 0} MB</p>
                </div>
              </div>

              {/* Environment audit */}
              <div className="rounded-2xl bg-[#0f1320] border border-white/[0.08] p-6">
                <h3 className="text-sm font-bold text-white mb-3">Service Connectors</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                    <span>Supabase Cloud URL</span>
                    <span className="text-emerald-400 font-semibold">Connected</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                    <span>Supabase Service Role Key</span>
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                    <span>Gemini AI API Engine</span>
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                    <span>OpenRouter Provider</span>
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Lecture Inspector */}
      {inspectLectureId && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-[#0c101a] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-sm font-bold text-white">Lecture Inspector</h3>
                <p className="text-[11px] text-slate-400">{inspectLectureId}</p>
              </div>
              <button
                onClick={() => setInspectLectureId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {loadingInspect ? (
                <div className="py-12 text-center text-slate-400">Loading lecture details...</div>
              ) : inspectLectureData ? (
                <>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <h4 className="text-base font-bold text-white">{inspectLectureData.lecture.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-slate-400">
                      <span>Owner: <strong className="text-white">{inspectLectureData.lecture.studentName}</strong></span>
                      <span>•</span>
                      <span>Source: <strong className="text-white uppercase">{inspectLectureData.lecture.source_type}</strong></span>
                      <span>•</span>
                      <span>Duration: <strong className="text-white">{formatSeconds(inspectLectureData.lecture.duration_seconds)}</strong></span>
                    </div>

                    {inspectLectureData.lecture.mediaUrl && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-3">
                        <a
                          href={inspectLectureData.lecture.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Open Media Resource
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Summary & Note */}
                  {inspectLectureData.note && (
                    <div className="space-y-2">
                      <h5 className="font-bold text-white uppercase text-[11px] tracking-wider text-indigo-400">
                        Generated Note Summary
                      </h5>
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-slate-300 leading-relaxed">
                        {inspectLectureData.note.summary}
                      </div>
                    </div>
                  )}

                  {/* Full Transcript */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-white uppercase text-[11px] tracking-wider text-purple-400">
                      Raw Lecture Transcript
                    </h5>
                    <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] max-h-60 overflow-y-auto text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {inspectLectureData.lecture.transcript || "No transcript content available for this lecture."}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-red-400">Could not load lecture details.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirm */}
      {deleteConfirmLecture && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c101a] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Lecture</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to permanently delete &ldquo;{deleteConfirmLecture.title}&rdquo;? This will remove all associated notes, transcripts, and storage files.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmLecture(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLecture}
                disabled={deletingLecture}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {deletingLecture ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Review Reply */}
      {replyModalReview && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c101a] border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reply to Student Review</h3>
                  <p className="text-[11px] text-slate-400">
                    Public official response by <strong className="text-indigo-300">{adminEmail}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReplyModalReview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Original Review snippet */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{replyModalReview.display_name}</span>
                <span className="text-[10px] text-amber-400 font-bold">{replyModalReview.rating} ★</span>
              </div>
              <p className="text-slate-300 italic text-[11px] leading-relaxed">&ldquo;{replyModalReview.review}&rdquo;</p>
            </div>

            <form onSubmit={handleSaveReviewReply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Official Team Response
                </label>
                <textarea
                  required
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Thank you for sharing your feedback! We're glad StudyStation helps you ace your courses..."
                  className="w-full bg-[#151a2b] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 This response will be displayed publicly directly underneath the student review on the landing page and reviews showcase.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyModalReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReply}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {savingReply ? "Publishing..." : "Publish Public Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
