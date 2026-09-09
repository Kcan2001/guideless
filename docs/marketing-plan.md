# Marketing plan — the 2027 season

_Brief item 9, written 9 September 2026, revised the same day once a wrong assumption came out
(see §0). `docs/marketing.md` is the machinery: accounts, pipelines,
events, UTMs, consent, the Instagram and Pinterest queues. All of that is built. This is the thing
the brief said was missing — the plan. What we are actually trying to do, in what order, and what
we are deliberately not doing yet._

## 0. The correction that reshaped this plan

The first draft said Guideless had no track record, inferred from an empty `reviews` table. Wrong:
**Monaco weekends have been run before, several times, just not under this company name.** That is
the single strongest asset in this document and the first version did not contain it.

Three consequences, worked through in the sections below: Monaco becomes the acquisition flagship
rather than the risky pre-proof departure; the April deadline problem mostly dissolves; and we can
make real trip content immediately, because real trips happened.

What it does **not** change is the review system. Those travelers cannot write reviews —
`submit_review()` requires a completed Guideless booking, and published rows feed the
`AggregateRating` a tour page hands to search engines. They become **testimonials** instead:
migration 0069, `/admin/testimonials`, no rating, clearly separated, and unattributed as to who ran
the earlier trips. See `docs/growth.md`.

## 1. Where we actually stand

|                                                      |                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Seats to sell in 2027                                | **90** across four departures                                             |
| Seats needed to make every minimum                   | **30**                                                                    |
| First departure                                      | **14 May 2027** — eight months out                                        |
| Travelers who have been on a Guideless trip          | **0**                                                                     |
| Monaco weekends run before, under other arrangements | **several** — the strongest asset here; get the exact number              |
| Published reviews                                    | **0**, by design — `submit_review()` refuses anyone who has not travelled |
| Photos and video of an actual departure              | **0**                                                                     |
| People doing this                                    | **1**                                                                     |

| Departure         | Dates          | Price  | Capacity | Minimum | Books by    |
| ----------------- | -------------- | ------ | -------- | ------- | ----------- |
| Southern France   | 14–22 May 2027 | $3,495 | 14       | 6       | 14 Apr 2027 |
| Monaco Grand Prix | 2–7 Jun 2027   | $2,450 | 50       | 12      | 20 Apr 2027 |
| Southern France   | 11–19 Jun 2027 | $3,495 | 14       | 6       | 11 May 2027 |
| Southern France   | 17–25 Sep 2027 | $3,495 | 12       | 6       | 17 Aug 2027 |

Every minimum met is about **$92k** of gross bookings. Every seat sold is about **$262k**. Those
two numbers are eight months and roughly 60 travelers apart, and this plan is about the first one.

**Hard gate before any of this starts.** Every price and date above is placeholder seed data, under
the pre-sale gate Kyle set on 7 September (`docs/strategy-v3-direction.md` §7). Marketing a price
we have not sourced is the one mistake here that is expensive to undo, because the first thirty
travelers are the people we can least afford to re-quote. Real supplier quotes in admin come first.

## 2. The arithmetic that decides everything below

Thirty deposits. There are two ways to get them.

**Cold.** High-ticket group travel from strangers on the internet converts somewhere around
0.2–0.5%. Thirty deposits therefore needs on the order of **10,000 qualified visitors** — people
already looking for a small-group trip to Europe, not passers-by. One person with no audience, no
budget and no reviews does not produce 10,000 qualified visitors in eight months.

**Warm.** Someone who has met you, or who trusts the person who told them about you, converts
closer to 5–15%. Thirty deposits needs on the order of **300 real conversations** — nine a week.
One person can do nine a week for eight months.

That is the whole strategy. Everything below is a consequence of it.

It is worth being precise about why cold converts so badly _for us specifically right now_, because
three of the four reasons expire:

1. No proof **under this name**. The reviews table is empty and stays empty until somebody travels
   with us — but Monaco has been run before, and testimonials and photographs from those weekends
   are usable today. This reason is largely already spent for Monaco, and fully intact for France.
2. You have to go with strangers. That is the product, and it is a real ask without faces attached.
3. $3,495, with $750 due today.
4. The trip is eight months away, so nobody has to decide now — and a decision nobody has to make
   is a decision nobody makes.

Reasons 1–3 are all fixed by running **one** trip — and for Monaco, reason 1 is already most of the
way there. That is the actual objective of this season.

One qualification to the cold-versus-warm split above. Monaco is the exception that has a real cold
channel: an event with a fixed date creates active search intent ("Monaco GP 2027 packages"), which
is one of the few places a stranger arrives already shopping rather than browsing. With prior
photographs and testimonials on the page, that traffic is worth competing for. Southern France has
no equivalent and stays entirely warm.

