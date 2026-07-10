# FreeDesignStore

**[freedesignstore.online](https://freedesignstore.online)** — 52 free stock images + 46 browser-based design tools. No signup, no watermarks, no install.

Part of [Open Frontier](https://openfrontier.pages.dev).

## Pages

| URL | What |
|-----|------|
| `/` | Homepage — hero, asset carousel with infinite scroll, tool grid |
| `/tools/` | All 46 tools with search and category filters |
| `/images/stock-photos/` | Asset library — 80 hosted images, community uploads, Unsplash search |
| `/photo/<id>` | Individual asset detail page with OG tags + share buttons |
| `/skills/` | MCP playbooks + capability manifest |
| `/console/` | Creator portal — sign in, publish assets |
| `/llms.txt` | AI-readable docs index |
| `/.well-known/mcp.json` | MCP discovery metadata |

## Tools (46)

### Brand (16)
Logo Maker, Color Palette, Typography Pairing, Brand Kit Builder, Business Card Designer, Favicon Generator, Smart Color from Description, Smart Logo Concepts, Design Token Generator, QR Code Designer, Contrast Checker, Tailwind Theme Builder, CSS Animation Studio, CSS Effects Generator, Micro-Interaction Library, Color Blindness Simulator

### Images (15)
Image Resizer, SVG Icon Library, Gradient Maker, Background Remover, Pattern Generator, Design Asset Library, Free Logo Templates, Personal Asset Manager, Format Converter, Noise & Texture Generator, SVG Optimizer, Avatar Generator, Photo Editor, Vector Editor, Pixel Art Editor

### Templates (6)
Social Media Templates, OG Image Maker, Slide Deck Builder, Pitch Deck Generator, Device Mockup Generator, Wireframe Builder

### UI/UX (9)
UI Component Library, CSS Layout Builder, Form Builder, Landing Page Builder, Dashboard Builder, Moodboard Builder, User Flow Builder, Sitemap Generator, Design Handoff Sheet

## Stock Images (52)

AI-generated lifestyle, nature, travel, people, workspace, and background photos at 1672x941. Each image has a unique URL at `/photo/<id>` with OG meta tags for social sharing (X, Facebook, LinkedIn, Pinterest).

Categories: Lifestyle (25), Nature (9), People (5), Travel (3), Workspace (2), Backgrounds (2), Technology (1), Business (1), Marketing (1), Mockups (1), Textures (1), UI (1)

## MCP

15-tool MCP server at `mcp.freedesignstore.online/mcp`. OAuth 2.1 (GitHub/Google) or bearer token auth. See [CLAUDE.md](./CLAUDE.md) for agent workflow and [MCP-CATALOG.md](./MCP-CATALOG.md) for full docs.

```bash
claude mcp add freedesignstore https://mcp.freedesignstore.online/mcp
```

## Project structure

```
store/                  Static site (Cloudflare Pages)
  tools/                Tools directory page
  brand/*/              16 brand tools
  images/*/             15 image tools + stock-photos library
  templates/*/          6 template tools
  components/*/         9 UI/UX tools
  skills/               MCP playbooks (6)
  assets/stock/         80 hosted stock images
  console/              Creator portal
  .well-known/          MCP discovery
  llms.txt              AI docs index
functions/              Pages Functions
  api/stock/            Stock list/random/upload/moderate API
  photo/[id].js         Photo detail page with OG tags
workers/mcp/            MCP server (Cloudflare Worker)
```

## Contributing

One HTML file + one PR. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
