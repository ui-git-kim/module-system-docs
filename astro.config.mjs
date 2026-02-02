// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import starlightThemeSix from "@six-tech/starlight-theme-six";

// https://astro.build/config
export default defineConfig({
  site: "https://saas.uniqueicon.com.au",
  integrations: [
    starlight({
      plugins: [
        starlightThemeSix({
          navLinks: [{ label: "Docs", link: "/getting-started" }],
        }),
      ],
      logo: {
        src: "./public/modularSystem_logo.png",
      },
      title: "Module System",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/ui-git-kim",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started" },
            {
              label: "Neon Database Setup",
              slug: "getting-started/neon-setup",
            },
            {
              label: "Create Script Walkthrough",
              slug: "getting-started/create-script",
            },
            { label: "LLM Rules", slug: "getting-started/llm-rules" },
          ],
        },
        {
          label: "Starter Template",
          items: [
            { label: "Overview", slug: "starter-template" },
            {
              label: "Project Architecture",
              slug: "starter-template/architecture",
            },
            { label: "Configuration", slug: "starter-template/configuration" },
            { label: "Base Registry", slug: "starter-template/base-registry" },
            {
              label: "Registry Reference",
              slug: "starter-template/registries",
            },
            {
              label: "Built-in Features",
              items: [
                { label: "Overview", slug: "starter-template/features" },
                {
                  label: "Authentication",
                  slug: "starter-template/auth-feature",
                },
                { label: "User", slug: "starter-template/user-feature" },
                {
                  label: "Dashboard",
                  slug: "starter-template/dashboard-feature",
                },
                { label: "Admin", slug: "starter-template/admin-feature" },
              ],
            },
            { label: "CLI Scripts", slug: "starter-template/scripts" },
            { label: "Updating", slug: "starter-template/updating" },
            { label: "Changelog", slug: "starter-template/changelog" },
            { label: "Roadmap", slug: "starter-template/roadmap" },
          ],
        },
        {
          label: "Module Starter",
          items: [
            { label: "Overview", slug: "module-starter" },
            {
              label: "Creating Modules",
              slug: "module-starter/creating-modules",
            },
            {
              label: "Module Structure",
              slug: "module-starter/module-structure",
            },
            { label: "Code Templates", slug: "module-starter/templates" },
            {
              label: "Lifecycle Hooks",
              slug: "module-starter/lifecycle-hooks",
            },
          ],
        },
        {
          label: "Modules",
          items: [
            { label: "Catalogue", slug: "modules" },
            { label: "Module Structure", slug: "modules/structure" },
            { label: "Billing", slug: "modules/billing" },
          ],
        },
        {
          label: "Reference",
          collapsed: true,
          items: [
            { label: "CLI Commands", slug: "reference/cli-commands" },
            { label: "Types", slug: "reference/types" },
            { label: "Registries API", slug: "reference/registries-api" },
            { label: "BaseRegistry API", slug: "reference/base-registry-api" },
          ],
        },
      ],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
