import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

import { resolveApiBaseUrl } from "./src/lib/vozzera/api-url";

export default defineConfig(({ mode }) => {
  resolveApiBaseUrl({
    isProduction: mode === "production",
    value: loadEnv(mode, process.cwd(), "VITE_")["VITE_API_URL"],
  });

  return {
    css: {
      transformer: "lightningcss",
    },
    server: {
      host: "::",
      port: 3000,
    },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins: [
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      nitro({ defaultPreset: "cloudflare-module" }),
      viteReact(),
    ],
  };
});