## 3. The objective

**Fill Southern France, 14 May 2027, past its minimum of six — and come home with proof.**

Not fill the season. Concentrate. Four departures at 25% each is not a business that has sold 22
seats; it is four groups that all feel empty, and a group that feels empty cancels. A group of six
that knows it is running sells its own remaining seats, because the roster strip and the group chat
start doing the work the marketing was doing. Fill one, then the next.

May is the right one to concentrate on: the lowest minimum (six), the earliest date, and it runs
three weeks before Monaco.

**Monaco is the flagship for selling; Southern France is the first run under the name.** These are
different jobs and they do not compete. Monaco has fifty seats, the lower ticket, an event hook, a
fixed date nobody can move, active search intent, and — the thing the first draft of this plan
missed — weekends that have already been run and can be shown. It is the departure most likely to
sell to somebody who has never met Kyle. Southern France is the one that proves Guideless can
operate, and it runs first, on 14 May.

The scheduling worry the first draft raised has mostly dissolved with it. Monaco books by 20 April,
three and a half weeks before Southern France runs, so proof from that trip arrives too late — but
Monaco no longer needs it, because it has proof of its own. Worth keeping in view rather than
acting on: if Monaco is short in March, a small documented trip in January or February would help,
and that is a decision for the March review, not for now.

## 4. Phase 0 — now to May 2027: this is selling, not marketing

Ranked by expected deposits per hour of Kyle's time. The mechanism for each of these is already
built; none of this needs new code.

**1. Hosts. One transaction fills a departure.** `/host` is live and the threshold is eight
(`HOST_FREE_SPOT_THRESHOLD`): bring eight, travel free. Eight is more than Southern France's
minimum. This is by a wide margin the highest-leverage thing in the product and it is currently
passive — a page that waits. It should be an ask. The people to ask are the ones who already
organize other people for a living or a hobby: run-club leaders, climbing-gym regulars, alumni
chapter organizers, photography-meetup hosts, wedding-adjacent friend groups, the person in any
group chat who books the restaurant. Twenty direct asks is a realistic month, and one yes ends the
minimum problem for a departure.

**2. Meetups. Reclassify them from retention to acquisition.** New York, London and Austin are
seeded and `/meetups` is public with RSVPs and Event JSON-LD. We have been treating city evenings as
something for people who have already travelled with us. They are the opposite: they are the
cheapest way in existence to turn a stranger into a warm lead, because the objection is "I would be
going with people I do not know" and the meetup is literally the answer to it. One evening a month
in the New York / Philadelphia corridor, ten to fifteen people, no pitch. It also produces the only
photography we can honestly publish before May: real people, real faces, no trip required.

**3. The 300 conversations.** Personal and second-degree network, tracked by hand in a list — not a
CRM, a list. Nine a week. This is unglamorous and it is the single line item most likely to close
the gap between six deposits and thirty.

**4. Small communities that already have an organizer.** Ask the organizer, never the members.
Running clubs, climbing gyms, alumni chapters, language schools, photography groups, coworking
spaces. The pitch is the host deal, so this and lever 1 are the same conversation.

**5. Reddit and forums: answer, do not post.** r/solotravel, r/travel, r/france, r/formula1 and the
GP-specific threads have people describing our exact customer in their own words. Be useful about
Nice logistics and Monaco transport, link nothing most of the time. This is slow, it does not scale,
and it works — and it is also free market research that feeds `/admin/demand`.

**6. Newsletter. The one channel we own.** `newsletter_subscribers` and the Resend pipeline are
live. One email a month, no more. Content is section 5.

**7. Instagram and Pinterest: credibility, not reach.** The account exists so that the person who
just heard about us from a friend, and looked us up, finds something that is clearly a real company
with a point of view. That is a completely different job from growth, and it is satisfied by a low
volume of specific posts. Two or three a week, never filler. Advanced Access and Pinterest Standard
are both still pending (`docs/marketing.md` §6) and neither blocks this. **Do not measure Instagram
on follower count this season.** It is not the goal, and optimizing for it produces exactly the
generic content section 5 rules out.

## 5. What we say — the content strategy, as opposed to a posting schedule

For Monaco we can make trip content, because the trips happened: photographs, video and quotes from
earlier weekends, published as what they are. That is the most persuasive material available to us
and it should carry the Monaco page and most of the Monaco posting.

For Southern France we cannot, because that route has not been run. Do not fill the gap with stock
or licensed travel imagery — every operator on Instagram is already posting it, ours would be
indistinguishable from theirs, and it would be slightly dishonest besides. Skip it entirely and use
the formats below.

