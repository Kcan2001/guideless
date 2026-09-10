"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BedDouble, Plus, Trash2, Users } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import {
  bookingPreferencesSchema,
  emergencyContactSchema,
  travelerInputSchema,
  type BookingPreferencesInput,
  type EmergencyContactInput,
  type TravelerInput,
} from "@guideless/validation";
import { emptyTraveler, type BuilderDraft } from "@/components/builder/draft";
import { GroupCodeField } from "@/components/builder/group-code-field";
import { STEP_FORM_ID, StepNav } from "@/components/builder/step-nav";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ownRoom, roomOccupancy, shareRoom } from "@/lib/bookings/add-on-selection";

const schema = z.object({
  travelers: z.array(travelerInputSchema).min(1).max(8),
  emergencyContact: emergencyContactSchema,
  preferences: bookingPreferencesSchema,
});
type FormInput = z.input<typeof schema>;
export interface TravelersStepOutput {
  travelers: TravelerInput[];
  emergencyContact: EmergencyContactInput;
  preferences: BookingPreferencesInput;
}

/**
 * "Who’s traveling?" — names as on passports, emergency contact, rooms, a few preferences and a
 * friend's trip code. Adding or removing a traveler here re-fits rooms and add-on choices.
 */
export function TravelersStep({
  title,
  departure,
  draft,
  userEmail,
  onRooms,
  onGroupCode,
  onTravelerCountChange,
  onBack,
  onNext,
}: {
  title: string;
  departure: CheckoutDeparture;
  draft: BuilderDraft;
  userEmail: string;
  onRooms: (rooms: number[]) => void;
  onGroupCode: (code: string | null) => void;
  onTravelerCountChange: (n: number) => void;
  onBack: () => void;
  onNext: (v: TravelersStepOutput) => void;
}) {
  const form = useForm<FormInput, unknown, TravelersStepOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      travelers: Array.from(
        { length: draft.travelerCount },
        (_, i) => draft.travelers[i] ?? emptyTraveler(i === 0 ? userEmail : ""),
      ),
      emergencyContact: draft.emergencyContact ?? {
        name: "",
        relationship: "",
        phone: "",
        email: undefined,
      },
      preferences: draft.preferences ?? {
        roomPreference: "no_preference",
        airportTransfer: "group_welcome_transfer",
        optionalExperienceIds: [],
      },
    },
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "travelers" });
  const errors = form.formState.errors;
  const watched = useWatch({ control: form.control, name: "travelers" });
  const names = watched.map(
    (t, i) => t?.preferredName?.trim() || t?.firstName?.trim() || `Traveler ${i + 1}`,
  );
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });

  return (
    <form id={STEP_FORM_ID} onSubmit={form.handleSubmit(onNext)} className="space-y-8" noValidate>
      <header>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 text-muted-foreground">
          Names as on passports. Only what hotels and rail operators need.
        </p>
      </header>

      {fields.map((f, i) => {
        const e = errors.travelers?.[i];
        return (
          <fieldset key={f.id} className="rounded-xl border border-border bg-surface p-6">
            <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {i === 0 ? "Lead traveler (you)" : `Traveler ${i + 1}`}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`t${i}-first`} label="First name" error={e?.firstName?.message}>
                <Input
                  id={`t${i}-first`}
                  autoComplete="given-name"
                  aria-invalid={!!e?.firstName}
                  {...form.register(`travelers.${i}.firstName`)}
                />
              </Field>
              <Field id={`t${i}-last`} label="Last name" error={e?.lastName?.message}>
                <Input
                  id={`t${i}-last`}
                  autoComplete="family-name"
                  aria-invalid={!!e?.lastName}
                  {...form.register(`travelers.${i}.lastName`)}
                />
              </Field>
              <Field
                id={`t${i}-preferred`}
                label="Preferred name"
                hint="What the group should call you."
                error={e?.preferredName?.message}
              >
                <Input
                  id={`t${i}-preferred`}
                  {...form.register(`travelers.${i}.preferredName`, {
                    setValueAs: (v) => (v === "" ? undefined : v),
                  })}
                />
              </Field>
              <Field id={`t${i}-email`} label="Email" error={e?.email?.message}>
                <Input
                  id={`t${i}-email`}
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!e?.email}
                  {...form.register(`travelers.${i}.email`)}
                />
              </Field>
              <Field
                id={`t${i}-phone`}
                label="Mobile (optional)"
                hint="With country code, e.g. +1 415 555 0123"
                error={e?.phone?.message}
              >
                <Input
                  id={`t${i}-phone`}
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!e?.phone}
                  {...form.register(`travelers.${i}.phone`, {
                    setValueAs: (v) => (v === "" ? undefined : String(v).replace(/[\s()-]/g, "")),
                  })}
                />
              </Field>
              <Field id={`t${i}-dob`} label="Date of birth" error={e?.dateOfBirth?.message}>
                <Input
                  id={`t${i}-dob`}
                  type="date"
                  autoComplete="bday"
                  aria-invalid={!!e?.dateOfBirth}
                  {...form.register(`travelers.${i}.dateOfBirth`)}
                />
              </Field>
              <Field
                id={`t${i}-nat`}
                label="Nationality"
                hint="Two-letter country code, e.g. US, GB, CA."
                error={e?.nationality?.message}
              >
                <Input
                  id={`t${i}-nat`}
                  maxLength={2}
                  className="uppercase"
                  aria-invalid={!!e?.nationality}
                  {...form.register(`travelers.${i}.nationality`, {
                    setValueAs: (v) => String(v).trim().toUpperCase(),
                  })}
                />
              </Field>
            </div>
            {i > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-4 text-danger"
                onClick={() => {
                  remove(i);
                  onTravelerCountChange(fields.length - 1);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Remove traveler
              </Button>
            )}
          </fieldset>
        );
      })}

      {fields.length < 8 && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            append(emptyTraveler());
            onTravelerCountChange(fields.length + 1);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add another traveler
        </Button>
      )}

      <RoomsPanel
        names={names}
        rooms={draft.roomIndexes}
        saving={departure.sharedRoomDiscountAmount}
        money={money}
        onRooms={onRooms}
      />

      <fieldset className="rounded-xl border border-border bg-surface p-6">
        <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Emergency contact
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ec-name" label="Name" error={errors.emergencyContact?.name?.message}>
            <Input
              id="ec-name"
              aria-invalid={!!errors.emergencyContact?.name}
              {...form.register("emergencyContact.name")}
            />
          </Field>
          <Field
            id="ec-rel"
            label="Relationship"
            error={errors.emergencyContact?.relationship?.message}
          >
            <Input
              id="ec-rel"
              placeholder="Partner, parent, friend…"
              aria-invalid={!!errors.emergencyContact?.relationship}
              {...form.register("emergencyContact.relationship")}
            />
          </Field>
          <Field
            id="ec-phone"
            label="Phone"
            hint="With country code."
            error={errors.emergencyContact?.phone?.message}
          >
            <Input
              id="ec-phone"
              type="tel"
              aria-invalid={!!errors.emergencyContact?.phone}
              {...form.register("emergencyContact.phone", {
                setValueAs: (v) => String(v).replace(/[\s()-]/g, ""),
              })}
            />
          </Field>
          <Field
            id="ec-email"
            label="Email (optional)"
            error={errors.emergencyContact?.email?.message}
          >
            <Input
              id="ec-email"
              type="email"
              {...form.register("emergencyContact.email", {
                setValueAs: (v) => (v === "" ? undefined : v),
              })}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-6">
        <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Preferences
        </legend>
        <p className="text-sm text-muted-foreground">
          All optional. Change them later from your account.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            id="room"
            label="Beds in shared rooms"
            hint="Only matters if two travelers share."
            error={errors.preferences?.roomPreference?.message}
          >
            <Select id="room" {...form.register("preferences.roomPreference")}>
              <option value="no_preference">No preference</option>
              <option value="shared_double">One bed</option>
              <option value="shared_twin">Two beds</option>
            </Select>
          </Field>
          <Field
            id="transfer"
            label="Arrival"
            hint="The welcome transfer is included."
            error={errors.preferences?.airportTransfer?.message}
          >
            <Select id="transfer" {...form.register("preferences.airportTransfer")}>
              <option value="group_welcome_transfer">Join the group welcome transfer</option>
              <option value="own_arrangement">I’ll make my own way to the hotel</option>
            </Select>
          </Field>
          <Field
            id="diet"
            label="Dietary requirements"
            className="sm:col-span-2"
            error={errors.preferences?.dietaryRequirements?.message}
          >
            <Textarea
              id="diet"
              placeholder="Vegetarian, allergies, anything a kitchen should know."
              {...form.register("preferences.dietaryRequirements", {
                setValueAs: (v) => (v === "" ? undefined : v),
              })}
            />
          </Field>
          <Field
            id="access"
            label="Accessibility"
            className="sm:col-span-2"
            hint="Stairs, walking distances, hearing or sight: tell us and we plan around it."
            error={errors.preferences?.accessibilityNeeds?.message}
          >
            <Textarea
              id="access"
              {...form.register("preferences.accessibilityNeeds", {
                setValueAs: (v) => (v === "" ? undefined : v),
              })}
            />
          </Field>
        </div>
      </fieldset>

      <GroupCodeField departureId={departure.id} value={draft.groupCode} onChange={onGroupCode} />

      <StepNav onBack={onBack} submit />
    </form>
  );
}

