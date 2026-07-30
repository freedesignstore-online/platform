# FreeDesignStore Roadmap

This roadmap keeps the current GitHub issues aligned with product direction and docs. It focuses on helping designers complete real jobs, not just adding isolated generators.

## Current Issue Set

| Issue | Status | Critical Assessment | Dependency Notes |
|---|---|---|---|
| [#3 Project workspace](https://github.com/freedesignstore-online/platform/issues/3) | In progress | V1 local workspace is implemented as `/projects/`: create/rename/delete, notes, colors, fonts, assets, exports, import/export JSON, saved workflow progress, and direct save hooks from asset library/detail/generated SVG surfaces. Keep account-backed collaboration out of scope. | Builds naturally on `/workflows/` and asset surfaces; remaining work should focus on selective tool/export save hooks only where they carry project value. |
| [#4 Asset trust metadata](https://github.com/freedesignstore-online/platform/issues/4) | Complete | Acceptance criteria are satisfied: asset detail pages and gallery modals expose license/use, source/origin, dimensions, file type/size, suggested use, description/alt fallback, palette fallback, and download metadata. Copy/download info actions include the same facts. | Completed before #7/#5 so readiness reports and review packages can reuse reliable metadata. |
| [#5 Review pages](https://github.com/freedesignstore-online/platform/issues/5) | Open | Useful for freelancers, but easiest to overbuild. Start with local/shareable review packages and copyable feedback before adding server comments. | Depends on selecting assets from #3 or existing asset cards; benefits from #4 trust metadata. |
| [#6 Guided workflow hubs](https://github.com/freedesignstore-online/platform/issues/6) | Complete | Acceptance criteria are satisfied: hub plus dedicated routes, ordered steps, tool links, task-first screens, inputs, exports, and local checklist state. Future integration belongs under #3. | Completed by commits `79d8217` and `53fa905`. |
| [#7 Design readiness checker](https://github.com/freedesignstore-online/platform/issues/7) | Complete | Acceptance criteria are satisfied: `/readiness/` runs deterministic checks for contrast, dimensions/file size, alt/metadata, consistency, and export recommendations, then provides pass/warn/fail remediation plus copy, download, linkable, and project-save report actions. | Built on #4 trust metadata conventions and saves reports into the #3 local workspace export model. |

## Implementation Order

1. Finish #3 project workspace integration by adding selective tool/export save hooks where they carry project value.
2. Build #5 review packages on top of project assets, trust metadata, and readiness reports.

## Documentation Rules

- README should describe shipped user-facing routes and current tool count.
- CLAUDE.md should describe agent/operator conventions, not marketing copy.
- STOCK-UPLOADS.md should avoid hard-coded live catalog totals unless they are sourced from current migration state.
- Issue bodies should state acceptance criteria. If implementation grows beyond those criteria, open a follow-up issue instead of keeping a completed issue open.
