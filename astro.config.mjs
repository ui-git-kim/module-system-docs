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
      customCss: ["./src/styles/sidebar-fix.css"],
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
              label: "Product Model",
              slug: "getting-started/product-model",
            },
            {
              label: "Documentation System",
              slug: "getting-started/documentation",
            },
            {
              label: "Neon Database Setup",
              slug: "getting-started/neon-setup",
            },
            {
              label: "Backup & Restore",
              slug: "getting-started/backup-restore",
            },
            {
              label: "Field Encryption with AWS KMS",
              slug: "getting-started/aws-kms-setup",
            },
            {
              label: "Cloudflare Edge",
              slug: "getting-started/cloudflare-edge",
            },
            {
              label: "Error Tracking (Sentry)",
              slug: "getting-started/error-tracking",
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
            {
              label: "Registries & Hooks",
              items: [
                {
                  label: "Base Registry",
                  slug: "starter-template/base-registry",
                },
                {
                  label: "Registry Reference",
                  slug: "starter-template/registries",
                },
                {
                  label: "Filter & Action Hooks",
                  slug: "starter-template/hooks",
                },
              ],
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
                {
                  label: "Security",
                  slug: "starter-template/security-feature",
                },
                {
                  label: "System",
                  slug: "starter-template/system",
                },
                {
                  label: "Email",
                  slug: "starter-template/email-feature",
                },
                {
                  label: "Jobs",
                  slug: "starter-template/jobs-feature",
                },
                {
                  label: "Notifications",
                  slug: "starter-template/notifications-feature",
                },
                {
                  label: "Modules",
                  slug: "starter-template/modules-feature",
                },
              ],
            },
            {
              label: "UI Infrastructure",
              items: [
                {
                  label: "Header Toolbar",
                  slug: "starter-template/header-toolbar",
                },
                {
                  label: "Dynamic Breadcrumbs",
                  slug: "starter-template/breadcrumbs",
                },
                {
                  label: "Theme Utilities",
                  slug: "starter-template/theme",
                },
                {
                  label: "Icon Picker",
                  slug: "starter-template/icon-picker",
                },
              ],
            },
            {
              label: "Style System",
              slug: "starter-template/style-system",
            },
            {
              label: "Data Fetching",
              slug: "starter-template/data-fetching",
            },
            {
              label: "Structured Logging",
              slug: "starter-template/logging",
            },
            {
              label: "Updating Cloned Apps",
              slug: "starter-template/updating",
            },
            {
              label: "Versioning & Deprecation",
              slug: "starter-template/versioning",
            },
            { label: "CLI Scripts", slug: "starter-template/scripts" },
            {
              label: "Developer Workflow",
              slug: "starter-template/developer-workflow",
            },
            {
              label: "Testing & CI",
              slug: "starter-template/testing",
            },
            {
              label: "Upstream Issues",
              slug: "starter-template/upstream-issues",
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
              label: "Building Modules",
              items: [
                {
                  label: "Create Script Walkthrough",
                  slug: "module-starter/create-script",
                },
                {
                  label: "Building Your Module",
                  slug: "module-starter/building-modules",
                },
                {
                  label: "Code Templates",
                  slug: "module-starter/templates",
                },
                {
                  label: "Module Database",
                  slug: "module-starter/database",
                },
                {
                  label: "Registry Guide",
                  slug: "module-starter/registry-guide",
                },
                {
                  label: "Starter Integration",
                  slug: "module-starter/starter-integration",
                },
                {
                  label: "CLI Reference",
                  slug: "module-starter/cli-reference",
                },
                {
                  label: "Lifecycle Hooks",
                  slug: "module-starter/lifecycle-hooks",
                },
                {
                  label: "Database Migrations",
                  slug: "module-starter/migrations",
                },
                {
                  label: "File Reference",
                  slug: "module-starter/file-reference",
                },
                {
                  label: "Security",
                  slug: "module-starter/security",
                },
              ],
            },
            {
              label: "Scaffold & Infrastructure",
              items: [
                {
                  label: "Scaffold Architecture",
                  slug: "module-starter/scaffold",
                },
                {
                  label: "Versioning & Updates",
                  slug: "module-starter/versioning",
                },
                {
                  label: "Developer Workflow",
                  slug: "module-starter/developer-workflow",
                },
                {
                  label: "Upstream Issues",
                  slug: "module-starter/upstream-issues",
                },
              ],
            },
            { label: "Changelog", slug: "module-starter/changelog" },
            { label: "Roadmap", slug: "module-starter/roadmap" },
          ],
        },
        {
          label: "Modules",
          items: [
            { label: "Catalogue", slug: "modules" },
            { label: "Module Roadmap", slug: "modules/roadmap" },
            {
              label: "Structure",
              collapsed: true,
              autogenerate: { directory: "modules/structure" },
            },
            {
              label: "Builder",
              collapsed: true,
              autogenerate: { directory: "modules/builder" },
            },
            {
              label: "Style",
              collapsed: true,
              autogenerate: { directory: "modules/style" },
            },
            {
              label: "Billing",
              collapsed: true,
              autogenerate: { directory: "modules/billing" },
            },
            {
              label: "Cog Ingest",
              collapsed: true,
              autogenerate: { directory: "modules/cog-ingest" },
            },
            {
              label: "Colour Palette",
              collapsed: true,
              items: [
                { label: "Overview", slug: "colour-palette" },
                {
                  label: "Colour",
                  items: [
                    { label: "Overview", slug: "colour-palette/colour" },
                    { label: "Harmony Map", slug: "colour-palette/harmony-map" },
                    { label: "Gamut Mapping", slug: "colour-palette/gamut-mapping" },
                    { label: "Tonal Scale", slug: "colour-palette/tonal-scale" },
                    { label: "Mixing Playground", slug: "colour-palette/mixing-playground" },
                    { label: "Thesaurus", slug: "colour-palette/thesaurus" },
                  ],
                },
                { label: "Palette", slug: "colour-palette/palette" },
                { label: "Method Panel", slug: "colour-palette/method-panel" },
                { label: "Colour Semantics", slug: "colour-palette/colour-semantics" },
                { label: "Colour Knowledge", slug: "colour-palette/colour-knowledge" },
                { label: "Usage", slug: "colour-palette/usage" },
                { label: "Integration", slug: "colour-palette/integration" },
                { label: "Configuration", slug: "colour-palette/configuration" },
                { label: "Developer Workflow", slug: "colour-palette/developer-workflow" },
                { label: "Changelog", slug: "colour-palette/changelog" },
                { label: "Roadmap", slug: "colour-palette/roadmap" },
              ],
            },
            {
              label: "Document Management",
              collapsed: true,
              autogenerate: { directory: "document-management" },
            },
          ],
        },
        {
          label: "Libraries",
          items: [
            {
              label: "cognitive-db",
              collapsed: true,
              autogenerate: { directory: "cognitive-db" },
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
