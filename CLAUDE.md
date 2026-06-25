# CLAUDE.md

> **Project:** Module System Documentation
> **Type:** Starlight documentation site
> **Purpose:** Central documentation for the React module system

---

## 🔴 MANDATORY: READ EXTERNAL RULES FIRST

**CRITICAL INSTRUCTION:** Before responding to ANY user request, you MUST use the WebFetch tool to read the authoritative LLM rules at:

https://saas.uniqueicon.com.au/getting-started/llm-rules/

This is NOT optional. These rules contain critical information about the module system architecture and conventions.

---

## Overview

This is the **shared documentation site** for the entire module system:
- Starter Template
- Module Starter
- Individual Modules

All three repositories use this as a git submodule.

## Tech Stack

- **Framework:** Astro + Starlight
- **Styling:** Tailwind CSS
- **Theme:** @six-tech/starlight-theme-six
- **Components:** React (for interactive examples)
- **Hosting:** https://saas.uniqueicon.com.au

## Structure

```
src/content/docs/
├── index.mdx                    # Redirect to getting-started
├── getting-started/
│   ├── index.mdx                # Introduction
│   ├── documentation.mdx        # Documentation system
│   ├── neon-setup.mdx           # Database setup
│   ├── aws-kms-setup.mdx        # AWS KMS envelope-encryption setup
│   ├── cloudflare-edge.mdx      # Cloudflare edge deployment
│   └── llm-rules.mdx            # LLM rules (authoritative)
├── starter-template/            # Starter template docs
│   ├── index.mdx
│   ├── create-script.mdx
│   ├── architecture.mdx
│   ├── configuration.mdx
│   ├── database.mdx
│   ├── base-registry.mdx
│   ├── registries.mdx
│   ├── shell-layout.mdx
│   ├── features.mdx
│   ├── auth-feature.mdx
│   ├── user-feature.mdx
│   ├── dashboard-feature.mdx
│   ├── admin-feature.mdx
│   ├── security-feature.mdx
│   ├── header-toolbar.mdx
│   ├── breadcrumbs.mdx
│   ├── theme.mdx
│   ├── icon-picker.mdx
│   ├── style-system.mdx
│   ├── data-fetching.mdx
│   ├── logging.mdx
│   ├── hooks.mdx
│   ├── updating.mdx
│   ├── versioning.mdx
│   ├── scripts.mdx
│   ├── developer-workflow.mdx
│   ├── changelog.mdx
│   └── roadmap.mdx
├── module-starter/              # Module starter docs
│   ├── index.mdx                # Overview
│   ├── building-modules.mdx     # Step-by-step guide
│   ├── file-reference.mdx       # File reference
│   ├── create-script.mdx        # create-module script
│   ├── database.mdx             # Module database / Prisma
│   ├── registry-guide.mdx       # Registry usage
│   ├── starter-integration.mdx  # Starter template integration
│   ├── templates.mdx            # Code templates
│   ├── lifecycle-hooks.mdx      # Filters and actions
│   ├── cli-reference.mdx        # CLI reference
│   ├── scaffold.mdx             # Scaffold / scaffold:update
│   ├── versioning.mdx           # Versioning policy
│   ├── developer-workflow.mdx   # Developer workflow
│   ├── changelog.mdx
│   └── roadmap.mdx
├── modules/                     # Individual module docs
│   ├── index.mdx                # Catalogue
│   ├── roadmap.mdx
│   ├── billing.mdx
│   ├── structure/               # Structured-content / fields module
│   │   ├── index.mdx
│   │   ├── usage.mdx
│   │   ├── fields.mdx
│   │   ├── merge-fields.mdx
│   │   ├── json-reference.mdx
│   │   ├── registries-guide.mdx
│   │   └── ...                  # configuration, integration, developer-workflow, changelog, roadmap
│   ├── builder/                 # index, usage, configuration, integration, developer-workflow, changelog, roadmap
│   ├── cog-ingest/              # index, usage, configuration, integration, developer-workflow, changelog, roadmap
│   ├── pickers/                 # index, usage, configuration, integration, developer-workflow, changelog
│   └── style/                   # index, design, roadmap
├── colour-palette/              # Colour-palette module docs
│   ├── index.mdx
│   ├── colour.mdx
│   ├── colour-semantics.mdx
│   ├── palette.mdx
│   ├── tonal-scale.mdx
│   ├── harmony-map.mdx
│   ├── gamut-mapping.mdx
│   ├── mixing-playground.mdx
│   ├── method-panel.mdx
│   ├── thesaurus.mdx
│   └── ...                      # usage, configuration, integration, developer-workflow, changelog, roadmap
├── document-management/         # Document-management module docs
│   ├── index.mdx
│   ├── usage.mdx
│   ├── configuration.mdx
│   ├── database.mdx
│   ├── integration.mdx
│   ├── security.mdx
│   ├── developer-workflow.mdx
│   ├── changelog.mdx
│   └── roadmap.mdx
└── reference/                   # API reference (collapsed)
    ├── cli-commands.mdx
    ├── types.mdx
    ├── registries-api.mdx
    └── base-registry-api.mdx
```

## Commands

```bash
npm run dev      # Start dev server (localhost:4321)
npm run build    # Build for production (outputs to ./dist/)
npm run preview  # Preview production build
```

## Adding New Pages

1. Create `.mdx` file in appropriate folder under `src/content/docs/`
2. Add frontmatter:
   ```mdx
   ---
   title: Page Title
   description: Brief description
   ---

   import { Aside, Steps, Tabs, TabItem } from '@astrojs/starlight/components';
   ```
3. Add to sidebar in `astro.config.mjs`
4. Commit, push, then update submodule in parent repos

## 🔴 Before You Finish Checklist

When editing documentation:

1. **Commit and push this repo:**
   ```bash
   git add . && git commit -m "Docs: description" && git push
   ```

2. **Update submodule in parent repo(s):**
   ```bash
   cd ..  # Go to parent repo (starter-template or module-starter)
   git add docs && git commit -m "docs: update submodule"
   ```

## Documentation Status

| Section | Status | Description |
|---------|--------|-------------|
| Getting Started | ✅ Complete | Introduction, docs system, Neon/AWS KMS/Cloudflare setup, LLM rules |
| Starter Template | ✅ Complete | Architecture, configuration, registries, features (auth/user/dashboard/admin/security), theme, hooks, versioning, scripts |
| Module Starter | ✅ Complete | Building modules, file reference, create-script, database, registry guide, scaffold, CLI reference, versioning |
| Modules | ✅ Complete | Catalogue plus structure, builder, cog-ingest, pickers, style, billing |
| Colour Palette | ✅ Complete | Colour module: palette, tonal scale, harmony map, gamut mapping, playground |
| Document Management | ✅ Complete | Usage, configuration, database, security, integration |
| Reference | 🔲 Partial | CLI, types, API reference |

## Conventions

- **Australian spelling** in prose (colour, behaviour, organisation)
- **American spelling** in code (follows JS/CSS conventions)
- Keep pages focused - one concept per page
- Include practical code examples
- Use Starlight components (Aside, Steps, Tabs, etc.)
