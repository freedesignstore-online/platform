# Catalog & contributor uploads backend

The FreeDesignStore catalog is unified on Cloudflare R2 (binaries) + KV (metadata),
served by Pages Functions. It holds the curated set (80 assets owned by the
`fds-official` account, handle `freedesignstore`) and community contributions.
Nothing binary is committed to git.

## Bindings

Configure these on the `freedesignstore` Pages project (Production; Preview if needed):

- `FDS_STOCK_BUCKET`: R2 bucket (`fds-stock-assets`). Curated objects at `hosted/<filename>`, community at `community/<id>/<filename>`.
- `FDS_STOCK_KV`: KV namespace for catalog items, indexes, and creator profiles.
- `SESSION_SIGNING_KEY`: HMAC key for verifying contributor session cookies locally (same value as the `freedesignstore-mcp` worker). Without it, Pages Functions fall back to proxying `/.fds/auth/me`.
- `STOCK_ADMIN_TOKEN`: secret for the REST moderation endpoint.
- `UNSPLASH_ACCESS_KEY`: optional secret for server-side Unsplash search (link-off only).
- `AUTO_PUBLISH_STOCK_UPLOADS`: uploads publish instantly unless this is set to `"false"` (then they land as `pending`).

The MCP worker (`workers/mcp`) shares the same KV/R2 and sets `FDS_ADMIN_LOGINS`
(comma-separated GitHub logins/emails) whose OAuth sessions receive the admin role.

## Contributor model

- **Uploads require sign-in** (GitHub/Google OAuth via the MCP worker). Ownership comes from the session; there is no free-text author.
- **Publish instantly, moderate by takedown** — admins use the console Admin view or MCP `moderate_asset` / `unpublish_asset`.
- **Every asset discloses its origin**: `origin` is required (`photograph | ai-generated | 3d-render | digital-illustration | vector-art | scan | mixed`); AI-generated assets must name the tool, prompts are encouraged and shown on asset pages.
- **License election**: `cc0 | fds-free | attribution` (`licenseId`).
- **Creator profiles**: lazily created on first contribution — `profile:account:{id}` / `profile:handle:{handle}` in KV, public at `/u/{handle}`, directory at `/creators`. Handles are unique; reserved names are blocked.

## Limits (soft, non-admin accounts)

- 20 uploads per hour per account, 100 assets per account, 500 catalog items total.
- Images (JPG/PNG/WebP/AVIF): 8 MB. SVG: 1 MB, sanitized and served with restrictive security headers. Video (MP4/WebM): 40 MB, 90 seconds.
- Video uploads arrive as multipart form data, which buffers in Worker memory — raising the video cap requires a raw-body upload endpoint.

## API

- `GET /api/stock/list`: unified public catalog. Filters: `source=hosted|community|all`, `assetType`, `category`, `orientation`, `purpose`, `origin`, `license`, `safe`, `q`.
- `GET /api/stock/random?purpose=profile_background&count=3`: random curated assets (HeartFull integration — response shape is stable).
- `POST /api/stock/upload`: multipart upload; requires session cookie + `rightsConsent=yes`, `releaseConsent=yes`, `origin`. Optional: `originTool/originModel/originPrompt`, `license`, `purpose`, `safe`, client `width/height/duration`.
- `GET /api/stock/image/:id`: serve from R2 (supports Range requests for video seeking).
- `GET /assets/stock/:file`: legacy curated URLs, served from R2 `hosted/` (consumers like HeartFull store these absolute URLs — do not break them).
- `GET/POST /api/stock/profile`: own profile read/update (session required).
- `GET /api/stock/creators`, `GET /api/stock/creator/:handle`: public directory + profile data.
- `POST /api/stock/moderate`: admin REST moderation (`{ "id": "...", "action": "publish" | "reject" }`) with admin bearer token.
- `GET /sitemap-catalog.xml`: dynamic sitemap of asset + creator pages.

The public use rule for FDS-hosted assets: free in personal and commercial
projects per the asset's license (`cc0` needs no attribution; `attribution`
requires credit); do not resell, mirror, or redistribute the files as a
competing stock library. Unsplash results are link-off only — never copied
into R2.

## Curated set maintenance

New curated batches are written directly to R2 + KV under `fds-official`
(use MCP `create_asset_from_url` as admin, or a wrangler data script — see the
June 2026 migration in git history for the pattern). AI generation prompts are
recorded in `store/assets/stock/manifest.json`. Pollinations generates
square-native only: generate square, center-crop to 16:9, upscale to 1672x941.

## Local test

```sh
npx wrangler pages dev store \
  --r2 FDS_STOCK_BUCKET \
  --kv FDS_STOCK_KV \
  --binding STOCK_ADMIN_TOKEN=test-token \
  --binding SESSION_SIGNING_KEY=test-signing-key
```
