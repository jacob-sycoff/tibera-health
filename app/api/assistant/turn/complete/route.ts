import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const RequestSchema = z
  .object({
    turnId: z.string().uuid(),
    applied: z.boolean(),
    applyError: z.string().max(2000).optional(),
  })
  .strict();

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const updates = parsed.data.applied
    ? { applied: true, applied_at: new Date().toISOString(), apply_error: null }
    : { applied: false, applied_at: null, apply_error: parsed.data.applyError ?? "Not applied" };

  const { error } = await supabase
    .from("assistant_turns")
    .update(updates)
    .eq("id", parsed.data.turnId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

