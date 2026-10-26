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
  fallbackSrc?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function readKnownDuration(audio: HTMLAudioElement, hint = 0): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
    return audio.duration;
  }
  if (audio.seekable && audio.seekable.length > 0) {
    const end = audio.seekable.end(audio.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  if (audio.buffered && audio.buffered.length > 0) {
    const end = audio.buffered.end(audio.buffered.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  if (typeof hint === "number" && Number.isFinite(hint) && hint > 0) return hint;
  return 0;
}

export function AudioPlayer({
  src,
  title,
  className = "",
  variant = "card",
  autoPlay = false,
  durationHintSeconds,
  fallbackSrc,
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
  const [canPlay, setCanPlay] = useState(false);

  useEffect(() => {
    setActiveSrc(src);
    setHasTriedFallback(false);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setHasError(false);
    setCanPlay(false);
    setCurrentTime(0);
    setIsPlaying(false);
    setDuration(
      typeof durationHintSeconds === "number" && Number.isFinite(durationHintSeconds) && durationHintSeconds > 0
        ? durationHintSeconds
        : 0
    );

    const markReady = () => {
      const known = readKnownDuration(audio, durationHintSeconds ?? 0);
      if (known > 0) setDuration((prev) => Math.max(prev, known));
      setIsLoading(false);
      setCanPlay(true);
    };

    const onLoadedMetadata = () => markReady();
    const onDurationChange = () => {
      const known = readKnownDuration(audio, durationHintSeconds ?? 0);
      if (known > 0) setDuration((prev) => Math.max(prev, known));
    };
    const onCanPlay = () => markReady();
    const onCanPlayThrough = () => markReady();
    const onProgress = () => {
      const known = readKnownDuration(audio, durationHintSeconds ?? 0);
      if (known > 0) setDuration((prev) => Math.max(prev, known));
      if (audio.readyState >= 2) {
        setIsLoading(false);
        setCanPlay(true);
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Grow duration while playing when metadata is missing (common for MediaRecorder WebM).
      if (
        (!Number.isFinite(audio.duration) || audio.duration === Infinity || audio.duration === 0) &&
        audio.currentTime > duration
      ) {
        setDuration(audio.currentTime);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      const known = readKnownDuration(audio, durationHintSeconds ?? 0);
      if (known > 0) {
        setDuration(known);
        setCurrentTime(known);
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setCanPlay(true);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsLoading(false);
      setCanPlay(true);
    };
    const onLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
    };
    const onError = () => {
      if (audio.error?.code === 1) return; // MEDIA_ERR_ABORTED
      if (!hasTriedFallback && fallbackSrc && fallbackSrc !== activeSrc) {
        setHasTriedFallback(true);
        setActiveSrc(fallbackSrc);
        return;
      }
      setIsLoading(false);
      setHasError(true);
      setCanPlay(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("progress", onProgress);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);

    // Kick load for the current source.
    try {
      audio.load();
    } catch {
      // ignore
    }

    // Safety: never leave the control stuck in a spinner.
    const readyTimer = window.setTimeout(() => {
      if (audio.readyState >= 2) markReady();
      else setIsLoading(false);
    }, 2500);

    if (autoPlay) {
      audio.play().catch(() => setIsPlaying(false));
    }

    return () => {
      window.clearTimeout(readyTimer);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("progress", onProgress);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("canplaythrough", onCanPlayThrough);
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
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
      return;
    }

    // Replay from the start after the track finishes.
    if (audio.ended || (duration > 0 && audio.currentTime >= duration - 0.2)) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
        setCanPlay(true);
      })
      .catch(() => setIsPlaying(false));
  }

  function handleSeek(newTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const maxTime = duration > 0 ? duration : readKnownDuration(audio, durationHintSeconds ?? 0);
    if (!Number.isFinite(newTime)) return;
    const target = maxTime > 0 ? Math.min(Math.max(newTime, 0), maxTime) : Math.max(newTime, 0);
    try {
      audio.currentTime = target;
      setCurrentTime(target);
    } catch {
      // Some WebM streams reject seeks until fully buffered.
    }
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
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    audio.playbackRate = next;
    setPlaybackRate(next);
  }

  const displayDuration = duration > 0 ? duration : 0;
  const progressPercent =
    displayDuration > 0 ? Math.min((currentTime / displayDuration) * 100, 100) : 0;
  const showSpinner = isLoading && !canPlay && !isPlaying;

  if (hasError) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-[#eeeaf2] bg-[#fbfaff] p-3 text-[11px] text-[#868093] ${className}`}
      >
        <FileAudio className="size-4 shrink-0 text-[#9b95a5]" />
        <span>Media preview is unavailable. Refresh the page or retry the lecture.</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border border-[#e8e4f1] bg-white p-2.5 shadow-sm ${className}`}
      >
        <audio ref={audioRef} src={activeSrc} preload="auto" playsInline />
        <button
          type="button"
          onClick={togglePlay}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#7259e8] text-white transition hover:bg-[#5f46dd]"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {showSpinner ? (
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
      <audio ref={audioRef} src={activeSrc} preload="auto" playsInline />

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
        <input
          type="range"
          min={0}
          max={displayDuration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e7e1f4] accent-[#7259e8]"
          style={{
            background: `linear-gradient(to right, #7259e8 ${progressPercent}%, #e7e1f4 ${progressPercent}%)`,
          }}
          aria-label="Audio progress slider"
        />
        <div className="flex justify-between text-[10px] font-bold text-[#8a8397] tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{displayDuration > 0 ? formatTime(displayDuration) : "--:--"}</span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => skip(-10)}
          className="grid size-8 place-items-center rounded-xl border border-[#e6e1f0] bg-white text-[#6a6377] transition hover:bg-[#f4f1fb]"
          aria-label="Skip backward 10 seconds"
        >
          <RotateCcw className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="grid size-11 place-items-center rounded-full bg-[#7259e8] text-white shadow-md shadow-[#7259e8]/25 transition hover:bg-[#5f46dd] active:scale-95"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {showSpinner ? (
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
          className="grid size-8 place-items-center rounded-xl border border-[#e6e1f0] bg-white text-[#6a6377] transition hover:bg-[#f4f1fb]"
          aria-label="Skip forward 10 seconds"
        >
          <RotateCw className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
