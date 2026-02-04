import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_MODELS } from "@/lib/openai/models";

const RequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().min(1).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "AI service not configured. Please add OPENAI_API_KEY to environment variables." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { text, voice } = parsed.data;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.tts.model,
        input: text,
        voice: voice || OPENAI_MODELS.tts.voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `OpenAI TTS error: ${response.status}${errorText ? `: ${errorText}` : ""}` },
        { status: 500 },
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS request failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
