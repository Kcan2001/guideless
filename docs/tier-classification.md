# Deciding which tier a property belongs to

Every trip sells the same four rungs — **Explorer, Classic, Premium, Elite** — and every trip
starts at the cheapest one. Assigning a real property to a rung is currently a person reading
`departure_tier_briefs` and using judgement. This document is that judgement written down so it can
be applied consistently, by a person or by a model, against a list of candidate properties.

It is a decision procedure, not a description. If it cannot be executed, it is not finished.

---

## The one idea underneath all of it

**A tier is a level of what the traveler came for, not a level of hotel.**

This is the whole thing, and it is the part that gets forgotten. The star rating is an input, not
the answer. What each rung buys changes with the trip:

- On an **ordinary route** — three cities, nothing scarce, everything walkable — nothing is hard to
  reach, so the ladder is about the **room and the address**. A better hotel is a better tier.
- On an **event weekend** — a Grand Prix, a festival — the room is not scarce, _proximity_ is. An
  unremarkable property inside the ring outranks a very good one outside it, because being there is
  the thing that cannot be bought later.

So the first question is never "how good is this hotel". It is **"what is scarce on this trip?"**
Rank candidates by whatever that is, then use quality to break ties.

A worked example, from the Monaco 2027 departure. A live search of 1,030 properties within 15 km of
the circuit found **eleven** with race-week availability, and only three inside 1.5 km. That single
fact set the whole ladder: the top two rungs are proximity, the bottom two are Nice hotels, and a
four-star inside the principality outranks a four-star in Nice by a factor of ten in price. On the
same route in an ordinary June week, that ladder would be nonsense.

---

## The procedure

### Step 1 — Name the scarce thing

Before looking at any property, answer in one sentence: **what is genuinely limited on this trip?**

| Trip shape                                     | Usually scarce                      | So the ladder is about     |
| ---------------------------------------------- | ----------------------------------- | -------------------------- |
| Event weekend                                  | Beds near the venue, on those dates | Proximity                  |
| Ordinary multi-city route                      | Nothing                             | The room and the street    |
| Remote or seasonal                             | Any bed at all                      | Availability, then comfort |
| Trip built around one place (a villa, a lodge) | The place itself                    | The property               |

Evidence, not intuition: run the availability sweep first. If most candidates are available, nothing
is scarce and the ladder is about quality. If a handful are, that handful is the top of the ladder
whatever their star ratings say.

### Step 2 — Set the bands from real rates

Each rung gets a **researched cost band per stay**, taken from live supplier rates for the actual
dates — never from a general sense of what a city costs. Record the band in the tier brief with the
figures behind it. A rung with no researched band **must not be sold**; say so in the brief and
leave the tier unsold rather than guessing.

The bands must not overlap, and the gaps between them must mean something. If Explorer and Classic
differ only by price, one of them is wrong.

### Step 3 — Assign candidates

For each candidate property, in this order:

1. **Filter to what we can actually sell.** Available for the exact dates, at the occupancy we sell
   (one adult in their own room, and two sharing), and bookable through a supplier we hold or can
   contract. A property with no availability is not a candidate however good it is.
2. **Score on the scarce thing** from Step 1. On an event weekend that is distance to the venue and
   whether the traveler needs transport on the morning that matters. On a route it is the
   neighbourhood and the walk.
3. **Place it in the band** its real cost falls into.
4. **Break ties on what the tier promises** — breakfast, room type, a lift, air conditioning in
   August. These are also what the price must be _derived_ from: a tier promising breakfast must be
   costed from a breakfast-included rate, or the promise is a hole in the margin.
5. **Reject rather than stretch.** If nothing fits a rung, that rung has no candidate on this
   departure. Say so. Do not promote a property to fill a gap — that is how "Premium: Monaco itself"
   ended up describing inventory that did not exist.

### Step 4 — Write the brief so the next person can disagree with it

