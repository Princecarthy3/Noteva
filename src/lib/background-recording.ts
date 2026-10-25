/**
 * Background Recording and Screen Keep-Awake Manager
 *
 * Provides:
 * 1. Screen Wake Lock API management (keeps phone/desktop screen awake during recording).
 * 2. Visual/fallback keep-awake for older browsers/iOS Safari versions.
 * 3. Background Audio Keep-Alive (silent audio loop + MediaSession API) so mobile OS
 *    (iOS Safari, Android Chrome) does not terminate or suspend audio capture and JS
 *    execution when the phone screen is locked or the app is backgrounded.
 * 4. Lock screen / notification controls via MediaSession (Play, Pause, Stop).
 * 5. Drift-free wall-clock elapsed time synchronization supporting pause and resume.
 */

export interface BackgroundRecordingOptions {
  title?: string;
  onStopRequest?: () => void;
  onPauseRequest?: () => void;
  onResumeRequest?: () => void;
  onStateChange?: (state: {
    isRecording: boolean;
    isPaused: boolean;
    isWakeLockActive: boolean;
    elapsedSeconds: number;
  }) => void;
}

export class BackgroundRecordingManager {
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private silentAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private fallbackVideo: HTMLVideoElement | null = null;
  private startTime: number | null = null;
  private accumulatedSeconds = 0;
  private isPausedInternal = false;
  private timerIntervalId: number | null = null;
  private isRecordingInternal = false;
  private isWakeLockHeld = false;
  private options: BackgroundRecordingOptions = {};
  private visibilityListener: (() => void) | null = null;
  private recorderRef: MediaRecorder | null = null;

  constructor(options: BackgroundRecordingOptions = {}) {
    this.options = options;
  }

  public updateOptions(options: Partial<BackgroundRecordingOptions>) {
    this.options = { ...this.options, ...options };
    this.updateMediaSessionMetadata();
  }

  /**
   * Check if Screen Wake Lock API is natively supported in this browser.
   */
  public static isWakeLockSupported(): boolean {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
  }

  /**
   * Get whether wake lock is currently active.
   */
  public isWakeLockActive(): boolean {
    return this.isWakeLockHeld;
  }

  /**
   * Start keep-awake and background recording mode.
   * MUST be invoked directly from a user gesture (e.g. click "Start Recording").
   */
  public async start(recorder?: MediaRecorder | null): Promise<void> {
    this.recorderRef = recorder ?? null;
    this.isRecordingInternal = true;
    this.isPausedInternal = false;
    this.accumulatedSeconds = 0;
    this.startTime = Date.now();

    // 1. Request native Screen Wake Lock
    await this.requestWakeLock();

    // 2. Start silent audio loop to keep mobile audio session alive in background
    this.startSilentAudioKeepAlive();

    // 3. Setup Web Audio keep-alive node
    this.startWebAudioKeepAlive();

    // 4. Fallback screen keep-awake video (for iOS Safari < 16.4 or power-save mode)
    this.startFallbackVideoKeepAwake();

    // 5. Setup MediaSession API (Lock screen / notification bar integration)
    this.setupMediaSession();

    // 6. Listen for visibility changes to re-acquire wake lock and resume if needed
    this.setupVisibilityListener();

    // 7. Start timer tick that syncs against real clock
    this.startTimerTick();
  }

