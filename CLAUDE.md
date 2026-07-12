# FreeDesignStore Platform

Unified R2 catalog (283 curated + community assets: photos, illustrations, renders, AI art, video), 46 browser tools, contributor identity with public profiles, publishing via MCP.

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
- Max 8 MB raster, 1 MB SVG, 2000 catalog items

## Project structure

```
store/                  Static site (Cloudflare Pages output)
  tools/                Tools directory page with search + filters
  brand/*/              16 brand tools (each a single index.html)
  images/*/             15 image tools + stock-photos library
  templates/*/          6 template tools
  components/*/         9 UI/UX tools
  skills/               MCP playbooks (6) + capability manifest
  assets/stock/         manifest.json only — images live in R2 (served via functions/assets/stock/)
  console/              Creator portal (GitHub/Google OAuth sign-in)
  .well-known/          MCP discovery metadata
  llms.txt              AI-readable docs index
  related.js            Related tools bottom bar (tool pages only)
  registry.json         Tool registry for related.js
  favicon.svg           Site icon
functions/              Cloudflare Pages Functions
  api/stock/            list.js, random.js, upload, profile, creators, moderate, unsplash (unified KV catalog)
  photo/[id].js         Photo detail page (OG tags, share buttons, download)
workers/mcp/            MCP server (Cloudflare Worker, 18 tools)
  src/index.ts          Main server (agents/mcp, McpServer, Zod)
  src/oauth-provider.ts OAuth 2.1 (GitHub/Google)
  src/session.ts        Session verification
  test/                 Regression tests (11 tests)
```

## Conventions

- Every tool page is a single self-contained `index.html`
- Back link: `<a class="back" href="/tools/">&larr; Tools</a>`
- Accent: `#ec4899`, fonts: Fraunces (headings) + Manrope (body)
- Nav order: Tools | Assets | Creators | Skills | Console
- Sticky header: `position:sticky;top:0;backdrop-filter:blur(14px)`
- Curated AI images: Pollinations generates SQUARE-native only (768x768 anon cap) and stretches non-square requests — generate square, center-crop to 16:9, upscale to 1672x941 with sips. Record prompts in `store/assets/stock/manifest.json`.
- Image categories: Lifestyle, Nature, People, Travel, Workspace, Backgrounds, etc.

## Unified catalog & contributors

- ALL asset binaries live in R2 (`fds-stock-assets`); metadata in KV (`FDS_STOCK_KV`). Nothing binary is committed to git.
- KV keys: `stock:item:{id}`, `stock:index:{public,pending}`, `stock:index:account:{accountId}`, `profile:account:{accountId}`, `profile:handle:{handle}`.
- Curated set: 283 items (incl. 3 hi-res background videos) owned by `fds-official` (`source: "hosted"`), objects at `hosted/<filename>`; legacy `/assets/stock/<file>` URLs served by `functions/assets/stock/[file].js` (HeartFull stores them).
- Uploads require sign-in (session cookie verified in Pages via `functions/api/_session.js`, needs SESSION_SIGNING_KEY on the Pages project; proxies to the MCP worker until set) and publish instantly; moderation is takedown-based.
- Taxonomy axes on every asset: `assetType` (13 types incl. video/animation), `origin` (photograph | ai-generated | 3d-render | digital-illustration | vector-art | scan | mixed, with `originDetail` tool/model/prompt — AI must name the tool), `licenseId` (always `cc0` — the whole catalog is public-domain dedicated, uploads force it; `fds-free | attribution` are legacy render-only ids), `purpose`, `safe`. Origin is disclosed on asset pages.
- Legal pages: `/terms/` (CC0 dedication, contributor terms, takedowns) and `/privacy/` (cookieless analytics, contributor OAuth data). Linked from every footer.
- Contributor profiles: `/u/{handle}` + `/creators` directory; videos: MP4/WebM ≤40 MB ≤90 s, served with Range support.
