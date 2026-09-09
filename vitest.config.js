import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Rules tests need the Firestore emulator, so they are a separate script
    // (npm run test:rules) rather than part of the default run.
    include: ["tests/orderStatus.test.js", "tests/roles.test.js"],
  },
});
