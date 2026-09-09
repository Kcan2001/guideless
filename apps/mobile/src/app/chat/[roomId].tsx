import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { emptyStates } from "@guideless/config";
import { formatInZone } from "@guideless/utils";
import { EmptyState, Loading, Muted } from "@/components/ui";
import { MinTouchTarget, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/auth/session";
import { chatService, type Message } from "@/lib/chat/service";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

/** One chat room, live over Supabase Realtime. Long-press a message to report or block. */
export default function ChatRoomScreen() {
  const c = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Message>>(null);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const room = useQuery({
    queryKey: ["room", roomId],
    enabled: !!roomId,
    queryFn: () => chatService.getRoom(roomId!),
  });
  const messages = useQuery({
    queryKey: ["messages", roomId],
    enabled: !!roomId,
    queryFn: () => chatService.listMessages(roomId!),
  });

  useEffect(() => {
    if (!roomId) return;
    track("chat_opened", { room_id: roomId });
    const channel = chatService.subscribe(roomId, (m) => {
      qc.setQueryData<Message[]>(["messages", roomId], (prev) =>
        prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m],
      );
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  useEffect(() => {
    if (roomId && user)
      chatService
        .markRead(roomId, user.id)
        .then(() => qc.invalidateQueries({ queryKey: ["rooms"] }));
  }, [roomId, user, messages.data?.length, qc]);

  const send = useMutation({
    mutationFn: () => chatService.sendMessage(roomId!, user!.id, draft),
    onSuccess: (m) => {
      setDraft("");
      qc.setQueryData<Message[]>(["messages", roomId], (prev) =>
        prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m],
      );
      track("message_sent", { room_id: roomId });
    },
    onError: () =>
      Alert.alert("Not sent", "Check your connection and try again. Announcements are read-only."),
  });

  const readOnly = room.data?.type === "announcements";

  function onLongPress(m: Message) {
    // A system post has no sender: there is nobody to report and nobody to block.
    if (!user || m.is_system || !m.sender_id || m.sender_id === user.id) return;
    const senderId = m.sender_id;
    Alert.alert("This message", undefined, [
      {
        text: "Report",
        style: "destructive",
        onPress: () =>
          chatService
            .report(user.id, m.id, "Reported from chat")
            .then(() => Alert.alert("Thanks", "Guideless will take a look.")),
      },
      {
        text: "Block this traveler",
        style: "destructive",
        onPress: () =>
          chatService
            .block(user.id, senderId)
            .then(() => qc.invalidateQueries({ queryKey: ["messages", roomId] })),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["bottom", "left", "right"]}
    >
      <Stack.Screen options={{ title: room.data?.name ?? "Chat" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        {messages.isPending ? (
          <Loading />
        ) : (
          <FlatList
            ref={listRef}
            data={messages.data ?? []}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubbles-outline"
                title={emptyStates.noMessages.title}
                body={emptyStates.noMessages.body}
              />
            }
            renderItem={({ item: m }) => {
              const mine = !m.is_system && m.sender_id === user?.id;
              return (
                <Pressable
                  onLongPress={() => onLongPress(m)}
                  style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}
                >
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: mine ? c.primary : c.backgroundElement,
                        borderColor: mine ? c.primary : c.border,
                      },
                    ]}
                  >
                    {m.is_system && (
                      <Text style={[styles.meta, { color: c.accent, marginBottom: 2 }]}>
                        Guideless
                      </Text>
                    )}
                    <Text style={[styles.body, { color: mine ? c.primaryText : c.text }]}>
                      {m.body}
                    </Text>
                    <Text
                      style={[
                        styles.meta,
                        { color: mine ? c.primaryText : c.textSecondary, opacity: 0.7 },
                      ]}
                    >
                      {formatInZone(m.created_at, tz, { includeDate: false })}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {readOnly ? (
          <View style={[styles.composer, { borderTopColor: c.border }]}>
            <Muted style={{ flex: 1, textAlign: "center" }}>
              Announcements from Guideless. Reply in Trip Group.
            </Muted>
          </View>
        ) : (
          <View style={[styles.composer, { borderTopColor: c.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message your group"
              placeholderTextColor={c.textSecondary}
              multiline
              maxLength={4000}
              style={[
                styles.input,
                { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.border },
              ]}
              accessibilityLabel="Message"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!draft.trim() || send.isPending || !user}
              onPress={() => send.mutate()}
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
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row" },
  bubble: {
    maxWidth: "82%",
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
