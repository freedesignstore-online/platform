# Community asset uploads backend

FreeDesignStore community asset uploads use Cloudflare Pages Functions.

## Bindings

Configure these on the `freedesignstore` Pages project for Production, and Preview if needed:

- `FDS_STOCK_BUCKET`: R2 bucket for uploaded visual assets.
- `FDS_STOCK_KV`: KV namespace for asset metadata and indexes.
- `STOCK_ADMIN_TOKEN`: secret used to approve or reject pending uploads.
- `UNSPLASH_ACCESS_KEY`: optional secret for server-side Unsplash search.
- `AUTO_PUBLISH_STOCK_UPLOADS`: optional plain variable. Set to `true` only if unmoderated public uploads are acceptable.

Default behavior is moderation-first: uploads are stored as `pending`.

## API

- `GET /api/stock/list`: list public hosted static assets plus public community assets. No key required.
- `GET /api/stock/list?source=hosted`: list only FDS static hosted assets. This does not read R2/KV.
- `GET /api/stock/list?source=community`: list public community assets from R2/KV.
- `GET /api/stock/list?status=pending`: list pending assets with `Authorization: Bearer $STOCK_ADMIN_TOKEN`.
- `GET /api/stock/list?assetType=photo&category=lifestyle`: filter by asset type and category. `asset_type=photo` is also supported.
- `GET /api/stock/random`: return random static hosted assets for app integrations. No key required and no database read.
- `GET /api/stock/random?assetType=photo&category=lifestyle&orientation=landscape&safe=true&purpose=profile_background&count=3`: return up to 3 suitable hosted lifestyle backgrounds.
- `POST /api/stock/upload`: multipart form upload. Required fields are `file`, `rightsConsent=yes`, and `releaseConsent=yes`.
- `GET /api/stock/image/:id`: serve a public asset from R2.
- `POST /api/stock/moderate`: JSON `{ "id": "...", "action": "publish" | "reject" }` with admin bearer token.
- `GET /api/stock/unsplash?q=workspace`: server-side Unsplash search when `UNSPLASH_ACCESS_KEY` is configured.

Hosted static API responses include absolute `url` and `download` fields, dimensions, `contentType`, `license`, `attribution`, `orientation`, `safe`, tags, and supported `purpose` values. The random endpoint sends public cache headers and CORS `access-control-allow-origin: *`.

Example:

```json
{
  "ok": true,
  "source": "hosted",
  "count": 1,
  "items": [
    {
      "id": "fds-lifestyle-australia-surf-beach",
      "title": "Australia Surf Beach",
      "url": "https://freedesignstore.online/assets/stock/lifestyle-australia-surf-beach.jpg",
      "download": "https://freedesignstore.online/assets/stock/lifestyle-australia-surf-beach.jpg",
      "width": 1672,
      "height": 941,
      "assetType": "photo",
      "category": "Lifestyle",
      "contentType": "image/jpeg",
      "license": "FreeDesignStore Community License",
      "attribution": "FreeDesignStore",
      "orientation": "landscape",
      "safe": true,
      "purpose": ["profile_background"]
    }
  ]
}
```

The intended public use rule for hosted FDS images is: free to use in personal and commercial projects; attribution is appreciated but not required; do not resell, mirror, or redistribute the image files as a competing stock library.

## Local test

```sh
npx wrangler pages dev store \
  --r2 FDS_STOCK_BUCKET \
  --kv FDS_STOCK_KV \
  --binding STOCK_ADMIN_TOKEN=test-token \
  --binding AUTO_PUBLISH_STOCK_UPLOADS=true
```

Accepted file types are JPG, PNG, WebP, AVIF, and SVG. SVGs are checked for unsafe markup and served with restrictive security headers.

Unsplash images should not be copied into R2 as the main catalog source. API results must use Unsplash image URLs and attribution.
