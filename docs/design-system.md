# Design system

The rules that make every Guideless screen look like the same product. Two fonts, one primary
colour, one accent, one card, one radius scale, one way to write a button label.

This document is enforceable, not aspirational. Where it states a rule it also states how the rule
is checked, and the audit below records how far the codebase currently is from it. If you are about
to write `rounded-2xl border border-border bg-surface` by hand, stop and read
[Components](#components) first.

---

## The direction, decided 2026-09-10

Kyle chose the loud one. Six hero directions were built against five pages of the CSS Design
Awards travel gallery; the winner is heavy caps on ink with the accent doing real work. Three
things in this document change because of it, and everything else holds.

|              | Was                              | Is                                                              |
| ------------ | -------------------------------- | --------------------------------------------------------------- |
| Display face | Manrope 800, sentence case       | **Archivo 900, uppercase**, line-height 0.88, tracking −0.022em |
| Radius       | four values: 6 / 10 / 16 / full  | **one value: 4px**                                              |
| Ground       | cloud, with ink as a text colour | **ink is the default surface**; light bands are the exception   |

Aqua stops being decoration and becomes the primary button plus exactly one phrase per screen. On
ink it is 10.4:1, so for the first time the brand colour can carry weight.

**Light bands are not a fallback, they are the pressure valve.** A loud register fails the moment
it meets a price ladder — four figures from $1,603 to $30,153 set in 40px caps is a poster, not a
table. So anywhere a number has to be trusted or a form has to be completed, the band goes to
cloud and Inter does the reading. Loud on ink, calm on paper.

The reference build is the three screens at
<https://claude.ai/code/artifact/c2433971-86b7-49bd-b433-f581bad7a8e2>.

---

## The audit, 2026-09-10

Measured across `apps/web/app` and `apps/web/components`, not estimated.

| Thing          | State                                                                                                         | Verdict               |
| -------------- | ------------------------------------------------------------------------------------------------------------- | --------------------- |
| Colour tokens  | Defined once in `app/globals.css`, exposed to Tailwind                                                        | Good                  |
| Buttons        | 72 files import the shared `buttonVariants`. **Zero hand-rolled buttons**                                     | The model             |
| Cards          | `components/ui/card.tsx` exists and is imported by **zero** files. 64 files hand-roll one                     | Broken                |
| Corner radius  | **Six** different values in use: `xl` ×126, `lg` ×72, `2xl` ×33, `full` ×30, `md` ×13, `sm` ×1                | Broken                |
| Headings       | **104 of 156** `h1`–`h3` do not set `font-heading`, so they silently render in Inter                          | Broken                |
| Accent as text | `text-teal` ×41, `text-aqua` ×24 — below WCAG AA on our own background (`text-danger` ×20 **fixed**, now AAA) | **Accessibility bug** |
| Shadows        | 11 uses, three values                                                                                         | Fine                  |

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

**Semantic — success, warning, danger, info. Each is a trio, and AAA.**

A status colour is three tokens, not one: the **text** value, the pale **surface** a banner sits
on, and the **border** at its edge. They are separate values rather than alpha washes of a single
hue, and that is the whole trick. Text on a 10% wash of itself can never reach 7:1 without going
so dark it stops reading as red at all — the search for one bounced out at `#76282B`, which is
maroon, and a maroon error message has lost the only job the colour had. Decoupling the surface
lets the text stay a real red and still clear AAA.

| Token     | Text      | Surface   | Border    | on white | on cloud | on its own surface |
| --------- | --------- | --------- | --------- | -------- | -------- | ------------------ |
| `danger`  | `#92292F` | `#F6ECED` | `#DDBBBC` | 8.14     | 7.50     | 7.03               |
| `warning` | `#764610` | `#F8F1EA` | `#E4CEB4` | 7.91     | 7.29     | 7.07               |
| `success` | `#1C5D4C` | `#ECF6F3` | `#BBDDD4` | 7.72     | 7.11     | 7.00               |
| `info`    | `#105875` | `#EAF4F8` | `#B4D6E4` | 7.85     | 7.23     | 7.03               |

Every text value clears **7:1 (AAA) on white, on cloud, and on its own surface** — measured in a
browser against the composited ground, not against the token it nominally sits on. On sand the
reds land at 5.7:1, which is AA; sand is not a ground these ever use, and the margin is the point.

So `text-danger` is now correct wherever it appears, and the three hardcoded hexes that had grown
up around the old failing token — `#9B2F33` in the field banner and the badge, `#8A6414` across
six admin files, `#0B6680` in the info badge — are gone. That drift is the tell: when a token
fails, people do not report it, they paste a darker hex next to it and move on.

Dark mode inverts the trio rather than borrowing it: the text value lightens (`#F5BABD`,
`#ECC37B`) and the surface darkens to ink 700, which is where the mobile pills live.

The ratio across a page stays roughly **70% neutral, 20% ink, 10% accent**.

---

## Typography

Two families. There is no third, and there is no case for one.

| Role          | Family                     | Where                                                                      |
| ------------- | -------------------------- | -------------------------------------------------------------------------- |
| **Primary**   | **Archivo 900, uppercase** | `h1`–`h4`, prices, statistics, button labels, the wordmark. Nothing else.  |
| **Secondary** | **Inter**                  | Body, helper text, form fields, tables, anything you read rather than scan |

`font-heading` is Archivo. **Every `h1`–`h4` sets it**, in caps, at line-height 0.88. A heading
without it renders in Inter and is the single most common reason two pages look like different
products. 104 of 156 headings currently miss it.

The division is scan versus read. Archivo is for text the eye lands on; Inter is for text the eye
moves through. A card title is Archivo, the sentence under it is Inter, and a paragraph is never
Archivo however short it is.

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

### Radius — one value

**4px. Everything.** Cards, buttons, inputs, badges, media frames, modals. There is no scale to
remember and no decision to make, which is the point: six radii are in use today because
`rounded-xl` and `rounded-2xl` are Tailwind defaults nobody mapped to a token, and a page with two
corner radii on two adjacent boxes is exactly the inconsistency this document exists to stop.

Pills are gone. Hard edges are what make this register read as confident rather than friendly, and
a 999px button beside a 4px card is the single loudest inconsistency available.

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

`components/ui/card.tsx` is the only card. It is `rounded border border-border` on `surface` (light
bands) or `surface-inverse` (ink bands), and nothing overrides its border, radius or background.

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

| Prop / class      | Effect                                                      |
| ----------------- | ----------------------------------------------------------- |
| `selected`        | A 2px `accent` border instead of 1px. Nothing else changes. |
| `media` slot      | A 16:10 image above `CardHeader`, flush to the card edge    |
| `className="p-0"` | For a card whose content manages its own padding            |

Everything else — a different radius, a coloured border, a gradient, a shadow — is a new component
and needs a reason in this file.

### Button

Already correct, and the template for the rest. Variants: `primary` (**aqua fill, ink label**), `secondary`
(border, no fill), `inverse` (cloud fill, for use on ink), `ghost`. Sizes `sm`, `md`, `lg`. Radius
`4px`, label in Archivo caps. **One primary button per screen region.**

### The tour page shows what exists; the builder is where you choose

The two pages answer different questions, and every card on them follows from which question it is
answering.

|                         | Tour page                                                           | Builder                                                |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| The reader              | deciding whether this trip is for them, and which budget            | has decided, and is picking                            |
| A stay tier             | what the **price band** means: area, distance, what is in the price | the actual properties, their photographs and addresses |
| An add-on with variants | **one card** for the thing, priced `From`                           | every variant, priced exactly                          |
| Call to action          | one per section                                                     | on every card, because now it is a control             |

Three rules come out of this.

**No per-card call to action on the tour page.** Four buttons that all go to the same builder ask
"which one?" of somebody who has not seen a room yet. One button per section, naming what happens
next — "See the rooms and prices" — and the choosing happens where the information is.

**A card on the tour page never names a hotel.** A named property on a marketing page is a promise
about inventory we only hold once a tier is linked and in date. The card shows the tier's own
photograph of the _area_ instead, which is true at every point in the cycle.

**Variants of one thing are one card.** The catalogue holds three Amber Lounge yacht rows; the tour
page shows one, priced `From` the cheapest, with "3 ways to do it — you pick when you build the
trip". Grouping is a real column (`departure_add_ons.family`), not a title prefix, because guessing
at names silently mis-groups the next thing anyone seeds.

And one rule that is really about consistency: **a card decides how much to say by its component,
not by how much content it happens to have.** Letting each card render whatever it had made the
Monaco race-viewing section 2,549px tall with three of its four columns empty, because one option
had a long inclusions list and another had none. Everything past the summary goes in the detail
sheet. Same card, same height, same row.

### Prices — a trip price is always prefixed "From"

The number on a trip card is the **cheapest tier**, so it reads `From $1,603`, never `$1,603`.
Stating it bare claims a price for a trip most people will not pay, and the four-tier ladder is the
whole product — the spread is a feature, not something to hide behind a single figure.

A tier price on a trip page or in the builder is exact and takes no prefix. A delta takes its sign:
`+$2,460`.

### Badge

`rounded` (4px), `label` type style, a solid `accent` fill with ink text. Never a saturated fill with
white text — see the contrast table.

### Field

Label above, input, helper text below, error replacing helper text. Radius `sm`. Errors use
`text-danger`, and an error banner is `border-danger-border bg-danger-surface text-danger`. Never
an alpha wash of the text colour, and never a one-off hex.

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
