import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateStudyOutput, type QuizOutput } from "@/lib/study-lab-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Your study library is unavailable until Supabase is configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to view your generated study materials." }, { status: 401 });
  }

  const { data, error } = await supabase.from("ai_generations")
    .select("id, task, input_metadata, output, created_at")
    .eq("owner_id", user.id)
    .eq("status", "completed")
    .in("task", ["flashcards", "quiz"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Generated study materials could not be loaded", { code: error.code });
    return NextResponse.json({ error: "Your generated study materials could not be loaded." }, { status: 500 });
  }

  const materials = (data ?? []).flatMap((generation) => {
    const metadata = generation.input_metadata as { action?: unknown; lectureTitle?: unknown } | null;
    const action = metadata?.action;
    if (action !== "flashcards" && action !== "quiz") return [];
    if (generation.task !== action) return [];
    if (!validateStudyOutput(action, generation.output)) return [];

    return [{
      id: generation.id,
      type: action,
      title: action === "quiz"
        ? (generation.output as QuizOutput).title
        : typeof metadata?.lectureTitle === "string" ? metadata.lectureTitle : "Lecture flashcards",
      sourceTitle: typeof metadata?.lectureTitle === "string" ? metadata.lectureTitle : "Lecture",
      createdAt: generation.created_at,
      output: generation.output,
    }];
  });

  return NextResponse.json({ materials }, { headers: { "Cache-Control": "private, no-store" } });
}
