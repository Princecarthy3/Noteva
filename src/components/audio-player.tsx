"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  LoaderCircle,
  FileAudio,
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
  variant?: "card" | "compact" | "banner";
  autoPlay?: boolean;
  durationHintSeconds?: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  title,
  className = "",
  variant = "card",
  autoPlay = false,
  durationHintSeconds,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const durationProbeRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [ended, setEnded] = useState(false);

  // Prefer same-origin proxy paths for reliable seeking / duration on WebM.
  const resolvedSrc =
    src && src.includes("supabase") && src.includes("/storage/")
      ? src // already a full URL; keep if caller insists
      : src;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setHasError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setEnded(false);
    durationProbeRef.current = null;

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
        setDuration(audio.duration);
        setIsLoading(false);
        return;
      }

      const lastSeekableRange = audio.seekable.length - 1;
      if (lastSeekableRange >= 0) {
        const seekableEnd = audio.seekable.end(lastSeekableRange);
        if (Number.isFinite(seekableEnd) && seekableEnd > 0) {
          setDuration(seekableEnd);
          setIsLoading(false);
          return;
        }
      }

      // WebM/Opus often reports Infinity until fully buffered — probe once.
      if (audio.duration === Infinity && durationProbeRef.current === null) {
        durationProbeRef.current = audio.currentTime;
        try {
          audio.currentTime = 1e101;
        } catch {
          durationProbeRef.current = null;
        }
      }
    };

    const onLoadedMetadata = () => {
      syncDuration();
      setIsLoading(false);
    };

    const onCanPlay = () => {
      setIsLoading(false);
      syncDuration();
    };

    const onTimeUpdate = () => {
      if (durationProbeRef.current === null) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setEnded(true);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setCurrentTime(audio.duration);
      }
    };

    const onSeeked = () => {
      const previousTime = durationProbeRef.current;
      if (previousTime === null) {
        setCurrentTime(audio.currentTime);
        return;
      }

      const measuredDuration =
        Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity
          ? audio.duration
          : audio.seekable.length
            ? audio.seekable.end(audio.seekable.length - 1)
            : 0;
      durationProbeRef.current = null;
      if (Number.isFinite(measuredDuration) && measuredDuration > 0) {
        setDuration(measuredDuration);
        const restoredTime = Math.min(previousTime, measuredDuration);
        audio.currentTime = restoredTime;
        setCurrentTime(restoredTime);
      }
      setIsLoading(false);
    };

    const onPlay = () => {
      setIsPlaying(true);
      setEnded(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlayThrough = () => {
      setIsLoading(false);
      syncDuration();
    };

    const onLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
    };

    const onError = () => {
      setIsLoading(false);
      setHasError(true);
      durationProbeRef.current = null;
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("progress", syncDuration);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);

    // Force reload when src changes so duration/metadata are re-read.
    audio.load();

    if (autoPlay) {
      audio.play().catch(() => setIsPlaying(false));
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("progress", syncDuration);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("canplaythrough", onCanPlayThrough);
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
      durationProbeRef.current = null;
      audio.pause();
    };
  }, [resolvedSrc, autoPlay]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    // Replay from the start when the track has finished.
    if (ended || (displayDuration > 0 && audio.currentTime >= displayDuration - 0.15)) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setEnded(false);
    }
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }

  function handleSeek(newTime: number) {
    const audio = audioRef.current;
    const maxTime = Number.isFinite(duration) && duration > 0 ? duration : displayDuration;
    if (!audio || !Number.isFinite(newTime) || maxTime <= 0) return;
    const targetTime = Math.min(Math.max(newTime, 0), maxTime);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
    setEnded(false);
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    if (displayDuration <= 0) return;
    handleSeek(audio.currentTime + seconds);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }

  function cycleSpeed() {
    const audio = audioRef.current;
    if (!audio) return;
    const speeds = [1, 1.25, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    audio.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
  }

  const validDurationHint =
    typeof durationHintSeconds === "number" &&
    Number.isFinite(durationHintSeconds) &&
    durationHintSeconds > 0
      ? durationHintSeconds
      : 0;
  const displayDuration = Number.isFinite(duration) && duration > 0 ? duration : validDurationHint;
  const progressPercent =
    displayDuration > 0 ? Math.min((currentTime / displayDuration) * 100, 100) : 0;

  if (hasError) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-[#eeeaf2] bg-[#fbfaff] p-3 text-[11px] text-[#868093] ${className}`}
      >
        <FileAudio className="size-4 shrink-0 text-[#9b95a5]" />
        <span>Media recording preview is unavailable. Try refreshing the page.</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border border-[#e8e4f1] bg-white p-2.5 shadow-sm ${className}`}
      >
        <audio ref={audioRef} src={resolvedSrc} preload="auto" playsInline />
        <button
          type="button"
          onClick={togglePlay}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#7259e8] text-white transition hover:bg-[#5f46dd]"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-3.5 fill-white" />
          ) : (
            <Play className="size-3.5 fill-white ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {title && <p className="truncate text-[10px] font-extrabold text-[#17132d]">{title}</p>}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-[#868093] tabular-nums">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={displayDuration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              disabled={displayDuration <= 0}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#e7e1f4] accent-[#7259e8]"
              aria-label="Audio progress"
            />
            <span className="text-[9px] font-bold text-[#868093] tabular-nums">
              {formatTime(displayDuration)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[#e4ddfa] bg-gradient-to-br from-[#faf8ff] to-[#f3effc] p-4 shadow-sm ${className}`}
    >
      <audio ref={audioRef} src={resolvedSrc} preload="auto" playsInline />

      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#efe9fb] text-[#7259e8]">
          <FileAudio className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold text-[#17132d]">
            {title || "Original audio capture"}
          </p>
          <p className="mt-0.5 text-[10px] text-[#868093]">Playback</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-lg border border-[#e6e1f0] bg-white px-2 py-1 text-[10px] font-extrabold text-[#6a6377] hover:bg-[#f4f1fb]"
            aria-label="Change playback speed"
            title="Playback speed"
          >
            {playbackRate}x
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="grid size-8 place-items-center rounded-lg border border-[#e6e1f0] bg-white text-[#6a6377] hover:bg-[#f4f1fb]"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="mt-3.5 space-y-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={displayDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            disabled={displayDuration <= 0}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e7e1f4] accent-[#7259e8] transition"
            style={{
              background: `linear-gradient(to right, #7259e8 ${progressPercent}%, #e7e1f4 ${progressPercent}%)`,
            }}
            aria-label="Audio progress slider"
          />
        </div>

        <div className="flex justify-between text-[10px] font-bold text-[#8a8397] tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(displayDuration)}</span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => skip(-10)}
          disabled={displayDuration <= 0}
          className="grid size-8 place-items-center rounded-xl border border-[#e6e1f0] bg-white text-[#6a6377] transition hover:bg-[#f4f1fb] disabled:opacity-40"
          aria-label="Skip backward 10 seconds"
          title="Rewind 10 seconds"
        >
          <RotateCcw className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="grid size-11 place-items-center rounded-full bg-[#7259e8] text-white shadow-md shadow-[#7259e8]/25 transition hover:bg-[#5f46dd] active:scale-95"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isLoading ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5 fill-white" />
          ) : (
            <Play className="size-5 fill-white ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => skip(10)}
          disabled={displayDuration <= 0}
          className="grid size-8 place-items-center rounded-xl border border-[#e6e1f0] bg-white text-[#6a6377] transition hover:bg-[#f4f1fb] disabled:opacity-40"
          aria-label="Skip forward 10 seconds"
          title="Forward 10 seconds"
        >
          <RotateCw className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
