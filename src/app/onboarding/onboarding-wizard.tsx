"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, GraduationCap, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { saveOnboarding } from "@/app/onboarding/actions";
import type { AuthActionState } from "@/app/auth/actions";
import { landingUniversities } from "@/lib/universities";

type UniversityOption = { id: string; name: string; country_code: string };
type CourseDraft = { code: string; title: string };
type ProfileDraft = {
  fullName: string;
  university: string;
  universityId: string;
  country: string;
  otherCountry: string;
  programme: string;
  academicLevel: string;
  semester: string;
  timezone: string;
};

const countryOptions = [
  ["GH", "Ghana"],
  ["NG", "Nigeria"],
  ["KE", "Kenya"],
  ["ZA", "South Africa"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["OTHER", "Another country"],
];

const initialState: AuthActionState = {};

export function OnboardingWizard({
  initialProfile,
  initialStep,
  universities,
  catalogUnavailable,
  initialCourses,
  courseCatalogUnavailable,
}: {
  initialProfile: ProfileDraft;
  initialStep: number;
  universities: UniversityOption[];
  catalogUnavailable: boolean;
  initialCourses: CourseDraft[];
  courseCatalogUnavailable: boolean;
}) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), 2));
  const [courses, setCourses] = useState<CourseDraft[]>(initialCourses.length ? initialCourses : [{ code: "", title: "" }]);
  const [university, setUniversity] = useState(initialProfile.university);
  const [universityId, setUniversityId] = useState(initialProfile.universityId);
  const [universityOpen, setUniversityOpen] = useState(false);
  const [searchedUniversities, setSearchedUniversities] = useState<UniversityOption[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [universitySearchError, setUniversitySearchError] = useState("");
  const universitySearching = university.trim().length >= 2 && searchedQuery !== university.trim();
  const universityOptions = useMemo(() => {
    const options = new Map<string, UniversityOption>();
    searchedUniversities.forEach((item) => options.set(item.name.trim().toLocaleLowerCase(), item));
    universities.forEach((item) => options.set(item.name.trim().toLocaleLowerCase(), item));
    landingUniversities.forEach((item) => {
      const key = item.name.trim().toLocaleLowerCase();
      if (!options.has(key)) options.set(key, { id: "", name: item.name, country_code: "GH" });
    });
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [searchedUniversities, universities]);
  useEffect(() => {
    const query = university.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/universities?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          const result = await response.json() as { universities?: UniversityOption[]; error?: string };
          if (!response.ok) throw new Error(result.error ?? "University search failed. Please try again.");
          setSearchedUniversities(result.universities ?? []);
          setSearchedQuery(query);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchedUniversities([]);
          setSearchedQuery(query);
          setUniversitySearchError(error instanceof Error ? error.message : "University search failed. Please try again.");
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [university]);
  const visibleUniversities = useMemo(() => {
    const query = university.trim().toLocaleLowerCase();
    return universityOptions
      .filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
      .slice(0, 12);
  }, [university, universityOptions]);
  const submitAction = async (previousState: AuthActionState, formData: FormData) => {
    const result = await saveOnboarding(previousState, formData);
    if (result.nextStep !== undefined) setStep(result.nextStep);
    return result;
  };
  const [state, formAction, pending] = useActionState(submitAction, initialState);

  function updateCourse(index: number, field: keyof CourseDraft, value: string) {
    setCourses((current) => current.map((course, courseIndex) => courseIndex === index ? { ...course, [field]: value } : course));
  }

  return (
    <main className="hero-glow relative min-h-screen overflow-x-clip bg-[#fbfaff] px-4 py-6 sm:px-8">
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[900px] flex-col">
        <header className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-[11px] bg-[#7259e8] text-lg font-black text-white">N</span><b className="text-xl font-extrabold tracking-[-.7px]">noteva</b></span>
          <span className="text-xs font-bold text-[#8b8593]">Step {step + 1} of 3</span>
        </header>

        <section className="mx-auto my-auto w-full max-w-[640px] py-10">
          <div className="mb-5 flex gap-2" aria-label="Setup progress">
            {[0, 1, 2].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-[#7259e8]" : "bg-[#e8e4ef]"}`} />)}
          </div>

          {step === 0 && (
            <>
              <span className="grid size-12 place-items-center rounded-2xl bg-[#eeeaff] text-[#7259e8]"><GraduationCap className="size-6" /></span>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Welcome to your study space</p>
              <h1 className="mt-2 text-[30px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[36px]">Let’s make Noteva yours.</h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[#777180]">Add a little academic context so you can keep your courses and study materials organized. You can skip optional details.</p>
              <form action={formAction} className="mt-7 space-y-4 rounded-[26px] border border-[#e8e4ef] bg-white p-5 shadow-[0_20px_70px_rgba(41,31,77,.08)] sm:p-7">
                <input type="hidden" name="step" value="0" />
                <input type="hidden" name="timezone" value={initialProfile.timezone || "UTC"} />
                <label className="block text-xs font-bold text-[#343047]">Display name
                  <input name="fullName" defaultValue={initialProfile.fullName} required minLength={2} maxLength={100} autoComplete="name" className="mt-2 h-12 w-full rounded-xl border border-[#e5e1ec] px-3.5 text-sm outline-none focus:border-[#a99aec]" />
                </label>

                <div className="block text-xs font-bold text-[#343047]">
                  <label htmlFor="university-name">University <span className="font-medium text-[#9a94a3]">(optional)</span></label>
                  <div
                    className="relative mt-2"
                    onBlur={(event) => {
                      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                        window.setTimeout(() => setUniversityOpen(false), 120);
                      }
                    }}
                  >
                    <input
                      id="university-name"
                      name="university"
                      value={university}
                      onChange={(event) => {
                        const value = event.target.value;
                        const exactMatch = universityOptions.find((item) => item.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
                        setUniversity(value);
                        setUniversityId(exactMatch?.id ?? "");
                        setSearchedUniversities([]);
                        setUniversitySearchError("");
                        setUniversityOpen(true);
                      }}
                      onFocus={() => setUniversityOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setUniversityOpen(false);
                        if (event.key === "ArrowDown" && visibleUniversities.length > 0) {
                          event.preventDefault();
                          event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[role="option"] button')?.focus();
                        }
                      }}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={universityOpen && (visibleUniversities.length > 0 || university.trim().length >= 2)}
                      aria-controls="university-suggestions"
                      autoComplete="off"
                      maxLength={160}
                      placeholder="Start typing or choose a university"
                      className="h-12 w-full rounded-xl border border-[#e5e1ec] bg-white px-3.5 pr-10 text-sm outline-none focus:border-[#a99aec]"
                    />
                    <input type="hidden" name="universityId" value={universityId} />
                    <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8b8593] transition-transform ${universityOpen ? "rotate-180" : ""}`} />
                    {universityOpen && (visibleUniversities.length > 0 || universitySearching || universitySearchError || university.trim().length >= 2) && (
                      <ul id="university-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#e5e1ec] bg-white p-1.5 shadow-[0_16px_40px_rgba(41,31,77,.14)]">
                        {universitySearching && <li role="presentation" className="px-3 py-2.5 text-xs font-medium text-[#8c8795]">Searching universities…</li>}
                        {!universitySearching && universitySearchError && <li role="presentation" className="px-3 py-2.5 text-xs font-medium text-[#a44e48]">{universitySearchError}</li>}
                        {!universitySearching && !universitySearchError && visibleUniversities.length === 0 && university.trim().length >= 2 && <li role="presentation" className="px-3 py-2.5 text-xs font-medium text-[#8c8795]">No matches. You can keep your university name as typed.</li>}
                        {visibleUniversities.map((item) => (
                          <li key={item.id || item.name} role="option" aria-selected={university.trim().toLocaleLowerCase() === item.name.toLocaleLowerCase()}>
                            <button
                              type="button"
                              onClick={() => {
                                setUniversity(item.name);
                                setUniversityId(item.id);
                                setUniversityOpen(false);
                              }}
                              className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#343047] hover:bg-[#f4f1ff] focus:bg-[#f4f1ff] focus:outline-none"
                            >
                              {item.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="mt-1.5 block text-[11px] font-medium text-[#8c8795]">
                    {catalogUnavailable ? "The university list isn’t available; you can still enter your university." : "Choose a suggestion or keep typing to enter another university."}
                  </span>
                </div>
{/* 
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-[#343047]">Country <span className="font-medium text-[#9a94a3]">(optional)</span>
                    <select name="country" defaultValue={countryOptions.some(([code]) => code === initialProfile.country) ? initialProfile.country : initialProfile.country ? "OTHER" : ""} className="mt-2 h-12 w-full rounded-xl border border-[#e5e1ec] bg-white px-3.5 text-sm outline-none focus:border-[#a99aec]">
                      <option value="" selected disabled>Choose a country</option>
                      {countryOptions.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
                    </select>
                  </label>
                  {/* <label className="block text-xs font-bold text-[#343047]">Country name if other
                    <input name="otherCountry" defaultValue={countryOptions.some(([code]) => code === initialProfile.country) ? "" : initialProfile.country} maxLength={80} placeholder="Country name" className="mt-2 h-12 w-full rounded-xl border border-[#e5e1ec] px-3.5 text-sm outline-none focus:border-[#a99aec]" />
                  </label> */} 
                {/* </div> */}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-[#343047]">Programme / department <span className="font-medium text-[#9a94a3]">(optional)</span>
                    <input name="programme" defaultValue={initialProfile.programme} maxLength={160} placeholder="e.g. Computer Science" className="mt-2 h-12 w-full rounded-xl border border-[#e5e1ec] px-3.5 text-sm outline-none focus:border-[#a99aec]" />
                  </label>
                  <label className="block text-xs font-bold text-[#343047]">Academic level <span className="font-medium text-[#9a94a3]">(optional)</span>
                    <input name="academicLevel" defaultValue={initialProfile.academicLevel} maxLength={80} placeholder="e.g. Year 2" className="mt-2 h-12 w-full rounded-xl border border-[#e5e1ec] px-3.5 text-sm outline-none focus:border-[#a99aec]" />
                  </label>
                </div>
                <label className="block text-xs font-bold text-[#343047]">Current semester <span className="font-medium text-[#9a94a3]">(optional)</span>
                  <input name="semester" defaultValue={initialProfile.semester} maxLength={80} placeholder="e.g. Semester 1, 2026" className="mt-2 h-12 w-full rounded-xl border border-[#e5e1ec] px-3.5 text-sm outline-none focus:border-[#a99aec]" />
                </label>
                <SubmitButton pending={pending} label="Save and continue" />
              </form>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Your courses</p>
              <h1 className="mt-2 text-[30px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[36px]">What are you studying?</h1>
              <p className="mt-2 text-sm leading-6 text-[#777180]">Add course codes and titles to get started. You can skip this and add courses later.</p>
              <form action={formAction} className="mt-7 rounded-[26px] border border-[#e8e4ef] bg-white p-5 shadow-[0_20px_70px_rgba(41,31,77,.08)] sm:p-7">
                <input type="hidden" name="step" value="1" />
                <input type="hidden" name="fullName" value={initialProfile.fullName} />
                <input type="hidden" name="university" value={initialProfile.university} />
                <input type="hidden" name="universityId" value={initialProfile.universityId} />
                <input type="hidden" name="country" value={initialProfile.country} />
                <input type="hidden" name="otherCountry" value="" />
                <input type="hidden" name="programme" value={initialProfile.programme} />
                <input type="hidden" name="academicLevel" value={initialProfile.academicLevel} />
                <input type="hidden" name="semester" value={initialProfile.semester} />
                <input type="hidden" name="timezone" value={initialProfile.timezone || "UTC"} />
                <input type="hidden" name="courses" value={JSON.stringify(courses)} readOnly />
                {courseCatalogUnavailable && <p className="mb-4 rounded-xl border border-[#f0e4c8] bg-[#fff9e9] px-4 py-3 text-xs leading-5 text-[#80621c]">We couldn’t load your saved courses. You can still add new courses here; existing courses won’t be removed.</p>}

                {courses.length > 0 && (
                  <div className="space-y-3">
                    {courses.map((course, index) => (
                      <div className="grid gap-3 sm:grid-cols-[.7fr_1.3fr_auto]" key={index}>
                        <label className="text-xs font-bold text-[#343047]">Course code
                          <input value={course.code} onChange={(event) => updateCourse(index, "code", event.target.value)} maxLength={30} placeholder="e.g. BIO 202" className="mt-2 h-11 w-full rounded-xl border border-[#e5e1ec] px-3 text-sm outline-none focus:border-[#a99aec]" />
                        </label>
                        <label className="text-xs font-bold text-[#343047]">Course title
                          <input value={course.title} onChange={(event) => updateCourse(index, "title", event.target.value)} maxLength={120} placeholder="e.g. Cell Biology" className="mt-2 h-11 w-full rounded-xl border border-[#e5e1ec] px-3 text-sm outline-none focus:border-[#a99aec]" />
                        </label>
                        <button type="button" onClick={() => setCourses((current) => current.filter((_, courseIndex) => courseIndex !== index))} className="mt-5 grid size-10 place-items-center rounded-xl text-[#958f9d] hover:bg-[#fff2f0] hover:text-[#b24e45]" aria-label={`Remove course ${index + 1}`}><Trash2 className="size-4" /></button>
                      </div>
                    ))}
                  </div>
                )}

                {courses.length < 12 && <button type="button" onClick={() => setCourses((current) => [...current, { code: "", title: "" }])} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6e1ef] px-3 text-xs font-extrabold text-[#7259e8] hover:bg-[#f7f5ff]"><Plus className="size-4" /> Add a course</button>}
                {courses.length === 0 && <button type="button" onClick={() => setCourses([{ code: "", title: "" }])} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6e1ef] px-3 text-xs font-extrabold text-[#7259e8] hover:bg-[#f7f5ff]"><Plus className="size-4" /> Add a course</button>}

                <div className="mt-7 flex flex-col-reverse justify-between gap-3 border-t border-[#f0edf4] pt-5 sm:flex-row">
                  <button type="button" onClick={() => setStep(0)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold text-[#777180] hover:bg-[#f7f5fa]"><ArrowLeft className="size-4" /> Back</button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="submit" name="skip" value="1" className="h-11 rounded-xl px-4 text-xs font-extrabold text-[#777180] hover:bg-[#f7f5fa]">Skip for now</button>
                    <SubmitButton pending={pending} label="Save courses" />
                  </div>
                </div>
              </form>
            </>
          )}

          {step === 2 && (
            <div className="rounded-[28px] border border-[#e8e4ef] bg-white p-7 text-center shadow-[0_20px_70px_rgba(41,31,77,.08)] sm:p-10">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e5f8ed] text-[#278c63]"><Check className="size-7" /></span>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">Setup saved</p>
              <h1 className="mt-2 text-[30px] font-black tracking-[-1.1px] text-[#17132d]">You’re ready to get started.</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#777180]">Your profile and course choices are saved. Open your study space whenever you’re ready; you can update these details later.</p>
              {state.error && <p className="mt-5 rounded-xl border border-[#f2d5d2] bg-[#fff4f2] px-4 py-3 text-left text-sm text-[#9b3f38]" role="alert">{state.error}</p>}
              <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                <button type="button" onClick={() => setStep(1)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#e5e1ec] px-5 text-sm font-extrabold text-[#686274] hover:bg-[#faf9fc]"><ArrowLeft className="size-4" /> Back to courses</button>
                <form action={formAction}>
                  <input type="hidden" name="step" value="2" />
                  <input type="hidden" name="fullName" value={initialProfile.fullName} />
                  <input type="hidden" name="university" value={initialProfile.university} />
                  <input type="hidden" name="universityId" value={initialProfile.universityId} />
                  <input type="hidden" name="country" value={initialProfile.country} />
                  <input type="hidden" name="programme" value={initialProfile.programme} />
                  <input type="hidden" name="academicLevel" value={initialProfile.academicLevel} />
                  <input type="hidden" name="semester" value={initialProfile.semester} />
                  <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-5 text-sm font-extrabold text-white hover:bg-[#624bda] disabled:opacity-70">
                    {pending ? <><LoaderCircle className="size-4 animate-spin" /> Finishing…</> : <>Go to my study space <ArrowRight className="size-4" /></>}
                  </button>
                </form>
              </div>
            </div>
          )}

          {state.error && step !== 2 && <p className="mt-4 rounded-xl border border-[#f2d5d2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b3f38]" role="alert">{state.error}</p>}
        </section>
      </div>
    </main>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-5 text-xs font-extrabold text-white hover:bg-[#624bda] disabled:cursor-wait disabled:opacity-70">
      {pending ? <><LoaderCircle className="size-4 animate-spin" /> Saving…</> : <>{label} <ArrowRight className="size-4" /></>}
    </button>
  );
}
