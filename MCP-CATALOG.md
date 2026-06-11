# FreeDesignStore Catalog MCP

FreeDesignStore now has an MCP worker scaffold for populating the community catalog that backs `/images/stock-photos/`.

It follows the FAS/FAGS/PAGS pattern: a dedicated Cloudflare Worker using `agents/mcp`, `McpServer`, Zod schemas, and a Durable Object binding named `MCP_OBJECT`. PAS also has a dynamic SQL app-tool manifest system, but that model is not the right fit here because FDS catalog assets live in R2 plus KV, not D1 app tables.

## Tools

- `asset_policy` - explains what can be hosted and the Unsplash rule.
- `catalog_status` - checks storage bindings and counts public/pending assets.
- `list_assets` - lists public assets, or pending assets with admin auth.
- `get_asset` - returns metadata and download URL for one asset.
- `create_svg_asset` - stores a generated SVG illustration/icon/pattern/background.
- `create_asset_from_url` - fetches a public HTTPS image and stores it in R2.
- `moderate_asset` - publishes or rejects pending assets.
- `delete_asset` - deletes catalog metadata and the R2 object.

Writes require `Authorization: Bearer <STOCK_ADMIN_TOKEN>` or `MCP_ADMIN_TOKEN`.

## Legal Guardrails

The MCP worker rejects `unsplash.com` and `images.unsplash.com` URLs in `create_asset_from_url`. Unsplash assets should be displayed with attribution and linked back to Unsplash for download. FDS/community assets can be hosted by us only when the uploader owns the rights or has permission to release the asset for free.

## Deploy

The worker lives in `workers/mcp`.

Production storage is managed in Cloudflare and the values are stored in Doppler `fas/prd` with `FDS_`-prefixed names because the Doppler workplace is currently at its project limit.

Before deploying in a new environment, wire it to the same production storage used by the Pages Functions:

1. Create or identify the R2 bucket bound to Pages as `FDS_STOCK_BUCKET`.
2. Create or identify the KV namespace bound to Pages as `FDS_STOCK_KV`.
3. Confirm `workers/mcp/wrangler.toml` uses the real namespace id. If your R2 bucket is not named `fds-stock-assets`, replace that too.
4. Set the write token:

```sh
cd workers/mcp
npx wrangler secret put STOCK_ADMIN_TOKEN
```

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
      "args": ["mcp-remote", "https://freedesignstore-mcp.serge-the-dev.workers.dev/mcp"]
    }
  }
}
```

For writes, use a client that can send the bearer token header to the remote MCP server.
