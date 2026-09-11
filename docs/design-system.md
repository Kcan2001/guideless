# Design system

The rules that make every Guideless screen look like the same product. Two fonts, one primary
colour, one accent, one card, one radius scale, one way to write a button label.

This document is enforceable, not aspirational. Where it states a rule it also states how the rule
is checked, and the audit below records how far the codebase currently is from it. If you are about
to write `rounded-2xl border border-border bg-surface` by hand, stop and read
[Components](#components) first.

---

## The audit, 2026-09-10

Measured across `apps/web/app` and `apps/web/components`, not estimated.

| Thing          | State                                                                                          | Verdict               |
| -------------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| Colour tokens  | Defined once in `app/globals.css`, exposed to Tailwind                                         | Good                  |
| Buttons        | 72 files import the shared `buttonVariants`. **Zero hand-rolled buttons**                      | The model             |
| Cards          | `components/ui/card.tsx` exists and is imported by **zero** files. 64 files hand-roll one      | Broken                |
| Corner radius  | **Six** different values in use: `xl` ×126, `lg` ×72, `2xl` ×33, `full` ×30, `md` ×13, `sm` ×1 | Broken                |
| Headings       | **104 of 156** `h1`–`h3` do not set `font-heading`, so they silently render in Inter           | Broken                |
| Accent as text | `text-teal` ×41, `text-aqua` ×24, `text-danger` ×20 — all below WCAG AA on our own background  | **Accessibility bug** |
| Shadows        | 11 uses, three values                                                                          | Fine                  |

Buttons prove the system works when there is one component and no alternative. Cards prove what
happens when there is a component and people do not know about it. **Everything below is written to
make cards look like buttons.**

---

## Colour

Six brand colours, and only two of them may ever carry text on a light background. This is not a
preference; it is measured contrast.

| Token   | Hex       | on white | on cloud | on sand | on ink | May carry text on |
| ------- | --------- | -------- | -------- | ------- | ------ | ----------------- |
| `ink`   | `#0B2025` | 16.8     | 15.5     | 11.9    | —      | any light ground  |
| `muted` | `#4D575B` | 7.4      | 6.8      | 5.2     | 2.3    | any light ground  |
| `link`  | `#0B6680` | 6.5      | 6.0      | 4.6     | 2.6    | any light ground  |
| `aqua`  | `#60E1BB` | 1.6      | 1.5      | 1.1     | 10.4   | **ink only**      |
| `teal`  | `#40B4BD` | 2.5      | 2.3      | 1.8     | 6.8    | **ink only**      |
| `cyan`  | `#17B1DF` | 2.5      | 2.3      | 1.8     | 6.7    | **ink only**      |
| `sand`  | `#DAD9D0` | 1.4      | 1.3      | —       | 11.9   | **ink only**      |
| `cloud` | `#F5F6F2` | 1.1      | —        | 1.3     | 15.5   | **ink only**      |

### The rule

**Primary — ink.** Every primary button, every heading, every line of body text on a light ground.
If you are choosing a colour for text and the ground is light, the answer is `ink`, `muted` for
secondary text, or `link` for links. There is no fourth option.

**Secondary — aqua.** The accent. A fill, a rule, an underline, an active state, a badge
background, or text **on ink**. Never text on white, cloud or sand. Roughly one aqua element per
screen; if there are three, two of them are decoration.

**Support — teal and cyan.** Interchangeable with aqua on ink grounds. Cyan is the focus ring.
Neither is a text colour on light.

**A photograph is not an ink ground.** This is the trap, and it caught the first draft of the three
screens in this system's own launch. A hero looks dark, so an accent eyebrow looks safe — but the
type sits over whatever the photograph is doing behind it, which is a sky at 2.3:1. On a
photograph, small text is `cloud` at 80% and the veil is strong enough that the effective ground is
near-ink. Accent colours go on ink, not on pictures of the sea.

**Semantic — success, warning, danger.** These are **fills with ink text**, never coloured text:

| Token     | Hex       | on cloud | Verdict                                            |
| --------- | --------- | -------- | -------------------------------------------------- |
| `success` | `#2FA88A` | 2.7      | fill only — `bg-success/10` with `text-ink`        |
| `warning` | `#D9A441` | 2.1      | fill only                                          |
| `danger`  | `#C9484D` | 4.3      | fill only — it fails AA on our own page background |

`text-danger` on the default background is **4.28:1 against a 4.5 minimum**. Twenty places do this
today. Error text is the one thing that must be readable, so this is the first thing to fix.

The ratio across a page stays roughly **70% neutral, 20% ink, 10% accent**.

---

## Typography

Two families. There is no third, and there is no case for one.

| Role          | Family      | Where                                                                   |
| ------------- | ----------- | ----------------------------------------------------------------------- |
| **Primary**   | **Manrope** | `h1`–`h4`, prices, statistics, the wordmark. Nothing else.              |
| **Secondary** | **Inter**   | Body, labels, buttons, navigation, tables, form fields, everything else |

`font-heading` is Manrope. **Every `h1`–`h4` sets it.** A heading without it renders in Inter and is
the single most common reason two pages look like different products. 104 of 156 headings currently
miss it.

### The scale

Sizes come from the scale. Nothing between the steps, nothing above `display`.

| Step      | Size / line-height  | Weight | Use                                      |
| --------- | ------------------- | ------ | ---------------------------------------- |
| `display` | 56–72 / 1.02        | 800    | Hero headline, one per page              |
| `h1`      | 36–48 / 1.05        | 800    | Page title                               |
| `h2`      | 26–32 / 1.1         | 800    | Section                                  |
| `h3`      | 20–22 / 1.2         | 700    | Card title, subsection                   |
| `body-lg` | 17–18 / 1.6         | 400    | Standfirst, one per section at most      |
| `body`    | 15–16 / 1.6         | 400    | Everything                               |
| `small`   | 13–14 / 1.5         | 400    | Captions, metadata, helper text          |
| `label`   | 11–12 / 1.4, 0.14em | 600    | Uppercase eyebrows and field labels only |

`label` is the only style that is ever uppercase. Body text, headings and **button labels are never
uppercase** — see [Writing](#writing).

Running text stays near 65 characters. Headings get `text-wrap: balance`. Digits that line up in a
column get `font-variant-numeric: tabular-nums`; prices in a ladder always do.

---

## Shape, spacing and elevation

### Radius — four values, and Tailwind's defaults are not them

| Token  | Value | Use                                                 |
| ------ | ----- | --------------------------------------------------- |
| `sm`   | 6px   | Inputs, checkboxes, small chips                     |
| `md`   | 10px  | Buttons, badges, inline controls                    |
| `lg`   | 16px  | **Cards.** Every card. Panels, modals, media frames |
| `full` | 999px | Pills, avatars, the one floating booking bar        |

Six radii are in use today because `rounded-xl` (12px) and `rounded-2xl` (16px) are Tailwind
defaults that nobody mapped to the tokens. **Fix the mapping, then use `rounded-lg` for every
card.** A page with two corner radii on two adjacent boxes is the thing Kyle is complaining about,
and it is always this.

### Spacing

A 4px base. Use 4, 8, 12, 16, 24, 32, 48, 64, 96. Nothing else. Sibling groups are laid out with
flex or grid and `gap`, never per-element margins that collapse or double.

### Elevation

Almost flat. Three levels, total:

1. **Flat** — the default. A card is a 1px `border-border` on `surface`. No shadow.
2. **Lifted** — `shadow-lg`, only for something floating over content: a modal, a popover, the
   booking bar on a photograph.
3. **Inverse** — `surface-inverse` (ink) instead of a shadow, for a section that must separate
   itself from the page.

Border, fill, radius and shadow each say "separate object". Spend them by role. If every block on
the page is a bordered card, nothing is emphasised and the hierarchy is gone.

---

## Components

### The rule

**If a component exists in `components/ui`, use it. If you are about to hand-roll one, either use
the component or change the component.** There is no third path, and the 64 hand-rolled cards are
what the third path looks like after six months.

### Card — one card, four slots

`components/ui/card.tsx` is the only card. It is `rounded-lg border border-border bg-surface`, and
nothing overrides its border, radius or background.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Hôtel Vendôme</CardTitle> {/* h3, Manrope */}
    <CardDescription>Nice · 3 nights</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>…</CardFooter>
</Card>
```

Permitted variation, and only this:

| Prop / class      | Effect                                                         |
| ----------------- | -------------------------------------------------------------- |
| `selected`        | `border-ink` instead of `border-border`. Nothing else changes. |
| `media` slot      | A 16:10 image above `CardHeader`, flush to the card edge       |
| `className="p-0"` | For a card whose content manages its own padding               |

Everything else — a different radius, a coloured border, a gradient, a shadow — is a new component
and needs a reason in this file.

### Button

Already correct, and the template for the rest. Variants: `primary` (ink fill), `secondary`
(border, no fill), `inverse` (cloud fill, for use on ink), `ghost`. Sizes `sm`, `md`, `lg`. Radius
`full`. **One primary button per screen region.**

### Badge

`rounded-md`, `label` type style, a `/10` tint fill with ink text. Never a saturated fill with
white text — see the contrast table.

### Field

Label above, input, helper text below, error replacing helper text. Radius `sm`. Errors use
`bg-danger/10` with ink text, never `text-danger`.

---

## Writing

We follow [Material Design 3's UX writing style guide](https://m3.material.io/foundations/content-design/style-guide/ux-writing-best-practices)
**for interface text** — buttons, labels, fields, errors, empty states, navigation, confirmations.
We do not follow it for marketing prose, and the distinction matters.

### Interface text — the M3 rules, as they apply here

| Rule                                  | What it means for us                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sentence case everywhere**          | Titles, headings, labels, menu items, nav, buttons. `Build my trip`, not `Build My Trip`. Brand terms keep their capitals: Guideless, Your Guide, Monaco Grand Prix. |
| **No title case**                     | The single most common violation. Check every button and every heading.                                                                                              |
| **Second person**                     | "your trip", "you pay a deposit". Never "my trip" or "my bookings" in navigation.                                                                                    |
| **Don't mix first and second**        | Never "we" and "you" in the same control. Prefer removing the pronoun.                                                                                               |
| **"I" only in legal acknowledgments** | `I accept the Terms of Service` is correct and stays.                                                                                                                |
| **Explain consequences**              | Say what will happen and how to undo it, in neutral language. No alarm, no pressure.                                                                                 |
| **Skip terminal periods**             | On labels, tooltips, bullets, links and single-sentence helper text. Keep them for two or more sentences.                                                            |
| **Use contractions**                  | "you'll", "we've". Except where caution needs emphasis: "do not" beats "don't" in a cancellation warning.                                                            |
| **Serial comma**                      | "hotels, trains, and transfers" — except before an ampersand.                                                                                                        |
| **Spell abbreviations out**           | "for example", not "e.g." "and more", not "etc."                                                                                                                     |
| **Commas over 1,000**                 | `$3,610`. No commas in years or addresses: `2027`, `44 rue Grimaldi`.                                                                                                |

Button labels say what happens, and the confirmation echoes it: `Publish` → "Published". Errors say
what went wrong and how to fix it, with no apology and no vagueness.

### Marketing prose — the exception, stated on purpose

Page copy, trip descriptions, tier briefs and the journal keep the Guideless editorial voice: first
person plural is allowed ("we book the hotels"), sentences are full sentences with full stops, and
the tone is plain and specific rather than neutral. M3 is Google's guide for product chrome and it
would flatten the one thing that makes our pages sound like a person wrote them.

**The line:** if it is a control, a label, a message or a piece of navigation, it is interface text
and M3 governs. If it is something you read rather than operate, it is prose and the brand voice
governs. A card title is interface text. The paragraph inside the card is prose.

### Terminology — one word per thing, always

| Use            | Never                                                    |
| -------------- | -------------------------------------------------------- |
| Trip           | tour, package, holiday, vacation                         |
| Departure      | date, session, instance                                  |
| Your Guide     | the app, the itinerary (when it means the digital guide) |
| Your Group     | the roster, the cohort, the party                        |
| Stay tier      | room type, accommodation level, upgrade                  |
| Add-on / extra | upsell, option, ancillary                                |
| Places left    | spots, seats, availability                               |
| Traveler       | guest, customer, pax, user                               |

"Your Guide" is always the digital itinerary and never a person. There are no guides on a Guideless
trip; that is the product.

---

## Accessibility — WCAG 2.2 AA, non-negotiable

- Text contrast **4.5:1**, large text (24px+, or 19px+ bold) **3:1**. The colour table above is the
  authority; do not eyeball it.
- Every interactive element has a visible focus state: a 2px `ring` outline at 2px offset.
- Targets are at least 24×24 CSS pixels, and 44×44 for anything primary on a phone.
- Nothing is communicated by colour alone. A "sold out" tier says "Sold out" as well as dimming.
- Motion respects `prefers-reduced-motion`.
- Every image has real alternative text, or `alt=""` when it is decorative and the caption already
  says it.

---

## How this gets enforced

1. **Tokens are the only source.** No hex in a component. No `text-[#…]`.
2. **`components/ui` before anything else.** New pattern? Add it there, document it here, then use
   it. Never inline first and extract later — that is how 64 cards happened.
3. **Radius comes from the four tokens.** Cards are `lg`. Always.
4. **Every `h1`–`h4` sets `font-heading`.**
5. **Accents never carry text on a light ground.**
6. **Sentence case on every control and heading.**

A change that breaks one of these is a change to this document first.

---

## Assets

Photography is the Guideless library in `apps/web/public/photos`, or a supplier's own hotel
photography through `hotels.image_urls`. Never stock. A hero photograph is chosen for where its
quiet area is, because heroes carry type without a heavy gradient — see
`docs/tier-classification.md` for the same discipline applied to hotels.

People belong in photographs of a group product. A hero with nobody in it sells solitude, which is
not what we sell.
