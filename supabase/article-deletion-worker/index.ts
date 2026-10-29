// The GitHub worker authenticates with a short-lived GitHub Actions OIDC JWT.
// No client or long-lived GitHub credential is stored in this public code.
const AUDIENCE = "rain-article-deletion-worker-v1";
const REPOSITORY = "rainwang628/rain-docs";
const REPOSITORY_ID = "1395633034";
const OWNER_ID = "25156116";
const WORKFLOW = ".github/workflows/article-deletion.yml";
const JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";
const encoder = new TextEncoder();
let cachedKeys: { keys: JsonWebKey[]; loaded: number } | null = null;

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  } });
}
function bytes(part: string): Uint8Array {
  const value = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(value + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}
function json(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes(part)));
}
async function verifyJwt(token: string): Promise<Record<string, unknown>> {
  const p = token.split(".");
  if (p.length !== 3 || token.length > 16000) throw new Error("invalid token");
  const header = json(p[0]), claims = json(p[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("invalid header");
  if (!cachedKeys || Date.now() - cachedKeys.loaded > 300000) {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("keys unavailable");
    const data = await res.json();
    if (!Array.isArray(data.keys)) throw new Error("invalid keys");
    cachedKeys = { keys: data.keys, loaded: Date.now() };
  }
  const jwk = cachedKeys.keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes(p[2]), encoder.encode(p[0] + "." + p[1]))) throw new Error("bad signature");
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud.includes(AUDIENCE) : claims.aud === AUDIENCE;
  if (claims.iss !== "https://token.actions.githubusercontent.com" || !audience ||
      typeof claims.exp !== "number" || claims.exp <= now || typeof claims.iat !== "number" ||
      claims.iat > now + 30 || claims.iat < now - 600 ||
      (typeof claims.nbf === "number" && claims.nbf > now + 30) ||
      claims.repository !== REPOSITORY || claims.repository_id !== REPOSITORY_ID ||
      claims.repository_owner_id !== OWNER_ID) throw new Error("invalid claims");
  return claims;
}
function expectedWorkflow(claims: Record<string, unknown>, branch: string) {
  return claims.ref === "refs/heads/" + branch &&
    claims.workflow_ref === REPOSITORY + "/" + WORKFLOW + "@refs/heads/" + branch;
}
function dbHeaders(key: string) {
  return { apikey: key, authorization: "Bearer " + key, "content-type": "application/json", prefer: "return=representation" };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "method not allowed" }, 405);
  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) return response({ error: "unauthorized" }, 401);
    const claims = await verifyJwt(auth.slice(7));
    const raw = await req.text();
    if (raw.length > 4096) return response({ error: "invalid request" }, 400);
    const body = JSON.parse(raw || "{}");
    if (!expectedWorkflow(claims, "main") || !["schedule", "workflow_dispatch", "push"].includes(String(claims.event_name))) {
      return response({ error: "forbidden" }, 403);
    }
    const projectUrl = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!projectUrl || !key) throw new Error("server configuration");
    const endpoint = projectUrl + "/rest/v1/site_article_deletion_requests";
    if (body.action === "pending") {
      const res = await fetch(endpoint + "?status=eq.pending&kind=eq.story&select=id,kind,slug,created_at&order=created_at.asc&limit=50", { headers: dbHeaders(key), signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error("queue unavailable");
      return response({ requests: await res.json() });
    }
    const ids = body.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 ||
        !ids.every((id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      return response({ error: "invalid requests" }, 400);
    }
    const target = endpoint + "?status=eq.pending&kind=eq.story&id=in.(" + ids.join(",") + ")";
    let change: Record<string, unknown>;
    if (body.action === "complete") {
      if (typeof body.commit !== "string" || !/^[0-9a-f]{40}$/.test(body.commit)) return response({ error: "invalid commit" }, 400);
      change = { status: "completed", completed_at: new Date().toISOString(), processed_commit: body.commit, last_error: null };
    } else if (body.action === "error") {
      change = { last_error: String(body.message || "处理失败，稍后自动重试").slice(0, 300) };
    } else return response({ error: "invalid action" }, 400);
    const res = await fetch(target, { method: "PATCH", headers: dbHeaders(key), body: JSON.stringify(change), signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("queue update failed");
    return response({ updated: (await res.json()).length });
  } catch (_error) {
    return response({ error: "authentication or processing failed" }, 401);
  }
});
