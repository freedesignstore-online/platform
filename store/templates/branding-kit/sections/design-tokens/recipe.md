# Design tokens - section recipe

## What this section is

The page that publishes the brand's visual decisions as **structured, machine-readable data** - the named values for colour, type, spacing, radius, and motion that a person reads *and* a tool or agent consumes. Where [colour](../color/) and [typography](../typography/) explain the decisions to a human in prose, design-tokens hands the same decisions to a machine as a token file. This is what turns a brand KB from a document into a **brand API**: a build tool, a Figma library, a Tailwind config, or an AI site-builder can read the tokens and produce on-brand output without a human transcribing hex codes.

It is the section that most distinguishes an open, AI-native brand KB from a PDF brand deck.

## Who reads it

- **Agents and build tools** - the primary consumer. An AI generating a page, or a CI step building a theme, reads `tokens.json` and applies it.
- **Engineers** - importing tokens into CSS custom properties, a Tailwind/Style Dictionary config, or a component library.
- **Designers** - syncing a Figma variables collection to the same source of truth.
- **Brand auditors** - a tool checking a live site's computed colours and fonts against the published tokens to flag brand drift.

## Standard structure

1. **What tokens are here** - one paragraph orienting the reader, and a link to the raw `tokens.json`.
2. **Token reference** - a table per category (colour, typography, spacing, radius, motion), each row: token name, value, and what it is for. The human-readable view of the machine file.
3. **The token file** - the canonical `tokens.json`, shown inline and published alongside the page. Align names to the [W3C Design Tokens](https://www.w3.org/community/design-tokens/) shape (`$value` / `$type`) so standard tooling can read it.
4. **How to consume** - short, copy-pasteable recipes: CSS custom properties, Tailwind theme, and "point your agent at this URL." This is what makes the tokens usable in one read.

## Anti-patterns

- **Prose-only tokens.** A colour section that says "our blue is a deep, trustworthy indigo" and never gives `#3B34D6` is not a token file. If a machine cannot parse it, it is not a token.
- **Two sources of truth.** If the hex codes on the colour page and in `tokens.json` can disagree, they will. Make the token file canonical and have the prose pages reference it (or generate their swatches from it).
- **Raw values with no names.** `#3B34D6` scattered through a doc is not a token; `color.brand.primary` is. The name is the contract; the value can change behind it.
- **Inventing a bespoke schema.** A private token format no tool understands defeats the purpose. Follow the W3C shape so Style Dictionary, Figma, and others read it for free.
- **Tokens that drift from the brand.** Tokens are downstream of the [colour](../color/) and [typography](../typography/) decisions - when those change, regenerate the file. A stale token file silently ships the old brand.

## When to update

- **Any visual decision changes** - a new accent colour, a type-scale tweak, a spacing change. Update `tokens.json` first, then let the prose pages reference it.
- **A new consumer appears** - adding a Figma sync or a native app means adding (and testing) a "How to consume" recipe for it.
- **The W3C spec or your tooling moves** - keep the file shape current so downstream tools keep reading it.

## FreeDocStore-specific notes

- Render as `design-tokens.html` in `docs/`, and publish the raw file as `docs/tokens.json` so it is fetchable at a stable URL (e.g. `https://<kb>.freedocstore.online/tokens.json`) - that URL *is* the brand API.
- FreeDocStore injects `source-repo` / `source-path` metadata into every page; combined with the published `tokens.json`, an agent can both read the tokens and trace them to their source.
- This is the section that most benefits from the KB being **open**: a public token URL means anyone's agent can build on-brand for you, and brand-compliance tooling can audit against it. Keep it public and stable.
- Pair with [brand-foundations](../brand-foundations/) - Foundations is the human "why," tokens are the machine "what." A complete brand KB has both.
