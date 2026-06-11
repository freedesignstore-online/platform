# SVG Illustration Director

## Purpose

Create safe, useful SVG illustrations that can be stored in the FreeDesignStore catalog and reused by designers.

## When To Use

When the user asks Claude, Codex, or another MCP client to generate an illustration, vector scene, pattern, background, or simple UI graphic for FDS.

## Questions

1. What is the scene or concept?
2. What should be the main focal object?
3. Should it feel editorial, product, SaaS, playful, technical, minimal, or decorative?
4. What colors should dominate and which colors should be avoided?
5. Does the asset need transparent background, fixed aspect ratio, or text-free output?
6. Is it intended for public reuse by the FDS community?

## Output Contract

- Complete SVG markup with a single root `<svg>`.
- `<title>` and `<desc>` accessibility text.
- Safe shapes, paths, gradients, and text only.
- No scripts, event handlers, foreignObject, iframe, object, embed, or unsafe URLs.
- Catalog metadata: title, category, asset type, tags, author, and license.
- Use `publish: true` only for trusted creators or admins.

## Suggested MCP Tools

- `create_svg_asset`
- `my_assets`

## Rule

Prefer original vector composition. Do not imitate a living artist, branded character, logo, copyrighted illustration, or private image unless the user owns the rights.
