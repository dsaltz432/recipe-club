/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
      "@edge": path.resolve(__dirname, "./supabase/functions"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 15000,
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "src/components/ui/", // shadcn components
        "**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },
  },
});
