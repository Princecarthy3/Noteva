import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { ForceLightTheme } from "@/components/force-light-theme";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="hero-glow relative min-h-screen overflow-hidden bg-[#fbfaff] px-4 py-6 sm:px-8">
      <ForceLightTheme />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1180px] flex-col">
        <header className="flex items-center justify-between">
          <Brand />
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#676276] hover:bg-white hover:text-[#7259e8]">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </header>
        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_440px] lg:gap-20">
          <section className="hidden max-w-xl lg:block">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ddd6ff] bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#5d48ca]">
              <Sparkles className="size-3.5" /> Your learning, in one place
            </span>
            <h2 className="mt-6 text-[52px] font-black leading-[1.02] tracking-[-2.7px] text-[#17132d]">
              Make every lecture count.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#676276]">
              Capture class, organize your courses, and turn what you learn into a study routine that works for you.
            </p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-[#e9e5f0] bg-white/80 p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]"><BookOpenCheck className="size-5" /></span>
              <span><b className="block text-sm text-[#28213f]">Built for your study week</b><small className="mt-1 block text-xs text-[#858090]">Courses, notes, and your next step—together.</small></span>
            </div>
          </section>
          <div className="flex justify-center">{children}</div>
        </div>
        <p className="pb-2 text-center text-[11px] font-medium text-[#9a94a3]">Your private study space. Your data stays yours.</p>
      </div>
    </main>
  );
}
