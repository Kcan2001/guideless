import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ASSISTANT_MESSAGE_MAX } from "@guideless/validation";
import { Body, Button, Card, Eyebrow, H1, Input, Loading, Muted } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import {
  assistantService,
  type AssistantAction,
  type AssistantTurn,
} from "@/lib/assistant/service";

/**
 * Asking about the trip, from the phone that is actually in the place.
 *
 * The one screen in this app that genuinely needs a connection — everything else is built to work
 * on a train through a tunnel — so it says that plainly when there is none rather than spinning.
 *
 * Actions the assistant took are rendered as their own small cards rather than left inside the
 * prose. "I've added that to your day" in a sentence is a claim; a card is a receipt.
 */
export default function AssistantScreen() {
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<AssistantTurn[]>([]);

  const history = useQuery({
    queryKey: ["assistant", bookingId],
    queryFn: () => assistantService.history(String(bookingId)),
  });
  const left = useQuery({
    queryKey: ["assistant-left"],
    queryFn: () => assistantService.messagesLeft(),
  });

  const ask = useMutation({
    mutationFn: async (message: string) => assistantService.ask(String(bookingId), message),
    onSuccess: (reply, message) => {
      if (reply.ok) {
        track("assistant_asked", { actions: reply.actions.length });
        setPending((p) => [
          ...p,
          { role: "user", content: message },
          { role: "assistant", content: reply.reply, actions: reply.actions },
        ]);
        qc.setQueryData(["assistant-left"], reply.messagesLeft);
        // A plan may have been added; the Today screen and the plan list must not be stale.
        qc.invalidateQueries({ queryKey: ["plans"] });
      } else {
        setPending((p) => [
          ...p,
          { role: "user", content: message },
          { role: "assistant", content: reply.message, failed: true },
        ]);
        if (reply.outOfMessages) qc.setQueryData(["assistant-left"], 0);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
  });

  if (history.isPending) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <Loading />
      </SafeAreaView>
    );
  }

  const turns = [...(history.data ?? []), ...pending];
  const remaining = left.data ?? 0;
  const out = remaining <= 0 && left.isFetched;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <Eyebrow>Your trip</Eyebrow>
          <H1>Ask anything</H1>

          {turns.length === 0 && (
            <Card>
              <Body>
                Where to eat tonight, what&rsquo;s near you, what to do with a free morning. It
                knows your route and what we recommend.
              </Body>
              <Muted>
                It can be wrong — check anything that matters. It can&rsquo;t change your booking or
                spend money; our team does that.
              </Muted>
            </Card>
          )}

          {turns.map((turn, i) => (
            <View
              key={i}
              style={{
                alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                borderRadius: 18,
                paddingHorizontal: Spacing.three,
                paddingVertical: 10,
                backgroundColor:
                  turn.role === "user"
                    ? c.primary
                    : turn.failed
                      ? c.backgroundSelected
                      : c.backgroundElement,
              }}
            >
              <Text style={{ color: turn.role === "user" ? c.primaryText : c.text, fontSize: 15 }}>
                {turn.content}
              </Text>
              {turn.actions?.map((a, j) => (
                <ActionCard key={j} action={a} />
              ))}
            </View>
          ))}

          {ask.isPending && (
            <View style={{ alignSelf: "flex-start" }}>
              <Muted>Thinking…</Muted>
            </View>
          )}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: c.border,
            padding: Spacing.three,
            gap: Spacing.two,
          }}
        >
          <Input
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={ASSISTANT_MESSAGE_MAX}
            editable={!ask.isPending && !out}
            placeholder={out ? "That's today's questions used up." : "Ask about your trip…"}
            accessibilityLabel="Ask the trip assistant"
            style={{ minHeight: 44, maxHeight: 120, textAlignVertical: "top", paddingTop: 12 }}
          />
          <Button
            title={ask.isPending ? "Sending…" : "Ask"}
            loading={ask.isPending}
            disabled={ask.isPending || out || draft.trim().length === 0}
            onPress={() => {
              const message = draft.trim();
              setDraft("");
              ask.mutate(message);
            }}
          />
          <Muted>
            {out
              ? "It resets tomorrow. Our team is there in the meantime."
              : `${remaining} question${remaining === 1 ? "" : "s"} left today.`}
          </Muted>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A receipt for something the assistant actually did, not a claim inside a sentence. */
function ActionCard({ action }: { action: AssistantAction }) {
  const c = useTheme();
  const message = typeof action.detail?.message === "string" ? action.detail.message : null;
  return (
    <View
      style={{
        marginTop: Spacing.two,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.accent,
        padding: Spacing.two,
        gap: 4,
      }}
    >
      <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>{action.summary}</Text>
      {message && <Text style={{ color: c.textSecondary, fontSize: 13 }}>{message}</Text>}
    </View>
  );
}
