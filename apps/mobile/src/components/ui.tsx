import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MinTouchTarget, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Small, brand-consistent primitives. Rules (spec §98): one-handed, legible in sunlight, no tiny
 * text or controls; the current trip state is always obvious.
 */

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const inner = (
    <View style={[padded && styles.padded, { gap: Spacing.three }, style]}>{children}</View>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["top", "left", "right"]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: Spacing.six }}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
    </SafeAreaView>
  );
}

export function H1({ style, ...props }: TextProps) {
  const c = useTheme();
  return <Text style={[styles.h1, { color: c.text }, style]} {...props} />;
}
export function H2({ style, ...props }: TextProps) {
  const c = useTheme();
  return <Text style={[styles.h2, { color: c.text }, style]} {...props} />;
}
export function Body({ style, ...props }: TextProps) {
  const c = useTheme();
  return <Text style={[styles.body, { color: c.text }, style]} {...props} />;
}
export function Muted({ style, ...props }: TextProps) {
  const c = useTheme();
  return <Text style={[styles.body, { color: c.textSecondary }, style]} {...props} />;
}
export function Eyebrow({ style, ...props }: TextProps) {
  const c = useTheme();
  return <Text style={[styles.eyebrow, { color: c.textSecondary }, style]} {...props} />;
}

export function Card({
  style,
  tone = "default",
  ...props
}: ViewProps & { tone?: "default" | "accent" | "inverse" }) {
  const c = useTheme();
  const bg =
    tone === "accent" ? c.backgroundSelected : tone === "inverse" ? c.primary : c.backgroundElement;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: tone === "default" ? c.border : "transparent" },
        style,
      ]}
      {...props}
    />
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger";
}) {
  const c = useTheme();
  const bg =
    tone === "accent"
      ? c.accent
      : tone === "warning"
        ? "#F4E3B6"
        : tone === "danger"
          ? "#F3C9CB"
          : c.backgroundSelected;
  const fg =
    tone === "accent"
      ? "#0B2025"
      : tone === "warning"
        ? "#8A6414"
        : tone === "danger"
          ? "#9B2F33"
          : c.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  variant = "primary",
  loading = false,
  icon,
  style,
  disabled,
  ...props
}: PressableProps & {
  title: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const bg = variant === "primary" ? c.primary : variant === "danger" ? "#C9484D" : "transparent";
  const fg =
    variant === "primary"
      ? c.primaryText
      : variant === "danger"
        ? "#FFFFFF"
        : variant === "secondary"
          ? c.text
          : c.link;
  const border = variant === "secondary" ? c.border : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: pressed || disabled ? 0.7 : 1 },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  const c = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.textSecondary}
      style={[
        styles.input,
        { color: c.text, borderColor: c.border, backgroundColor: c.backgroundElement },
        style,
      ]}
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.label, { color: c.text }]}>{children}</Text>;
}

export function Row({
  title,
  subtitle,
  right,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  icon?: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
}) {
  const c = useTheme();
  const content = (
    <View style={styles.row}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: c.backgroundSelected }]}>
          <Ionicons name={icon} size={18} color={c.text} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: c.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={c.textSecondary} /> : null)}
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function EmptyState({
  icon = "compass-outline",
  title,
  body,
  action,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const c = useTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: Spacing.five }}>
      <Ionicons name={icon} size={36} color={c.accent} />
      <Text style={[styles.h2, { color: c.text, marginTop: Spacing.two, textAlign: "center" }]}>
        {title}
      </Text>
      {body && (
        <Text
          style={[
            styles.body,
            { color: c.textSecondary, textAlign: "center", marginTop: Spacing.one },
          ]}
        >
          {body}
        </Text>
      )}
      {action && <View style={{ marginTop: Spacing.three }}>{action}</View>}
    </Card>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={[styles.note, { backgroundColor: "#F3C9CB" }]}>
      <Text style={{ color: "#9B2F33", fontFamily: "Inter_500Medium" }}>{message}</Text>
    </View>
  );
}

export function Loading() {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: Spacing.five, alignItems: "center" }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export const text = {
  h1: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
  } satisfies TextStyle,
};

const styles = StyleSheet.create({
  padded: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  h1: { fontFamily: "Manrope_800ExtraBold", fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
  h2: { fontFamily: "Manrope_700Bold", fontSize: 20, lineHeight: 26 },
  body: { fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24 },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  pill: {
    alignSelf: "flex-start",
    borderRadius: Radius.xl,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  button: {
    minHeight: MinTouchTarget + 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  input: {
    minHeight: MinTouchTarget + 4,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  label: { fontFamily: "Inter_500Medium", fontSize: 14, marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    minHeight: MinTouchTarget + 8,
    paddingVertical: Spacing.two,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 2 },
  note: { borderRadius: Radius.md, padding: Spacing.three },
});
