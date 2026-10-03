/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "docs",
    // tools/clean-docs.mjs empties docs/ while keeping hand-written files.
    emptyOutDir: false,
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5180,
    host: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
