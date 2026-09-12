# Stock Photo Curator

## Purpose

Choose whether a photo should be FDS-hosted, uploaded by a rights holder, or linked off to Unsplash.

## When To Use

When adding photographs, stock-style images, screenshots, mockup photos, or external image references to the catalog.

## Questions

1. Did the creator take the photo or have explicit permission to release it for free?
2. Does the photo include recognizable people, private property, sensitive locations, trademarks, or documents?
3. Is the source Unsplash or another third-party stock site?
4. If Unsplash: is it Unsplash+ premium (`plus.unsplash.com` or a `premium_photo-` URL)? Premium is excluded — check the URL, not the search page.
5. Is the intended action upload, direct URL ingest, or link-off attribution?
6. What category, tags, and use cases help designers find it?
7. Is the image technically useful: sharp, uncropped, inspectable, and not misleading?

## Output Contract

- Rights decision: FDS-host, link off, reject, or ask for proof.
- Attribution and license label.
- Catalog title, category, tags, and asset type.
- If source is Unsplash, link users to Unsplash for download instead of mirroring into FDS.
- If source is Unsplash+ premium, reject it — a paid licence is not free to link, let alone mirror.
- If source is a permitted non-Unsplash HTTPS image, use `create_asset_from_url`.

## Suggested MCP Tools

- `asset_policy`
- `create_asset_from_url`
- `list_assets`

## Rule

Do not mirror Unsplash assets into FDS. Unsplash should be represented with attribution and a link-off download path according to Unsplash terms and API rules.

Unsplash+ premium is a separate, paid licence and is excluded entirely — the restriction rides on the licence, not on where the bytes are hosted, so linking a `premium_photo-` URL is a violation even though we never mirror it. Unsplash search interleaves premium with free and gives no visual marker, so verify each URL individually.
