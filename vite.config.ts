import { defineConfig } from "vite";

export const githubPagesBase = "/GoblinClicker/";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? githubPagesBase : "/",
  build: {
    assetsInlineLimit: 0,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
