import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { requireSuperadmin } from "@/lib/auth-guards";
import {
  buildClientAssistantTools,
  clientAssistantSystemPrompt,
  CLIENT_ASSISTANT_MODEL,
} from "@/lib/ai/client-assistant";

export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  const { client_id } = await params;

  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return jsonError(
      "AI is not configured. Set AI_GATEWAY_API_KEY locally (it is automatic on Vercel).",
      400
    );
  }

  const { data: client } = await gate.supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", client_id)
    .maybeSingle();

  const clientLabel =
    client?.company_name?.trim() || client?.full_name?.trim() || "this client";

  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: CLIENT_ASSISTANT_MODEL,
    system: clientAssistantSystemPrompt(clientLabel),
    messages: modelMessages,
    tools: buildClientAssistantTools(gate.supabase, client_id),
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
