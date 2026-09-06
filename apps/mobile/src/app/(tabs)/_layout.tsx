import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTheme } from "@/hooks/use-theme";

/** Trip · Explore · Group · Support · Profile (spec §22). */
export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trip",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: "Group",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: "Support",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-buoy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
