import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateRange } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { HotelForm } from "@/components/admin/hotel-form";
import { HotelMappingForm } from "@/components/admin/hotel-mapping-form";
import { HotelRoomForm } from "@/components/admin/hotel-room-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { DL, PageHeader, Section, Table, money } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { freeUntil } from "@/lib/hotels/cancellation-policy";
import type { CancellationPolicy } from "@/lib/hotels/types";
import {
  deleteHotelMappingAction,
  refreshHotelRatesAction,
  updateHotelAction,
  useSuggestedDeltaAction,
} from "@/lib/admin/actions/hotels";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { getHotelAdmin, suggestStayPrice, type HotelRateRow } from "@/lib/hotels/catalog";

function policySummary(rate: HotelRateRow): string {
  if (!rate.refundable) return "Non-refundable";
  const deadline = freeUntil(rate.cancellation_policy as CancellationPolicy | null) ?? undefined;
  return deadline ? `Free until ${new Date(deadline).toLocaleDateString("en-GB")}` : "Refundable";
}

export default async function AdminHotelPage(props: PageProps<"/admin/hotels/[id]">) {
  const [{ id }, sp] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff(OPS_ROLES),
  ]);
  const data = await getHotelAdmin(id);
  if (!data) notFound();
  const { hotel, rooms, mappings, rates, stayOptions, destinations } = data;
  const path = `/admin/hotels/${hotel.id}`;

  // One suggestion per linked stay option (its own dates), two adults sharing.
  const suggestions = await Promise.all(
    stayOptions.map(async (s) => ({
      stay: s,
      suggestion: await suggestStayPrice({
        hotelId: hotel.id,
        checkIn: s.departure_start,
        checkOut: s.departure_end,
        adults: 2,
      }),
    })),
  );

  return (
    <>
      <PageHeader
        title={hotel.name}
        description={
          [hotel.city, hotel.country_code].filter(Boolean).join(", ") || "Location not set"
        }
        crumbs={
          <>
            <Link href="/admin/hotels">Hotels</Link> / {hotel.name}
          </>
        }
        actions={
          <form action={refreshHotelRatesAction}>
            <input type="hidden" name="hotelId" value={hotel.id} />
            <SubmitButton size="sm">Refresh rates</SubmitButton>
          </form>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Details">
          <HotelForm
            action={updateHotelAction}
            hotel={hotel}
            destinations={destinations}
            submitLabel="Save"
            returnTo={path}
          />
        </Section>
        <div className="grid gap-6">
          <Section
            id="suppliers"
            title="Supplier mappings"
            description="Which supplier ids mean this property. Rates can only be fetched for mapped suppliers."
          >
            <Table
              head={["Supplier", "Supplier hotel id", "Room", "Supplier room id", ""]}
              rows={mappings.map((m) => [
                m.supplier,
                <code key="h" className="text-xs">
                  {m.supplier_hotel_id}
                </code>,
                m.hotel_room_id
                  ? (rooms.find((r) => r.id === m.hotel_room_id)?.name ?? "room")
                  : "whole hotel",
                m.supplier_room_id ?? "—",
                <form key="d" action={deleteHotelMappingAction}>
                  <input type="hidden" name="hotelId" value={hotel.id} />
                  <input type="hidden" name="mappingId" value={m.id} />
                  <SubmitButton size="sm" variant="ghost" confirm="Remove this mapping?">
                    Remove
                  </SubmitButton>
                </form>,
              ])}
              empty="Not mapped to any supplier yet."
            />
            <div className="mt-4 border-t border-border pt-4">
              <HotelMappingForm hotelId={hotel.id} rooms={rooms} />
            </div>
          </Section>
          <Section
            id="rooms"
            title={`Rooms (${rooms.length})`}
            description="Room types a stay tier can point at. Names should match the supplier's so rates filter correctly."
          >
            <div className="grid gap-4">
              {rooms.map((r) => (
                <HotelRoomForm key={r.id} hotelId={hotel.id} room={r} />
              ))}
              <div className={rooms.length ? "border-t border-border pt-4" : undefined}>
                <HotelRoomForm hotelId={hotel.id} />
              </div>
            </div>
          </Section>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <Section
          id="stays"
          title={`Stay tiers using this hotel (${stayOptions.length})`}
          description="Suggested customer price = best stored rate for two adults + the matching pricing rule, per traveler."
        >
          <Table
            head={[
              "Tour · dates",
              "Stay tier",
              "Current delta / traveler",
              "Suggested delta / traveler",
              "Rule",
              "",
            ]}
            rows={suggestions.map(({ stay, suggestion }) => {
              const best = suggestion?.rates?.[0];
              // Customer amount is for the room (two sharing); the tier delta is per traveler.
              const suggestedDelta = best ? Math.round(best.customer_total / 2) : null;
              return [
                <span key="t">
                  {stay.tour_name}
                  <br />
                  <span className="text-muted-foreground">
                    {formatDateRange(stay.departure_start, stay.departure_end)}
                  </span>
                </span>,
                <span key="s">
                  <Link href={`/admin/departures/${stay.departure_id}#stays`}>{stay.name}</Link>
                  {stay.tier && (
                    <Badge variant="neutral" className="ml-2">
                      {stay.tier}
                    </Badge>
                  )}
                </span>,
                money(stay.price_delta_amount, stay.departure_currency),
                suggestedDelta !== null && best ? (
                  <span key="sd">
                    {money(suggestedDelta, best.currency)}
                    <span className="block text-xs text-muted-foreground">
                      room {money(best.net_total, best.currency)} net +{" "}
                      {money(best.markup, best.currency)} markup
                    </span>
                  </span>
                ) : (
                  <span key="sd" className="text-muted-foreground">
                    no stored rate
                  </span>
                ),
                suggestion?.rule_id ? (
                  "matched"
                ) : (
                  <span className="text-muted-foreground">none</span>
                ),
                suggestedDelta !== null && best ? (
                  <form key="use" action={useSuggestedDeltaAction}>
                    <input type="hidden" name="hotelId" value={hotel.id} />
                    <input type="hidden" name="stayOptionId" value={stay.id} />
                    <input
                      type="hidden"
                      name="deltaMajor"
                      value={(suggestedDelta / 100).toFixed(2)}
                    />
                    <SubmitButton
                      size="sm"
                      variant="secondary"
                      confirm={`Set this tier's delta to ${money(suggestedDelta, best.currency)} per traveler?`}
                    >
                      Use suggested delta
                    </SubmitButton>
                  </form>
                ) : null,
              ];
            })}
            empty="No stay option points at this hotel. Link one from a departure's stay options."
          />
        </Section>

        <Section
          id="rates"
          title={`Stored rates (${rates.length})`}
          description="Net, taxes and fees are supplier figures and stay internal. Expired rows are re-fetched by the nightly job."
        >
          <Table
            head={[
              "Dates",
              "Room",
              "Adults",
              "Net",
              "Taxes",
              "Fees",
              "Total",
              "Terms",
              "Breakfast",
              "Pay",
              "Expires",
              "Supplier",
            ]}
            rows={rates.map((r) => [
              formatDateRange(r.check_in, r.check_out),
              r.room_name ?? "—",
              r.occupancy_adults,
              money(r.net_amount, r.currency),
              money(r.taxes_amount, r.currency),
              money(r.fees_amount, r.currency),
              <span
                key="t"
                className={r.available ? "font-medium" : "text-muted-foreground line-through"}
              >
                {money(r.total_amount, r.currency)}
              </span>,
              policySummary(r),
              r.breakfast_included ? "Yes" : "No",
              r.payment_type === "pay_now" ? "Now" : "At hotel",
              r.expires_at ? new Date(r.expires_at).toLocaleString("en-GB") : "—",
              r.supplier,
            ])}
            empty="No rates stored yet. Map a supplier, link a stay option, then refresh."
          />
        </Section>

        <Section title="Record">
          <DL
            rows={[
              ["Created", new Date(hotel.created_at).toLocaleString("en-GB")],
              ["Updated", new Date(hotel.updated_at).toLocaleString("en-GB")],
              ["Slug", <code key="slug">{hotel.slug}</code>],
              ["Amenities", hotel.amenities.length ? hotel.amenities.join(", ") : "—"],
            ]}
          />
        </Section>
      </div>
    </>
  );
}