Each `departure_tier_briefs` row should say: what this rung buys, the researched band with the
figures, the property it is priced against, and anything the rung explicitly is _not_. A brief that
only says "better" is not usable.

---

## The rungs

Definitions are fixed across every trip. What satisfies them is not.

### Explorer — the entry point

The only rung anyone price-shops, because it is the number on the tour card and a traveler can check
it against booking the same hotel themselves. It must be **defensible on price alone**.

- Cheap, but a real hotel. Clean, well reviewed, sensibly located. Never the cheapest bed in the
  city, and never a hostel.
- May drop things the other rungs include — breakfast is the usual one. Say so plainly.
- Judge it by: would a careful traveler on a budget pick this themselves and feel fine about it?

### Classic — the standard

What most people should book. A clear step up from Explorer in **the room and the address**, not
merely in price.

- Includes what the trip promises as standard — breakfast, a double or twin, a location you walk out
  of rather than drive out of.
- If it differs from Explorer only by cost, the ladder has failed. There must be a sentence
  describing what the extra money buys that does not use the word "better".

### Premium — the one that changes shape

This is where the trip's own logic shows. Premium buys **the scarce thing**, whatever Step 1 said it
was.

- On an event: proximity. Accept a plainer property for a shorter walk.
- On a route: design, character, the best part of each city.
- It is not "Classic plus a bit". If the only difference is a nicer room, it is Classic.

### Elite — no ceiling, but a real floor

What a traveler would choose if price were irrelevant — and it must be _available_, not aspirational.

- On an event: the address, at whatever it costs. Race-week Monte Carlo runs six to seven times an
  ordinary rate; that is the price, and the copy should say why rather than apologise.
- On a route: the best room and building on that route for those dates.
- **Availability is the binding constraint.** An Elite tier resting on one property is a real tier
  with a capacity of about that property's allocation, not a comfortable number. Set capacity to
  what could actually be secured, and record that it is an estimate rather than a held block.

---

## Constraints that override everything above

- **Never sell a rung with no researched band.** Leave it unsold and say why in the brief.
- **Never name a property as the traveler's hotel until it is contracted.** Until then it is the
  property the tier is _priced against_ — a weaker and true claim — and the page must say so.
- **Price from the rate that matches the promise.** Cheapest-at-the-hotel is the wrong rate whenever
  the tier promises breakfast, a room type, or refundability.
- **A tier whose cost per person rises as the group empties is dangerous.** A whole-property let — a
  villa, a house — divides by however many turn up. Price it at a conservative occupancy, or it
  loses money on a quiet departure.
- **Capacity is a promise.** Without a contracted allocation it is judgement, and the traveler should
  be told which it is.

---

## For an automated first pass

A model can do Steps 1–3 and produce a **proposal**, not a decision. Give it:

- the candidate set with, per property: name, type, star rating, coordinates, distance to the
  anchor point, total cost for the exact stay at one adult and at two sharing, board type,
  refundability, and amenities;
- the trip's anchor (the venue, or the city centre per leg) and its dates;
- the existing `departure_tier_briefs` for the departure, which carry the bands and the intent;
- what each tier promises, from `departure_stay_options.details` and `includes`.

Ask for, per tier: a chosen property, two runners-up, the band it falls in, a one-sentence
justification naming **the scarce thing**, and an explicit list of rungs it could not fill and why.

Then a human approves. The point of automating this is to turn authoring into confirming, not to
remove the judgement — the failure mode of this whole area is a plausible number nobody checked, and
a model is very good at producing plausible numbers.

**Guardrails for the automated pass**, all of which have already been violated at least once here:

- Refuse to propose a property with no availability for the exact dates.
- Refuse to propose a rung whose band has not been researched.
- Flag when a proposal's cost sits outside the tier's band rather than silently widening the band.
- Flag when the cheapest rate at a property does not match what the tier promises.
- Never let it write a price. It proposes; `departure_stay_options` is written by a person or by the
  live-pricing job, which derives from a real rate.
