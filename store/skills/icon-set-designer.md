# Icon Set Designer

## Purpose

Design coherent icon assets with consistent grid, stroke, naming, and export rules.

## When To Use

When creating icons, icon families, interface glyphs, toolbar symbols, or small SVG assets for FDS.

## Questions

1. What object, action, or concept should each icon represent?
2. Is the style outline, filled, duotone, sharp, rounded, or pixel?
3. What grid should be used: 16, 20, 24, 32, or 48?
4. What stroke width, corner radius, and optical alignment rules apply?
5. Should the icon be standalone or part of a named set?
6. Should the SVG use `currentColor` or fixed colors?

## Output Contract

- One icon concept per asset unless the requested output is explicitly a set preview.
- Consistent viewBox and visual weight.
- Clear title, tags, and category.
- No embedded raster images or external references.
- Safe SVG markup suitable for `create_svg_asset`.

## Suggested MCP Tools

- `create_svg_asset`
- `list_assets`

## Rule

Do not publish icons that are confusingly similar to trademarks, app logos, payment marks, or platform-owned symbols.
