# FreeDesignStore Platform

## MCP-first workflow

Use FreeDesignStore only through the configured MCP server.

Do not use the web UI for asset operations.
Do not call the REST API (`/api/stock/*`) directly — use MCP tools.
First inspect available tools with `list_design_skills` and `catalog_status`.
Prefer read-only tools unless the task explicitly requires changes.
Confirm before destructive actions (delete, unpublish).

## MCP connection

Remote endpoint: `https://mcp.freedesignstore.online/mcp`
Transport: streamable-http
Auth: OAuth 2.1 (GitHub/Google) or bearer token

```bash
claude mcp add freedesignstore https://mcp.freedesignstore.online/mcp
```

## Recommended tool flow

### Browse assets
1. `catalog_status` — check what's available
2. `list_assets` — browse public catalog
3. `get_asset` — get details + download URL

### Create an asset
1. `list_design_skills` — see available playbooks
2. `apply_design_skill` with mode `checklist` — get creation guidance
3. `create_svg_asset` or `create_asset_from_url` — create the asset
4. `publish_asset` — make it public

### Curate / moderate
1. `list_assets` with status `pending` (admin) — see submissions
2. `get_asset` — inspect details
3. `moderate_asset` with action `publish` or `reject`

## Security rules

- SVGs are validated: no `<script>`, event handlers, `javascript:` URIs
- Unsplash images must not be mirrored — use Unsplash link-off only
- Creators can only manage their own assets
- Admin token required for moderation and viewing pending assets
- Max 8 MB raster, 1 MB SVG, 500 catalog items

## Project structure

```
workers/mcp/        MCP server (Cloudflare Worker)
functions/          Pages Functions (stock API, photo detail pages)
store/              Static site (tools, assets, skills)
store/skills/       Design playbooks (6 published)
store/.well-known/  MCP discovery metadata
```
