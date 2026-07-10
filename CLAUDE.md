# FreeDesignStore Platform

80 hosted stock images, 46 browser tools, community asset publishing via MCP.

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
store/                  Static site (Cloudflare Pages output)
  tools/                Tools directory page with search + filters
  brand/*/              16 brand tools (each a single index.html)
  images/*/             15 image tools + stock-photos library
  templates/*/          6 template tools
  components/*/         9 UI/UX tools
  skills/               MCP playbooks (6) + capability manifest
  assets/stock/         80 hosted stock images (AI-generated, 1672x941)
  console/              Creator portal (GitHub/Google OAuth sign-in)
  .well-known/          MCP discovery metadata
  llms.txt              AI-readable docs index
  related.js            Related tools bottom bar (tool pages only)
  registry.json         Tool registry for related.js
  favicon.svg           Site icon
functions/              Cloudflare Pages Functions
  api/stock/            hosted.js (catalog), list.js, random.js, upload, moderate, unsplash
  photo/[id].js         Photo detail page (OG tags, share buttons, download)
workers/mcp/            MCP server (Cloudflare Worker, 15 tools)
  src/index.ts          Main server (agents/mcp, McpServer, Zod)
  src/oauth-provider.ts OAuth 2.1 (GitHub/Google)
  src/session.ts        Session verification
  test/                 Regression tests (11 tests)
```

## Conventions

- Every tool page is a single self-contained `index.html`
- Back link: `<a class="back" href="/tools/">&larr; Tools</a>`
- Accent: `#ec4899`, fonts: Fraunces (headings) + Manrope (body)
- Nav order: Tools | Assets | Skills | Console
- Sticky header: `position:sticky;top:0;backdrop-filter:blur(14px)`
- Stock images: AI-generated via Pollinations API, upscaled to 1672x941 with sips
- Image categories: Lifestyle, Nature, People, Travel, Workspace, Backgrounds, etc.
