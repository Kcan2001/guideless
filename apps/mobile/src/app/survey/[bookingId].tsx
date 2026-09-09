import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  POST_TRIP_SCORES,
  SCORE_ENDS,
  SURVEY_HEARD_ABOUT_OPTIONS,
  SURVEY_PACE_OPTIONS,
  surveyFormSchema,
  surveyIsEmpty,
} from "@guideless/validation";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  H1,
  Input,
  Label,
  Loading,
  Muted,
  Screen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import { surveyService, type OpenSurvey, type SurveyAnswers } from "@/lib/surveys/service";

/**
 * The survey, before or after a trip. Which one is open is decided by the database, not by this
 * screen and not by the link that opened it, so a stale notification can never show the wrong one.
 *
 * Nothing is required. A survey that refuses to submit until it is complete is a survey people
 * abandon, so a half-answered one saves as-is and can be returned to.
 */
export default function SurveyScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const open = useQuery({ queryKey: ["open-surveys"], queryFn: () => surveyService.open() });
  const survey = open.data?.find((s) => s.bookingId === bookingId) ?? null;
  const kind = survey?.kind;

  const existing = useQuery({
    queryKey: ["survey-answers", bookingId, kind],
    queryFn: () => surveyService.answers(String(bookingId), kind!),
    enabled: Boolean(kind),
  });

  if (open.isPending || (survey && existing.isPending)) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!survey) {
    return (
      <Screen>
        <H1>Nothing to answer</H1>
        <Muted>
          The survey before a trip closes when the trip does, and the one after opens the day it
          ends. If you think that is wrong, write to us and we will sort it out.
        </Muted>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  // The editor mounts only once both queries have resolved, so it can seed its fields from the
  // previous answers in `useState` rather than copying them in with an effect afterwards.
  return <SurveyEditor survey={survey} previous={existing.data ?? null} />;
}

function SurveyEditor({
  survey,
  previous,
}: {
  survey: OpenSurvey;
  previous: SurveyAnswers | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { bookingId, kind } = survey;

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const s of POST_TRIP_SCORES) {
      const value = previous?.[s.field];
      if (typeof value === "number") seed[s.field] = value;
    }
    return seed;
  });
  const [text, setText] = useState<Record<string, string>>(() => ({
    bestBit: previous?.bestBit ?? "",
    worstBit: previous?.worstBit ?? "",
    expectations: previous?.expectations ?? "",
  }));
  const [choices, setChoices] = useState<Record<string, string>>(() => ({
    pace: previous?.answers.pace ?? "",
    heardAbout: previous?.answers.heard_about ?? "",
  }));
  const [wouldRepeat, setWouldRepeat] = useState<boolean | null>(previous?.wouldRepeat ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = surveyFormSchema.safeParse(
        kind === "pre_trip"
          ? {
              bookingId: String(bookingId),
              kind,
              expectations: text.expectations,
              pace: choices.pace,
              heardAbout: choices.heardAbout,
            }
          : {
              bookingId: String(bookingId),
              kind: "post_trip",
              ...scores,
              bestBit: text.bestBit,
              worstBit: text.worstBit,
              expectations: text.expectations,
              wouldRepeat: wouldRepeat === null ? undefined : wouldRepeat,
            },
      );
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check your answers and try again.");
      }
      if (surveyIsEmpty(parsed.data)) throw new Error("Nothing is filled in yet.");
      await surveyService.submit(parsed.data);
      return parsed.data;
    },
    onSuccess: (input) => {
      track("survey_submitted", {
        kind: input.kind,
        answered: input.kind === "post_trip" ? Object.keys(scores).length : 0,
      });
      qc.invalidateQueries({ queryKey: ["open-surveys"] });
      qc.invalidateQueries({ queryKey: ["survey-answers", bookingId] });
      router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  const pre = kind === "pre_trip";

  return (
    <Screen>
      <Eyebrow>{pre ? "Before you go" : "Your trip"}</Eyebrow>
      <H1>{pre ? survey.tourName : `How was ${survey.tripName}?`}</H1>
      <Body>
        {pre
          ? "What are you expecting? Knowing that before you arrive is the difference between a week that suits you and one that nearly does."
          : "Private, and never published. This is not a review — say the blunt version."}
      </Body>

      {pre ? (
        <>
          <Card>
            <Label>What are you hoping for?</Label>
            <Input
              value={text.expectations ?? ""}
              onChangeText={(v) => setText((t) => ({ ...t, expectations: v }))}
              multiline
              numberOfLines={5}
              maxLength={2000}
              style={{ minHeight: 110, textAlignVertical: "top", paddingTop: 10 }}
              placeholder="Somewhere to swim every morning, and not being on a coach at 8am."
              accessibilityLabel="What are you hoping for?"
            />
          </Card>

          <Card>
            <Choice
              legend="What kind of week do you think you booked?"
              options={SURVEY_PACE_OPTIONS}
              value={choices.pace ?? ""}
              onChange={(v) => setChoices((c) => ({ ...c, pace: v }))}
            />
          </Card>

          <Card>
            <Choice
              legend="How did you come across us?"
              options={SURVEY_HEARD_ABOUT_OPTIONS}
              value={choices.heardAbout ?? ""}
              onChange={(v) => setChoices((c) => ({ ...c, heardAbout: v }))}
            />
          </Card>
        </>
      ) : (
        <>
          <Card>
            {POST_TRIP_SCORES.map((s) => (
              <Score
                key={s.field}
                legend={s.label}
                value={scores[s.field] ?? null}
                onChange={(n) => setScores((prev) => ({ ...prev, [s.field]: n }))}
              />
            ))}
          </Card>

          <Card>
            <Label>The best part</Label>
            <Input
              value={text.bestBit ?? ""}
              onChangeText={(v) => setText((t) => ({ ...t, bestBit: v }))}
              multiline
              numberOfLines={4}
              maxLength={2000}
              style={{ minHeight: 90, textAlignVertical: "top", paddingTop: 10 }}
              placeholder="The morning swim nobody organised."
              accessibilityLabel="The best part"
            />

            <Label>The worst part</Label>
            <Input
              value={text.worstBit ?? ""}
              onChangeText={(v) => setText((t) => ({ ...t, worstBit: v }))}
              multiline
              numberOfLines={4}
              maxLength={2000}
              style={{ minHeight: 90, textAlignVertical: "top", paddingTop: 10 }}
              accessibilityLabel="The worst part"
            />

            <Label>Anything the scores did not capture</Label>
            <Input
              value={text.expectations ?? ""}
              onChangeText={(v) => setText((t) => ({ ...t, expectations: v }))}
              multiline
              numberOfLines={4}
              maxLength={2000}
              style={{ minHeight: 90, textAlignVertical: "top", paddingTop: 10 }}
              accessibilityLabel="Anything the scores did not capture"
            />
          </Card>

          <Card>
            <Choice
              legend="Would you travel with us again?"
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              value={wouldRepeat === null ? "" : wouldRepeat ? "yes" : "no"}
              onChange={(v) => setWouldRepeat(v === "yes")}
            />
          </Card>
        </>
      )}

      <ErrorNote message={error} />

      <Button
        title={save.isPending ? "Sending…" : previous ? "Save changes" : "Send"}
        loading={save.isPending}
        disabled={save.isPending}
        onPress={() => save.mutate()}
      />
      <Button title="Not now" variant="secondary" onPress={() => router.back()} />
      <Muted>Answer as much or as little as you like. You can come back and change it.</Muted>
    </Screen>
  );
}

/** Five taps, one row. Leaving it alone is a legible answer: every score here is optional. */
function Score({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const c = useTheme();
  return (
    <View>
      <Label>{legend}</Label>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.two, marginTop: 4 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>{SCORE_ENDS.low}</Text>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === n }}
            accessibilityLabel={`${legend}: ${n} out of 5`}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: value === n ? c.accent : c.border,
              backgroundColor: value === n ? c.backgroundSelected : "transparent",
            }}
          >
            <Text style={{ color: value === n ? c.text : c.textSecondary, fontWeight: "600" }}>
              {n}
            </Text>
          </Pressable>
        ))}
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>{SCORE_ENDS.high}</Text>
      </View>
    </View>
  );
}

function Choice({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useTheme();
  return (
    <View>
      <Label>{legend}</Label>
      <View style={{ gap: Spacing.one, marginTop: 4 }}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === o.value }}
            style={{
              paddingHorizontal: Spacing.three,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: value === o.value ? c.accent : c.border,
              backgroundColor: value === o.value ? c.backgroundSelected : "transparent",
            }}
          >
            <Text style={{ color: c.text }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
