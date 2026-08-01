# FreeDesignStore MCP — Connection & Conventions

Remote MCP server for the FreeDesignStore CC0 design-asset catalog. 19 tools over
streamable-http. Use FDS through this server, not the web UI or `/api/stock/*` REST endpoints.

## Connect

| Client | Command |
|---|---|
| Claude Code | `claude mcp add --transport http freedesignstore https://mcp.freedesignstore.online/mcp` |
| Codex / Cursor | point at `https://mcp.freedesignstore.online/mcp` (streamable-http) |
| Bridge | `npx mcp-remote https://mcp.freedesignstore.online/mcp` |

Auth: OAuth 2.1 browser sign-in (GitHub/Google), or `Authorization: Bearer <creator | admin token>`.
Read tools work unauthenticated; write tools need an account and ownership; `moderate_asset` needs admin.

## Layout

```
src/index.ts          Worker entry + all 19 tool registrations (McpAgent + McpServer + Zod)
src/safety.ts         Read-only mode, audit log, dry-run, confirmation gates (vendored from FAS/PAGS)
src/oauth-provider.ts OAuth 2.1 (GitHub/Google) + dynamic client registration
src/session.ts        HMAC session verification
test/                 Source-level surface tests (node --test)
server.json           MCP registry manifest
AGENTS.md             Agent behaviour rules + workflow recipes
```

## Conventions

- Success returns `jsonText(...)`; failures return `errText(...)` which sets `isError: true`.
- Every write tool: `requireWritable()` guard → validation → optional `dry_run` preview → mutate → `audit()`.
- `delete_asset` is destructive: `dry_run` needs no confirm; the real delete requires `confirm=<id>`.
- The audit `subject` is the caller's `accountId`; anonymous calls are not audited.
- Read-only mode: set the `MCP_READ_ONLY=1` var (wrangler) to freeze all writes. `catalog_status.readOnly` reflects it.
- Tool list is declared twice — keep `mcpDiscoveryTools` (src/index.ts), `server.json`, and
  `store/.well-known/mcp.json` in sync. The surface test asserts the count.

## Secrets (wrangler)

`STOCK_ADMIN_TOKEN`, `MCP_ADMIN_TOKEN`, `SESSION_SIGNING_KEY`, `FDS_CREATOR_TOKENS`,
`FDS_GITHUB_CLIENT_ID`/`_SECRET`, optional `GOOGLE_CLIENT_ID`/`_SECRET`. See `wrangler.toml`.
