# Contributing to FreeDesignStore

## What we accept

Self-contained browser design tools. Each tool is a single `index.html` file.

## Design rules (LIGHT theme)

| Rule | Value |
|------|-------|
| Background | `#fafafa` |
| Text | `#1a1a1a` |
| Muted text | `#6b7280` |
| Accent | `#ec4899` (pink) |
| Panel background | `#ffffff` with `border: 1px solid #e5e7eb` |
| Panel shadow | `0 1px 3px rgba(0,0,0,.08)` |
| Border radius | `12px` panels, `8px` inputs |
| Font | Manrope via Google Fonts |
| Back link | `<a class="back" href="/">Back to Store</a>` |
| Related | `<script src="/related.js"></script>` before `</body>` |

## Directory structure

```
store/
├── brand/your-tool/index.html      (brand identity tools)
├── images/your-tool/index.html     (image utilities)
└── templates/your-tool/index.html  (template editors)
```

## Registry entry

Add to `store/registry.json`:

```json
{
  "id": "your-tool",
  "name": "Your Tool Name",
  "description": "One-line description.",
  "icon": "emoji",
  "iconBg": "#ec4899",
  "category": "brand|images|templates",
  "section": "brand|images|templates"
}
```
