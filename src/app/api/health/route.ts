import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, error: "Database is not configured." }, { status: 503 });
  }

  try {
    const { db } = await import("@/db");
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Database health check failed", error);
    return Response.json({ ok: false, error: "Database connection failed." }, { status: 503 });
  }
}
