"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Menu, Share2, X } from "lucide-react";
import { Brand } from "@/components/brand";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setShowInstallHelp(true);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#ebe8f3]/80 bg-[#fbfaff]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-8 text-[14px] font-semibold text-[#555064] md:flex" aria-label="Main navigation">
            <a className="transition hover:text-[#7259e8]" href="#how-it-works">How it works</a>
            <a className="transition hover:text-[#7259e8]" href="#features">Features</a>
            <a className="transition hover:text-[#7259e8]" href="#students">For students</a>
            <a className="transition hover:text-[#7259e8]" href="#faq">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={install} className="inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-[#514a66] transition hover:bg-[#f0edfa]" type="button">
              <Download className="size-4" /> Install
            </button>
            <Link href="/auth/login" className="inline-flex h-10 items-center rounded-xl bg-[#17132d] px-5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(23,19,45,.16)] transition hover:-translate-y-0.5 hover:bg-[#2b244b]">
              Sign in
            </Link>
          </div>
          <button onClick={() => setMenuOpen((value) => !value)} className="grid size-10 place-items-center rounded-xl bg-white text-[#17132d] shadow-sm md:hidden" aria-label="Toggle navigation" type="button">
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-[#ebe8f3] bg-white px-5 py-5 md:hidden">
            <nav className="flex flex-col gap-1 text-[15px] font-semibold">
              {[["How it works", "#how-it-works"], ["Features", "#features"], ["For students", "#students"], ["FAQ", "#faq"]].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 hover:bg-[#f7f5ff]">{label}</a>
              ))}
              <button onClick={install} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#ded9ee] px-4 py-3 font-bold" type="button"><Download className="size-4" /> Install app</button>
              <Link href="/auth/login" className="mt-1 rounded-xl bg-[#7259e8] px-4 py-3 text-center font-bold text-white">Sign in</Link>
            </nav>
          </div>
        )}
      </header>

      {showInstallHelp && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#17132d]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Install Noteva">
          <div className="w-full max-w-sm rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-2xl bg-[#eeeaff] text-[#7259e8]"><Download className="size-5" /></div>
              <button onClick={() => setShowInstallHelp(false)} className="grid size-9 place-items-center rounded-full bg-[#f5f3fa]" aria-label="Close install instructions"><X className="size-4" /></button>
            </div>
            <h2 className="mt-5 text-xl font-extrabold tracking-tight">Keep Noteva on your home screen</h2>
            <p className="mt-2 text-sm leading-6 text-[#6e6a7e]">On iPhone or iPad, tap <Share2 className="mx-1 inline size-4" /> <b>Share</b>, then choose <b>Add to Home Screen</b>. On Android, open your browser menu and tap <b>Install app</b>.</p>
            <button onClick={() => setShowInstallHelp(false)} className="mt-5 w-full rounded-xl bg-[#17132d] py-3 text-sm font-bold text-white">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
