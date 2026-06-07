import { defineConfig } from "vitepress";
import pkg from "../../package.json";

// Docs site for wasm-mcp. Bundled into the Cloudflare Worker as
// static assets (see `worker/wrangler.toml` `[assets]` block) and
// rebuilt + redeployed by `.github/workflows/deploy-worker.yml`.
//
// Source content: the markdown files in this directory, plus three
// auto-generated pages produced by `npm run docs:data`:
//   - `/tools`      — the full tool reference, from src/mcp/tool_meta.ts
//   - `/snapshots`  — the pinned upstream SHAs, from build/*.json
//   - `/changelog`  — a copy of the repo-root CHANGELOG.md

export default defineConfig({
  title: "wasm-mcp",
  description:
    "MCP server for the WebAssembly specification — SHA-pinned instructions, types, sections, search, and proposals. Not affiliated with the W3C WebAssembly CG/WG.",

  base: "/",
  cleanUrls: true,

  // Don't fail the build on outbound links that may 404 briefly.
  ignoreDeadLinks: [/^https?:\/\/(?!github\.com\/xyzzylabs\/wasm-mcp)/],

  head: [
    ["meta", { name: "theme-color", content: "#654ff0" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "wasm-mcp" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Structured MCP server for the WebAssembly specification.",
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: "Get started", link: "/getting-started" },
      { text: "Tools", link: "/tools" },
      { text: "Snapshots", link: "/snapshots" },
    ],

    sidebar: [
      {
        text: "Get started",
        items: [
          { text: "Overview", link: "/" },
          { text: "Get started in 5 min", link: "/getting-started" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Tool reference", link: "/tools" },
          { text: "Pinned snapshots", link: "/snapshots" },
          { text: "Changelog", link: "/changelog" },
        ],
      },
      {
        text: "Under the hood",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Hosting (Cloudflare Worker)", link: "/deployment" },
        ],
      },
      {
        text: "Policies",
        items: [{ text: "Privacy Policy", link: "/privacy" }],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/xyzzylabs/wasm-mcp" }],

    editLink: {
      pattern: "https://github.com/xyzzylabs/wasm-mcp/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: `wasm-mcp v${pkg.version} · © 2026 <a href="https://xyzzylabs.ai" target="_blank" rel="noopener">xyzzy_labs</a>`,
    },

    search: { provider: "local" },

    outline: { level: [2, 3], label: "On this page" },
  },
});
