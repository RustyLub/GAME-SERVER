import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project URL: https://rustylub.github.io/GAME-SERVER/
export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/GAME-SERVER/" : "/",
  plugins: [react()],
});
