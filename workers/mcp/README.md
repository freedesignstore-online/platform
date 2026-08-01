# FreeDesignStore MCP Server

A Cloudflare Worker exposing the FreeDesignStore CC0 design-asset catalog as 19 MCP tools:
browse assets, apply design playbooks, and create/publish/moderate hosted assets.

- **Endpoint:** `https://mcp.freedesignstore.online/mcp` (streamable-http)
- **Discovery:** `https://mcp.freedesignstore.online/.well-known/mcp.json`
- **Auth:** OAuth 2.1 (GitHub/Google) or `Authorization: Bearer <creator | admin token>`

## Connect

```bash
# Claude Code
claude mcp add --transport http freedesignstore https://mcp.freedesignstore.online/mcp

# Any client via the reference bridge
npx mcp-remote https://mcp.freedesignstore.online/mcp
```

Project-local `.mcp.json`:

```json
{ "mcpServers": { "freedesignstore": { "type": "http", "url": "https://mcp.freedesignstore.online/mcp" } } }
```

## Tools

| Category | Tools |
|---|---|
| Skills | `list_design_skills`, `get_design_skill`, `apply_design_skill`, `asset_policy` |
| Read | `catalog_status`, `list_assets`, `get_asset`, `whoami`, `get_my_profile`, `my_assets`, `mcp_audit_log` |
| Write (owner) | `update_my_profile`, `create_svg_asset`, `create_asset_from_url`, `update_asset`, `publish_asset`, `unpublish_asset`, `delete_asset` |
| Admin | `moderate_asset` |

Every write tool accepts `dry_run: true` to validate without committing. `delete_asset` additionally
requires `confirm=<asset id>`. Failed calls return `isError: true`.

## Safety layer (`src/safety.ts`)

Vendored and simplified from the FAS/PAGS MCP servers. FDS gates writes by account role +
ownership inside each tool, so this layer adds the orthogonal maturity primitives:

- **Read-only mode** — deploy with `MCP_READ_ONLY=1` to disable all write tools.
- **Audit log** — every write/dry-run/denied action → `OAUTH_KV`, 90-day TTL, secrets redacted; read via `mcp_audit_log`.
- **Dry-run** — preview any mutation without side effects.
- **Confirmation gates** — destructive tools require an explicit `confirm` token.

## Architecture

Cloudflare Worker + SQLite Durable Object (`agents` SDK `McpAgent`). Asset metadata lives in
KV (`FDS_STOCK_KV`); binaries in R2 (`FDS_STOCK_BUCKET`); OAuth tokens + audit events in `OAUTH_KV`.

See [AGENTS.md](./AGENTS.md) for the agent workflow and [CLAUDE.md](./CLAUDE.md) for connection details.

## Develop

```bash
npm run dev        # wrangler dev
npm run typecheck  # tsc --noEmit
npm test           # node --test (surface tests)
npm run deploy     # wrangler deploy
```
