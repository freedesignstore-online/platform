// MCP safety layer — vendored and simplified from the FAS/PAGS MCP servers.
//
// FDS already gates writes by account role + ownership inside each tool (see
// `isOwner`, `assertAdmin`, `canPublish` in index.ts), so this module deliberately
// omits the PAGS-style read/write/destructive scope taxonomy. What it adds are the
// cross-store maturity primitives that are orthogonal to roles:
//
//   - read-only mode      (MCP_READ_ONLY=1 disables every write tool)
//   - per-account audit    (every write/dry-run/denied action, 90-day TTL in KV)
//   - dry-run previews      (validate + describe a mutation without committing)
//   - confirmation gates     (destructive tools require an explicit confirm token)
//
// Keep this in sync by hand with the sibling stores — it is vendored, not shared.

export type TextResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

interface SafetyEnv {
  OAUTH_KV?: KVNamespace;
  MCP_READ_ONLY?: string;
}

export interface SafetyContext {
  env: SafetyEnv;
  /** Account id of the caller — the audit trail is keyed on it. Anonymous callers
   *  (no account) are not audited, matching FAS/PAGS. */
  subject?: string;
}

const errResult = (text: string): TextResult => ({ content: [{ type: 'text', text }], isError: true });
const jsonResult = (value: unknown): TextResult => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });

export function isReadOnly(env: SafetyEnv): boolean {
  return env.MCP_READ_ONLY === '1';
}

/** Block a write tool when the server is in read-only mode. Returns an error result
 *  to hand straight back to the client, or null when the call may proceed. */
export async function requireWritable(
  ctx: SafetyContext,
  tool: string,
  input?: Record<string, unknown>,
): Promise<TextResult | null> {
  if (!isReadOnly(ctx.env)) return null;
  await audit(ctx, { tool, action: 'denied', reason: 'read_only', input });
  return errResult(`Error: ${tool} is a write tool, but this MCP server is in read-only mode (MCP_READ_ONLY=1).`);
}

/** Require an exact confirmation token before a destructive tool runs. */
export async function requireConfirmation(
  ctx: SafetyContext,
  tool: string,
  confirm: string | undefined,
  expected: string,
  input?: Record<string, unknown>,
): Promise<TextResult | null> {
  if (confirm === expected) return null;
  await audit(ctx, { tool, action: 'denied', reason: 'missing_confirmation', expected, input });
  return errResult(`Error: ${tool} is destructive and cannot be undone. Re-run with confirm="${expected}" to proceed.`);
}

/** Preview a mutation: audit the attempt and return what would happen, without committing. */
export async function dryRun(
  ctx: SafetyContext,
  tool: string,
  action: string,
  input: Record<string, unknown>,
  wouldDo: unknown,
): Promise<TextResult> {
  const body = { dryRun: true, tool, action, wouldDo };
  await audit(ctx, { tool, action: 'dry_run', input, result: body });
  return jsonResult(body);
}

/** Append one audit event for the caller. No-op for anonymous callers or when
 *  OAUTH_KV is unbound, so it is always safe to call. */
export async function audit(ctx: SafetyContext, event: Record<string, unknown>): Promise<void> {
  if (!ctx.env.OAUTH_KV || !ctx.subject) return;
  const now = new Date().toISOString();
  const key = `audit:${ctx.subject}:${now}:${crypto.randomUUID()}`;
  await ctx.env.OAUTH_KV.put(
    key,
    JSON.stringify({ time: now, subject: ctx.subject, ...(redact(event) as Record<string, unknown>) }),
    { expirationTtl: 90 * 86_400 },
  );
}

/** Read the caller's own audit events, newest first. */
export async function listAuditEvents(ctx: SafetyContext, limit = 50): Promise<unknown[]> {
  if (!ctx.env.OAUTH_KV || !ctx.subject) return [];
  const safeLimit = Math.max(1, Math.min(200, limit));
  const listed = await ctx.env.OAUTH_KV.list({ prefix: `audit:${ctx.subject}:`, limit: safeLimit });
  const rows = await Promise.all(
    listed.keys
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, safeLimit)
      .map(async (key) => {
        const raw = await ctx.env.OAUTH_KV?.get(key.name);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return { raw };
        }
      }),
  );
  return rows.filter((row) => row !== null);
}

/** Strip credential-shaped keys and truncate long strings before anything is logged. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|password|credential|authorization/i.test(key)) out[key] = '[redacted]';
    else out[key] = redact(item, depth + 1);
  }
  return out;
}
