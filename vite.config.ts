import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The production site is served from the apex custom domain rusty-lub.online.
// Using "/" also keeps local development paths predictable.
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { test: /node_modules\\/(react|react-dom|scheduler)\\//, name: "framework" },
            { test: /node_modules\\/@firebase\\/auth\\//, name: "firebase-auth" },
            { test: /node_modules\\/@firebase\\/firestore\\//, name: "firebase-firestore" },
            { test: /node_modules\\/@firebase\\/util\\//, name: "firebase-core" },
          ],
        },
      },
    },
  },
});
