# FreeDesignStore Catalog MCP

FreeDesignStore now has an MCP worker scaffold for populating the community catalog that backs `/images/stock-photos/`.

It follows the FAS/FAGS/PAGS pattern: a dedicated Cloudflare Worker using `agents/mcp`, `McpServer`, Zod schemas, and a Durable Object binding named `MCP_OBJECT`. PAS also has a dynamic SQL app-tool manifest system, but that model is not the right fit here because FDS catalog assets live in R2 plus KV, not D1 app tables.

## Tools

- `asset_policy` - explains what can be hosted and the Unsplash rule.
- `catalog_status` - checks storage bindings and counts public/pending assets.
- `whoami` - shows the authenticated creator/admin account for the MCP session.
- `list_assets` - lists public assets, or pending assets with admin auth.
- `my_assets` - lists assets owned by the authenticated creator account.
- `get_asset` - returns metadata and download URL for one asset.
- `create_svg_asset` - stores a generated SVG illustration/icon/pattern/background under the authenticated account.
- `create_asset_from_url` - fetches a public HTTPS non-Unsplash image and stores it in R2 under the authenticated account.
- `moderate_asset` - publishes or rejects pending assets.
- `delete_asset` - deletes catalog metadata and the R2 object.

Creator writes use the FDS MCP endpoint at `https://freedesignstore.pages.dev/mcp`. Claude and other remote MCP clients should use FDS OAuth/PKCE browser sign-in. Static creator tokens remain supported for automation. Admin actions require `Authorization: Bearer <STOCK_ADMIN_TOKEN>` or `MCP_ADMIN_TOKEN`.

## Legal Guardrails

The MCP worker rejects `unsplash.com` and `images.unsplash.com` URLs in `create_asset_from_url`. Unsplash assets should be displayed with attribution and linked back to Unsplash for download. FDS/community assets can be hosted by us only when the uploader owns the rights or has permission to release the asset for free.

## Deploy

The worker lives in `workers/mcp`.

Production storage is managed in Cloudflare and the values are stored in Doppler `fas/prd` with `FDS_`-prefixed names because the Doppler workplace is currently at its project limit.

Before deploying in a new environment, wire it to the same production storage used by the Pages Functions:

1. Create or identify the R2 bucket bound to Pages as `FDS_STOCK_BUCKET`.
2. Create or identify the KV namespace bound to Pages as `FDS_STOCK_KV`.
3. Confirm `workers/mcp/wrangler.toml` uses the real namespace id. If your R2 bucket is not named `fds-stock-assets`, replace that too.
4. Set the admin write token, FDS session signing key, and creator account map:

```sh
cd workers/mcp
npx wrangler secret put STOCK_ADMIN_TOKEN
npx wrangler secret put SESSION_SIGNING_KEY
npx wrangler secret put FDS_CREATOR_TOKENS
```

`FDS_CREATOR_TOKENS` is JSON. Supported shapes:

```json
[
  { "accountId": "creator-id", "name": "Creator Name", "token": "secret-token", "canPublish": false }
]
```

or:

```json
{
  "creator-id": { "name": "Creator Name", "token": "secret-token", "canPublish": false }
}
```

Set `canPublish: true` only for trusted creators whose generated/uploaded assets may go public immediately. Other creator submissions stay pending for review.

Then deploy:

```sh
cd workers/mcp
npm install
npm run deploy
```

Connect from an MCP client:

```json
{
  "mcpServers": {
    "freedesignstore": {
      "command": "npx",
      "args": ["mcp-remote", "https://freedesignstore.pages.dev/mcp"]
    }
  }
}
```

Claude-style remote MCP clients should connect directly to:

```text
https://freedesignstore.pages.dev/mcp
```

The client discovers the OAuth metadata, opens the FDS authorization page on `freedesignstore.pages.dev`, and exchanges the authorization code for an access token. The user signs in with an FDS creator account; no FAS/PAS auth route is used.

For automation, bearer tokens are still accepted, but they are not the human creator UX.

The public FDS origin proxies the whole MCP surface to the backend Worker: `/mcp`, `/register`, `/authorize`, `/token`, `/.well-known/oauth-*`, and `/.fds/auth/*`. That keeps the external integration FDS-branded.
