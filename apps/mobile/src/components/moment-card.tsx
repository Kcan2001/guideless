import { View } from "react-native";
import { formatInZone } from "@guideless/utils";
import { Button, Card, H2, Muted, Pill } from "@/components/ui";
import type { MomentWithState } from "@/lib/moments/service";

/**
 * One Live Moment. Shared by the Group tab and the Trip home so counts, wording and the join
 * button behave identically wherever a traveler meets it.
 */
export function MomentCard({
  moment,
  onToggle,
  disabled = false,
  compact = false,
}: {
  moment: MomentWithState;
  onToggle: (going: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const going = moment.mine === "joined";
  const full = moment.capacity != null && moment.joined >= moment.capacity && !going;

  return (
    <Card tone={moment.status === "live" ? "accent" : "default"}>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {moment.is_official ? (
          <Pill tone="accent">Guideless</Pill>
        ) : (
          <Pill>Traveler suggested</Pill>
        )}
        {moment.status === "live" && <Pill tone="warning">Happening now</Pill>}
      </View>
      <H2>{moment.title}</H2>
      <Muted>
        {formatInZone(moment.start_at, moment.timezone)}
        {moment.location_name ? ` · ${moment.location_name}` : ""}
      </Muted>
      {!compact && moment.description ? (
        <Muted style={{ fontSize: 14 }}>{moment.description}</Muted>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <Muted style={{ fontSize: 13 }}>
          {moment.joined} going{moment.capacity ? ` · ${moment.capacity} max` : ""}
        </Muted>
        <Button
          title={going ? "I'm going ✓" : full ? "Full" : "Join"}
          variant={going ? "secondary" : "primary"}
          disabled={full || disabled}
          accessibilityLabel={going ? `Leave ${moment.title}` : `Join ${moment.title}`}
          onPress={() => onToggle(!going)}
          style={{ minHeight: 40, paddingHorizontal: 16 }}
        />
      </View>
    </Card>
  );
}
