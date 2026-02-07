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
              label: "Documentation System",
              slug: "getting-started/documentation",
            },
            {
              label: "Neon Database Setup",
              slug: "getting-started/neon-setup",
            },
            { label: "LLM Rules", slug: "getting-started/llm-rules" },
          ],
        },
        {
          label: "Starter Template",
          items: [
            { label: "Overview", slug: "starter-template" },
            {
              label: "Create Script Walkthrough",
              slug: "starter-template/create-script",
            },
            {
              label: "Project Architecture",
              slug: "starter-template/architecture",
            },
            { label: "Configuration", slug: "starter-template/configuration" },
            {
              label: "Database & Prisma",
              slug: "starter-template/database",
            },
            { label: "Base Registry", slug: "starter-template/base-registry" },
            {
              label: "Registry Reference",
              slug: "starter-template/registries",
            },
            {
              label: "Shell Layout",
              slug: "starter-template/shell-layout",
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
            {
              label: "Updating Cloned Apps",
              slug: "starter-template/updating",
            },
            { label: "CLI Scripts", slug: "starter-template/scripts" },
            {
              label: "Developer Workflow",
              slug: "starter-template/developer-workflow",
            },
            { label: "Changelog", slug: "starter-template/changelog" },
            { label: "Roadmap", slug: "starter-template/roadmap" },
          ],
        },
        {
          label: "Module Starter",
          items: [
            { label: "Overview", slug: "module-starter" },
            {
              label: "Scaffold Architecture",
              slug: "module-starter/scaffold",
            },
            {
              label: "Starter Integration",
              slug: "module-starter/starter-integration",
            },
            {
              label: "Versioning & Updates",
              slug: "module-starter/versioning",
            },
            {
              label: "Lifecycle Hooks",
              slug: "module-starter/lifecycle-hooks",
            },
            {
              label: "Create Script Walkthrough",
              slug: "module-starter/create-script",
            },
            {
              label: "Building Your Module",
              slug: "module-starter/building-modules",
            },
            {
              label: "Registry Guide",
              slug: "module-starter/registry-guide",
            },
            {
              label: "Module Database",
              slug: "module-starter/database",
            },
            {
              label: "File Reference",
              slug: "module-starter/file-reference",
            },
            { label: "Code Templates", slug: "module-starter/templates" },
            { label: "Changelog", slug: "module-starter/changelog" },
            { label: "Roadmap", slug: "module-starter/roadmap" },
          ],
        },
        {
          label: "Modules",
          items: [
            { label: "Catalogue", slug: "modules" },
            {
              label: "Structure",
              items: [
                { label: "Overview", slug: "modules/structure" },
                { label: "Installation", slug: "modules/structure/installation" },
                { label: "Node Types", slug: "modules/structure/node-types" },
                { label: "Admin Page", slug: "modules/structure/admin" },
                { label: "Pages", slug: "modules/structure/pages" },
                { label: "Registries", slug: "modules/structure/registries" },
                {
                  label: "Components & Hooks",
                  slug: "modules/structure/components",
                },
                { label: "Database & API", slug: "modules/structure/database" },
                { label: "Changelog", slug: "modules/structure/changelog" },
                { label: "Roadmap", slug: "modules/structure/roadmap" },
              ],
            },
            {
              label: "Builder",
              items: [
                { label: "Overview", slug: "modules/builder" },
                { label: "Roadmap", slug: "modules/builder/roadmap" },
              ],
            },
            { label: "Billing", slug: "modules/billing" },
            {
              label: "Pickers",
              items: [
                { label: "Overview", slug: "modules/pickers" },
                { label: "Configuration", slug: "modules/pickers/configuration" },
                { label: "Usage", slug: "modules/pickers/usage" },
                { label: "Integration", slug: "modules/pickers/integration" },
                { label: "Developer Workflow", slug: "modules/pickers/developer-workflow" },
                { label: "Changelog", slug: "modules/pickers/changelog" },
              ],
            },
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
