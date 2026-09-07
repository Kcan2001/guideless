// Side-effect CSS imports (NativeWind/Tailwind entry) have no runtime module shape.
// Expo generates this locally under .expo/types, which CI does not have, so declare it here.
declare module "*.css";
