# FreeDesignStore MCP — Agent Guide

AI agent tools for the FreeDesignStore CC0 design-asset catalog. Use FreeDesignStore
**only** through this MCP server — do not scrape the web UI or call the `/api/stock/*`
REST endpoints directly.

Endpoint: `https://mcp.freedesignstore.online/mcp` (streamable-http)
Auth: OAuth 2.1 (GitHub/Google) or `Authorization: Bearer <creator token | admin token>`

## Rules

1. Inspect first. Call `catalog_status` and `list_design_skills` before creating or moderating anything.
2. Prefer read-only tools. Only call a write tool when the task explicitly requires a change.
3. Preview mutations. Every write tool accepts `dry_run: true` — use it to validate before committing.
4. Confirm destructive actions. `delete_asset` requires `confirm=<asset id>` and cannot be undone.
5. Disclose origin. AI-generated assets **must** set `origin: "ai-generated"` and `origin_tool`.
6. Never mirror Unsplash. `create_asset_from_url` rejects unsplash.com — link users off to Unsplash instead.
7. Everything is CC0. Only submit assets the uploader has the right to release into the public domain.

## Capabilities

| Level | Tools | Requires |
|---|---|---|
| Read (open) | `asset_policy`, `list_design_skills`, `get_design_skill`, `apply_design_skill`, `catalog_status`, `list_assets`, `get_asset` | nothing |
| Read (account) | `whoami`, `get_my_profile`, `my_assets`, `mcp_audit_log` | authenticated account |
| Write (owner) | `update_my_profile`, `create_svg_asset`, `create_asset_from_url`, `update_asset`, `publish_asset`, `unpublish_asset`, `delete_asset` | account + ownership |
| Admin | `moderate_asset`, plus write on any asset | admin account |

## Workflow recipes

**Browse:** `catalog_status` → `list_assets` (filter by `asset_type`/`origin`/`category`/`q`) → `get_asset`.

**Create:** `list_design_skills` → `apply_design_skill` (mode `checklist`) → `create_svg_asset` or
`create_asset_from_url` with `dry_run: true` → re-run without `dry_run` → `publish_asset`.

**Moderate (admin):** `list_assets` (status `pending`) → `get_asset` → `moderate_asset` (`publish`/`reject`).

**Audit your actions:** `mcp_audit_log` — every write, dry-run, and denial for your account, newest first.

## Safety

- **Read-only mode:** when the server is deployed with `MCP_READ_ONLY=1`, every write tool
  returns an error and the attempt is audited. `catalog_status.readOnly` reports the current state.
- **Audit trail:** each write/dry-run/denied action is logged to KV for 90 days, keyed to your
  account, with tokens/secrets redacted. Read it back with `mcp_audit_log`.
- **Failure signalling:** failed tool calls return `isError: true` — check it rather than parsing text.
- **Ownership:** creators may only mutate their own assets; admin required for others' assets and moderation.

## Not supported via MCP

Provisioning (repos, DNS, Pages projects), billing, account deletion, and bulk imports.
Uploaded binaries live in R2; nothing binary is committed to git.
