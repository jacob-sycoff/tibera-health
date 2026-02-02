import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const RequestSchema = z
  .object({
    model: z.string().min(1).optional(),
    voice: z.string().min(1).optional(),
  })
  .strict()
  .optional();

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "AI service not configured. Please add OPENAI_API_KEY to environment variables." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => undefined);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const model = parsed.data?.model || process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
  const voice = parsed.data?.voice || process.env.OPENAI_REALTIME_VOICE || "marin";

  const sessionConfig = {
    session: {
      type: "realtime",
      model,
      audio: { output: { voice } },
    },
  };

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `OpenAI Realtime token error: ${response.status}${text ? `: ${text}` : ""}` },
        { status: 500 }
      );
    }

    const data = (await response.json()) as unknown as { value?: string; expires_at?: number };
    if (!data?.value) {
      return NextResponse.json({ success: false, error: "OpenAI Realtime token response missing value" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { value: data.value, expires_at: data.expires_at, model, voice } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate OpenAI Realtime token";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
