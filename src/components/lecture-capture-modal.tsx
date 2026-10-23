"use client";

import { useEffect, useState } from "react";
import {
  CloudUpload,
  FileAudio,
  FileText,
  FileVideo,
  LoaderCircle,
  Mic2,
  RotateCcw,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import type { Stage6Course } from "@/components/stage6-workspace";
import { AudioPlayer } from "@/components/audio-player";

type CaptureTab = "record" | "upload";

export function LectureCaptureModal({
  tab,
  setTab,
  close,
  courseId,
  setCourseId,
  courses,
  title,
  setTitle,
  recording,
  seconds,
  recorded,
  liveTranscript,
  interimTranscript,
  captionStatus,
  start,
  stop,
  processRecording,
  processing,
  fileInputRef,
  handleUpload,
  resetRecording,
}: {
  tab: CaptureTab;
  setTab: (tab: CaptureTab) => void;
  close: () => void;
  courseId: string;
  setCourseId: (id: string) => void;
  courses: Stage6Course[];
  title: string;
  setTitle: (title: string) => void;
  recording: boolean;
  seconds: number;
  recorded: Blob | null;
  liveTranscript: string;
  interimTranscript: string;
  captionStatus: string;
  start: () => void;
  stop: () => void;
  processRecording: (title?: string) => void;
  processing: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleUpload: (file?: File, title?: string) => void;
  resetRecording?: () => void;
}) {
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!recorded) {
      setRecordedAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(recorded);
    setRecordedAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [recorded]);

  useEffect(() => {
    if (!selectedUploadFile) {
      setUploadPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedUploadFile);
    setUploadPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedUploadFile]);

  const formattedTime = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  function onFileChange(file?: File) {
    if (!file) return;
    setSelectedUploadFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim());
    }
  }

  function handleDiscardRecording() {
    if (resetRecording) {
      resetRecording();
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#17132d]/55 p-3 backdrop-blur-sm sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lecture-upload-title"
        className="my-auto max-h-[94vh] w-full max-w-[620px] overflow-y-auto rounded-[28px] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#ece9f0] px-5 py-4 sm:px-6">
          <div>
            <h2 id="lecture-upload-title" className="text-[16px] font-extrabold text-[#17132d]">
              Add a lecture
            </h2>
            <p className="mt-1 text-[9px] text-[#938d9a]">
              Record live or upload audio, video, PDF, Word, PowerPoint, or text files
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={recording || processing}
            className="grid size-9 place-items-center rounded-xl bg-[#f4f2f7] hover:bg-[#ebe7f2] disabled:opacity-30 transition"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 pt-5 sm:px-6">
          <div className="grid grid-cols-2 rounded-xl bg-[#f3f1f7] p-1" aria-label="Choose lecture source">
            {(
              [
                { id: "record", label: "Record live", icon: Mic2 },
                { id: "upload", label: "Upload file", icon: CloudUpload },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                disabled={recording || processing}
                className={`flex h-9 items-center justify-center gap-2 rounded-lg text-[9px] font-extrabold transition ${
                  tab === item.id ? "bg-white text-[#7259e8] shadow-sm" : "text-[#898390]"
                }`}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-[8px] font-black uppercase tracking-[.1em] text-[#8e8895]">
            Lecture title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="e.g. Week 3 — Cell structure & mitosis"
              className="mt-2 h-10 w-full rounded-xl border border-[#e2dee8] bg-white px-3 text-[11px] font-medium text-[#17132d] outline-none focus:border-[#7259e8]"
            />
          </label>

          <label className="mt-3 block text-[8px] font-black uppercase tracking-[.1em] text-[#8e8895]">
            Save to course
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#e2dee8] bg-white px-3 text-[10px] font-bold text-[#17132d] outline-none focus:border-[#7259e8]"
            >
              <option value="">Unassigned lecture</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === "record" ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-[22px] bg-[#17132d] p-6 text-center text-white">
              {/* Waveform indicator */}
              <div className="mx-auto flex h-[64px] items-center justify-center gap-[4px]">
                {[
                  22, 38, 55, 30, 64, 42, 24, 50, 68, 36, 57, 29, 46, 62, 34, 51, 25, 40, 58, 31,
                ].map((height, index) => (
                  <span
                    key={index}
                    className={`w-[3px] rounded-full transition-all duration-200 ${
                      recording ? "animate-pulse bg-[#a994ff]" : "bg-white/15"
                    }`}
                    style={{
                      height: `${recording ? height : Math.max(10, height * 0.35)}px`,
                    }}
                  />
                ))}
              </div>

              <p className="mt-2 text-[28px] font-black tabular-nums tracking-[-1px]">
                {formattedTime}
              </p>
              <p className="mt-0.5 text-[9px] font-bold text-white/60">
                {recording
                  ? "Recording in progress · Speak clearly"
                  : recorded
                  ? "Recording captured · Ready to review"
                  : "Record a lecture or class presentation"}
              </p>

              {/* Recording Controls */}
              <div className="mt-5 flex items-center justify-center gap-3">
                {!recording && !recorded && (
                  <button
                    type="button"
                    onClick={start}
                    className="grid size-14 place-items-center rounded-full bg-[#ef6862] shadow-[0_0_0_8px_rgba(239,104,98,.15)] hover:scale-105 active:scale-95 transition"
                    aria-label="Start recording"
                  >
                    <Mic2 className="size-6 text-white" />
                  </button>
                )}

                {recording && (
                  <button
                    type="button"
                    onClick={stop}
                    className="grid size-14 place-items-center rounded-full bg-[#ef6862] shadow-[0_0_0_8px_rgba(239,104,98,.2)] hover:scale-105 active:scale-95 transition animate-pulse"
                    aria-label="Stop recording"
                  >
                    <Square className="size-5 fill-white text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* PRE-TRANSCRIPTION AUDIO PLAYER: Listen before uploading! */}
            {recorded && !recording && recordedAudioUrl && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#7259e8]">
                    Review your recording
                  </span>
                  <span className="text-[9px] font-bold text-[#868093]">
                    Listen before transcription
                  </span>
                </div>

                <AudioPlayer
                  src={recordedAudioUrl}
                  title={title || "Recorded lecture audio"}
                  variant="card"
                  durationHintSeconds={seconds}
                />

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDiscardRecording}
                    disabled={processing}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e3dfea] bg-white px-4 text-[10px] font-extrabold text-[#736c7e] hover:bg-[#faf9fc] disabled:opacity-50 transition"
                  >
                    <RotateCcw className="size-3.5" />
                    Record again
                  </button>

                  <button
                    type="button"
                    onClick={() => processRecording(title)}
                    disabled={processing}
                    className="flex h-10 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-5 text-[10px] font-extrabold text-white shadow-md shadow-[#7259e8]/20 hover:bg-[#5f46dd] disabled:opacity-60 transition"
                  >
                    {processing ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Upload and transcribe
                  </button>
                </div>
              </div>
            )}

            {/* Live speech captions */}
            {(recording || (recorded && !recordedAudioUrl)) && (
              <section
                aria-label="Live transcription"
                aria-live="polite"
                className="mt-4 rounded-2xl border border-[#e9e5ef] bg-[#faf9fd] p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[10px] font-extrabold text-[#373145]">Live transcription</h3>
                  {recording && (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#7259e8]">
                      <span className="size-1.5 animate-pulse rounded-full bg-[#7259e8]" />
                      Listening
                    </span>
                  )}
                </div>
                {liveTranscript || interimTranscript ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#514b5d]">
                    {liveTranscript}
                    {liveTranscript && interimTranscript ? " " : ""}
                    <span className="text-[#9993a0]">{interimTranscript}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] leading-4 text-[#8a8494]">
                    {recording ? "Your words will appear here as you speak." : "No live captions were captured."}
                  </p>
                )}
                {captionStatus && <p className="mt-2 text-[9px] leading-4 text-[#8a8494]">{captionStatus}</p>}
              </section>
            )}

            <p className="mt-3 text-center text-[9px] leading-4 text-[#8a8494]">
              You can listen to your recording above at any time. When you tap &quot;Upload and transcribe&quot;,
              your recording is processed by StudyStation AI to generate your complete lecture notes and study sets.
            </p>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.m4a,.wav,.webm,.mp4,.pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => {
                onFileChange(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />

            {!selectedUploadFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-[#d8d1e9] bg-[#faf9fd] p-7 transition hover:border-[#9f8be8] hover:bg-[#f5f2ff] disabled:opacity-60"
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-[#eeeaff] text-[#7259e8]">
                  {processing ? (
                    <LoaderCircle className="size-6 animate-spin" />
                  ) : (
                    <CloudUpload className="size-6" />
                  )}
                </span>
                <h3 className="mt-4 text-[13px] font-extrabold text-[#17132d]">
                  {processing ? "Processing lecture material…" : "Choose audio, video, or lecture document"}
                </h3>
                <p className="mt-2 text-center text-[9px] leading-4 text-[#918b98]">
                  Audio / Video (MP3, M4A, WAV, WebM, MP4)
                  <br />
                  or Documents (PDF, Word .docx, PowerPoint .pptx, Markdown, Text)
                  <br />
                  Maximum file size: 25 MB
                </p>
                <span className="mt-4 rounded-xl bg-[#17132d] px-4 py-2.5 text-[9px] font-extrabold text-white">
                  Browse files
                </span>
              </button>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const isDoc = /\.(pdf|docx|doc|pptx|ppt|txt|md|rtf)$/i.test(selectedUploadFile.name) ||
                    selectedUploadFile.type.startsWith("text/") ||
                    selectedUploadFile.type.includes("pdf") ||
                    selectedUploadFile.type.includes("document") ||
                    selectedUploadFile.type.includes("presentation");

                  return (
                    <>
                      <div className="flex items-center justify-between rounded-xl border border-[#e5e0f1] bg-[#faf9fe] p-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                            {isDoc ? (
                              <FileText className="size-4" />
                            ) : selectedUploadFile.type.startsWith("video") ? (
                              <FileVideo className="size-4" />
                            ) : (
                              <FileAudio className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-[#17132d]">
                              {selectedUploadFile.name}
                            </p>
                            <p className="text-[10px] text-[#878094]">
                              {(selectedUploadFile.size / (1024 * 1024)).toFixed(2)} MB · {isDoc ? "Ready to organize into notes" : "Ready to transcribe"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUploadFile(null);
                            setUploadPreviewUrl(null);
                          }}
                          className="grid size-8 place-items-center rounded-lg text-[#888195] hover:bg-[#eeeaf4] transition"
                          title="Choose a different file"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      {/* Preview: Audio/video player or Document info card */}
                      {isDoc ? (
                        <div className="rounded-2xl border border-[#e5e0f1] bg-[#fbfaff] p-4 text-center">
                          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                            <FileText className="size-5" />
                          </span>
                          <h4 className="mt-2 text-xs font-black text-[#17132d]">
                            Lecture Document Ready
                          </h4>
                          <p className="mx-auto mt-1 max-w-sm text-[10px] leading-4 text-[#868093]">
                            StudyStation AI will extract the full content and organize it into executive summaries, key terms, topic sections, exam takeaways, and active recall practice sets.
                          </p>
                        </div>
                      ) : (
                        uploadPreviewUrl && (
                          <div>
                            {selectedUploadFile.type.startsWith("video") ? (
                              <video
                                src={uploadPreviewUrl}
                                controls
                                className="max-h-[220px] w-full rounded-2xl bg-black"
                              />
                            ) : (
                              <AudioPlayer
                                src={uploadPreviewUrl}
                                title={selectedUploadFile.name}
                                variant="card"
                              />
                            )}
                          </div>
                        )
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={processing}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e3dfea] bg-white px-3 text-[10px] font-bold text-[#736c7e] hover:bg-[#faf9fc]"
                        >
                          Change file
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpload(selectedUploadFile, title)}
                          disabled={processing}
                          className="flex h-10 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[10px] font-extrabold text-white shadow-md shadow-[#7259e8]/20 hover:bg-[#5f46dd] disabled:opacity-60 transition"
                        >
                          {processing ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" />
                              {isDoc ? "Extracting & organizing…" : "Uploading & transcribing…"}
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-4" />
                              {isDoc ? "Upload & organize notes" : "Upload and transcribe"}
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="mt-3 flex items-center justify-center gap-4 text-[8px] text-[#9993a0]">
              <span className="flex items-center gap-1">
                <FileAudio className="size-3" />
                Audio
              </span>
              <span className="flex items-center gap-1">
                <FileVideo className="size-3" />
                Video
              </span>
              <span>Private storage</span>
            </div>
            <p className="mt-3 text-center text-[9px] leading-4 text-[#8a8494]">
              Only upload media you have permission to process. Files are stored privately and processed with StudyStation AI.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
