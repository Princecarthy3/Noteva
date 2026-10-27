"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Video, X } from "lucide-react";

type CallSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
};
type CallConfiguration = {
  provider: "jitsi";
  domain: string;
  roomName: string;
  joinUrl?: string;
  session: {
    title: string;
    groupName: string;
    startsAt: string;
    endsAt: string;
  };
};
type JitsiEvent = { message?: string; isFatal?: boolean };
type JitsiApi = {
  addEventListener: (name: string, listener: (event?: JitsiEvent) => void) => void;
  removeEventListener: (name: string, listener: (event?: JitsiEvent) => void) => void;
  executeCommand: (command: string) => void;
  dispose: () => void;
};
type JitsiListener = (event?: JitsiEvent) => void;
type JitsiOptions = {
  roomName: string;
  parentNode: HTMLElement;
  width: string;
  height: string;
  configOverwrite: Record<string, unknown>;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: JitsiOptions) => JitsiApi;
  }
}

let jitsiScriptPromise: Promise<void> | null = null;

function loadJitsiApi(domain: string) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (!jitsiScriptPromise) {
    jitsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = () => {
        if (window.JitsiMeetExternalAPI) resolve();
        else {
          jitsiScriptPromise = null;
          reject(new Error("The call provider did not finish loading."));
        }
      };
      script.onerror = () => {
        script.remove();
        jitsiScriptPromise = null;
        reject(new Error("The call provider could not be reached. Check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }
  return jitsiScriptPromise;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
}

export function StudyCallDialog({
  groupId,
  session,
  onClose,
}: {
  groupId: string;
  session: CallSession;
  onClose: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const listenersRef = useRef<Array<[string, JitsiListener]>>([]);
  const activeRef = useRef(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [configuration, setConfiguration] = useState<CallConfiguration | null>(null);
  const [callState, setCallState] = useState<"idle" | "connecting" | "connected" | "left" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      listenersRef.current.forEach(([name, listener]) => apiRef.current?.removeEventListener(name, listener));
      listenersRef.current = [];
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, []);

  function disposeApi() {
    listenersRef.current.forEach(([name, listener]) => apiRef.current?.removeEventListener(name, listener));
    listenersRef.current = [];
    apiRef.current?.dispose();
    apiRef.current = null;
  }

  async function joinCall() {
    setLaunching(true);
    setError("");
    try {
      const response = await fetch(`/api/study-groups/${groupId}/sessions/${session.id}/call`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as (CallConfiguration & { error?: string }) | null;
      if (!response.ok || !data?.domain || !data.roomName) {
        throw new Error(data?.error ?? "The call could not be authorized.");
      }
      if (!activeRef.current) return;
      // Prefer server joinUrl, otherwise build one
      if (!data.joinUrl) {
        data.joinUrl = `https://${data.domain}/${data.roomName}`;
      }
      setConfiguration(data);
      setCallState("connecting");
    } catch (joinError) {
      if (activeRef.current) {
        setError(joinError instanceof Error ? joinError.message : "The call could not be started.");
        setCallState("error");
      }
    } finally {
      if (activeRef.current) setLaunching(false);
    }
  }

  // Mount Jitsi only after the video container is in the DOM
  useEffect(() => {
    if (!configuration || callState === "left") return;
    let cancelled = false;
    async function mount() {
      try {
        await loadJitsiApi(configuration!.domain);
        if (cancelled || !activeRef.current || !mountRef.current || !window.JitsiMeetExternalAPI) return;
        disposeApi();
        if (mountRef.current) mountRef.current.replaceChildren();
        const api = new window.JitsiMeetExternalAPI!(configuration!.domain, {
          roomName: configuration!.roomName,
          parentNode: mountRef.current!,
          width: "100%",
          height: "100%",
          configOverwrite: {
            prejoinPageEnabled: true,
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            disableDeepLinking: true,
            toolbarButtons: audioOnly
              ? ["microphone", "hangup", "chat", "tileview", "raisehand"]
              : ["microphone", "camera", "hangup", "chat", "tileview", "raisehand"],
          },
        });
        apiRef.current = api;
        const listeners: Array<[string, JitsiListener]> = [
          ["videoConferenceJoined", () => {
            if (activeRef.current) setCallState("connected");
          }],
          ["videoConferenceLeft", () => {
            if (activeRef.current) setCallState("left");
          }],
          ["readyToClose", () => {
            if (activeRef.current) setCallState("left");
          }],
          ["errorOccurred", (event) => {
            if (event?.isFatal && activeRef.current) {
              setError(event.message ?? "The call encountered an error.");
              setCallState("error");
            }
          }],
        ];
        listenersRef.current = listeners;
        listeners.forEach(([name, listener]) => api.addEventListener(name, listener));
      } catch (mountError) {
        if (activeRef.current && !cancelled) {
          setError(mountError instanceof Error ? mountError.message : "The call could not be embedded. Use Open in browser.");
          setCallState("error");
        }
      }
    }
    void mount();
    return () => {
      cancelled = true;
    };
  }, [configuration, audioOnly]);

  function reconnect() {
    disposeApi();
    if (mountRef.current) mountRef.current.replaceChildren();
    setConfiguration(null);
    setCallState("idle");
    setError("");
    void joinCall();
  }

  function leaveCall() {
    apiRef.current?.executeCommand("hangup");
    disposeApi();
    onClose();
  }

  const joined = Boolean(configuration);

  return <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#17132d]/60 p-3 backdrop-blur-sm sm:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="study-call-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-[#eeeaf2] px-4 py-3 sm:px-5">
        <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">STUDY GROUP CALL</p><h2 id="study-call-title" className="mt-1 text-sm font-extrabold text-[#17132d]">{session.title}</h2><p className="mt-1 text-[10px] text-[#827b8e]">{formatDate(session.starts_at)} – {formatDate(session.ends_at)}</p></div>
        <button type="button" onClick={leaveCall} aria-label="Close call" className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#e9e5ef] text-[#777080]"><X className="size-4" /></button>
      </header>

      {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-xs text-[#a44e48] sm:mx-5">{error}</p>}

      {!joined ? <div className="space-y-4 overflow-y-auto p-5 sm:p-7">
        <div className="rounded-xl border border-[#f0dcae] bg-[#fff9e9] p-4">
          <h3 className="text-xs font-extrabold text-[#69521b]">Before you join: third-party service notice</h3>
          <p className="mt-2 text-[11px] leading-5 text-[#665d4b]">This prototype connects to Jitsi Meet (meet.jit.si). Jitsi is operated by a third party and may process meeting connection details and in-call content. StudyStation checks your group membership before sharing the room name, but anyone who obtains that room name may be able to join directly through Jitsi. Do not discuss sensitive or confidential information, and do not record or share the meeting. Review the <a href="https://jitsi.org/meet-jit-si-privacy/" target="_blank" rel="noreferrer" className="font-bold underline">Jitsi privacy notice</a> and <a href="https://jitsi.org/meet-jit-si-terms-of-service/" target="_blank" rel="noreferrer" className="font-bold underline">terms</a>.</p>
          <p className="mt-2 text-[10px] leading-4 text-[#796e57]">The room opens with your microphone and camera muted. You must explicitly enable either in the call controls. Browser permission prompts may appear when you choose to enable a device.</p>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-[#514b5d]"><input type="checkbox" checked={audioOnly} onChange={(event) => setAudioOnly(event.target.checked)} className="accent-[#7259e8]" /><Mic className="size-3.5 text-[#7259e8]" /> Audio-only mode <span className="text-[10px] font-normal text-[#8a8494]">(camera control hidden)</span></label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void joinCall()} disabled={launching} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[11px] font-extrabold text-white disabled:opacity-60">{launching ? <LoaderCircle className="size-4 animate-spin" /> : audioOnly ? <Mic className="size-4" /> : <Video className="size-4" />}{launching ? "Connecting…" : "I understand — join call"}</button>
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#e9e5ef] px-4 text-[11px] font-bold text-[#665f70]">Cancel</button>
          {configuration?.joinUrl && <a href={configuration.joinUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl border border-[#dcd4ff] bg-[#f7f5ff] px-4 text-[11px] font-extrabold text-[#5b47bd]">Prefer browser tab</a>}
        </div>
      </div> : <div className="relative min-h-[320px] flex-1 bg-[#17132d] sm:min-h-[480px]">
        <div ref={mountRef} className="absolute inset-0" />
        <div className="absolute bottom-3 left-3 rounded-lg bg-[#17132d]/85 px-3 py-2 text-[10px] font-semibold text-white" role="status">
          {callState === "connecting" ? "Connecting… your devices start muted." : callState === "connected" ? "Connected. Enable your microphone or camera only when ready." : callState === "left" ? "You left the call." : callState === "error" ? "The call ended unexpectedly." : "Loading call…"}
        </div>
        {(callState === "left" || callState === "error") && <div className="absolute inset-0 grid place-items-center bg-[#17132d]/75"><div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reconnect} className="h-9 rounded-lg bg-white px-4 text-[10px] font-extrabold text-[#5140b0]">Reconnect</button>
          {configuration?.joinUrl && <a href={configuration.joinUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg bg-[#7259e8] px-4 text-[10px] font-extrabold text-white">Open in browser</a>}
          <button type="button" onClick={leaveCall} className="h-9 rounded-lg border border-white/50 px-4 text-[10px] font-extrabold text-white">Leave call</button>
        </div></div>}
      </div>}

      {joined && <div className="flex items-center justify-between gap-3 border-t border-[#eeeaf2] px-4 py-3 text-[9px] text-[#827b8e]"><span>{configuration?.session.groupName} · Jitsi Meet</span><button type="button" onClick={leaveCall} className="h-8 rounded-lg bg-[#fff1ef] px-3 font-extrabold text-[#a44e48]">Leave call</button></div>}
    </section>
  </div>;
}