  /**
   * Pause recording keep-awake session.
   */
  public pause(): void {
    if (!this.isRecordingInternal || this.isPausedInternal) return;
    this.isPausedInternal = true;

    if (this.startTime !== null) {
      this.accumulatedSeconds += Math.floor((Date.now() - this.startTime) / 1000);
      this.startTime = null;
    }

    if (this.silentAudio) {
      try {
        this.silentAudio.pause();
      } catch {}
    }

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "paused";
      } catch {}
    }

    this.notifyState();
  }

  /**
   * Resume recording keep-awake session.
   */
  public resume(): void {
    if (!this.isRecordingInternal || !this.isPausedInternal) return;
    this.isPausedInternal = false;
    this.startTime = Date.now();

    void this.requestWakeLock();

    if (this.silentAudio) {
      this.silentAudio.play().catch(() => {});
    }

    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "playing";
      } catch {}
    }

    this.notifyState();
  }

  /**
   * Stop keep-awake and background recording mode.
   */
  public stop(): void {
    this.isRecordingInternal = false;
    this.isPausedInternal = false;
    this.recorderRef = null;

    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    this.releaseWakeLock();
    this.stopSilentAudioKeepAlive();
    this.stopWebAudioKeepAlive();
    this.stopFallbackVideoKeepAwake();
    this.teardownMediaSession();
    this.removeVisibilityListener();

    this.startTime = null;
    this.accumulatedSeconds = 0;
    this.notifyState();
  }

  /**
   * Calculate current elapsed recording seconds based on real timestamp (immune to sleep throttle).
   */
  public getElapsedSeconds(): number {
    const activeSegment =
      this.startTime !== null && !this.isPausedInternal
        ? Math.floor((Date.now() - this.startTime) / 1000)
        : 0;
    return Math.max(0, this.accumulatedSeconds + activeSegment);
  }

  /**
   * Attach or update the current MediaRecorder instance for resilience hooks.
   */
  public attachRecorder(recorder: MediaRecorder): void {
    this.recorderRef = recorder;

    // If recorder pauses unexpectedly in background, auto-resume if not explicitly paused by user
    recorder.addEventListener("pause", () => {
      if (this.isRecordingInternal && !this.isPausedInternal && recorder.state === "paused") {
        try {
          recorder.resume();
        } catch (e) {
          console.warn("[BackgroundRecording] Failed to auto-resume paused recorder:", e);
        }
      }
    });
  }

  /* ------------------- Screen Wake Lock ------------------- */

  private async requestWakeLock(): Promise<boolean> {
    if (!BackgroundRecordingManager.isWakeLockSupported()) {
      return false;
    }

    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
        this.isWakeLockHeld = true;
        this.notifyState();
        return true;
      }

      const sentinel = await navigator.wakeLock.request("screen");
      this.wakeLockSentinel = sentinel;
      this.isWakeLockHeld = true;

      sentinel.addEventListener("release", () => {
        this.isWakeLockHeld = false;
        this.wakeLockSentinel = null;
        this.notifyState();
      });

      this.notifyState();
      return true;
    } catch (err) {
      // Wake lock can fail if battery saver is on or document is not visible
      console.warn("[BackgroundRecording] Screen Wake Lock request failed:", err);
      this.isWakeLockHeld = false;
      this.notifyState();
      return false;
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release().catch(() => {});
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
    this.isWakeLockHeld = false;
  }

  /* ------------------- Background Audio Keep-Alive ------------------- */

  /**
   * Generates a 1-second inaudible PCM WAV Blob in memory.
   * No network requests or external assets required.
   */
  private createSilentWavBlob(): Blob {
    const sampleRate = 8000;
    const numSamples = sampleRate; // 1 second
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    // "RIFF" chunk descriptor
    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, 36 + numSamples, true);
    // "WAVE" format
    view.setUint32(8, 0x57415645, false);
    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true); // NumChannels (1 = mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate, true); // ByteRate (sampleRate * 1)
    view.setUint16(32, 1, true); // BlockAlign (1 byte)
    view.setUint16(34, 8, true); // BitsPerSample (8-bit)
    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, numSamples, true);

    // 8-bit unsigned PCM silence is 128 (0x80)
    new Uint8Array(buffer, 44, numSamples).fill(128);

    return new Blob([buffer], { type: "audio/wav" });
  }

  private startSilentAudioKeepAlive(): void {
    try {
      if (!this.silentAudio) {
        const blob = this.createSilentWavBlob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = 0.001;
        this.silentAudio = audio;
      }

      const playPromise = this.silentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[BackgroundRecording] Silent audio playback could not start:", err);
        });
      }
    } catch (e) {
      console.warn("[BackgroundRecording] Error starting silent audio keepalive:", e);
    }
  }

  private stopSilentAudioKeepAlive(): void {
    if (this.silentAudio) {
      try {
        this.silentAudio.pause();
        this.silentAudio.currentTime = 0;
        if (this.silentAudio.src) {
          URL.revokeObjectURL(this.silentAudio.src);
          this.silentAudio.src = "";
        }
      } catch {
        // ignore
      }
      this.silentAudio = null;
    }
  }

  /* ------------------- Web Audio API Keep-Alive ------------------- */

  private startWebAudioKeepAlive(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === "closed") {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      // Create an inaudible sub-sonic oscillator (1Hz) connected to zero gain
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.frequency.setValueAtTime(1, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.00001, this.audioContext.currentTime);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
    } catch (e) {
      console.warn("[BackgroundRecording] Web Audio keep-alive init error:", e);
    }
  }

  private stopWebAudioKeepAlive(): void {
    if (this.audioContext) {
      try {
        if (this.audioContext.state !== "closed") {
          this.audioContext.close().catch(() => {});
        }
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }

  /* ------------------- Fallback Video Keep-Awake ------------------- */

  /**
   * Fallback for older iOS Safari and browsers where native Screen Wake Lock is rejected.
   * Plays a tiny 1x1 canvas/video stream with playsinline and muted in the background.
   */
  private startFallbackVideoKeepAwake(): void {
    if (BackgroundRecordingManager.isWakeLockSupported() && this.isWakeLockHeld) {
      return;
    }

    try {
      if (!this.fallbackVideo && typeof document !== "undefined") {
        const video = document.createElement("video");
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.loop = true;
        video.style.position = "fixed";
        video.style.top = "-9999px";
        video.style.left = "-9999px";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0.01";
        video.style.pointerEvents = "none";

        // Minimal 1-frame WebM video data URI
        video.src =
          "data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17GDD0JATYCGQ2hkbXRocGlkQW1wbGlmeWluZw==";

        document.body.appendChild(video);
        this.fallbackVideo = video;
      }

      if (this.fallbackVideo) {
        this.fallbackVideo.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  private stopFallbackVideoKeepAwake(): void {
    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
        this.fallbackVideo.removeAttribute("src");
        this.fallbackVideo.load();
        this.fallbackVideo.remove();
      } catch {
        // ignore
      }
      this.fallbackVideo = null;
    }
  }

  /* ------------------- MediaSession API ------------------- */

  private setupMediaSession(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    try {
      this.updateMediaSessionMetadata();
      navigator.mediaSession.playbackState = "playing";

      navigator.mediaSession.setActionHandler("stop", () => {
        if (this.options.onStopRequest) {
          this.options.onStopRequest();
        }
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        if (this.options.onPauseRequest) {
          this.options.onPauseRequest();
        }
      });

      navigator.mediaSession.setActionHandler("play", () => {
        if (this.options.onResumeRequest) {
          this.options.onResumeRequest();
        }
      });
    } catch (e) {
      console.warn("[BackgroundRecording] Failed to setup MediaSession:", e);
    }
  }

  private updateMediaSessionMetadata(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    try {
      const lectureTitle = this.options.title?.trim() || "Lecture Recording";
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `🔴 ${lectureTitle}`,
        artist: "StudyStation AI Assistant",
        album: "Live Lecture Audio Capture",
        artwork: [
          { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
        ],
      });
    } catch {
      // ignore
    }
  }

  private teardownMediaSession(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("play", null);
    } catch {
      // ignore
    }
  }

  /* ------------------- Visibility & Lifecycle ------------------- */

  private setupVisibilityListener(): void {
    if (typeof document === "undefined") return;

    this.visibilityListener = async () => {
      if (!this.isRecordingInternal) return;

      if (document.visibilityState === "visible") {
        // User unlocked phone or switched back to app
        // 1. Re-acquire Screen Wake Lock if not paused
        if (!this.isPausedInternal) {
          await this.requestWakeLock();
        }

        // 2. Ensure recorder is running if not user-paused (resume if OS paused it)
        if (!this.isPausedInternal && this.recorderRef && this.recorderRef.state === "paused") {
          try {
            this.recorderRef.resume();
          } catch (e) {
            console.warn("[BackgroundRecording] Failed to resume recorder on visible:", e);
          }
        }

        // 3. Ensure AudioContext is active
        if (!this.isPausedInternal && this.audioContext && this.audioContext.state === "suspended") {
          this.audioContext.resume().catch(() => {});
        }

        // 4. Ensure silent audio is playing
        if (!this.isPausedInternal && this.silentAudio && this.silentAudio.paused) {
          this.silentAudio.play().catch(() => {});
        }

        // 5. Notify UI immediately with current elapsed time
        this.notifyState();
      }
    };

    document.addEventListener("visibilitychange", this.visibilityListener);
    window.addEventListener("focus", this.visibilityListener);
  }

  private removeVisibilityListener(): void {
    if (typeof document === "undefined" || !this.visibilityListener) return;
    document.removeEventListener("visibilitychange", this.visibilityListener);
    window.removeEventListener("focus", this.visibilityListener);
    this.visibilityListener = null;
  }

  /* ------------------- Accurate Clock Sync ------------------- */

  private startTimerTick(): void {
    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
    }

    this.timerIntervalId = window.setInterval(() => {
      this.notifyState();
    }, 1000);
  }

  private notifyState(): void {
    if (this.options.onStateChange) {
      this.options.onStateChange({
        isRecording: this.isRecordingInternal,
        isPaused: this.isPausedInternal,
        isWakeLockActive: this.isWakeLockHeld,
        elapsedSeconds: this.getElapsedSeconds(),
      });
    }
  }
}
