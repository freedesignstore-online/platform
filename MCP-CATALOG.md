# FreeDesignStore Catalog MCP

FreeDesignStore now has an MCP worker scaffold for populating the community catalog that backs `/images/stock-photos/`.

It follows the FAS/FAGS/PAGS pattern: a dedicated Cloudflare Worker using `agents/mcp`, `McpServer`, Zod schemas, and a Durable Object binding named `MCP_OBJECT`. PAS also has a dynamic SQL app-tool manifest system, but that model is not the right fit here because FDS catalog assets live in R2 plus KV, not D1 app tables.

## Tools

- `asset_policy` - explains what can be hosted and the Unsplash rule.
- `list_design_skills` - lists the published FDS design asset playbooks.
- `get_design_skill` - returns one published design asset playbook.
- `apply_design_skill` - applies a playbook as questions, checklist, or tool plan.
- `catalog_status` - checks storage bindings and counts public/pending assets.
- `whoami` - shows the authenticated creator/admin account for the MCP session.
- `list_assets` - lists public assets, or pending assets with admin auth.
- `my_assets` - lists assets owned by the authenticated creator account.
- `get_asset` - returns metadata and download URL for one asset.
- `create_svg_asset` - stores a generated SVG illustration/icon/pattern/background under the authenticated account.
- `create_asset_from_url` - fetches a public HTTPS non-Unsplash image and stores it in R2 under the authenticated account.
- `moderate_asset` - publishes or rejects pending assets.
- `delete_asset` - deletes catalog metadata and the R2 object.

Creator writes use the FDS MCP endpoint at `https://mcp.freedesignstore.online/mcp`. Claude and other remote MCP clients should use FDS OAuth/PKCE browser sign-in. Human creators sign in with the FDS GitHub/Google OAuth app and receive a secure httpOnly FDS session cookie. Static creator tokens remain supported for automation only. Admin actions require `Authorization: Bearer <STOCK_ADMIN_TOKEN>` or `MCP_ADMIN_TOKEN`.

## Published Skills

FDS publishes canonical design asset playbooks the same way FreeIdeaStore publishes idea skills: public Markdown files plus a manifest at `/skills/`, and matching MCP tools for agents.

- Public index: `https://freedesignstore.online/skills/`
- Manifest: `https://freedesignstore.online/skills/manifest.json`
- MCP tools: `list_design_skills`, `get_design_skill`, `apply_design_skill`

Use these skills before briefing, creating, uploading, reviewing, or publishing assets. They keep agents aligned on legal hosting rules, SVG safety, Unsplash link-off behavior, metadata quality, and trusted-publisher moderation.

## Legal Guardrails

The MCP worker rejects `unsplash.com` and `images.unsplash.com` URLs in `create_asset_from_url`. Unsplash assets should be displayed with attribution and linked back to Unsplash for download. FDS/community assets can be hosted by us only when the uploader owns the rights or has permission to release the asset for free.

## Deploy

The worker lives in `workers/mcp`.

Production storage is managed in Cloudflare and the values are stored in Doppler `fas/prd` with `FDS_`-prefixed names because the Doppler workplace is currently at its project limit.

Before deploying in a new environment, wire it to the same production storage used by the Pages Functions:

1. Create or identify the R2 bucket bound to Pages as `FDS_STOCK_BUCKET`.
2. Create or identify the KV namespace bound to Pages as `FDS_STOCK_KV`.
3. Confirm `workers/mcp/wrangler.toml` uses the real namespace id. If your R2 bucket is not named `fds-stock-assets`, replace that too.
4. Set the admin write token, FDS session signing key, and provider OAuth app credentials:

```sh
cd workers/mcp
npx wrangler secret put STOCK_ADMIN_TOKEN
npx wrangler secret put SESSION_SIGNING_KEY
npx wrangler secret put FDS_GITHUB_CLIENT_ID
npx wrangler secret put FDS_GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

OAuth callback URLs:

- GitHub: `https://freedesignstore.online/.fds/auth/github/callback`
- Google: `https://freedesignstore.online/.fds/auth/google/callback`

Google OAuth is optional. GitHub should be configured before exposing the creator console. Google stays hidden unless `GOOGLE_OAUTH_ENABLED=true` is set after the Google OAuth client has the FDS callback URL authorized.

Static automation tokens can also be configured:

```sh
cd workers/mcp
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

Set `canPublish: true` only for trusted automation accounts whose generated/uploaded assets may go public immediately. Human provider sign-ins submit pending assets unless later promoted by a role system.

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
      "args": ["mcp-remote", "https://mcp.freedesignstore.online/mcp"]
    }
  }
}
```

Claude-style remote MCP clients should connect directly to:

```text
https://mcp.freedesignstore.online/mcp
```

The client discovers the OAuth metadata, opens the FDS authorization page on `mcp.freedesignstore.online`, and exchanges the authorization code for an access token. The user signs in with GitHub or Google through the FDS OAuth app; no FAS/PAS auth route is used.

For automation, bearer tokens are still accepted, but they are not the human creator UX.

The public FDS origin proxies the whole MCP surface to the backend Worker: `/mcp`, `/register`, `/authorize`, `/token`, `/.well-known/oauth-*`, and `/.fds/auth/*`. That keeps the external integration FDS-branded.
