// Vendored FDS session verification for Pages Functions.
// Mirrors workers/mcp/src/session.ts (HMAC-SHA256 tokens: b64url(payload).b64url(sig))
// and the /.fds/auth/me response shape from oauth-provider.ts. When
// SESSION_SIGNING_KEY is not configured on the Pages project, falls back to
// proxying /.fds/auth/me on the MCP backend so deploys are order-independent.

const SESSION_COOKIE_NAME = "__Host-fds_mcp_session";
const DEFAULT_MCP_BACKEND = "https://freedesignstore-mcp.serge-the-dev.workers.dev";

export async function verifySession(token, signingKey) {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(body, signingKey);
  if (!timingSafeEqual(sig, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function readSessionCookie(request) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

// Returns the /.fds/auth/me account shape or null:
// { authenticated, accountId, accountName, provider, login, avatarUrl, email, isAdmin, canPublish }
export async function sessionAccount(request, env) {
  const token = readSessionCookie(request);
  if (!token) return null;

  if (env.SESSION_SIGNING_KEY) {
    const payload = await verifySession(token, env.SESSION_SIGNING_KEY);
    if (!payload?.uid) return null;
    const roles = [...(payload.roles || []), ...(payload.appRoles?.fds || [])];
    return {
      authenticated: true,
      accountId: payload.uid,
      accountName: payload.name || payload.uid,
      provider: payload.provider || null,
      login: payload.login || null,
      avatarUrl: payload.avatarUrl || null,
      email: payload.email || null,
      isAdmin: roles.includes("admin"),
      canPublish: roles.includes("publisher"),
    };
  }

  // Fallback: verify via the MCP backend (pre-SESSION_SIGNING_KEY deploys).
  const source = new URL(request.url);
  const target = new URL(env.FDS_MCP_BACKEND_URL || DEFAULT_MCP_BACKEND);
  target.pathname = "/.fds/auth/me";
  target.search = "";
  const headers = new Headers();
  headers.set("cookie", request.headers.get("cookie") || "");
  headers.set("x-fds-forwarded-host", source.host);
  headers.set("x-fds-forwarded-proto", source.protocol.replace(":", ""));
  try {
    const res = await fetch(target.toString(), { headers });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.authenticated ? body : null;
  } catch {
    return null;
  }
}

export function safeAccountId(value) {
  return (
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "creator"
  );
}

export function accountIndexKey(accountId) {
  return `stock:index:account:${safeAccountId(accountId)}`;
}

async function hmac(data, keyMaterial) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlBytes(new Uint8Array(sig));
}

function b64urlBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return atob(padded);
}

function timingSafeEqual(a, b) {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
