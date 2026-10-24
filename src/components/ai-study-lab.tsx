"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import type { StudyLabAction, StudyLabOutput } from "@/lib/study-lab-validation";

type LectureSource = {
  id: string;
  title: string;
  course_id: string | null;
  created_at: string;
};

type Generation = {
  id: string;
  task: string;
  status: string;
  input_metadata: {
    action?: StudyLabAction;
    lectureId?: string;
    lectureTitle?: string;
    difficulty?: string;
    sourceTruncated?: boolean;
  } | null;
  output: StudyLabOutput | null;
  model: string | null;
  error_code: string | null;
  created_at: string;
};

const actionLabels: Record<StudyLabAction, string> = {
  summary: "Revision summary",
  explain: "Explain a concept",
  ask: "Ask from this lecture",
  flashcards: "Flashcards",
  quiz: "Practice quiz",
  simplify: "Simplify material",
};

const actionDescriptions: Record<StudyLabAction, string> = {
  summary: "Get a structured overview, key terms, and a revision checklist.",
  explain: "Ask for a clear explanation of a concept from the selected lecture.",
  ask: "Ask a direct question and receive an answer grounded in the transcript.",
  flashcards: "Create active-recall cards from the key ideas.",
  quiz: "Build a multiple-choice practice quiz with explanations.",
  simplify: "Rephrase a challenging passage in simpler language.",
};

const initialActions: StudyLabAction[] = ["summary", "explain", "ask", "flashcards", "quiz", "simplify"];

async function responseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error ?? fallback;
}

async function fetchStudyLabData() {
  const response = await fetch("/api/study-lab", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response, "The study lab could not be loaded."));
  return await response.json() as { lectures: LectureSource[]; generations: Generation[] };
}

