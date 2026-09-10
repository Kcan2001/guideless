# Design system

Derived from the master spec §9–13, §97–101. Tokens live in code at
`packages/config/src/{tokens,typography,brand}.ts`; web CSS variables in
`apps/web/app/globals.css`; mobile theme in `apps/mobile/src/constants/theme.ts`.
**Change the package first, then mirror.**

## Feel

Modern · adventurous · premium · calm · international.
Not: corporate travel agency, backpacker hostel, generic SaaS, luxury-hotel cliché, tech startup.

Metaphor: _the road is always there, but nobody is forcing you down it._ Maps, routes,
coordinates, passport/document motifs, curved lines, small location markers, large photography,
generous negative space, timeline itineraries. Avoid compass clichés, airplane icons, stock
photos of guides, "adventure" badges.

## Color

| Token | Hex       | Role                                                                    |
| ----- | --------- | ----------------------------------------------------------------------- |
| ink   | `#0B2025` | Primary text, nav, primary buttons, headers, footer, dark surfaces      |
| aqua  | `#60E1BB` | Primary accent: highlights, active states, map routes, positive moments |
| cyan  | `#17B1DF` | Links, interactive elements, activity accents, secondary CTA states     |
| teal  | `#40B4BD` | Supporting, sparingly (outlines, subtle fills)                          |
| sand  | `#DAD9D0` | Secondary background, cards, section bands, "journal" surfaces          |
| cloud | `#F5F6F2` | Page background                                                         |
| white | `#FFFFFF` | Cards, contrast                                                         |

**Ratio: ~70% neutral (cloud/sand/white) · ~20% ink · ~10% aqua/cyan.** Do not make it turquoise.

Semantic roles (`semantic` in tokens.ts / CSS vars): background, surface, surface-muted,
surface-inverse, text, text-muted, border, primary, primary-foreground, accent,
accent-foreground, link, link-hover, ring, success `#2FA88A`, warning `#D9A441`, danger `#C9484D`.

Buttons: **Primary** = ink bg + white text. **Secondary** = teal/aqua outline or aqua-tinted fill
with ink text. **Link** = cyan. Gradients only on photography overlays / occasional hero.

Dark mode (mobile, automatic): ink ground, cloud text, aqua as primary. Contrast must stay AA.

## Typography

Inter for UI/body, Manrope for headings (weights 600–800). Large, clean, spacious.

| Style      | Web  | Mobile | Line-height | Weight | Family  |
| ---------- | ---- | ------ | ----------- | ------ | ------- |
| Hero       | 72px | 40px   | 1.05        | 700    | Manrope |
| H1         | 56px | 32px   | 1.10        | 700    | Manrope |
| H2         | 40px | 28px   | 1.15        | 700    | Manrope |
| H3         | 28px | 22px   | 1.25        | 600    | Manrope |
| H4         | 22px | 18px   | 1.30        | 600    | Manrope |
| Body large | 20px | 18px   | 1.60        | 400    | Inter   |
| Body       | 17px | 16px   | 1.60        | 400    | Inter   |
| Small      | 14px | 14px   | 1.50        | 400    | Inter   |
| Caption    | 12px | 12px   | 1.40        | 500    | Inter   |

Headings: letter-spacing −0.02em, `text-wrap: balance`. No decorative fonts.

## Spacing, radius, elevation

Spacing scale 4-based (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96). Radius sm 6 · md 10 ·
lg 16 · xl 24. Shadows minimal; prefer borders (`border`, `#DAD9D0`) and surface shifts.

## Components (shadcn/ui, restyled with tokens)

Button (primary/secondary/ghost/link/danger) · Card · Badge (Included / Optional / You book /
Guideless handles) · Timeline (itinerary days → items with type icon and time in local zone) ·
Itinerary item card · Departure picker · Price display (`formatMoney`, compact) · Availability
pill (e.g. "2 spots left") · Group avatar stack · Chat bubble · Live Moment card · Empty state ·
Alert/Issue row (admin) · Data table (admin) · Form primitives (React Hook Form + Zod).

## Accessibility (WCAG 2.2 AA)

Keyboard navigable, visible focus (cyan ring, 2px offset), semantic HTML, labeled forms,
screen-reader text for icons, contrast ≥ 4.5:1 body / 3:1 large text, `prefers-reduced-motion`
respected, mobile touch targets ≥ 44px, strong hierarchy (used outdoors, in sunlight, walking).

## Voice

Calm, clear, confident. Say what is arranged and what is free. "Included: Welcome Experience",
"Optional", "Your Next Stop", "Free time — explore Nice". Never "mandatory". Push copy is
operational and specific: "Your train to Avignon leaves in 45 minutes."

## Assets

Logo: `apps/web/public/brand/guideless-logo.webp`. Mobile icons/splash in
`apps/mobile/assets/images/` (currently Expo placeholders — replace with brand marks on ink).

## Links that take a moment

Some routes are rendered per request — the Trip Builder loads a departure, its stay tiers, its
add-ons, live availability and any saved draft before it can paint; `/tours`, a departure page and
`/trips/[id]` do their own work. On a slow connection that is a real wait, and a plain link gives
no sign it registered the click, so people press it again. Kyle, on the Monaco builder: _"should
at least have a spinner if thats the case... shouldn't have people clicking the buttons over and
over."_

- **`<CtaLink>`** (`components/analytics/cta-link.tsx`) already wraps the primary calls to action
  and now shows a spinner while the next page loads. Anything using it got this for free.
- **`<PendingLink>`** (`components/ui/pending-link.tsx`) is the same behaviour without the
  analytics event. Both take an optional `pendingLabel` ("Opening…").

Both use `useLinkStatus` from `next/link`, so they stay real anchors — middle-click, open in a new
tab, prefetch and the browser's own affordances keep working, which a button calling
`router.push` would throw away. While pending, the anchor dims and stops taking clicks via
`:has([role=status])`, which is the part that actually prevents the second and third press.

**Use them for links into dynamic routes only.** A link to a statically rendered page is served
from the cache and there is nothing to wait for; a spinner there is theatre. Form submissions
already have `<SubmitButton>` with its own pending text — this is the navigation equivalent.
