import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/pipeline/**/*.ts", "src/lib/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/lib/auth.ts",
        "src/lib/logger.ts",
        "src/lib/utils.ts",
        "src/pipeline/main.ts",
        "src/pipeline/sync/**",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
