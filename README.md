# FreeDesignStore

**[freedesignstore.online](https://freedesignstore.online)** — a live CC0 design asset catalog, guided design workflows, and 47 browser-based design tools. No signup for tools, no watermarks, no install.

Part of [Open Frontier](https://openfrontier.pages.dev).

## Pages

| URL | What |
|-----|------|
| `/` | Homepage — hero, asset carousel with infinite scroll, workflow shortcuts, tool grid |
| `/tools/` | All 47 tools with search and category filters |
| `/workflows/` | Guided design workflows that connect existing FDS tools by job |
| `/workflows/<slug>/` | Workflow detail pages with inputs, ordered steps, tool links, exports, and local checklist state |
| `/projects/` | Local-first project workspace for notes, colors, fonts, assets, exports, and workflow progress |
| `/images/stock-photos/` | Asset library — curated + community catalog (photos, illustrations, renders, AI art, video), Unsplash search, trust metadata modal |
| `/photo/<id>` | Individual asset detail page with OG tags, share buttons, project save, and trust metadata |
| `/skills/` | MCP playbooks + capability manifest |
| `/console/` | Creator portal — sign in, publish assets |
| `/llms.txt` | AI-readable docs index |
| `/.well-known/mcp.json` | MCP discovery metadata |

## Workflows

Workflow routes are task-first entry points for people who do not know which individual tool to open first:

- `/workflows/launch-brand/`
- `/workflows/landing-page/`
- `/workflows/social-campaign/`
- `/workflows/ui-kit/`
- `/workflows/pitch-deck/`
- `/workflows/asset-export/`

Each workflow renders from `store/workflows/workflow.js` and includes required inputs, ordered steps, links into existing tools, final exports, copyable plan text, and local checklist persistence.

## Projects

`/projects/` is a local-first workspace backed by browser storage. Users can create, rename, delete, import, and export projects without an account. A project stores notes, colors, fonts, assets/links, export metadata, saved workflow progress from the workflow detail pages, and saved assets from the stock library, asset detail pages, and generated SVG panel.

## Tools (47)

### Brand (16)
Logo Maker, Color Palette, Typography Pairing, Brand Kit Builder, Business Card Designer, Favicon Generator, Smart Color from Description, Smart Logo Concepts, Design Token Generator, QR Code Designer, Contrast Checker, Tailwind Theme Builder, CSS Animation Studio, CSS Effects Generator, Micro-Interaction Library, Color Blindness Simulator

### Images (16)
AI Icon Set Generator, Image Resizer, SVG Icon Library, Gradient Maker, Background Remover, Pattern Generator, Design Asset Library, Free Logo Templates, Personal Asset Manager, Format Converter, Noise & Texture Generator, SVG Optimizer, Avatar Generator, Photo Editor, Vector Editor, Pixel Art Editor

### Templates (6)
Social Media Templates, OG Image Maker, Slide Deck Builder, Pitch Deck Generator, Device Mockup Generator, Wireframe Builder

### UI/UX (9)
UI Component Library, CSS Layout Builder, Form Builder, Landing Page Builder, Dashboard Builder, Moodboard Builder, User Flow Builder, Sitemap Generator, Design Handoff Sheet

## Asset catalog

The public asset catalog is backed by Cloudflare R2 + KV and includes curated and community assets across photos, illustrations, renders, AI art, icons, patterns, textures, UI assets, and video. Asset counts are live data; use MCP `catalog_status` for the current total. Each public asset has a unique URL at `/photo/<id>` with OG meta tags for social sharing and trust metadata: license/use, source/origin, dimensions, file type/size, suggested use, description/alt fallback, palette fallback, and download/export details. Gallery modals and detail pages can copy or download the same metadata as text.

## MCP

18-tool MCP server at `mcp.freedesignstore.online/mcp`. OAuth 2.1 (GitHub/Google) or bearer token auth. See [CLAUDE.md](./CLAUDE.md) for agent workflow and [MCP-CATALOG.md](./MCP-CATALOG.md) for full docs.

```bash
claude mcp add freedesignstore https://mcp.freedesignstore.online/mcp
```

## Project structure

```
store/                  Static site (Cloudflare Pages)
  tools/                Tools directory page
  workflows/            Guided workflow hub + detail routes
  projects/             Local-first project workspace
  brand/*/              16 brand tools
  images/*/             16 image tools + stock-photos library
  templates/*/          6 template tools
  components/*/         9 UI/UX tools
  skills/               MCP playbooks (6)
  assets/stock/         manifest.json (images live in R2)
  console/              Creator portal
  .well-known/          MCP discovery
  llms.txt              AI docs index
functions/              Pages Functions
  api/stock/            Stock list/random/upload/moderate API
  photo/[id].js         Photo detail page with OG tags + trust metadata
workers/mcp/            MCP server (Cloudflare Worker)
```

## Contributing

One HTML file + one PR. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
