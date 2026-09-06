// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*"],
  },
  {
    rules: {
      // pnpm installs @expo/vector-icons as a symlink the import resolver cannot follow on Windows;
      // TypeScript (tsc --noEmit) still verifies the module resolves.
      "import/no-unresolved": ["error", { ignore: ["^@expo/vector-icons$"] }],
    },
  },
]);
