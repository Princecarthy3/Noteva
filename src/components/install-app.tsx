"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, Download, MoreVertical, Share2, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallContextValue = { openInstallInstructions: () => void };
const InstallContext = createContext<InstallContextValue | null>(null);

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() =>
    typeof window !== "undefined" && (
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    )
  );
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstructions) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowInstructions(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showInstructions]);

  async function installNow() {
    if (!installPrompt) return;
    setIsInstalling(true);
    setInstallError("");
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setShowInstructions(false);
    } catch {
      setInstallError("The install prompt could not open. Follow the browser steps below instead.");
    } finally {
      setIsInstalling(false);
    }
  }

  return (
    <InstallContext.Provider value={{ openInstallInstructions: () => setShowInstructions(true) }}>
      {children}
      {showInstructions && (
        <div
          className="install-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#17132d]/60 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowInstructions(false);
          }}
        >
          <section className="install-card my-auto w-full max-w-[680px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(14,10,34,.32)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#211a43] via-[#392b78] to-[#7259e8] px-6 py-7 text-white sm:px-8 sm:py-8">
              <div className="absolute -right-12 -top-20 size-56 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                    <Smartphone className="size-6" />
                  </span>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-white/65">StudyStation app</p>
                  <h2 id="install-title" className="mt-1 text-2xl font-black tracking-tight sm:text-[30px]">Take your study space with you</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/75">Add StudyStation to your home screen for quick, app-like access to your lectures, notes, and study tools.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructions(false)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close install instructions"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
              <article className="install-instructions rounded-2xl border border-[#e8e4f1] bg-[#faf9fd] p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]"><Share2 className="size-4" /></span>
                  <div><h3 className="text-sm font-extrabold text-[#211b35]">iPhone & iPad</h3><p className="text-[10px] font-semibold text-[#878193]">Safari · iOS / iPadOS</p></div>
                </div>
                <ol className="mt-4 space-y-3 text-xs leading-5 text-[#5f596b]">
                  <li className="flex gap-2.5"><span className="step-number">1</span><span>Open StudyStation in <b>Safari</b> (not an in-app browser).</span></li>
                  <li className="flex gap-2.5"><span className="step-number">2</span><span>Tap <Share2 className="mx-0.5 inline size-3.5 text-[#7259e8]" /> <b>Share</b> in the browser toolbar.</span></li>
                  <li className="flex gap-2.5"><span className="step-number">3</span><span>Scroll down and choose <b>Add to Home Screen</b>.</span></li>
                  <li className="flex gap-2.5"><span className="step-number">4</span><span>Tap <b>Add</b>. Find StudyStation beside your other apps.</span></li>
                </ol>
              </article>

              <article className="install-instructions rounded-2xl border border-[#e8e4f1] bg-[#faf9fd] p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#e8f7ef] text-[#20815b]"><MoreVertical className="size-4" /></span>
                  <div><h3 className="text-sm font-extrabold text-[#211b35]">Android phones & tablets</h3><p className="text-[10px] font-semibold text-[#878193]">Chrome · Samsung Internet</p></div>
                </div>
                <ol className="mt-4 space-y-3 text-xs leading-5 text-[#5f596b]">
                  <li className="flex gap-2.5"><span className="step-number">1</span><span>Open StudyStation in <b>Chrome</b> or Samsung Internet.</span></li>
                  <li className="flex gap-2.5"><span className="step-number">2</span><span>Tap the browser menu <MoreVertical className="mx-0.5 inline size-3.5 text-[#20815b]" /> in the top corner.</span></li>
                  <li className="flex gap-2.5"><span className="step-number">3</span><span>Choose <b>Install app</b> or <b>Add to Home screen</b>.</span></li>
                  <li className="flex gap-2.5"><span className="step-number">4</span><span>Confirm <b>Install</b> or <b>Add</b>.</span></li>
                </ol>
              </article>
            </div>

            <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:pb-7">
              <p className="max-w-sm text-[10px] leading-4 text-[#858093]">On a computer? Use the install icon in your browser’s address bar or choose <b>Install StudyStation</b> from its menu.</p>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setShowInstructions(false)} className="rounded-xl border border-[#e6e2ed] px-4 py-2.5 text-xs font-extrabold text-[#625b70] transition hover:bg-[#f8f6fb]">Close</button>
                {installPrompt && !isInstalled && (
                  <button type="button" disabled={isInstalling} onClick={() => void installNow()} className="inline-flex items-center gap-2 rounded-xl bg-[#7259e8] px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#7259e8]/20 transition hover:bg-[#6048d5] disabled:opacity-60">
                    {isInstalling ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Download className="size-3.5" />}
                    Install now
                  </button>
                )}
              </div>
            </div>
            {installError && <p role="alert" className="px-7 pb-5 text-xs text-[#a44e48]">{installError}</p>}
            {isInstalled && <p className="flex items-center gap-2 px-7 pb-5 text-xs font-bold text-[#20815b]"><Check className="size-4" /> StudyStation is installed on this device.</p>}
          </section>
        </div>
      )}
    </InstallContext.Provider>
  );
}

export function useInstallApp() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstallApp must be used within InstallAppProvider.");
  return context;
}
