# Asset Brief Builder

## Purpose

Turn a vague visual request into a concrete FreeDesignStore asset brief before creating, uploading, or ingesting an asset.

## When To Use

Before `create_svg_asset`, `create_asset_from_url`, or a creator upload when the request is still broad, aesthetic-only, or missing usage details.

## Questions

1. What will the asset be used for: hero, icon, social post, deck, mockup, UI, pattern, or background?
2. Who is the intended user or audience?
3. Which asset type fits best: photo, illustration, icon, pattern, texture, background, or UI?
4. What dimensions, aspect ratio, file type, and transparency requirements matter?
5. What visual style, mood, palette, and density should it have?
6. What must be avoided: brands, people, copyrighted characters, unsafe claims, or sensitive contexts?
7. Should the asset be published immediately, submitted for review, or kept as a draft?

## Output Contract

- Short title suitable for catalog search.
- Asset type and category.
- Prompt or production notes.
- Tags, author credit, and license label.
- Rights and safety notes.
- Suggested MCP tool call and whether `publish` should be true.

## Suggested MCP Tools

- `asset_policy`
- `create_svg_asset`
- `create_asset_from_url`

## Rule

Do not create or publish until rights, intended use, and asset type are clear enough that the catalog item can stand alone.
