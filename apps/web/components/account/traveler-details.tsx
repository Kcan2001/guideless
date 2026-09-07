import type { Tables } from "@guideless/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { updateEmergencyContact, updateTraveler } from "@/lib/bookings/self-service";

type Traveler = Tables<"traveler_profiles">;
type Contact = Tables<"emergency_contacts">;

function complete(t: Traveler, hasContact: boolean, isLead: boolean): boolean {
  return !!t.date_of_birth && !!t.nationality && (!isLead || hasContact);
}

/**
 * Per-traveler details on the account page (spec §85 "Complete profile"). Plain forms that work
 * without JavaScript; each traveler is a <details> so a finished one stays folded.
 */
export function TravelerDetails({
  bookingId,
  travelers,
  leadTravelerId,
  contacts,
  openTravelerId,
}: {
  bookingId: string;
  travelers: Traveler[];
  leadTravelerId: string | null;
  contacts: Map<string, Contact>;
  openTravelerId?: string | null;
}) {
  return (
    <div id={`travelers-${bookingId}`} className="mt-4 space-y-3">
      {travelers.map((t) => {
        const isLead = t.id === leadTravelerId;
        const contact = contacts.get(t.id);
        const done = complete(t, !!contact, isLead);
        const name = `${t.first_name} ${t.last_name}`;
        return (
          <details
            key={t.id}
            id={`traveler-${t.id}`}
            open={openTravelerId === t.id || !done}
            className="group rounded-xl border border-border bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="font-heading font-semibold">{name}</span>
                {isLead && (
                  <span className="ml-2 text-xs text-muted-foreground">Lead traveler</span>
                )}
              </span>
              <span
                className={`text-xs font-medium ${done ? "text-muted-foreground" : "text-foreground"}`}
              >
                {done ? "Details complete" : "Details needed"}
                <span className="sr-only">. Expand to edit</span>
              </span>
            </summary>
            <div className="border-t border-border p-4">
              <form action={updateTraveler} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="travelerId" value={t.id} />
                <Field
                  id={`t-${t.id}-preferred`}
                  label="Preferred name"
                  hint="What the group should call you."
                >
                  <Input
                    id={`t-${t.id}-preferred`}
                    name="preferredName"
                    defaultValue={t.preferred_name ?? ""}
                    maxLength={80}
                  />
                </Field>
                <Field id={`t-${t.id}-email`} label="Email">
                  <Input
                    id={`t-${t.id}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={t.email ?? ""}
                  />
                </Field>
                <Field id={`t-${t.id}-phone`} label="Phone" hint="Optional. With country code.">
                  <Input
                    id={`t-${t.id}-phone`}
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    defaultValue={t.phone ?? ""}
                  />
                </Field>
                <Field
                  id={`t-${t.id}-dob`}
                  label="Date of birth"
                  hint="Hotels and rail operators require it."
                >
                  <Input
                    id={`t-${t.id}-dob`}
                    name="dateOfBirth"
                    type="date"
                    required
                    defaultValue={t.date_of_birth ?? ""}
                  />
                </Field>
                <Field
                  id={`t-${t.id}-nat`}
                  label="Nationality"
                  hint="Two-letter country code, e.g. US, FR."
                >
                  <Input
                    id={`t-${t.id}-nat`}
                    name="nationality"
                    required
                    maxLength={2}
                    className="uppercase"
                    defaultValue={t.nationality ?? ""}
                  />
                </Field>
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  <Field id={`t-${t.id}-diet`} label="Dietary requirements" hint="Optional.">
                    <Textarea
                      id={`t-${t.id}-diet`}
                      name="dietaryRequirements"
                      rows={2}
                      maxLength={500}
                      defaultValue={t.dietary_requirements ?? ""}
                    />
                  </Field>
                  <Field
                    id={`t-${t.id}-access`}
                    label="Accessibility notes"
                    hint="Optional. Stairs, mobility, anything hotels should know."
                  >
                    <Textarea
                      id={`t-${t.id}-access`}
                      name="accessibilityNotes"
                      rows={2}
                      maxLength={500}
                      defaultValue={t.accessibility_notes ?? ""}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm">
                    Save traveler
                  </Button>
                </div>
              </form>

              {isLead && (
                <form
                  action={updateEmergencyContact}
                  className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2"
                >
                  <input type="hidden" name="travelerId" value={t.id} />
                  <p className="sm:col-span-2 text-sm font-medium">
                    Emergency contact
                    <span className="block text-xs font-normal text-muted-foreground">
                      Someone we can call if something happens on the trip. Never shared with the
                      group.
                    </span>
                  </p>
                  <Field id={`ec-${t.id}-name`} label="Name">
                    <Input
                      id={`ec-${t.id}-name`}
                      name="name"
                      required
                      defaultValue={contact?.name ?? ""}
                    />
                  </Field>
                  <Field id={`ec-${t.id}-rel`} label="Relationship">
                    <Input
                      id={`ec-${t.id}-rel`}
                      name="relationship"
                      required
                      defaultValue={contact?.relationship ?? ""}
                    />
                  </Field>
                  <Field id={`ec-${t.id}-phone`} label="Phone">
                    <Input
                      id={`ec-${t.id}-phone`}
                      name="phone"
                      type="tel"
                      required
                      defaultValue={contact?.phone ?? ""}
                    />
                  </Field>
                  <Field id={`ec-${t.id}-email`} label="Email" hint="Optional.">
                    <Input
                      id={`ec-${t.id}-email`}
                      name="email"
                      type="email"
                      defaultValue={contact?.email ?? ""}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm" variant="secondary">
                      Save emergency contact
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
