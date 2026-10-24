import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : { supabase, user };
}

export async function GET() {
  let auth;
  try { auth = await getUser(); } catch { return NextResponse.json({ error: "Notifications are unavailable." }, { status: 503 }); }
  if (!auth) return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 });
  const { data, error } = await auth.supabase.from("notifications")
    .select("id, type, title, body, read_at, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH() {
  let auth;
  try { auth = await getUser(); } catch { return NextResponse.json({ error: "Notifications are unavailable." }, { status: 503 }); }
  if (!auth) return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.user.id)
      .is("read_at", null);
    if (error) return NextResponse.json({ error: "Notifications could not be marked as read." }, { status: 500 });
  } catch { return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 }); }
  return NextResponse.json({ success: true });
}
