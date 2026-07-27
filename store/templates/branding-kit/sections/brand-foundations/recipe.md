# Brand foundations - section recipe

## What this section is

The page that explains **what the brand stands for, who it is for, and how it behaves** - before any logo, colour, or font is chosen. Where the visual sections (logo, colour, typography) answer *what the brand looks like*, Foundations answers *why the brand exists and what it means* - the strategic bedrock every visual and verbal decision downstream has to serve. It is the branding archetype's equivalent of the [context](../context/) page in a software KB: the orientation doc that makes every other page make sense.

## Who reads it

- **Designers and agents producing on-brand work** - the first page they read before touching a pixel, so their output serves the strategy, not just the aesthetic
- **New team members and contractors** - to absorb what the brand is in one read
- **Partners and vendors** - agencies, freelancers, and co-marketing partners who need the positioning to represent the brand faithfully
- **Anyone making a brand judgement call** - "does this campaign / product name / tone still fit who we are?"

## Standard structure

1. **Purpose** - why the brand exists beyond making money. One sharp sentence, then a paragraph. If you cannot say it without jargon, it is not done.
2. **Positioning** - the trio that fixes the brand in the market:
   - **Audience** - who it is for (and, just as important, who it is *not* for).
   - **Category** - the frame of reference: what kind of thing this is, what it competes with.
   - **Differentiation** - the one thing true of this brand that is not true of the alternatives.
3. **Personality** - 3-5 traits, each with a one-line gloss and an "is / is not" pair so the trait is testable rather than decorative.
4. **Values / principles** - the beliefs that govern behaviour and trade-offs. Each is a sentence you could actually act on.
5. **Naming** - how the brand and its sub-brands are named (the pattern), and the one-liner / tagline if there is one.

## Anti-patterns

- **Aspirational fog.** "We empower everyone to achieve more" describes no brand in particular. If the sentence would fit a competitor unchanged, it says nothing.
- **Traits without tests.** "Bold, innovative, human" as a bare list is decoration. A trait earns its place only with an is/is-not pair a designer can check work against.
- **Skipping who it is *not* for.** A brand for everyone is a brand for no one. The excluded audience is the most useful line on the page.
- **Confusing purpose with features.** Purpose is why the brand exists; features are what the product does. Keep them apart - features change, purpose should not.
- **Values that cost nothing.** "Integrity" is not a value if no one would ever claim the opposite. State beliefs that imply a trade-off you actually make.

## When to update

- **Positioning shifts** - a pivot, a new audience, a new competitor set. The whole page cascades from positioning; refresh it first.
- **A sub-brand or product line launches** - the naming pattern and audience section need to absorb it.
- **On-brand work keeps missing** - if designers and agents produce work that is technically correct but "not us," the foundations are too vague to steer by. Tighten the traits and differentiation.
- **A new contributor reads it and still cannot describe the brand** - their confusion is data. Rewrite for the next person.

## FreeDocStore-specific notes

- Render as a single `brand-foundations.html` in `docs/`, first in the topbar nav - it is the orientation doc for the whole KB.
- Every downstream section (logo, colour, typography, voice) should be readable as *serving* this page. When you write those recipes' "why," point back here.
- Keep it forkable: someone cloning your KB as a starting scaffold learns the most from *how* you argued positioning, not the specific answer. Write it so the reasoning is visible.
- Pair with [design-tokens](../design-tokens/) - Foundations is the human "why," design-tokens is the machine "what." Together they make the brand both understandable and consumable.
