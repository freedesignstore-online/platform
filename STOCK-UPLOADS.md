# Stock uploads backend

FreeDesignStore stock uploads use Cloudflare Pages Functions.

## Bindings

Configure these on the `freedesignstore` Pages project for Production, and Preview if needed:

- `FDS_STOCK_BUCKET`: R2 bucket for uploaded images.
- `FDS_STOCK_KV`: KV namespace for stock metadata and indexes.
- `STOCK_ADMIN_TOKEN`: secret used to approve or reject pending uploads.
- `UNSPLASH_ACCESS_KEY`: optional secret for server-side Unsplash search.
- `AUTO_PUBLISH_STOCK_UPLOADS`: optional plain variable. Set to `true` only if unmoderated public uploads are acceptable.

Default behavior is moderation-first: uploads are stored as `pending`.

## API

- `GET /api/stock/list`: list public community photos.
- `GET /api/stock/list?status=pending`: list pending photos with `Authorization: Bearer $STOCK_ADMIN_TOKEN`.
- `POST /api/stock/upload`: multipart form upload. Required fields are `file`, `rightsConsent=yes`, and `releaseConsent=yes`.
- `GET /api/stock/image/:id`: serve a public image from R2.
- `POST /api/stock/moderate`: JSON `{ "id": "...", "action": "publish" | "reject" }` with admin bearer token.
- `GET /api/stock/unsplash?q=workspace`: server-side Unsplash search when `UNSPLASH_ACCESS_KEY` is configured.

## Local test

```sh
npx wrangler pages dev store \
  --r2 FDS_STOCK_BUCKET \
  --kv FDS_STOCK_KV \
  --binding STOCK_ADMIN_TOKEN=test-token \
  --binding AUTO_PUBLISH_STOCK_UPLOADS=true
```

Unsplash images should not be copied into R2 as the main catalog source. API results must use Unsplash image URLs and attribution.
