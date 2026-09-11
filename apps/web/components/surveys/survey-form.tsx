import {
  POST_TRIP_SCORES,
  SURVEY_HEARD_ABOUT_OPTIONS,
  SURVEY_PACE_OPTIONS,
} from "@guideless/validation";
import { ChoiceQuestion, ScoreScale } from "@/components/surveys/score-scale";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { submitSurveyAction } from "@/lib/surveys/actions";
import type { OpenSurvey, SurveyAnswers } from "@/lib/surveys/queries";

/**
 * The survey itself, before or after a trip. Two shapes, one form, because they submit to the same
 * function and share the same "nothing is required" rule.
 *
 * Before the trip there is nothing to score — only what somebody is hoping for and what they think
 * they booked. After it, the scores are the comparable part and the prose is the part that changes
 * what we do next.
 */
export function SurveyForm({
  survey,
  existing,
}: {
  survey: OpenSurvey;
  existing: SurveyAnswers | null;
}) {
  return (
    <form action={submitSurveyAction} className="mt-8 grid gap-8">
      <input type="hidden" name="bookingId" value={survey.bookingId} />
      <input type="hidden" name="kind" value={survey.kind} />

      {survey.kind === "pre_trip" ? (
        <PreTripQuestions existing={existing} />
      ) : (
        <PostTripQuestions existing={existing} />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit">{existing ? "Save changes" : "Send"}</Button>
        <p className="text-sm text-muted-foreground">
          Answer as much or as little as you like. You can come back and change it.
        </p>
      </div>
    </form>
  );
}

function PreTripQuestions({ existing }: { existing: SurveyAnswers | null }) {
  return (
    <>
      <Field
        id="expectations"
        label="What are you hoping for?"
        hint="The thing that would make the week worth it. We read these before the trip, and they change what we suggest once you are there."
      >
        <Textarea
          id="expectations"
          name="expectations"
          rows={5}
          maxLength={2000}
          defaultValue={existing?.expectations ?? ""}
          placeholder="Somewhere to swim every morning, and not being on a coach at 8am."
        />
      </Field>

      <ChoiceQuestion
        name="pace"
        legend="What kind of week do you think you booked?"
        options={SURVEY_PACE_OPTIONS}
        defaultValue={existing?.answers.pace}
      />

      <ChoiceQuestion
        name="heardAbout"
        legend="How did you come across us?"
        options={SURVEY_HEARD_ABOUT_OPTIONS}
        defaultValue={existing?.answers.heard_about}
      />
    </>
  );
}

function PostTripQuestions({ existing }: { existing: SurveyAnswers | null }) {
  return (
    <>
      <div className="grid gap-4 rounded border border-border bg-surface p-6">
        {POST_TRIP_SCORES.map((s) => (
          <ScoreScale
            key={s.field}
            name={s.field}
            legend={s.label}
            defaultValue={existing?.[s.field] ?? null}
          />
        ))}
      </div>

      <Field id="bestBit" label="The best part">
        <Textarea
          id="bestBit"
          name="bestBit"
          rows={4}
          maxLength={2000}
          defaultValue={existing?.bestBit ?? ""}
          placeholder="The morning swim nobody organised."
        />
      </Field>

      <Field
        id="worstBit"
        label="The worst part"
        hint="This one is more useful than the last. Nothing here is published."
      >
        <Textarea
          id="worstBit"
          name="worstBit"
          rows={4}
          maxLength={2000}
          defaultValue={existing?.worstBit ?? ""}
        />
      </Field>

      <Field id="expectations" label="Anything the scores did not capture">
        <Textarea
          id="expectations"
          name="expectations"
          rows={4}
          maxLength={2000}
          defaultValue={existing?.expectations ?? ""}
        />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium">Would you travel with us again?</legend>
        <div className="mt-2 flex flex-wrap gap-5">
          {[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ].map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="wouldRepeat"
                value={o.value}
                defaultChecked={existing?.wouldRepeat === (o.value === "yes")}
                className="h-4 w-4 accent-teal"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
