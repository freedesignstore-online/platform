# Prompt - draft a Design tokens section

## Tool-agnostic prompt

```
You are producing the Design tokens section of a brand-system knowledge
base: the brand's visual decisions as machine-readable data, plus a
human-readable page that documents them.

You will be given the brand's colour, typography, and spacing decisions
(from the colour / typography sections, or raw notes). Turn them into
tokens. Do NOT invent values - use only what the source provides, and add
"[gap]" for any category with no source values yet.

Produce TWO artefacts:

A) tokens.json - the canonical token file, in W3C Design Tokens shape:
   - Group by category: color, font, space, radius, motion.
   - Each token is an object with "$value" and "$type"
     ("color", "fontFamily", "dimension", "duration").
   - Use dot-free nested groups, e.g.
     { "color": { "brand": { "primary": { "$value": "#3B34D6", "$type": "color" } } } }
   - Names are the contract: color.brand.primary, font.family.text,
     space.md, radius.md, motion.duration.base. Prefer semantic names
     (brand.primary) over literal ones (indigo-600).

B) design-tokens.html - the human page, a complete <article class="doc">:
   1. <h1>Design tokens</h1> + a <p class="lede">.
   2. A paragraph pointing at tokens.json as canonical.
   3. One <table> per category (colour, typography, spacing/radius/motion)
      with columns: Token, Value, Use for.
   4. <h2>The token file</h2> with the tokens.json contents (or a
      representative excerpt) in a <pre><code> block.
   5. <h2>How to consume</h2> with copy-pasteable CSS custom properties
      and a one-line "point your agent at tokens.json" instruction.

RULES:
- The JSON must be valid and parseable. Validate it.
- tokens.json and the HTML tables MUST agree - the tables are generated
  from the file, not written independently.
- Every token needs a semantic name and a real value. No prose-only
  "colours" and no unnamed raw hex.
- Follow the W3C shape exactly so Style Dictionary / Figma can read it.
- Output the JSON first, then the HTML article.
```

## Per-tool notes

### Claude

- Reliable at producing valid, consistent JSON and keeping the HTML tables
  in sync with it. Paste the colour and typography section outputs as
  context and it will derive tokens that match.
- Ask it to self-check: *"Confirm tokens.json is valid JSON and every row
  in the HTML tables has a matching token in the file."*

### ChatGPT / Codex

- Strong at the W3C shape. If it flattens names (color-brand-primary as
  one key), add: *"Use nested groups, not hyphenated flat keys."*
- Ask for the JSON in a fenced ```json block so it is easy to save as
  tokens.json.

### Gemini

- Add: *"Return the JSON in one fenced block, then the HTML in a second
  fenced block. No commentary between them."*

### Universal tweaks

- **Prime with the example.** `examples/open-frontier-tokens.json` in this
  folder shows the exact shape - paste it as the pattern to follow.
- **Semantic first.** Follow-up that pays off: *"Add a primitive layer
  (color.indigo.600) that the semantic tokens (color.brand.primary)
  reference, so the palette and its roles are separable."*
- **Round-trip test.** Ask: *"Generate the :root CSS custom properties
  from this tokens.json, then confirm each variable traces back to a
  token."* Catches drift between the file and the consume recipes.
```
