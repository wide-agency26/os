import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { requireSuperadmin } from "@/lib/auth-guards";
import {
  buildClientAssistantTools,
  clientAssistantSystemPrompt,
  CLIENT_ASSISTANT_MODEL,
} from "@/lib/ai/client-assistant";
import {
  GATEWAY_CREDENTIALS_HINT,
  hasGatewayCredentials,
  resolveLanguageModel,
} from "@/lib/ai/gateway-json";

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

  if (!hasGatewayCredentials()) {
    return jsonError(
      GATEWAY_CREDENTIALS_HINT,
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
    model: resolveLanguageModel(CLIENT_ASSISTANT_MODEL),
    system: clientAssistantSystemPrompt(clientLabel),
    messages: modelMessages,
    tools: buildClientAssistantTools(gate.supabase, client_id),
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