The one thing we can make that nobody can copy is **the reasoning**. A company is being built in the
open, by one person, and the decisions are unusually opinionated. That is genuinely interesting to
the exact person who would book this, and it recruits people who are buying the judgement rather
than a brand — which is the only kind of customer available before there are reviews.

Six recurring formats:

- **Past Monaco weekends.** What the weekend actually looks like, from the ones already run.
  Attributed as its own thing, never as a Guideless departure — that separation is enforced in the
  schema (`docs/growth.md`) and the copy should match it.

- **What $3,495 buys, line by line.** What is included, what is not, and what the same trip costs
  as a guided package. Ends at the trip page. This one carries the most weight: the objection is
  always price legibility.
- **Why there is no guide.** The core argument, made properly and repeatedly, in different shapes.
- **The decisions.** Why the group opens thirty days before departure instead of at booking; why
  two people can share a room and three cannot; why we will not sell you travel insurance; why a
  missed flight is not our fault and what we do anyway. Every one of these is already written down
  somewhere in `docs/` — they just need saying out loud.
- **Building the thing.** The route being planned, the hotels being chosen and rejected, the day
  that got cut. This is the closest thing we have to trip content and it is real.
- **The free days.** The mechanism that makes one group across price tiers actually work — a beach
  walk, a morning jog, a hike that everybody does and nobody pays for. It is the most distinctive
  thing about the product and it is currently the least talked about.

Voice rules are in `docs/design-system.md` and `docs/marketing.md` §8 and do not change: show the
day, not the logo; never "tour guide"; one soft call to action; no faces without consent.

## 6. Phase 1 — from May 2027: the asset

The first departure is not a trip that happens to be photographed. It is the entire marketing budget
of the following year, and it should be resourced like one.

What we need to come home with, in priority order: **faces and consent** (release at booking, so it
is not an awkward request on day one), **video of the free days** — the moment the concept is
legible in two seconds, **the group meeting on night one**, **the route as it actually looked**, and
**four to six reviews** written through `submit_review()` in the week the survey prompt fires.

This matters less than the first draft claimed, because Monaco footage already exists — but it is
still the only way to get Southern France content, and the first Guideless-branded trip is worth
documenting properly whatever else we have. The single best marketing spend available this year is
making sure someone competent is holding a camera on that trip. Comping a seat to someone who shoots well, in exchange for footage rights, is
cheaper than any advertising we could buy with the same money and produces an asset that keeps
working. That is the creator lever from `docs/strategy-v3-direction.md` §5 applied at the only point
in the company's life where it actually pays: _before_ there is content, not after.

Only once that exists does the rest of the strategy addendum's flywheel — creators, destination
ambassadors, UGC share cards, quizzes, programmatic SEO, paid retargeting — stop being multiplication
by zero. Revisit §5 of that document in June 2027, not before.

## 6b. Collecting the testimonials

The one unblocked task in this plan that pays immediately. `/admin/testimonials` exists and is
empty; eight to ten quotes and a folder of photographs is a week of messages.

Three things make the difference between a 20% reply rate and a 70% one: ask for something small,
say exactly where it goes, and make saying no easy. A draft to send individually — never as a
group message:

> Hey — I've finally turned the Monaco weekends into a proper thing. It's called Guideless, and
> the 2027 one is up on the site.
>
> Would you mind if I used a line or two from you about the weekend you came on? Just a sentence
> about what it was actually like. It'd go on the trip page with your first name and the year, and
> I'd keep it separate from the reviews section, since that's only for people who book through the
> new company.
>
> No pressure at all, and I'll send you the exact wording before anything goes up. Also — if you
> have photos from that weekend I could use, I'd love them.

Then in admin: paste the quote as they wrote it, tick the consent box, put where it came from in
the source note (which message, which date, what they agreed to), and publish. Trim for length if
you must; do not rewrite what somebody said.

Two rules that are not negotiable. **Send them the wording before it goes live** — the message
promises it. And **never publish a quote you cannot point to**: the source note exists so that in
a year's time there is an answer to "where did this come from", and the consent flag exists so
that publishing without one is refused rather than merely discouraged.

Photographs are worth as much as the quotes. Ask for the camera roll, not for "a good photo" —
people underestimate their own.

## 7. Not doing, and why

