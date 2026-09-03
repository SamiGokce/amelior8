import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/firestore.rules.test.js"],
    // Emulator round-trips are slower than a unit test.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
