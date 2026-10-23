import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  CircleHelp,
  FileText,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Brand } from "@/components/brand";

const sectionIcons = [
  BookOpenCheck,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  UsersRound,
  FileText,
  HeartHandshake,
  CircleHelp,
];

export const footerLinkGroups: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/about", label: "About StudyStation" },
      { href: "/features", label: "Features" },
      { href: "/faq", label: "FAQs" },
    ],
  },
  {
    title: "Policies & community",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/community-guidelines", label: "Community Guidelines" },
    ],
  },
];

export type InfoSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export function InfoPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: InfoSection[];
}) {
  return (
    <main className="info-page min-h-screen overflow-hidden bg-[#fbfaff] px-5 py-5 text-[#17132d] sm:px-8 sm:py-7">
      <header className="info-enter relative z-10 mx-auto flex max-w-[1180px] items-center justify-between">
        <Brand />
        <Link href="/" className="group inline-flex items-center gap-2 rounded-full border border-[#e6e1ef] bg-white/80 px-4 py-2.5 text-xs font-bold text-[#514a66] shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#c9bdf4] hover:text-[#7259e8]">
          <ArrowRight className="size-3.5 rotate-180 transition-transform group-hover:-translate-x-1" />
          Back to home
        </Link>
      </header>

      <div className="relative mx-auto max-w-[1180px]">
        <div className="info-orb info-orb-one" aria-hidden="true" />
        <div className="info-orb info-orb-two" aria-hidden="true" />
        <section className="info-hero relative z-[1] mx-auto mt-8 max-w-[960px] px-2 pb-12 pt-10 text-center sm:mt-12 sm:px-8 sm:pb-16 sm:pt-14">
          <div className="info-enter inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-3.5 py-2 text-[10px] font-black uppercase tracking-[.15em] text-[#654ad8] shadow-[0_8px_30px_rgba(114,89,232,.1)] backdrop-blur">
            <Sparkles className="size-3.5 fill-[#ffdf78] text-[#7259e8]" />
            Your StudyStation guide
          </div>
          <h1 className="info-enter mx-auto mt-6 max-w-[900px] text-balance text-[38px] font-black leading-[1.04] tracking-[-2.3px] sm:text-[58px] sm:tracking-[-3.5px] lg:text-[68px]">
            {title}
            <span className="info-title-mark" aria-hidden="true" />
          </h1>
          <p className="info-enter mx-auto mt-5 max-w-[680px] text-[14px] leading-7 text-[#706a7e] sm:text-base sm:leading-8">
            {description}
          </p>
          <div className="info-enter mt-7 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold text-[#7e778a]">
            <span className="rounded-full border border-white bg-white/70 px-3 py-1.5 shadow-sm">Made for focused learning</span>
            <span className="size-1 rounded-full bg-[#b6a8ef]" aria-hidden="true" />
            <span>Simple. Supportive. Student-first.</span>
          </div>
        </section>

        <article className="relative z-[1] mx-auto max-w-[1060px] pb-14 sm:pb-20">
          <div className="mb-5 flex items-end justify-between gap-4 px-1 sm:mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Good to know</p>
              <h2 className="mt-1.5 text-xl font-black tracking-[-.7px] sm:text-2xl">The details, made clear</h2>
            </div>
            <span className="hidden rounded-full border border-[#e9e5f2] bg-white/80 px-3 py-1.5 text-[10px] font-bold text-[#8b8496] sm:inline-flex">
              {String(sections.length).padStart(2, "0")} helpful notes
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {sections.map((section, index) => {
              const Icon = sectionIcons[index % sectionIcons.length];

              return (
                <section
                  key={section.heading}
                  className="info-page-card group relative overflow-hidden rounded-[24px] border border-[#e9e5f1] bg-white/90 p-5 shadow-[0_10px_35px_rgba(41,31,77,.045)] backdrop-blur-sm sm:rounded-[28px] sm:p-7"
                  style={{ animationDelay: `${Math.min(index * 90, 450)}ms` }}
                >
                  <div className="absolute -right-14 -top-16 size-36 rounded-full bg-[#eeeaff]/70 blur-2xl transition duration-500 group-hover:scale-150 group-hover:bg-[#e4dcff]" aria-hidden="true" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#f0edff] to-[#faf9ff] text-[#7259e8] ring-1 ring-[#eae5fc] transition duration-300 group-hover:-rotate-3 group-hover:scale-110">
                        <Icon className="size-5" strokeWidth={1.8} />
                      </span>
                      <span className="font-mono text-[11px] font-bold tracking-widest text-[#c3bdd0]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-5 text-[16px] font-extrabold tracking-[-.3px] sm:text-[18px]">{section.heading}</h3>
                    <div className="mt-2.5 space-y-3 text-[12px] leading-[1.8] text-[#716a7e] sm:text-[13px]">
                      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      {section.bullets && (
                        <ul className="space-y-2.5 pt-1">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-2.5">
                              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#7259e8] to-[#9b83ff]" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-5 h-px w-10 bg-gradient-to-r from-[#7259e8]/60 to-transparent transition-all duration-500 group-hover:w-20" />
                  </div>
                </section>
              );
            })}
          </div>
        </article>

        <section className="info-cta relative z-[1] mx-auto mb-12 max-w-[1060px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#21183e] via-[#39276f] to-[#654ad8] px-6 py-8 text-white shadow-[0_22px_65px_rgba(54,37,112,.2)] sm:mb-16 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-10 sm:py-9">
          <div className="info-cta-orb absolute -right-10 -top-28 size-64 rounded-full bg-[#a48bff]/25 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#d8ceff]">Make your next study session count</p>
            <h2 className="mt-2 text-xl font-black tracking-[-.5px] sm:text-2xl">Your study space is ready when you are.</h2>
          </div>
          <Link href="/auth/register" className="group relative mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-extrabold text-[#5039b6] shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:mt-0">
            Get started free
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </section>
      </div>

      <footer className="relative z-[1] mx-auto flex max-w-[1180px] flex-col gap-5 border-t border-[#e9e5ef] py-6 text-[11px] text-[#777180] sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2">
          <Brand compact />
          <span className="font-bold">© 2026 StudyStation</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Site policies">
          {footerLinkGroups.flatMap((group) => group.links).map(({ href, label }) => (
            <Link key={href} href={href} className="font-semibold transition-colors hover:text-[#7259e8]">
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}