export function AiStudyLab() {
  const [sources, setSources] = useState<LectureSource[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [action, setAction] = useState<StudyLabAction>("summary");
  const [difficulty, setDifficulty] = useState("standard");
  const [count, setCount] = useState(8);
  const [instructions, setInstructions] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedOutput, setEditedOutput] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Record<number, boolean>>({});

  const current = useMemo(() => generations.find((item) => item.id === selectedId) ?? null, [generations, selectedId]);

  const load = useCallback(async () => {
    try {
      const data = await fetchStudyLabData();
      setSources(data.lectures);
      setGenerations(data.generations);
      setSelectedSource((previous) => data.lectures.some((lecture) => lecture.id === previous) ? previous : data.lectures[0]?.id ?? "");
      setSelectedId(data.generations[0]?.id ?? "");
      setEditedOutput(data.generations[0]?.output ? JSON.stringify(data.generations[0].output, null, 2) : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The study lab could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchStudyLabData().then((data) => {
      if (!active) return;
      setSources(data.lectures);
      setGenerations(data.generations);
      setSelectedSource(data.lectures[0]?.id ?? "");
      setSelectedId(data.generations[0]?.id ?? "");
      setEditedOutput(data.generations[0]?.output ? JSON.stringify(data.generations[0].output, null, 2) : "");
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "The study lab could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function selectGeneration(generation: Generation | undefined) {
    setSelectedId(generation?.id ?? "");
    setEditing(false);
    setAnswers({});
    setShowQuizResults(false);
    setRevealedCards({});
    setEditedOutput(generation?.output ? JSON.stringify(generation.output, null, 2) : "");
  }

  async function generate() {
    setError("");
    setNotice("");
    setGenerating(true);
    try {
      const response = await fetch("/api/study-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lectureId: selectedSource,
          difficulty,
          count,
          instructions,
          question,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Study material could not be generated."));
      const data = await response.json() as { generation: Generation; sourceTruncated: boolean };
      setGenerations((previous) => [data.generation, ...previous.filter((item) => item.id !== data.generation.id)].slice(0, 30));
      selectGeneration(data.generation);
      setNotice(data.sourceTruncated
        ? "Generated and saved. The transcript was long, so only its first section was used."
        : "Generated and saved to your study library.");
      setQuestion("");
      setInstructions("");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Study material could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdit() {
    if (!current) return;
    setError("");
    let output: unknown;
    try {
      output = JSON.parse(editedOutput);
    } catch {
      setError("The edited output is not valid JSON.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/study-lab/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Your edits could not be saved."));
      setGenerations((previous) => previous.map((item) => item.id === current.id ? { ...item, output: output as StudyLabOutput } : item));
      setEditing(false);
      setNotice("Your edits are saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Your edits could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrent() {
    if (!current) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/study-lab/${current.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "The study material could not be deleted."));
      const remaining = generations.filter((item) => item.id !== current.id);
      setGenerations(remaining);
      selectGeneration(remaining[0]);
      setNotice("Study material deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The study material could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  const quizScore = current?.output && "questions" in current.output
    ? current.output.questions.reduce((score, item, index) => score + (answers[index] === item.correctIndex ? 1 : 0), 0)
    : 0;

  return <div className="fade-up space-y-5">
    <header>
      <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">AI STUDY LAB</p>
      <h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Study from your lectures</h1>
      <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7d7789]">StudyStation retrieves relevant lecture content to ground each response, then uses the AI model’s reasoning and subject knowledge to explain and connect ideas. Review generated material against your class materials.</p>
    </header>

    {error && <p role="alert" className="rounded-xl bg-[#fff1ef] px-4 py-3 text-xs leading-5 text-[#a44e48]">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#f1efff] px-4 py-3 text-xs font-semibold text-[#5b47bd]">{notice}</p>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#f0edff] text-[#7259e8]"><WandSparkles className="size-4" /></span><div><h2 className="text-[15px] font-extrabold">Create study material</h2><p className="mt-0.5 text-[10px] text-[#8a8494]">Grounded in your selected lecture, with AI reasoning for added clarity.</p></div></div>

        {loading ? <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#817b8e]"><LoaderCircle className="size-4 animate-spin" /> Loading your sources…</div>
          : sources.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#e3deeb] bg-[#fbfaff] px-4 py-7 text-center"><BookOpen className="mx-auto size-6 text-[#9c91c2]" /><p className="mt-3 text-sm font-extrabold">No completed lecture transcripts yet</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#8a8494]">Upload and transcribe a lecture in Lecture Studio first. Only your own completed transcripts can be used.</p></div>
            : <>
              <label className="mt-5 block text-[10px] font-extrabold text-[#5d5768]">SOURCE LECTURE
                <span className="relative mt-1.5 block"><select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#e7e3ec] bg-white px-3 pr-9 text-xs font-semibold outline-none focus:border-[#aa9af0]">{sources.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-[#8a8494]" /></span>
              </label>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {initialActions.map((item) => <button key={item} type="button" onClick={() => setAction(item)} className={`rounded-xl border p-3 text-left transition ${action === item ? "border-[#9a88ec] bg-[#f4f1ff] ring-1 ring-[#d9d1fb]" : "border-[#ebe7f0] hover:border-[#d0c8e8]"}`}><span className="block text-xs font-extrabold">{actionLabels[item]}</span><span className="mt-1 block text-[9px] leading-4 text-[#8a8494]">{actionDescriptions[item]}</span></button>)}
              </div>

              {(action === "ask" || action === "explain" || action === "simplify") && <label className="mt-4 block text-[10px] font-extrabold text-[#5d5768]">{action === "ask" ? "YOUR QUESTION" : action === "explain" ? "CONCEPT TO EXPLAIN" : "MATERIAL TO SIMPLIFY"}
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} placeholder={action === "ask" ? "What is the main difference between…?" : action === "explain" ? "For example: oxidative phosphorylation" : "Paste a difficult passage or name a concept"} className="mt-1.5 w-full resize-y rounded-xl border border-[#e7e3ec] p-3 text-xs leading-5 outline-none focus:border-[#aa9af0]" />
              </label>}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-extrabold text-[#5d5768]">DIFFICULTY
                  <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]"><option value="introductory">Introductory</option><option value="standard">Standard</option><option value="advanced">Advanced</option></select>
                </label>
                {(action === "quiz" || action === "flashcards") && <label className="text-[10px] font-extrabold text-[#5d5768]">{action === "quiz" ? "QUESTION COUNT" : "CARD COUNT"}
                  <input type="number" min={3} max={action === "quiz" ? 15 : 20} value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]" />
                </label>}
              </div>
              <label className="mt-4 block text-[10px] font-extrabold text-[#5d5768]">OPTIONAL INSTRUCTIONS
                <input value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1000} placeholder="Focus on definitions, examples, or a particular topic" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs font-medium outline-none focus:border-[#aa9af0]" />
              </label>
              <button type="button" disabled={generating || !selectedSource} onClick={() => void generate()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] text-xs font-extrabold text-white transition hover:bg-[#8069ed] disabled:cursor-not-allowed disabled:opacity-60">{generating ? <><LoaderCircle className="size-4 animate-spin" /> Creating your material…</> : <><Sparkles className="size-4" /> Generate and save</>}</button>
              <p className="mt-3 text-center text-[9px] leading-4 text-[#9993a0]">Limit: 20 generations per hour. Source text is limited to 24,000 characters per request.</p>
            </>}
      </section>

      <section className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Your library</p><h2 className="mt-1 text-[15px] font-extrabold">Recent generations</h2></div><button type="button" onClick={() => {setLoading(true); setError(""); void load();}} disabled={loading} className="grid size-8 place-items-center rounded-lg border border-[#ebe7f0] text-[#777180] hover:bg-[#f8f6fb]" aria-label="Refresh generations"><RotateCcw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /></button></div>
        {generations.length ? <div className="mt-4 max-h-[340px] space-y-1 overflow-y-auto">{generations.map((generation) => <button key={generation.id} type="button" onClick={() => selectGeneration(generation)} className={`w-full rounded-xl px-3 py-2.5 text-left ${generation.id === selectedId ? "bg-[#f3f0ff]" : "hover:bg-[#faf9fc]"}`}><span className="block truncate text-[11px] font-extrabold">{generation.output && "title" in generation.output ? generation.output.title : generation.input_metadata?.lectureTitle ?? actionLabels[generation.input_metadata?.action ?? "summary"]}</span><span className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#918b99]"><span>{actionLabels[generation.input_metadata?.action ?? "summary"]}</span><span>{new Date(generation.created_at).toLocaleDateString()}</span></span>{generation.status !== "completed" && <span className="mt-1 block text-[9px] font-bold text-[#b26a2c]">Generation failed. Try again.</span>}</button>)}</div>
          : <p className="mt-4 rounded-xl bg-[#fbfaff] px-3 py-5 text-center text-[11px] leading-5 text-[#8a8494]">Generated summaries, questions, and practice materials will appear here.</p>}

        {current && <div className="mt-5 border-t border-[#eeeaf2] pt-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#8e8796]">{actionLabels[current.input_metadata?.action ?? "summary"]}</p><h3 className="mt-1 text-sm font-extrabold">{current.output && "title" in current.output ? current.output.title : current.input_metadata?.lectureTitle}</h3><p className="mt-1 text-[9px] text-[#9993a0]">Source: {current.input_metadata?.lectureTitle ?? "Lecture"}{current.input_metadata?.sourceTruncated ? " · source excerpt" : ""}</p></div><div className="flex shrink-0 gap-1"><button type="button" disabled={saving} onClick={() => {setEditedOutput(JSON.stringify(current.output, null, 2)); setEditing((value) => !value);}} className="rounded-lg border border-[#e9e5ef] px-2 py-1.5 text-[9px] font-extrabold text-[#5d5768] disabled:opacity-50">{editing ? "Cancel" : "Edit"}</button><button type="button" disabled={saving} onClick={() => void removeCurrent()} className="grid size-7 place-items-center rounded-lg text-[#aa625c] hover:bg-[#fff1ef] disabled:opacity-50" aria-label="Delete study material"><Trash2 className="size-3.5" /></button></div></div>

          {editing ? <div className="mt-3"><textarea value={editedOutput} onChange={(event) => setEditedOutput(event.target.value)} rows={14} aria-label="Edit generated study material JSON" className="w-full rounded-xl border border-[#e7e3ec] p-3 font-mono text-[10px] leading-4 outline-none focus:border-[#aa9af0]" /><button type="button" disabled={saving} onClick={() => void saveEdit()} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#17132d] text-[10px] font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save edits</button></div>
            : <OutputView key={current.id} generation={current} answers={answers} setAnswers={setAnswers} showQuizResults={showQuizResults} setShowQuizResults={setShowQuizResults} revealedCards={revealedCards} setRevealedCards={setRevealedCards} quizScore={quizScore} />}
        </div>}
      </section>
    </div>
  </div>;
}

function OutputView({ generation, answers, setAnswers, showQuizResults, setShowQuizResults, revealedCards, setRevealedCards, quizScore }: {
  generation: Generation;
  answers: Record<number, number>;
  setAnswers: (value: Record<number, number>) => void;
  showQuizResults: boolean;
  setShowQuizResults: (value: boolean) => void;
  revealedCards: Record<number, boolean>;
  setRevealedCards: (value: Record<number, boolean>) => void;
  quizScore: number;
}) {
  const [attemptSaving, setAttemptSaving] = useState(false);
  const [attemptMessage, setAttemptMessage] = useState("");
  const [attemptError, setAttemptError] = useState("");
  const output = generation.output;
  async function saveQuizAttempt(
    generationId: string,
    questionCount: number,
    selectedAnswers: Record<number, number>,
    setResultsVisible: (value: boolean) => void,
    setSaving: (value: boolean) => void,
    setMessage: (value: string) => void,
    setError: (value: string) => void,
  ) {
    const answersToSave = Array.from({ length: questionCount }, (_, index) => selectedAnswers[index]);
    if (answersToSave.some((answer) => !Number.isInteger(answer))) {
      setMessage("");
      setError("Answer every question before saving your attempt.");
      return;
    }
    setResultsVisible(true);
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/study-lab/${generationId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersToSave }),
      });
      const data = await response.json().catch(() => null) as { error?: string; attempt?: { score: number; total: number } } | null;
      if (!response.ok || !data?.attempt) throw new Error(data?.error ?? "The quiz score could not be saved.");
      setMessage(`Saved to your progress: ${data.attempt.score} / ${data.attempt.total}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The quiz score could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  if (!output) return <p className="mt-4 text-xs text-[#8a8494]">No completed output is available.</p>;

  if ("cards" in output) return <div className="mt-3 space-y-2">{output.cards.map((card, index) => <button key={`${index}-${card.front}`} type="button" onClick={() => setRevealedCards({ ...revealedCards, [index]: !revealedCards[index] })} className="w-full rounded-xl border border-[#ebe7f0] p-3 text-left hover:bg-[#fbfaff]"><span className="text-[8px] font-black uppercase tracking-wide text-[#8e8796]">{revealedCards[index] ? "BACK" : `CARD ${index + 1} · TAP TO REVEAL`}</span><span className="mt-1 block text-[10px] font-semibold leading-4">{revealedCards[index] ? card.back : card.front}</span></button>)}</div>;

  if ("questions" in output) return <div className="mt-3 space-y-4">{output.questions.map((item, index) => <fieldset key={`${index}-${item.question}`} className="rounded-xl border border-[#ebe7f0] p-3"><legend className="px-1 text-[10px] font-extrabold">Q{index + 1}. {item.question}</legend><div className="mt-2 space-y-1.5">{item.choices.map((choice, choiceIndex) => <label key={`${choiceIndex}-${choice}`} className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-[9px] leading-4 ${answers[index] === choiceIndex ? "bg-[#f3f0ff]" : "hover:bg-[#faf9fc]"}`}><input type="radio" name={`question-${index}`} checked={answers[index] === choiceIndex} onChange={() => {setAnswers({ ...answers, [index]: choiceIndex }); setShowQuizResults(false); setAttemptMessage(""); setAttemptError("");}} className="mt-0.5 accent-[#7259e8]" /><span>{choice}</span></label>)}</div>{showQuizResults && <p className={`mt-2 rounded-lg p-2 text-[9px] leading-4 ${answers[index] === item.correctIndex ? "bg-[#e9f7ef] text-[#287451]" : "bg-[#fff1ef] text-[#a44e48]"}`}><b>{answers[index] === item.correctIndex ? "Right answer." : `Wrong answer. Correct answer: ${item.choices[item.correctIndex]}.`}</b> {item.explanation}</p>}</fieldset>)}{attemptError && <p role="alert" className="rounded-lg bg-[#fff1ef] p-2.5 text-[9px] font-semibold text-[#a44e48]">{attemptError}</p>}{attemptMessage && <p role="status" className="rounded-lg bg-[#e9f7ef] p-2.5 text-[9px] font-semibold text-[#287451]">{attemptMessage}</p>}<button type="button" disabled={attemptSaving} onClick={() => void saveQuizAttempt(generation.id, output.questions.length, answers, setShowQuizResults, setAttemptSaving, setAttemptMessage, setAttemptError)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17132d] py-2.5 text-[10px] font-extrabold text-white disabled:opacity-60">{attemptSaving ? <><LoaderCircle className="size-3.5 animate-spin" /> Saving score…</> : showQuizResults ? "Save another attempt" : "Check answers and save attempt"}</button></div>;

  if ("sections" in output) return <div className="mt-3 space-y-3"><p className="text-[10px] leading-5 text-[#5f596b]">{output.summary}</p>{output.sections.map((section) => <div key={section.heading}><h4 className="text-[10px] font-extrabold">{section.heading}</h4><p className="mt-1 text-[9px] leading-4 text-[#777180]">{section.body}</p></div>)}{output.keyTerms.length > 0 && <div><h4 className="text-[10px] font-extrabold">Key terms</h4><ul className="mt-1 space-y-1">{output.keyTerms.map((term) => <li key={term.term} className="text-[9px] leading-4"><b>{term.term}:</b> <span className="text-[#777180]">{term.definition}</span></li>)}</ul></div>}<div className="rounded-xl bg-[#f7f5ff] p-3"><h4 className="text-[10px] font-extrabold">Revision checklist</h4><ul className="mt-2 space-y-1">{output.revisionChecklist.map((item) => <li key={item} className="flex gap-2 text-[9px] leading-4 text-[#655d74]"><span>•</span>{item}</li>)}</ul></div></div>;

  return <div className="mt-3"><p className="whitespace-pre-wrap text-[10px] leading-5 text-[#5f596b]">{output.answer}</p><ul className="mt-3 space-y-1.5">{output.keyPoints.map((point) => <li key={point} className="flex gap-2 text-[9px] leading-4 text-[#777180]"><span className="font-black text-[#7259e8]">•</span>{point}</li>)}</ul><p className="mt-3 flex items-center gap-1.5 text-[8px] font-semibold text-[#9a94a3]"><Sparkles className="size-3" /> Based on the selected lecture transcript.</p></div>;
}

