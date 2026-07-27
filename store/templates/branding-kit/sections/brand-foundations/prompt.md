# Prompt - draft a Brand foundations section

## Tool-agnostic prompt

```
You are drafting the Brand foundations section of a brand-system knowledge
base. This is the orientation page - what the brand stands for, who it is
for, and how it behaves, BEFORE any logo, colour, or font.

Use ONLY information present in the provided material (founder interviews,
existing brand notes, product briefs, positioning docs, transcripts). Do
NOT invent purpose, audience, or values. Where source material is missing,
write what is there and add an explicit "[gap]" marker naming what is
needed to finish.

REQUIRED STRUCTURE (in this order):

1. <h1>Brand foundations</h1>
2. A one-sentence lede in <p class="lede"> naming what the brand is and
   who it is for.
3. <h2>Purpose</h2> - why the brand exists beyond revenue. One sharp
   sentence, then a short paragraph. Plain language.
4. <h2>Positioning</h2>
   - <h3>Audience</h3> - who it is for, specifically; then a
     <strong>Not for:</strong> line naming who it is deliberately not for.
   - <h3>Category</h3> - the frame of reference and what it competes with.
   - <h3>Differentiation</h3> - the one thing true here that is not true
     of the alternatives.
5. <h2>Personality</h2> - 3-5 traits. Each <li> has the trait in
   <strong>, a one-line gloss, then an is/is-not pair in <em> so the
   trait is testable.
6. <h2>Values and principles</h2> - beliefs that govern behaviour. Each
   must imply a real trade-off.
7. <h2>Naming</h2> - the naming pattern with an example, and a
   <strong>Tagline:</strong> line if one exists.

RULES:
- HTML only. <h1>/<h2>/<h3>, <p>, <ul>/<li>, <strong>, <em>.
- The differentiation sentence must fail the "competitor could copy this
  unchanged" test. If a rival brand could say it verbatim, rewrite it.
- Every personality trait needs its is/is-not pair. A bare adjective list
  is a failure.
- The "Not for" line is required, not optional.
- Do not describe the logo, colours, or fonts here - those are their own
  sections. This page is strategy, not visuals.
- Output is a complete <article class="doc"> ready for
  docs/brand-foundations.html.
```

## Per-tool notes

### Claude

- Paste the prompt as a system message and all brand material as the user
  message. Claude reliably honours the "[gap]" instruction and the
  is/is-not testability requirement.
- Good at pulling a genuine differentiation out of founder interviews -
  paste transcripts in full and ask it to name the belief the founder
  keeps returning to.

### ChatGPT / Codex

- Same prompt works on GPT-4 and later; use the system + user split.
- GPT models drift toward aspirational fog ("empowering everyone to..."). 
  Add: *"Ban the words empower, seamless, innovative, revolutionary, and
  world-class. Say the specific thing instead."*

### Gemini

- Add: *"Output ONLY the <article> element - no preamble, no closing
  remarks."*
- Handles long context well; paste every brief and let it synthesise, but
  check that it did not average competing positionings into mush.

### Universal tweaks

- **Prime with the example.** Pasting `examples/open-frontier.html` from
  this folder sharply improves first-draft quality - it shows the
  is/is-not and "Not for" moves in action.
- **Interrogate the differentiation.** The single most valuable follow-up:
  *"Give me three competitors and show why each could NOT write our
  differentiation sentence. If one could, fix it."*
- **Neutral voice.** AI defaults to flattering the brand. Add: *"Use
  factual, confident, non-promotional language. No superlatives."*