function RoomsPanel({
  names,
  rooms,
  saving,
  money,
  onRooms,
}: {
  names: string[];
  rooms: number[];
  saving: number;
  money: (amount: number) => string;
  onRooms: (rooms: number[]) => void;
}) {
  if (rooms.length < 2) return null;
  const occupancy = roomOccupancy(rooms);
  return (
    <section
      aria-labelledby="rooms-heading"
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id="rooms-heading"
        className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        Rooms
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Own rooms by default. Two can share{saving > 0 ? ` and each save ${money(saving)}` : ""}.
      </p>
      <ul className="mt-4 space-y-3">
        {[...occupancy.entries()].map(([room, travelers]) => (
          <li
            key={room}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sand">
                {travelers.length === 2 ? (
                  <Users className="h-4 w-4" aria-hidden />
                ) : (
                  <BedDouble className="h-4 w-4" aria-hidden />
                )}
              </span>
              <div>
                <p className="font-medium">
                  Room {room} · {travelers.length === 2 ? "shared" : "own room"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {travelers.map((i) => names[i] ?? `Traveler ${i + 1}`).join(" and ")}
                </p>
              </div>
            </div>
            {travelers.length === 2 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onRooms(ownRoom(rooms, travelers[1]!))}
              >
                Separate rooms
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-2">
        {rooms.map((room, i) =>
          rooms.map((other, j) => {
            if (j <= i || room === other) return null;
            if (occupancy.get(room)!.length > 1 || occupancy.get(other)!.length > 1) return null;
            return (
              <li key={`${i}-${j}`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="border border-border"
                  onClick={() => onRooms(shareRoom(rooms, j, i))}
                >
                  {names[i]} + {names[j]}
                  {saving > 0 ? ` · save ${money(saving * 2)}` : ""}
                </Button>
              </li>
            );
          }),
        )}
      </ul>
    </section>
  );
}
