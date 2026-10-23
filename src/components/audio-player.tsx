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
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
  variant?: "card" | "compact" | "banner";
  autoPlay?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
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
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setHasError(false);
    setCurrentTime(0);

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    const onError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (autoPlay) {
      audio.play().catch(() => setIsPlaying(false));
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
  }, [src, autoPlay]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }

  function handleSeek(newTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.min(Math.max(0, audio.currentTime + seconds), duration || audio.duration || 0);
    audio.currentTime = target;
    setCurrentTime(target);
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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (hasError) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-[#eeeaf2] bg-[#fbfaff] p-3 text-[11px] text-[#868093] ${className}`}>
        <FileAudio className="size-4 shrink-0 text-[#9b95a5]" />
        <span>Media recording preview is unavailable.</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-[#e8e4f1] bg-white p-2.5 shadow-sm ${className}`}>
        <audio ref={audioRef} src={src} preload="metadata" />
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
            <span className="text-[9px] font-bold text-[#868093] tabular-nums">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-[#eeeaf2] accent-[#7259e8]"
              aria-label="Seek audio"
            />
            <span className="text-[9px] font-bold text-[#868093] tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={cycleSpeed}
          className="rounded-md bg-[#f4f2f8] px-2 py-1 text-[9px] font-black text-[#7259e8] hover:bg-[#ece8f5]"
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
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Top row: Title and Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#7259e8]/10 text-[#7259e8]">
            <FileAudio className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-[#17132d]">
              {title || "Lecture audio recording"}
            </p>
            <p className="text-[9px] text-[#868093]">Original audio capture</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            className="flex items-center gap-1 rounded-lg border border-[#e2dcf2] bg-white px-2 py-1 text-[9px] font-black text-[#7259e8] hover:bg-[#f6f4fe] transition"
            title="Change playback speed"
          >
            <Gauge className="size-3" />
            <span>{playbackRate}x</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="grid size-7 place-items-center rounded-lg border border-[#e2dcf2] bg-white text-[#6b6478] hover:bg-[#f6f4fe] transition"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="size-3.5 text-[#e0544c]" /> : <Volume2 className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Scrubber slider */}
      <div className="mt-3.5 space-y-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e7e1f4] accent-[#7259e8] transition"
            style={{
              background: `linear-gradient(to right, #7259e8 ${progressPercent}%, #e7e1f4 ${progressPercent}%)`,
            }}
            aria-label="Audio progress slider"
          />
        </div>

        <div className="flex justify-between text-[10px] font-bold text-[#8a8397] tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main playback control bar */}
      <div className="mt-2.5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => skip(-10)}
          className="grid size-8 place-items-center rounded-xl bg-white text-[#6a6377] border border-[#e6e1f0] hover:bg-[#f4f1fb] transition"
          aria-label="Skip backward 10 seconds"
          title="Rewind 10 seconds"
        >
          <RotateCcw className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="grid size-11 place-items-center rounded-full bg-[#7259e8] text-white shadow-md shadow-[#7259e8]/25 hover:bg-[#5f46dd] transition active:scale-95"
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
          className="grid size-8 place-items-center rounded-xl bg-white text-[#6a6377] border border-[#e6e1f0] hover:bg-[#f4f1fb] transition"
          aria-label="Skip forward 10 seconds"
          title="Forward 10 seconds"
        >
          <RotateCw className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
