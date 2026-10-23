import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateStudyOutput, type QuizOutput } from "@/lib/study-lab-validation";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return fail("Quiz not found.", 404);

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return fail("Quiz progress is unavailable until Supabase is configured.", 503);
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Sign in to save a quiz attempt.", 401);

  let body: { answers?: unknown };
  try {
    body = await request.json() as { answers?: unknown };
  } catch {
    return fail("The quiz answers were not valid JSON.");
  }
  const { data: generation, error: generationError } = await supabase.from("ai_generations")
    .select("id, status, output, input_metadata")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (generationError) return fail("The quiz could not be loaded.", 500);
  if (!generation || generation.status !== "completed") return fail("Quiz not found.", 404);

  const metadata = generation.input_metadata as { action?: unknown; courseId?: unknown; lectureId?: unknown } | null;
  if (metadata?.action !== "quiz" || !validateStudyOutput("quiz", generation.output)) {
    return fail("Only a completed practice quiz can be submitted.", 409);
  }
  const output = generation.output as QuizOutput;
  if (!Array.isArray(body.answers) || body.answers.length !== output.questions.length
    || body.answers.some((answer) => !Number.isInteger(answer) || (answer as number) < 0 || (answer as number) > 3)) {
    return fail("Answer every question before saving your attempt.");
  }
  const answers = body.answers as number[];
  const score = output.questions.reduce((total, question, index) => total + Number(answers[index] === question.correctIndex), 0);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Quiz progress saving is not configured on the server.", 503);
  }
  const { data: existingQuiz, error: quizLookupError } = await admin.from("quizzes")
    .select("id")
    .eq("owner_id", user.id)
    .eq("generation_id", id)
    .maybeSingle();
  if (quizLookupError) {
    console.error("Saved quiz lookup failed", { code: quizLookupError.code });
    return fail("The quiz could not be prepared for saving progress.", 500);
  }

  const questions = output.questions.map((question) => ({
    question: question.question,
    options: question.choices,
    answerIndex: question.correctIndex,
    explanation: question.explanation,
  }));
  let quizId = existingQuiz?.id;
  if (quizId) {
    const { error } = await admin.from("quizzes").update({
      title: output.title,
      questions,
      updated_at: new Date().toISOString(),
    }).eq("id", quizId).eq("owner_id", user.id);
    if (error) {
      console.error("Saved quiz refresh failed", { code: error.code });
      return fail("The quiz could not be prepared for saving progress.", 500);
    }
  } else {
    const { data: quiz, error } = await admin.from("quizzes").insert({
      owner_id: user.id,
      course_id: typeof metadata.courseId === "string" && uuidPattern.test(metadata.courseId) ? metadata.courseId : null,
      lecture_id: typeof metadata.lectureId === "string" && uuidPattern.test(metadata.lectureId) ? metadata.lectureId : null,
      generation_id: id,
      title: output.title,
      questions,
    }).select("id").single();
    if (error || !quiz) {
      console.error("Saved quiz creation failed", { code: error?.code });
      return fail("The quiz could not be prepared for saving progress.", 500);
    }
    quizId = quiz.id;
  }

  const { data: attempt, error: attemptError } = await admin.from("quiz_attempts").insert({
    quiz_id: quizId,
    user_id: user.id,
    answers,
    score,
    total: output.questions.length,
  }).select("id, completed_at").single();
  if (attemptError || !attempt) {
    console.error("Quiz attempt save failed", { code: attemptError?.code });
    return fail("Your score was checked but the attempt could not be saved. Please try again.", 500);
  }

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      score,
      total: output.questions.length,
      completedAt: attempt.completed_at,
    },
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
