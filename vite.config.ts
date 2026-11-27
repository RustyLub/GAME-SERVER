import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The production site is served from the apex custom domain rusty-lub.online.
// Using "/" also keeps local development paths predictable.
export default defineConfig({
  base: "/",
  plugins: [react()],
});
