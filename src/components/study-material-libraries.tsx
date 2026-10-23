"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Layers3, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import type { FlashcardsOutput, QuizOutput } from "@/lib/study-lab-validation";

type StudyMaterial = {
  id: string;
  type: "flashcards" | "quiz";
  title: string;
  sourceTitle: string;
  createdAt: string;
  output: FlashcardsOutput | QuizOutput;
};

type LoadState = {
  loading: boolean;
  error: string;
  materials: StudyMaterial[];
};

function useStudyMaterials() {
  const [state, setState] = useState<LoadState>({ loading: true, error: "", materials: [] });
  useEffect(() => {
    let active = true;
    void fetch("/api/study-materials", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { materials?: StudyMaterial[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Generated study materials could not be loaded.");
        return body;
      })
      .then((body) => {
        if (active) setState({ loading: false, error: "", materials: body.materials ?? [] });
      })
      .catch((cause: unknown) => {
        if (active) setState({
          loading: false,
          error: cause instanceof Error ? cause.message : "Generated study materials could not be loaded.",
          materials: [],
        });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function GeneratedFlashcardsLibrary({ onOpenStudyLab }: { onOpenStudyLab: () => void }) {
  const { loading, error, materials } = useStudyMaterials();
  const decks = materials.filter((material): material is StudyMaterial & { output: FlashcardsOutput } =>
    material.type === "flashcards" && "cards" in material.output);
  const [selectedId, setSelectedId] = useState("");
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const selected = decks.find((deck) => deck.id === selectedId) ?? decks[0] ?? null;

  function moveCard(direction: number) {
    if (!selected) return;
    setCardIndex((index) => (index + direction + selected.output.cards.length) % selected.output.cards.length);
    setFlipped(false);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">AI STUDY LAB LIBRARY</p>
          <h2 className="mt-1 text-lg font-black text-[#17132d]">Generated flashcard decks</h2>
          <p className="mt-1 text-xs leading-5 text-[#7d7789]">Decks created in AI Study Lab show up here automatically.</p>
        </div>
        <button type="button" onClick={onOpenStudyLab} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#7259e8] px-3 text-[10px] font-extrabold text-white">
          <Sparkles className="size-3.5" /> Create in AI Study Lab
        </button>
      </div>

      {error ? <p role="alert" className="rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a44e48]">{error}</p>
        : loading ? <div className="flex items-center gap-2 rounded-2xl border border-[#e9e5ef] bg-white p-5 text-xs font-semibold text-[#817b8e]"><LoaderCircle className="size-4 animate-spin" /> Loading your generated flashcards…</div>
          : decks.length === 0 ? <div className="rounded-2xl border border-dashed border-[#dcd6e8] bg-white/70 p-8 text-center"><Layers3 className="mx-auto size-8 text-[#7259e8]/60" /><h3 className="mt-3 text-sm font-black text-[#17132d]">No generated flashcards yet</h3><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#868093]">Open AI Study Lab, choose Flashcards, and generate a deck from one of your lectures. It will appear here when saved.</p></div>
            : <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {decks.map((deck) => (
                  <button key={deck.id} type="button" onClick={() => { setSelectedId(deck.id); setCardIndex(0); setFlipped(false); }} className={`min-w-[170px] rounded-xl border px-3 py-2.5 text-left ${selected?.id === deck.id ? "border-[#a99aed] bg-[#f4f1ff]" : "border-[#e9e5ef] bg-white"}`}>
                    <span className="block truncate text-[10px] font-extrabold text-[#28233a]">{deck.title}</span>
                    <span className="mt-1 block truncate text-[9px] text-[#85808d]">{deck.output.cards.length} cards · {deck.sourceTitle}</span>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#eeeaff] px-3 py-1 text-[9px] font-black text-[#7259e8]">CARD {cardIndex + 1} OF {selected.output.cards.length}</span>
                      <span className="text-[10px] font-bold text-[#868093]">{masteredCount} marked as known</span>
                    </div>
                    <button type="button" onClick={() => setFlipped((value) => !value)} className="mt-5 flex min-h-[210px] w-full flex-col items-center justify-center rounded-2xl border border-[#e5ddfa] bg-gradient-to-tr from-[#faf9fd] to-[#f4f0ff] p-6 text-center transition hover:shadow-md">
                      <span className="rounded-full bg-white px-3 py-1 text-[9px] font-black text-[#7259e8] shadow-sm">{flipped ? "ANSWER" : "QUESTION · TAP TO REVEAL"}</span>
                      <p className="mt-5 text-base font-extrabold leading-7 text-[#17132d]">{flipped ? selected.output.cards[cardIndex].back : selected.output.cards[cardIndex].front}</p>
                    </button>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button type="button" onClick={() => moveCard(-1)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e9e5ef] px-3 text-[10px] font-bold"><ChevronLeft className="size-4" /> Previous</button>
                      <button type="button" onClick={() => { setMasteredCount((count) => count + 1); moveCard(1); }} className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#e5f7ed] px-3 text-[10px] font-extrabold text-[#287451]"><CheckCircle2 className="size-4" /> Got it</button>
                      <button type="button" onClick={() => moveCard(1)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e9e5ef] px-3 text-[10px] font-bold">Next <ChevronRight className="size-4" /></button>
                    </div>
                  </div>
                  <aside className="rounded-[24px] bg-[#17132d] p-5 text-white">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#7259e8]"><BookOpen className="size-4" /></span>
                    <h3 className="mt-4 text-sm font-black">{selected.title}</h3>
                    <p className="mt-1 text-[10px] leading-5 text-white/60">Generated from {selected.sourceTitle}. Review the prompt, reveal the answer, then mark it as known or keep practicing.</p>
                    <button type="button" onClick={() => { setCardIndex(0); setFlipped(false); setMasteredCount(0); }} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-white/10 px-3 text-[10px] font-extrabold text-white hover:bg-white/15"><RotateCcw className="size-3.5" /> Restart deck</button>
                  </aside>
                </div>
              )}
            </>}
    </section>
  );
}

export function GeneratedQuizLibrary() {
  const router = useRouter();
  const { loading, error, materials } = useStudyMaterials();
  const quizzes = materials.filter((material): material is StudyMaterial & { output: QuizOutput } =>
    material.type === "quiz" && "questions" in material.output);
  const [selectedId, setSelectedId] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const selected = quizzes.find((quiz) => quiz.id === selectedId) ?? quizzes[0] ?? null;

  function selectQuiz(id: string) {
    setSelectedId(id);
    setAnswers({});
    setMessage("");
    setRequestError("");
  }

  async function saveAttempt() {
    if (!selected) return;
    const selectedAnswers = selected.output.questions.map((_, index) => answers[index]);
    if (selectedAnswers.some((answer) => !Number.isInteger(answer))) {
      setRequestError("Answer every question before saving your attempt.");
      return;
    }
    setSaving(true);
    setRequestError("");
    setMessage("");
    try {
      const response = await fetch(`/api/study-lab/${selected.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers }),
      });
      const body = await response.json() as { error?: string; attempt?: { score: number; total: number } };
      if (!response.ok || !body.attempt) throw new Error(body.error || "Your quiz result could not be saved.");
      setMessage(`Saved to your progress: ${body.attempt.score} / ${body.attempt.total}.`);
      router.refresh();
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "Your quiz result could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]"><CircleHelp className="size-4.5" /></span>
        <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">AI STUDY LAB LIBRARY</p><h2 className="mt-0.5 text-[15px] font-extrabold text-[#17132d]">Generated practice quizzes</h2></div>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a44e48]">{error}</p>
        : loading ? <div className="mt-4 flex items-center gap-2 text-xs text-[#817b8e]"><LoaderCircle className="size-4 animate-spin" /> Loading your generated quizzes…</div>
          : quizzes.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[#e3deeb] bg-[#fbfaff] p-4 text-center text-xs leading-5 text-[#8a8494]">No quizzes yet. Create and save one in AI Study Lab to see it here.</p>
            : <>
              <label className="mt-4 block text-[10px] font-extrabold text-[#5d5768]">SELECT A QUIZ
                <select value={selected?.id ?? ""} onChange={(event) => selectQuiz(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-3 text-xs font-semibold text-[#302a40] outline-none focus:border-[#aa9af0]">
                  {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title} · {quiz.sourceTitle}</option>)}
                </select>
              </label>
              {selected && <div className="mt-4 space-y-3">
                <p className="text-[10px] text-[#85808d]">From {selected.sourceTitle} · {selected.output.questions.length} questions</p>
                {selected.output.questions.map((question, index) => (
                  <fieldset key={`${selected.id}-${index}`} className="rounded-xl border border-[#ebe7f0] p-3">
                    <legend className="px-1 text-[10px] font-extrabold text-[#28233a]">Q{index + 1}. {question.question}</legend>
                    <div className="mt-2 space-y-1.5">
                      {question.choices.map((choice, choiceIndex) => <label key={`${choiceIndex}-${choice}`} className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-[9px] leading-4 ${answers[index] === choiceIndex ? "bg-[#f3f0ff]" : "hover:bg-[#faf9fc]"}`}>
                        <input type="radio" name={`generated-quiz-${selected.id}-${index}`} checked={answers[index] === choiceIndex} onChange={() => { setAnswers((previous) => ({ ...previous, [index]: choiceIndex })); setMessage(""); setRequestError(""); }} className="mt-0.5 accent-[#7259e8]" />
                        <span>{choice}</span>
                      </label>)}
                    </div>
                  </fieldset>
                ))}
                {requestError && <p role="alert" className="rounded-lg bg-[#fff1ef] p-2.5 text-[9px] font-semibold text-[#a44e48]">{requestError}</p>}
                {message && <p role="status" className="rounded-lg bg-[#e9f7ef] p-2.5 text-[9px] font-semibold text-[#287451]">{message}</p>}
                <button type="button" disabled={saving} onClick={() => void saveAttempt()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17132d] py-2.5 text-[10px] font-extrabold text-white disabled:opacity-60">{saving && <LoaderCircle className="size-3.5 animate-spin" />} Check answers and save attempt</button>
              </div>}
            </>}
    </section>
  );
}
