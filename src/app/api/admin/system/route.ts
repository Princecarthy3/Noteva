import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const startTime = Date.now();

    // 1. Database ping
    let dbStatus = "offline";
    let dbLatencyMs = -1;
    try {
      const dbStart = Date.now();
      const { error } = await adminClient.from("profiles").select("id").limit(1);
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = error ? "error" : "healthy";
    } catch {
      dbStatus = "error";
    }

    // 2. Storage inspection
    let storageStatus = "unknown";
    let bucketFilesCount = 0;
    try {
      const { data: buckets } = await adminClient.storage.listBuckets();
      const hasLectures = buckets?.some((b) => b.name === "lectures");
      if (hasLectures) {
        storageStatus = "healthy";
        // Check files in lectures bucket
        const { data: files } = await adminClient.storage.from("lectures").list("", { limit: 100 });
        bucketFilesCount = files?.length ?? 0;
      } else {
        storageStatus = "missing_lectures_bucket";
      }
    } catch {
      storageStatus = "error";
    }

    // 3. Memory stats
    const memory = process.memoryUsage();
    const memoryFormatted = {
      rssMb: Math.round(memory.rss / (1024 * 1024)),
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      externalMb: Math.round(memory.external / (1024 * 1024)),
    };

    // 4. API Configurations
    const envAudit = {
      supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseServiceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      openRouterKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      appUrl: process.env.APP_URL || "http://localhost:3000",
      nodeEnv: process.env.NODE_ENV || "development",
    };

    return NextResponse.json({
      diagnostics: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        storage: {
          status: storageStatus,
          sampleFilesCount: bucketFilesCount,
        },
        memory: memoryFormatted,
        uptimeSeconds: Math.round(process.uptime()),
        envAudit,
        diagnosticsDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Admin system diagnostics error:", err);
    return NextResponse.json(
      { error: "Could not run system diagnostics." },
      { status: 500 }
    );
  }
}
