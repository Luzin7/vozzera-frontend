import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
  },
  test: {
    environment: "node",
    env: { VITE_API_URL: "http://localhost:8080" },
    include: ["src/**/*.spec.ts"],
  },
});
