import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Bearer MCP_API_KEY (Vercel env). Never accept query-string secrets for MCP. */
export function authorizeMcpRequest(req: Request): boolean {
  const secret = process.env.MCP_API_KEY?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!bearer) return false;
  return safeEqual(bearer, secret);
}

export function mcpUnauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": 'Bearer realm="wide-os-mcp"',
    },
  });
}
