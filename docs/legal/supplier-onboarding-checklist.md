# Supplier onboarding checklist

> **Working document, and it depends on drafts that have not been reviewed.** The agreements in this
> directory are drafts prepared for a qualified travel-business attorney. They are not legal advice
> and must not be sent to a supplier until reviewed. Guideless has not yet determined whether it
> operates as a travel agent, a tour operator or a package organiser, and that answer changes what
> some of these steps are for.

Work through this once per supplier, before the first booking. Nothing here is optional: every line
exists because skipping it has a specific consequence, which is stated.

---

## Before any money moves

**1. Signed master agreement, plus the right schedule**
Master agreement for every supplier. Schedule A for a hotel, B for an activity, C for a transfer
company, D for event tickets. A supplier who sells two things signs two schedules.
_If skipped:_ their terms govern, not ours, and clause 22 is the only thing that would have stopped
that.

**2. Certificate of insurance naming Guideless**
Not a screenshot of a policy number. A certificate, in date, showing the limits clause 15 requires,
and naming Guideless as additional insured where the activity warrants it. Diary the renewal date.
_If skipped:_ a claim from a traveler lands on Guideless with nothing behind it.

**3. Licences and permits**
Whatever their business requires: hotel classification, passenger vessel certificate, skipper's
licence, VTC or transport licence, alcohol licence, event reseller appointment. Copies on file.
_If skipped:_ clause 13.1 is a warranty we never checked, and an unlicensed operator is uninsured in
practice.

**4. Tax form**
W-8BEN-E from a non-US entity, or W-9 from a US one. Every supplier so far is European, so W-8BEN-E
is the normal case.
_If skipped:_ withholding obligations and a mess at year end. Ask the accountant which form before
assuming.

**5. Bank details, verified out of band**
Get them in writing, then **telephone a number you already had** — not one on the same email — and
have someone read them back. Record who you spoke to and when.
_If skipped:_ this is the single most common way travel companies lose real money. Clause 8.3 only
protects us if we actually did the call.

---

## Contacts and escalation

**6. Emergency contact that a person answers**
A 24-hour number, a named person, and a backup. Test it: call it outside business hours before the
first traveler arrives.
_If skipped:_ clause 14.4 is a phone number nobody picks up at 2am, which is exactly when it matters
— there is no Guideless representative on site.

**7. Give them ours**
They need the Guideless 24-hour number and `partners@guidelesstravel.com`. Confirm they have logged
it somewhere their night staff can find.

**8. Day-to-day booking contact**
Who receives booking requests, who confirms them, and what the confirmation turnaround is under
clause 6.3.

---

## Record it in the system, not in your head

**9. Create the supplier in admin**
`/admin/suppliers` → the supplier record, then their services on the departure they serve.

**10. Record every cancellation deadline**
Each service's cancellation deadline goes on the supplier service record, not in an email thread.
The operations alerts read these: an unconfirmed supplier service inside 30 days of departure raises
a flag on `/admin`, and it can only do that if the data is there.
_If skipped:_ we discover a deadline by missing it.

**11. Record the confirmation number against the booking**
Every confirmed service gets its supplier confirmation reference stored on the supplier service
record. Clause 6.4 requires it and the manifest prints from it.
_If skipped:_ an operator standing at a hotel desk has nothing to show.

**12. Rates into the catalogue, not into a spreadsheet**
Net rates inform the price a traveler pays, but they are staff-only and never shown to customers.
Hotel rates come in through the hotel supplier mapping on `/admin/hotels`; activity and transfer
rates set the add-on prices on the departure.
_If skipped:_ pricing drifts from cost and nobody notices until the margin has gone.

---

## Before the first traveler

**13. Cross-check what we publish against what they contracted**
Read the trip page and the add-on descriptions against the schedule. Sessions covered, what is
included, what is not, meeting point, minimum age, cancellation window. A mismatch here is a
mis-sale, and Schedule B clause B6.4 and Schedule D clause D1.2 exist because of it.

**14. Confirm accessibility answers**
Accessible rooms, step-free access, whether an activity can take a traveler with reduced mobility.
Get it in writing before someone books on the strength of our page.

**15. Diary the release and attrition dates**
Hotel room release, ticket hold dates, minimum-numbers decision dates. These are the days money
starts to be at risk.

**16. For event tickets, get the delivery plan in writing**
Where, when, to whom, with what identification. Schedule D clause D7.2 exists because travelers are
already overseas when tickets are usually released.

---

## Annually, or when something changes

- Insurance certificate renewed and still meeting the limits.
- Licences still current.
- Bank details unchanged — and if they have changed, verify by phone again.
- Emergency number still answered by a person.
- Rates and cancellation terms for the coming season agreed in writing before selling against them.

---

## Quick record

Copy this per supplier.

| Item                                 | Done | Date | Note                          |
| ------------------------------------ | ---- | ---- | ----------------------------- |
| Master agreement signed              |      |      | `[SCHEDULE(S)]`               |
| Certificate of insurance on file     |      |      | Renews `[DATE]`               |
| Licences on file                     |      |      | `[WHICH]`                     |
| W-8BEN-E / W-9 received              |      |      |                               |
| Bank details verified by phone       |      |      | Spoke to `[NAME]` on `[DATE]` |
| Emergency number tested out of hours |      |      | `[NUMBER]`                    |
| Supplier created in admin            |      |      |                               |
| Cancellation deadlines recorded      |      |      |                               |
| Rates recorded                       |      |      |                               |
| Published description cross-checked  |      |      |                               |
| Release / hold dates diarised        |      |      | `[DATES]`                     |

---

## Placeholders in this document

`[SCHEDULE(S)]`, `[DATE]` × 2, `[WHICH]`, `[NAME]`, `[NUMBER]`, `[DATES]`.
