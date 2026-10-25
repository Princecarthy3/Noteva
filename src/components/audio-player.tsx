"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Gauge,
  LoaderCircle,
  FileAudio,
  RefreshCw,
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  fallbackSrc?: string;
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
  fallbackSrc,
  title,
  className = "",
  variant = "card",
  autoPlay = false,
  durationHintSeconds,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSrc, setActiveSrc] = useState(src);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Sync activeSrc whenever incoming src prop changes
  useEffect(() => {
    setActiveSrc(src);
    setHasTriedFallback(false);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setHasError(false);
    setCurrentTime(0);
    setDuration(
      typeof durationHintSeconds === "number" && Number.isFinite(durationHintSeconds) && durationHintSeconds > 0
        ? durationHintSeconds
        : 0
    );
    setIsPlaying(false);

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        setIsLoading(false);
        return;
      }

      const lastSeekableRange = audio.seekable ? audio.seekable.length - 1 : -1;
      if (lastSeekableRange >= 0) {
        const seekableEnd = audio.seekable.end(lastSeekableRange);
        if (Number.isFinite(seekableEnd) && seekableEnd > 0) {
          setDuration((prev) => Math.max(prev, seekableEnd));
          setIsLoading(false);
          return;
        }
      }

      if (durationHintSeconds && durationHintSeconds > 0) {
        setDuration(durationHintSeconds);
        setIsLoading(false);
      }
    };

    const onLoadedMetadata = () => {
      syncDuration();
      setIsLoading(false);
    };

    const onCanPlay = () => {
      syncDuration();
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime > duration) {
        setDuration(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setCurrentTime(audio.duration);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlayThrough = () => setIsLoading(false);

    const onLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
    };

    const onError = () => {
      // Ignore user or navigation aborts
      if (audio.error?.code === 1) return;

      // If we haven't tried the fallback proxy yet, switch to it
      if (!hasTriedFallback && fallbackSrc && fallbackSrc !== activeSrc) {
        setHasTriedFallback(true);
        setActiveSrc(fallbackSrc);
        return;
      }

      setIsLoading(false);
      setHasError(true);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("progress", syncDuration);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);

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
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
  }, [activeSrc, autoPlay, durationHintSeconds, fallbackSrc, hasTriedFallback]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleSeek(newTime: number) {
    const audio = audioRef.current;
    const maxTime = Number.isFinite(duration) && duration > 0 ? duration : displayDuration;
    if (!audio || !Number.isFinite(newTime) || maxTime <= 0) return;
    const targetTime = Math.min(Math.max(newTime, 0), maxTime);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
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

  function retryPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    setHasError(false);
    setIsLoading(true);
    audio.load();
  }

  const validDurationHint =
    typeof durationHintSeconds === "number" &&
    Number.isFinite(durationHintSeconds) &&
    durationHintSeconds > 0
      ? durationHintSeconds
      : 0;
  const displayDuration = Number.isFinite(duration) && duration > 0 ? duration : validDurationHint;
  const progressPercent = displayDuration > 0 ? Math.min((currentTime / displayDuration) * 100, 100) : 0;

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-[#e8e4f1] bg-white p-2.5 shadow-sm ${className}`}>
        <audio ref={audioRef} src={activeSrc} preload="metadata" />
        <button
          type="button"
          onClick={togglePlay}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#7259e8] text-white transition hover:bg-[#5f46dd]"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-4 fill-white" />
          ) : (
            <Play className="size-4 fill-white ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {title && <p className="truncate text-xs font-extrabold text-[#17132d]">{title}</p>}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#868093] tabular-nums">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={displayDuration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              disabled={displayDuration <= 0 && currentTime <= 0}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-[#eeeaf2] accent-[#7259e8]"
              aria-label="Seek audio"
            />
            <span className="text-[11px] font-bold text-[#868093] tabular-nums">{formatTime(displayDuration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => skip(-10)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#777180] transition hover:bg-[#f2eff9] hover:text-[#7259e8]"
          aria-label="Skip backward 10 seconds"
          title="Rewind 10 seconds"
        >
          <RotateCcw className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => skip(10)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#777180] transition hover:bg-[#f2eff9] hover:text-[#7259e8]"
          aria-label="Skip forward 10 seconds"
          title="Forward 10 seconds"
        >
          <RotateCw className="size-4" />
        </button>

        <button
          type="button"
          onClick={cycleSpeed}
          className="rounded-md bg-[#f4f2f8] px-2.5 py-1 text-[11px] font-black text-[#7259e8] hover:bg-[#ece8f5]"
          title="Playback speed"
        >
          {playbackRate}x
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[#e4ddfa] bg-gradient-to-b from-[#fbfaff] to-[#f5f2ff] p-4 shadow-sm ${className}`}
    >
      <audio ref={audioRef} src={activeSrc} preload="metadata" />

      {/* Top row: Title and Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#7259e8]/10 text-[#7259e8]">
            <FileAudio className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#17132d]">
              {title || "Lecture audio recording"}
            </p>
            <p className="text-[11px] text-[#868093]">Original audio capture · Playback</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            className="flex items-center gap-1 rounded-lg border border-[#e2dcf2] bg-white px-2.5 py-1 text-[11px] font-black text-[#7259e8] hover:bg-[#f6f4fe] transition"
            title="Change playback speed"
          >
            <Gauge className="size-3.5" />
            <span>{playbackRate}x</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="grid size-8 place-items-center rounded-lg border border-[#e2dcf2] bg-white text-[#6b6478] hover:bg-[#f6f4fe] transition"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="size-4 text-[#e0544c]" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      </div>

      {hasError ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#f3d9d7] bg-[#fff5f4] p-3 text-xs text-[#a44e48]">
          <div className="flex items-center gap-2">
            <FileAudio className="size-4 shrink-0 text-[#c85a53]" />
            <span>Audio stream could not be loaded immediately.</span>
          </div>
          <button
            type="button"
            onClick={retryPlayback}
            className="inline-flex items-center gap-1 rounded-lg bg-[#7259e8] px-2.5 py-1 text-[11px] font-black text-white hover:bg-[#6045de]"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Scrubber slider */}
          <div className="mt-3.5 space-y-1">
            <div className="relative flex items-center">
              <input
                type="range"
                min={0}
                max={displayDuration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                disabled={displayDuration <= 0 && currentTime <= 0}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e7e1f4] accent-[#7259e8] transition"
                style={{
                  background: `linear-gradient(to right, #7259e8 ${progressPercent}%, #e7e1f4 ${progressPercent}%)`,
                }}
                aria-label="Audio progress slider"
              />
            </div>

            <div className="flex justify-between text-[11px] font-bold text-[#8a8397] tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(displayDuration)}</span>
            </div>
          </div>

          {/* Main playback control bar */}
          <div className="mt-2.5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => skip(-10)}
              className="grid size-9 place-items-center rounded-xl bg-white text-[#6a6377] border border-[#e6e1f0] hover:bg-[#f4f1fb] transition"
              aria-label="Skip backward 10 seconds"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="size-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="grid size-12 place-items-center rounded-full bg-[#7259e8] text-white shadow-md shadow-[#7259e8]/25 hover:bg-[#5f46dd] transition active:scale-95"
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
              className="grid size-9 place-items-center rounded-xl bg-white text-[#6a6377] border border-[#e6e1f0] hover:bg-[#f4f1fb] transition"
              aria-label="Skip forward 10 seconds"
              title="Forward 10 seconds"
            >
              <RotateCw className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
