# Branding kit (brand-system archetype)

A reusable set of sections for authoring a **complete brand system** — foundations, visual
identity, verbal identity, and machine-readable design tokens — as a shareable, forkable,
**open** artefact for the design community.

Each `sections/<name>/` folder follows the same shape: `recipe.md` (what it is / who reads it /
structure / anti-patterns / when to update) · `template.html` (`<article class="doc">` skeleton with
`{{ }}` placeholders) · `prompt.md` (tool-agnostic AI prompt + per-tool notes) · `examples/`.

## Ready
- **`sections/brand-foundations/`** — the human *why*: purpose, positioning (incl. "not for"),
  personality (is/is-not), values, naming. Example: Open Frontier.
- **`sections/design-tokens/`** — the machine *what*: colour/type/spacing/radius/motion as
  **W3C Design Tokens** published as `tokens.json` = a **brand API** an agent can build against.
  Example: `open-frontier-tokens.json` (valid).

## Pending
logo · color · typography · voice-tone · imagery · iconography · motion · layout-spacing · naming ·
asset-library · accessibility — build on the same shape.

## Integration note (TODO)
This archetype was first drafted against FreeDocStore's Zensical section-library. FreeDesignStore is
an **asset-catalog / MCP-first** platform (photos, video, AI art, design tools), not a Zensical doc
host — so how a branding kit is *published and shared* here (as an asset type? a browser tool? an
exported KB?) is **not yet decided**. Files are staged here; the FDS-native publish mechanism is a
follow-up.

Flagship target: the **Open Frontier** brand system (running example across sections).
