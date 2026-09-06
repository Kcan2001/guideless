import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatInZone } from "@guideless/utils";
import { Loading, Muted, Pill } from "@/components/ui";
import { MinTouchTarget, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/auth/session";
import { supabase } from "@/lib/supabase";
import {
  SUPPORT_CATEGORY_LABELS,
  supportService,
  type SupportMessage,
} from "@/lib/support/service";

export default function SupportThreadScreen() {
  const c = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<SupportMessage>>(null);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const thread = useQuery({
    queryKey: ["support-thread", threadId],
    enabled: !!threadId,
    queryFn: () => supportService.getThread(threadId!),
  });

  useEffect(() => {
    if (!threadId) return;
    const channel = supportService.subscribe(threadId, (m) => {
      qc.setQueryData<Awaited<ReturnType<typeof supportService.getThread>>>(
        ["support-thread", threadId],
        (prev) =>
          prev && !prev.messages.some((x) => x.id === m.id)
            ? { ...prev, messages: [...prev.messages, m] }
            : prev,
      );
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, qc]);

  const reply = useMutation({
    mutationFn: () => supportService.reply(threadId!, user!.id, draft),
    onSuccess: (m) => {
      setDraft("");
      qc.setQueryData<Awaited<ReturnType<typeof supportService.getThread>>>(
        ["support-thread", threadId],
        (prev) =>
          prev && !prev.messages.some((x) => x.id === m.id)
            ? { ...prev, messages: [...prev.messages, m] }
            : prev,
      );
      qc.invalidateQueries({ queryKey: ["support-threads"] });
    },
  });

  const t = thread.data?.thread;
  const closed = t?.status === "closed";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["bottom", "left", "right"]}
    >
      <Stack.Screen options={{ title: t?.subject ?? "Support" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        {thread.isPending ? (
          <Loading />
        ) : (
          <FlatList
            ref={listRef}
            data={thread.data?.messages ?? []}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              t ? (
                <View style={{ flexDirection: "row", gap: 6, marginBottom: Spacing.two }}>
                  <Pill>{SUPPORT_CATEGORY_LABELS[t.category]}</Pill>
                  <Pill
                    tone={
                      t.status === "waiting_on_customer"
                        ? "accent"
                        : closed || t.status === "resolved"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t.status.replace(/_/g, " ")}
                  </Pill>
                </View>
              ) : null
            }
            renderItem={({ item: m }) => {
              const staff = m.is_from_staff;
              return (
                <View style={[styles.bubbleRow, !staff && { justifyContent: "flex-end" }]}>
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: staff ? c.backgroundSelected : c.primary,
                        borderColor: staff ? c.border : c.primary,
                      },
                    ]}
                  >
                    {staff && (
                      <Text
                        style={[
                          styles.meta,
                          { color: c.textSecondary, fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        Guideless
                      </Text>
                    )}
                    <Text style={[styles.body, { color: staff ? c.text : c.primaryText }]}>
                      {m.body}
                    </Text>
                    <Text
                      style={[
                        styles.meta,
                        { color: staff ? c.textSecondary : c.primaryText, opacity: 0.7 },
                      ]}
                    >
                      {formatInZone(m.created_at, tz)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.composer, { borderTopColor: c.border }]}>
          {closed ? (
            <Muted style={{ flex: 1, textAlign: "center" }}>
              This request is closed. Start a new one if you need us.
            </Muted>
          ) : (
            <>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Reply"
                placeholderTextColor={c.textSecondary}
                multiline
                style={[
                  styles.input,
                  { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.border },
                ]}
                accessibilityLabel="Reply"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                disabled={!draft.trim() || reply.isPending || !user}
                onPress={() => reply.mutate()}
                style={[
                  styles.send,
                  { backgroundColor: draft.trim() ? c.primary : c.backgroundSelected },
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={draft.trim() ? c.primaryText : c.textSecondary}
                />
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row" },
  bubble: {
    maxWidth: "85%",
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  body: { fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 11 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: MinTouchTarget,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  send: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: MinTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
