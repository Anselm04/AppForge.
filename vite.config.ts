import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    minify: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            /[/\\]node_modules[/\\](?:react|react-dom|react-router|react-router-dom|scheduler)[/\\]/.test(
              id,
            )
          ) {
            return "react-vendor";
          }
          if (/[/\\]node_modules[/\\]@tanstack[/\\]/.test(id)) {
            return "tanstack-vendor";
          }
        },
      },
    },
    target: "esnext",
    sourcemap: true,
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
    ],
  },
  server: {
    hmr: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