|                                             |                                                                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paid ads**                                | No proof to convert against, no conversion data to optimize on, and an eight-month lead time makes attribution unreadable. Revisit when a departure has sold out once.       |
| **Creators and ambassadors at scale**       | Nothing to sell them and no track record to attach their name to. One comped documentarian (§6) is the exception.                                                            |
| **Programmatic SEO**                        | Two tours. Programmatic pages over two tours is doorway-page spam. Needs three-plus destinations.                                                                            |
| **TikTok and Reels volume**                 | Requires footage we will not have until May.                                                                                                                                 |
| **X, Threads, LinkedIn**                    | Not where this audience plans travel.                                                                                                                                        |
| **Trustpilot / review solicitation**        | Nothing to review. Asking early is how a review platform starts distrusting you.                                                                                             |
| **Discounting to fill the first departure** | It re-prices the product permanently and signals exactly the weakness we are trying to hide. Use the host deal and the referral credit, which are structural, not the price. |

## 8. Budget

Deliberately small, because the constraint this season is Kyle's hours, not dollars.

| Line                                             | Amount                   | Note                                                              |
| ------------------------------------------------ | ------------------------ | ----------------------------------------------------------------- |
| Documenting the first departure                  | **$2,000–3,500**         | One comped seat, or a paid shooter. The one line worth defending. |
| Meetups (venue, first round, travel)             | **$150/mo × 8 = $1,200** | The highest-conversion hour available.                            |
| Google Business Profile, Search Console, sitemap | **$0**                   | Free, and still not finished (`docs/marketing.md` §6).            |
| Resend, GA4, PostHog                             | **$0**                   | All on free tiers at this volume.                                 |
| Paid ads                                         | **$0**                   | See §7.                                                           |
| **Total**                                        | **≈ $4,000–5,000**       |                                                                   |

## 9. How we will know

At thirty target bookings, a GA4 conversion rate is statistical noise. Do not manage to it. Manage
to the pipeline, which is already fully instrumented in the product — every leading indicator below
has a table behind it and a screen to read it on:

| Signal                     | Where it lives                             | What it means                       |
| -------------------------- | ------------------------------------------ | ----------------------------------- |
| Conversations had          | A list Kyle keeps                          | The only input we control directly  |
| Host applications          | `/admin/hosts`                             | The highest-value lead type we have |
| Meetup RSVPs               | `/admin/meetups`                           | Warm leads with a face              |
| Saves per tour             | `/admin/demand`                            | Interest with no prompt attached    |
| Destination requests       | `/admin/demand`                            | Where trip three should go          |
| Waitlist and alert signups | `departure_waitlist`, `destination_alerts` | People who want the email           |
| Newsletter subscribers     | `newsletter_subscribers`                   | The owned list                      |
| **Deposits**               | `bookings`                                 | The only one that is not a proxy    |

Monthly review, first Monday. Targets: **40 conversations a month** (nine a week — that is the 300),
**one host conversation a week**, **one meetup a month**, **six Southern France deposits by 1 March
2027**, **twelve Monaco deposits by 20 April 2027**.

**Kill criteria, decided now rather than in March.** If Southern France May has fewer than six
deposits on 1 March 2027, do not push it to the deadline — move those travelers to the June
departure with the difference credited, and put everything into one date. If Monaco has fewer than
twelve on 1 March, either the deadline moves or the departure does not run, and the travelers should
hear that from us in March rather than discover it in April.

## 10. Decisions this plan is waiting on

1. **Real prices and dates** from supplier quotes, entered in admin. Blocks literally everything
   here. Nothing in this plan should start before it. Monaco should be the easier half — the
   weekend has been run before, so the real costs are known rather than estimated.
2. **Collect the testimonials.** `/admin/testimonials` is built and empty. Getting eight to ten
   quotes and a set of photographs out of past Monaco travelers is the highest-value unblocked task
   in this document, and it is a week of messages rather than a project. Consent is recorded per
   quote and the database refuses to publish without it.
3. **Monaco's 20 April deadline** (§3). Probably fine as it stands now. Revisit at the March
   review if Monaco is short.
4. **Referral economics.** What is built is 5% off the base for the friend and a $75 credit for the
   referrer. On a $3,495 trip that is roughly $250 of a contribution the strategy addendum estimates
   at ~$600, which is a lot to pay, while $75 is probably too small to actually motivate anyone —
   the worst of both. The addendum proposed $100–500 tiers. Pick real numbers once real margins
   exist, and change `referral_discount_percent` / `referral_reward_amount` in `system_settings`.
5. **Who documents the first departure**, and whether that is a comped seat. Decide by January so it
   can be offered as a seat rather than bought as a service.
6. **Whether Kyle is on camera.** The building-in-public format in §5 is materially stronger with a
   face attached, and materially harder to sustain. It is a real preference, not an oversight, and
   the plan works either way — it is just slower without.
