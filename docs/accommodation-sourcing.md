# Where the beds come from

Decision note, 2026-09-08. The question was whether Guideless can book Airbnb listings for paying
travelers, or whether hotels are simply easier. Short answer: Airbnb is now legally possible and
still operationally wrong. Hotels plus a bedbank is the path, with direct contracts for the
properties we actually care about.

## Airbnb: the rule everyone quotes has changed, and it does not help

The old objection was that the person booking had to be the person staying. That is no longer true.
Airbnb runs a booking-permissions feature: you can book a home for someone else even if you are not
travelling. The terms back it. Clause 11.1 says do not book unless you, or an authorized Guest, are
actually using the stay, and the permissions flow is what makes a traveler an authorized guest.

The mechanics are what kill it at group scale. Every traveler needs their own Airbnb account, must
complete identity verification with a phone number and profile photo, and must accept an emailed
permission request before we can book for them. That is a per-person onboarding step we do not
control, sitting between a customer paying us and us being able to buy their room.

Everything downstream is worse:

- **No commission and no trade rate.** Airbnb has no agency model, only referral credit. Every
  dollar of margin would be markup on the same retail price the traveler can see themselves.
- **No supplier invoice.** Airbnb issues a VAT invoice for its service fee only, never for the
  accommodation. There is nothing to reconcile a trip's largest cost line against, and receipts
  freeze once a reservation confirms.
- **Cancellation fragments per host.** A twelve-room trip can carry twelve different cancellation
  regimes. Our published refund ladder cannot survive that.
- **Host cancellations have no contracted backstop.** AirCover says it will help rebook at
  comparable pricing subject to availability, and states plainly that it is not an insurance policy.
  For a group arriving on a fixed date that is a best effort, not a guarantee.
- **Damage sits with the account holder.** Security deposits ended in 2022 and AirCover for Hosts
  protects the host. We would be the counterparty on damage caused by travelers we do not supervise.
- **No API.** The Airbnb API program is supply-side, invite-only, under NDA, and aimed at channel
  managers and property-management systems. There is no documented path for a company that wants to
  search and book. Not realistically obtainable.

There is no Airbnb for Travel Agents program. Pages claiming one, with IATA numbers and commission
rates, do not correspond to anything on airbnb.com. Airbnb for Work is a corporate travel profile
for booking employee trips, not a distribution channel, and its documentation is silent on booking
for third-party paying customers. Silence is not permission.

Use Airbnb only as a deliberate one-off, for a specific villa we cannot source any other way,
priced knowing we earn nothing on it.

## What to use instead

Ordered by how quickly a company with no trading history can actually get in.

| Channel                                 | Barrier                                                                                                                | What it gives us                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Bedsonline (HBX)**                    | Free. Prove you are a travel agent. Credentials in 1 to 3 working days. No IATA, no volume minimum.                    | The obvious first account. Trade rates on hotels.                                                                     |
| **RateHawk**                            | Free, no monthly fee. Needs a legal entity and bank details.                                                           | B2B net rates, and it explicitly includes apartments, which is the Airbnb-shaped inventory we wanted.                 |
| **Nuitee / LiteAPI**                    | Free account, a card for production, a prefunded wallet. No licence or volume requirement stated.                      | A genuine API at zero barrier. Apartment coverage unconfirmed.                                                        |
| **Direct villa and apartment managers** | One agency agreement per supplier. Typically around 10% commission.                                                    | The least gated route to hero properties, and the only one where we can negotiate terms that match our refund ladder. |
| **WebBeds / Stuba**                     | Trade only, requirements not published.                                                                                | Apartments in the WebBeds supply. Worth an enquiry, not a plan.                                                       |
| **Expedia TAAP**                        | Open to agencies of any size, but needs accreditation: IATA/IATAN, ARC, CLIA or TRUE.                                  | 3.5M properties including vacation rentals, commission on gross value. Route in through a host agency.                |
| **Booking.com Demand API**              | Must already be a Managed Affiliate Partner; the search-look-book tier needs separate approval and an account manager. | Its schema separates booker from guest, so agency booking is native. Effectively closed at zero volume.               |
| **Expedia Rapid**                       | Application only, case by case, certification required.                                                                | Out of reach for now.                                                                                                 |

**The plan:** open Bedsonline and RateHawk now, because both are free and neither has a volume bar,
and RateHawk carries the apartment inventory. Sign direct agreements for the properties a trip is
actually built around. Revisit TAAP and Booking.com once there is accreditation or volume to show.

## The licensing point this turned up

Worth reading properly, because it is bigger than the Airbnb question and applies either way.

California defines a seller of travel around **transportation**, not lodging. Business and
Professions Code 17550.1(a) catches air and sea transport, and land transport where the charge to
the passenger exceeds $300. Lodging appears only in 17550.9 as a travel service that rides along
with a transportation sale. So hotel versus short-term rental makes no difference to registration.

But Guideless sells trains and transfers, well over $300 a head. That triggers registration on its
own. What follows if it does:

- $100 per location, filed annually (17550.20).
- Travel Consumer Restitution Corporation participation is mandatory for a California seller doing
  business with Californians, with assessments capped by 17550.44.
- **17550.15 requires 100% of customer funds in a trust account** unless an exemption under 17550.16
  applies. The usual exemptions are an ARC appointment with three years of unchanged ownership, a
  $1M deposit plan, or an escrow plan. A packager holding customer money generally cannot use the
  ARC route.
- Operating unregistered is a misdemeanour, up to $10,000 and up to a year.

Airbnb itself registers as a seller of travel in California, Florida, Hawaii and Washington.
Washington and Florida both define travel services to include lodging expressly, so a lodging-only
package would be caught in those states even though it is not in California.

**Action:** this needs counsel before the next departure, and it is independent of which
accommodation channel we choose. The trust-account requirement in particular changes how deposits
are held, which is a product decision, not just a compliance one.

## Confidence

Everything above about Airbnb booking permissions, fees, invoicing, AirCover and API access is from
the Airbnb help centre and terms. The bedbank entry requirements are from each provider's own
registration pages, except WebBeds and Stuba, whose requirements are not published, and the Expedia
TAAP accreditation requirement, which is consistent across secondary sources but not stated
officially. The California statute text is quoted from the code; the conclusion that Guideless is
already caught by it is an inference from the transport we sell, and a lawyer should confirm it
rather than us.
