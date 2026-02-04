import { z } from "zod";
import {
  AssistantV3ResponseSchema,
  type AssistantV3Response,
  type RecentEntry,
} from "@/lib/assistant/action-schemas";
import { localDateISO } from "@/lib/utils/dates";

export type { AssistantV3Response };

export async function conversationV3(args: {
  text: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  existingActions?: AssistantV3Response["actions"];
  recentEntries?: RecentEntry[];
  sessionId?: string;
  inputSource?: "typed" | "speech";
  correlationId?: string;
  mode?: "chat" | "conversation_v3";
}): Promise<
  | { success: true; data: AssistantV3Response; meta?: { sessionId?: string; turnId?: string } }
  | { success: false; error: string }
> {
  const nowIso = new Date().toISOString();
  const today = localDateISO();

  const response = await fetch("/api/assistant/conversation-v3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: args.text,
      nowIso,
      today,
      history: args.history,
      existingActions: args.existingActions,
      recentEntries: args.recentEntries,
      sessionId: args.sessionId,
      inputSource: args.inputSource,
      correlationId: args.correlationId,
      mode: args.mode,
    }),
  });

  const json = (await response.json()) as unknown;
  const parsed = z
    .object({
      success: z.boolean(),
      data: z.unknown().optional(),
      error: z.string().optional(),
      meta: z
        .object({
          sessionId: z.string().uuid().optional(),
          turnId: z.string().uuid().optional(),
        })
        .optional(),
    })
    .safeParse(json);

  if (!parsed.success) return { success: false, error: "Invalid assistant response" };
  if (!parsed.data.success) return { success: false, error: parsed.data.error || "Assistant error" };

  const outParsed = AssistantV3ResponseSchema.safeParse(parsed.data.data);
  if (!outParsed.success) return { success: false, error: "Could not parse assistant response" };

  return { success: true, data: outParsed.data, meta: parsed.data.meta };
}
