# FreeDesignStore Roadmap

This roadmap keeps the current GitHub issues aligned with product direction and docs. It focuses on helping designers complete real jobs, not just adding isolated generators.

## Current Issue Set

| Issue | Status | Critical Assessment | Dependency Notes |
|---|---|---|---|
| [#3 Project workspace](https://github.com/freedesignstore-online/platform/issues/3) | In progress | V1 local workspace is being implemented as `/projects/`: create/rename/delete, notes, colors, fonts, assets, exports, import/export JSON, and saved workflow progress. Keep account-backed collaboration out of scope. | Builds naturally on `/workflows/` and reuses workflow slugs/checklist state. |
| [#4 Asset trust metadata](https://github.com/freedesignstore-online/platform/issues/4) | Open | High trust impact. Asset pages already disclose some origin/license data, but the issue should standardize missing/fallback metadata and copied/downloaded metadata. | Should land before deep review/share work so review packages carry reliable metadata. |
| [#5 Review pages](https://github.com/freedesignstore-online/platform/issues/5) | Open | Useful for freelancers, but easiest to overbuild. Start with local/shareable review packages and copyable feedback before adding server comments. | Depends on selecting assets from #3 or existing asset cards; benefits from #4 trust metadata. |
| [#6 Guided workflow hubs](https://github.com/freedesignstore-online/platform/issues/6) | Complete | Acceptance criteria are satisfied: hub plus dedicated routes, ordered steps, tool links, task-first screens, inputs, exports, and local checklist state. Future integration belongs under #3. | Completed by commits `79d8217` and `53fa905`. |
| [#7 Design readiness checker](https://github.com/freedesignstore-online/platform/issues/7) | Open | Strong differentiator. Scope must stay narrow: deterministic checks first, no broad AI critique. Start with contrast, dimensions/file size, alt/metadata, export recommendations, and copyable report. | Benefits from #4 metadata and can later save reports into #3 workspace. |

## Implementation Order

1. Finish #3 project workspace integration beyond workflows where practical.
2. Build #4 asset trust metadata so all later workspace/review/readiness views rely on consistent asset facts.
3. Build #7 design readiness checker with deterministic checks and local reports.
4. Build #5 review packages on top of project assets and trust metadata.

## Documentation Rules

- README should describe shipped user-facing routes and current tool count.
- CLAUDE.md should describe agent/operator conventions, not marketing copy.
- STOCK-UPLOADS.md should avoid hard-coded live catalog totals unless they are sourced from current migration state.
- Issue bodies should state acceptance criteria. If implementation grows beyond those criteria, open a follow-up issue instead of keeping a completed issue open.
