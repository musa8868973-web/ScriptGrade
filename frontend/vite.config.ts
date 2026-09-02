import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Client-only static SPA export for Vercel: all data fetching happens in
      // the browser against the FastAPI backend, so SSR is never exercised at
      // request time. SPA mode renders a single shell page (dist/client/index.html)
      // that the client router hydrates for every route — no per-route prerender
      // (route loaders would hit the backend during build).
      spa: {
        enabled: true,
        // Default outputPath ("/_shell") writes the shell as _shell.html, which
        // static hosts can't serve as the SPA entry. "/index" makes the shell
        // land at dist/client/index.html so "/" resolves directly and the
        // vercel.json rewrite (/(.*) -> /index.html) covers deep links.
        prerender: { outputPath: "/index" },
      },
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    }),
    react(),
    tsConfigPaths(),
  ],
});
