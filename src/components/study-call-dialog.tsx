"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  Users,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ExternalLink,
  Volume2,
  LoaderCircle,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CallSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
};

type CallApiResponse = {
  provider: "webrtc";
  roomId: string;
  roomName: string;
  domain: string;
  joinUrl: string;
  session: {
    id: string;
    title: string;
    groupName: string;
    startsAt: string;
    endsAt: string;
  };
  currentUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
    email?: string;
  };
};

type RemotePeer = {
  peerId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  audioMuted: boolean;
  videoOff: boolean;
  isSpeaking: boolean;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

function VideoTile({
  stream,
  muted = false,
  mirror = false,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover transition-transform ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callData, setCallData] = useState<CallApiResponse | null>(null);

  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

  // Peers state
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const channelRef = useRef<any>(null);
  const clientIdRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAnalysersRef = useRef<Map<string, () => void>>(new Map());

  // Duration timer
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  // Clean-up audio analyser helper
  const attachAudioAnalyser = useCallback((stream: MediaStream, onSpeaking: (speaking: boolean) => void) => {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return () => {};
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return () => {};
      const ctx = new AudioCtxClass();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let rafId: number;
      let wasSpeaking = false;

      const check = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const speaking = avg > 15;
        if (speaking !== wasSpeaking) {
          wasSpeaking = speaking;
          onSpeaking(speaking);
        }
        rafId = requestAnimationFrame(check);
      };

      rafId = requestAnimationFrame(check);

      return () => {
        cancelAnimationFrame(rafId);
        try {
          source.disconnect();
          analyser.disconnect();
          if (ctx.state !== "closed") void ctx.close();
        } catch {
          // ignore
        }
      };
    } catch {
      return () => {};
    }
  }, []);

  // Send message over Supabase broadcast
  const sendSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event,
      payload: { ...payload, senderId: clientIdRef.current },
    });
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((remotePeerId: string, remoteUser: { id: string; name: string; avatarUrl: string | null }, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(remotePeerId)) {
      return peerConnectionsRef.current.get(remotePeerId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(remotePeerId, pc);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", {
          targetId: remotePeerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming remote stream tracks
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((t) => {
        remoteStream.addTrack(t);
      });

      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(remotePeerId);
        next.set(remotePeerId, {
          peerId: remotePeerId,
          userId: remoteUser.id,
          name: remoteUser.name,
          avatarUrl: remoteUser.avatarUrl,
          stream: remoteStream,
          audioMuted: existing?.audioMuted ?? false,
          videoOff: existing?.videoOff ?? false,
          isSpeaking: false,
        });
        return next;
      });

      // Hook up audio analyser for speaking indicator
      if (!remoteAnalysersRef.current.has(remotePeerId)) {
        const cleanupAnalyser = attachAudioAnalyser(remoteStream, (speaking) => {
          setPeers((prev) => {
            const current = prev.get(remotePeerId);
            if (!current || current.isSpeaking === speaking) return prev;
            const updated = new Map(prev);
            updated.set(remotePeerId, { ...current, isSpeaking: speaking });
            return updated;
          });
        });
        remoteAnalysersRef.current.set(remotePeerId, cleanupAnalyser);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        removePeer(remotePeerId);
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sendSignal("peer-offer", {
            targetId: remotePeerId,
            sdp: pc.localDescription,
            user: callData?.currentUser,
            audioMuted: isAudioMuted,
            videoOff: isVideoOff,
          });
        })
        .catch((err) => console.warn("Error creating offer", err));
    }

    return pc;
  }, [sendSignal, callData?.currentUser, isAudioMuted, isVideoOff, attachAudioAnalyser]);

  const removePeer = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    const cleanup = remoteAnalysersRef.current.get(peerId);
    if (cleanup) {
      cleanup();
      remoteAnalysersRef.current.delete(peerId);
    }
    setPeers((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  // Initialize Call
  useEffect(() => {
    activeRef.current = true;
    let localCleanup: (() => void) | null = null;

    async function init() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/study-groups/${groupId}/sessions/${session.id}/call`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as (CallApiResponse & { error?: string }) | null;
        if (!res.ok || !data?.roomId) {
          throw new Error(data?.error ?? "Could not authorize this study call.");
        }
        if (!activeRef.current) return;
        setCallData(data);

        // Generate client ID
        const clientId = `${data.currentUser.id}-${Math.random().toString(36).slice(2, 9)}`;
        clientIdRef.current = clientId;

        // Acquire local media stream (fallback to audio-only if camera unavailable)
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: false,
            });
            setIsVideoOff(true);
          } catch (micErr) {
            console.warn("Could not acquire microphone or camera", micErr);
            stream = new MediaStream();
            setIsAudioMuted(true);
            setIsVideoOff(true);
          }
        }

        if (!activeRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        setLocalStream(stream);

        // Local speaking detector
        localCleanup = attachAudioAnalyser(stream, (speaking) => {
          setIsLocalSpeaking(speaking && !isAudioMuted);
        });

        // Setup Supabase Realtime channel for signaling
        const supabase = createClient();
        const channelName = `study-call:${data.roomId}`;
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });

        channelRef.current = channel;

        channel
          .on("broadcast", { event: "peer-join" }, ({ payload }) => {
            if (!payload || payload.senderId === clientIdRef.current) return;
            const remotePeerId = payload.senderId as string;
            const remoteUser = payload.user || { id: remotePeerId, name: "Student", avatarUrl: null };
            
            // Register peer placeholder
            setPeers((prev) => {
              const next = new Map(prev);
              next.set(remotePeerId, {
                peerId: remotePeerId,
                userId: remoteUser.id,
                name: remoteUser.name,
                avatarUrl: remoteUser.avatarUrl,
                stream: null,
                audioMuted: Boolean(payload.audioMuted),
                videoOff: Boolean(payload.videoOff),
                isSpeaking: false,
              });
              return next;
            });

            // As existing participant, initiate offer to new joiner
            createPeerConnection(remotePeerId, remoteUser, true);
          })
          .on("broadcast", { event: "peer-offer" }, async ({ payload }) => {
            if (!payload || payload.targetId !== clientIdRef.current) return;
            const remotePeerId = payload.senderId as string;
            const remoteUser = payload.user || { id: remotePeerId, name: "Student", avatarUrl: null };

            let pc = peerConnectionsRef.current.get(remotePeerId);
            if (!pc) {
              pc = createPeerConnection(remotePeerId, remoteUser, false);
            }

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

              // Process pending candidates
              const pending = pendingCandidatesRef.current.get(remotePeerId) || [];
              for (const cand of pending) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {
                  // ignore
                }
              }
              pendingCandidatesRef.current.delete(remotePeerId);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              sendSignal("peer-answer", {
                targetId: remotePeerId,
                sdp: pc.localDescription,
              });
            } catch (sdpErr) {
              console.warn("Failed handling peer offer", sdpErr);
            }
          })
          .on("broadcast", { event: "peer-answer" }, async ({ payload }) => {
            if (!payload || payload.targetId !== clientIdRef.current) return;
            const remotePeerId = payload.senderId as string;
            const pc = peerConnectionsRef.current.get(remotePeerId);
            if (!pc) return;

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const pending = pendingCandidatesRef.current.get(remotePeerId) || [];
              for (const cand of pending) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {
                  // ignore
                }
              }
              pendingCandidatesRef.current.delete(remotePeerId);
            } catch (ansErr) {
              console.warn("Failed handling peer answer", ansErr);
            }
          })
          .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
            if (!payload || payload.targetId !== clientIdRef.current) return;
            const remotePeerId = payload.senderId as string;
            const pc = peerConnectionsRef.current.get(remotePeerId);

            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (iceErr) {
                console.warn("Failed adding ice candidate", iceErr);
              }
            } else {
              const queue = pendingCandidatesRef.current.get(remotePeerId) || [];
              queue.push(payload.candidate);
              pendingCandidatesRef.current.set(remotePeerId, queue);
            }
          })
          .on("broadcast", { event: "media-state" }, ({ payload }) => {
            if (!payload || payload.senderId === clientIdRef.current) return;
            const remotePeerId = payload.senderId as string;
            setPeers((prev) => {
              const current = prev.get(remotePeerId);
              if (!current) return prev;
              const next = new Map(prev);
              next.set(remotePeerId, {
                ...current,
                audioMuted: typeof payload.audioMuted === "boolean" ? payload.audioMuted : current.audioMuted,
                videoOff: typeof payload.videoOff === "boolean" ? payload.videoOff : current.videoOff,
              });
              return next;
            });
          })
          .on("broadcast", { event: "peer-leave" }, ({ payload }) => {
            if (!payload) return;
            removePeer(payload.senderId as string);
          });

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Announce presence to room
            channel.send({
              type: "broadcast",
              event: "peer-join",
              payload: {
                senderId: clientIdRef.current,
                user: data.currentUser,
                audioMuted: isAudioMuted,
                videoOff: isVideoOff,
              },
            });
            setLoading(false);
          }
        });
      } catch (initErr) {
        if (activeRef.current) {
          setError(initErr instanceof Error ? initErr.message : "Failed to connect to study call.");
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      activeRef.current = false;
      if (localCleanup) localCleanup();

      // Announce leave
      try {
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "peer-leave",
            payload: { senderId: clientIdRef.current },
          });
          channelRef.current.unsubscribe();
        }
      } catch {
        // ignore
      }

      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Clean analysers
      remoteAnalysersRef.current.forEach((cleanup) => cleanup());
      remoteAnalysersRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
    };
  }, [groupId, session.id, attachAudioAnalyser, createPeerConnection, removePeer, sendSignal]);

  // Toggle Mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const next = !isAudioMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setIsAudioMuted(next);
    sendSignal("media-state", { audioMuted: next });
  };

  // Toggle Video
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const next = !isVideoOff;

    if (next) {
      // Turn off video
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      setIsVideoOff(true);
      sendSignal("media-state", { videoOff: true });
    } else {
      // Turn on video
      const existingTrack = localStreamRef.current.getVideoTracks()[0];
      if (existingTrack) {
        existingTrack.enabled = true;
        setIsVideoOff(false);
        sendSignal("media-state", { videoOff: false });
      } else {
        // Request camera if we started audio-only
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          const newVideoTrack = stream.getVideoTracks()[0];
          if (newVideoTrack) {
            localStreamRef.current.addTrack(newVideoTrack);
            cameraTrackRef.current = newVideoTrack;
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

            // Replace on peer connections
            peerConnectionsRef.current.forEach((pc) => {
              const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
              if (videoSender) {
                videoSender.replaceTrack(newVideoTrack);
              } else {
                pc.addTrack(newVideoTrack, localStreamRef.current!);
              }
            });

            setIsVideoOff(false);
            sendSignal("media-state", { videoOff: false });
          }
        } catch (camErr) {
          console.warn("Could not enable camera", camErr);
        }
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      setIsScreenSharing(false);

      // Revert to camera track if active
      const camTrack = cameraTrackRef.current;
      if (camTrack && localStreamRef.current) {
        const currentVideo = localStreamRef.current.getVideoTracks()[0];
        if (currentVideo) localStreamRef.current.removeTrack(currentVideo);
        localStreamRef.current.addTrack(camTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        peerConnectionsRef.current.forEach((pc) => {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) videoSender.replaceTrack(camTrack);
        });
      }
      sendSignal("media-state", { videoOff: isVideoOff });
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = displayStream.getVideoTracks()[0];
        if (!screenTrack) return;

        screenTrack.onended = () => {
          void toggleScreenShare();
        };

        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);

        if (localStreamRef.current) {
          const currentVideo = localStreamRef.current.getVideoTracks()[0];
          if (currentVideo) localStreamRef.current.removeTrack(currentVideo);
          localStreamRef.current.addTrack(screenTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        peerConnectionsRef.current.forEach((pc) => {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else if (localStreamRef.current) {
            pc.addTrack(screenTrack, localStreamRef.current);
          }
        });
        sendSignal("media-state", { videoOff: false });
      } catch (err) {
        console.warn("Screen share cancelled or failed", err);
      }
    }
  };

  const copyCallLink = async () => {
    try {
      const url = `${window.location.origin}/app?view=study-groups&group=${groupId}&call=${session.id}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const peerList = Array.from(peers.values());
  const totalCount = 1 + peerList.length;

  // Grid layout class based on participant count
  const gridClass =
    totalCount === 1
      ? "grid-cols-1 grid-rows-1"
      : totalCount === 2
      ? "grid-cols-1 sm:grid-cols-2 grid-rows-1"
      : totalCount <= 4
      ? "grid-cols-2 grid-rows-2"
      : totalCount <= 6
      ? "grid-cols-2 sm:grid-cols-3 grid-rows-2"
      : "grid-cols-2 sm:grid-cols-4 grid-rows-2";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0b0a14] text-white selection:bg-[#7259e8]/30"
      role="dialog"
      aria-modal="true"
      aria-label="Study Group Call"
    >
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#120f24]/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#7259e8] to-[#5b3fd4] text-white shadow-lg shadow-[#7259e8]/25">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xs font-black tracking-tight sm:text-sm">
              {callData?.session.groupName ? `${callData.session.groupName} · ` : ""}
              {session.title || "Study Call"}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-white/50">
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live ({totalCount} {totalCount === 1 ? "participant" : "participants"})
              </span>
              <span>·</span>
              <span className="font-mono">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {callData?.joinUrl && (
            <a
              href={callData.joinUrl}
              target="_blank"
              rel="noreferrer"
              title="Open external Jitsi fallback room"
              className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-white/70 transition hover:bg-white/10 hover:text-white md:inline-flex"
            >
              <ExternalLink className="size-3" />
              <span>External fallback</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => void copyCallLink()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Copy invite link"
          >
            {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? "Link copied" : "Share link"}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="grid size-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close call window"
            className="grid size-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
        {loading ? (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#7259e8]/20 text-[#9f8df5]">
                <LoaderCircle className="size-6 animate-spin" />
              </span>
              <h2 className="text-sm font-extrabold text-white">Connecting to study call…</h2>
              <p className="max-w-xs text-xs text-white/50">Setting up peer-to-peer audio and video stream encryption.</p>
            </div>
          </div>
        ) : error ? (
          <div className="grid h-full place-items-center p-4">
            <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-950/30 p-6 text-center">
              <AlertCircle className="mx-auto size-8 text-red-400" />
              <h2 className="mt-3 text-sm font-extrabold text-white">Call Connection Notice</h2>
              <p className="mt-2 text-xs leading-5 text-red-200/80">{error}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid h-full w-full gap-2 sm:gap-3 ${gridClass}`}>
            {/* Local Participant Tile */}
            <div
              className={`group relative flex h-full min-h-[160px] w-full items-center justify-center overflow-hidden rounded-2xl border bg-[#151226] shadow-xl transition-all ${
                isLocalSpeaking ? "border-emerald-500 ring-2 ring-emerald-500/40" : "border-white/10"
              }`}
            >
              {localStream && !isVideoOff && localStream.getVideoTracks().some((t) => t.enabled) ? (
                <VideoTile stream={localStream} mirror={!isScreenSharing} muted={true} />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`grid size-20 place-items-center rounded-full bg-gradient-to-tr from-[#7259e8] to-[#9d8bf0] text-xl font-black text-white shadow-lg transition-transform ${
                      isLocalSpeaking ? "scale-105 ring-4 ring-emerald-400" : ""
                    }`}
                  >
                    {callData?.currentUser.name ? getInitials(callData.currentUser.name) : "YOU"}
                  </div>
                </div>
              )}

              {/* Top Status Indicators */}
              <div className="absolute left-3 top-3 flex items-center gap-1.5">
                {isScreenSharing && (
                  <span className="flex items-center gap-1 rounded-lg bg-[#7259e8] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow">
                    <ScreenShare className="size-3" /> Sharing Screen
                  </span>
                )}
              </div>

              {/* Bottom Tag */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md">
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate text-xs font-bold text-white">
                    {callData?.currentUser.name || "You"} (You)
                  </span>
                  {isLocalSpeaking && (
                    <span className="inline-flex items-center text-emerald-400" title="Speaking">
                      <Volume2 className="size-3.5 animate-pulse" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isAudioMuted ? (
                    <span className="grid size-6 place-items-center rounded-lg bg-red-500/80 text-white" title="Muted">
                      <MicOff className="size-3" />
                    </span>
                  ) : (
                    <span className="grid size-6 place-items-center rounded-lg bg-white/10 text-white" title="Mic active">
                      <Mic className="size-3" />
                    </span>
                  )}
                  {isVideoOff && (
                    <span className="grid size-6 place-items-center rounded-lg bg-white/10 text-white/60" title="Camera off">
                      <VideoOff className="size-3" />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Remote Participants */}
            {peerList.map((peer) => {
              const hasVideo = peer.stream && !peer.videoOff && peer.stream.getVideoTracks().some((t) => t.enabled);
              return (
                <div
                  key={peer.peerId}
                  className={`group relative flex h-full min-h-[160px] w-full items-center justify-center overflow-hidden rounded-2xl border bg-[#151226] shadow-xl transition-all ${
                    peer.isSpeaking ? "border-emerald-500 ring-2 ring-emerald-500/40" : "border-white/10"
                  }`}
                >
                  {hasVideo ? (
                    <VideoTile stream={peer.stream} muted={false} />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={`grid size-20 place-items-center rounded-full bg-gradient-to-tr from-[#3b2d6b] to-[#5a43aa] text-xl font-black text-white shadow-lg transition-transform ${
                          peer.isSpeaking ? "scale-105 ring-4 ring-emerald-400" : ""
                        }`}
                      >
                        {getInitials(peer.name)}
                      </div>
                    </div>
                  )}

                  {/* Remote Name Bar */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md">
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate text-xs font-bold text-white">{peer.name}</span>
                      {peer.isSpeaking && (
                        <span className="inline-flex items-center text-emerald-400" title="Speaking">
                          <Volume2 className="size-3.5 animate-pulse" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {peer.audioMuted ? (
                        <span className="grid size-6 place-items-center rounded-lg bg-red-500/80 text-white" title="Muted">
                          <MicOff className="size-3" />
                        </span>
                      ) : (
                        <span className="grid size-6 place-items-center rounded-lg bg-white/10 text-white" title="Mic active">
                          <Mic className="size-3" />
                        </span>
                      )}
                      {peer.videoOff && (
                        <span className="grid size-6 place-items-center rounded-lg bg-white/10 text-white/60" title="Camera off">
                          <VideoOff className="size-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Control Bar */}
      <footer className="flex h-20 shrink-0 items-center justify-center border-t border-white/10 bg-[#120f24]/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Mic Button */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
            className={`flex size-11 items-center justify-center rounded-2xl transition-all shadow-lg ${
              isAudioMuted
                ? "bg-red-500/90 text-white hover:bg-red-600 shadow-red-500/20"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            {isAudioMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>

          {/* Camera Button */}
          <button
            type="button"
            onClick={() => void toggleVideo()}
            aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
            className={`flex size-11 items-center justify-center rounded-2xl transition-all shadow-lg ${
              isVideoOff
                ? "bg-red-500/90 text-white hover:bg-red-600 shadow-red-500/20"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>

          {/* Screen Share Button */}
          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
            className={`flex size-11 items-center justify-center rounded-2xl transition-all shadow-lg ${
              isScreenSharing
                ? "bg-[#7259e8] text-white hover:bg-[#6247df] shadow-[#7259e8]/30"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            <ScreenShare className="size-5" />
          </button>

          {/* Leave Call Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Leave call"
            className="flex h-11 items-center gap-2 rounded-2xl bg-red-600 px-5 text-xs font-black text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700"
          >
            <PhoneOff className="size-4" />
            <span className="hidden sm:inline">Leave call</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
