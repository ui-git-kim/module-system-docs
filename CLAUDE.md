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
│   ├── updating.mdx
│   ├── scripts.mdx
│   ├── changelog.mdx
│   └── roadmap.mdx
├── module-starter/              # Module starter docs
│   ├── index.mdx                # Overview
│   ├── creating-modules.mdx     # Step-by-step guide
│   ├── module-structure.mdx     # File reference
│   ├── templates.mdx            # Code templates
│   ├── lifecycle-hooks.mdx      # Filters and actions
│   ├── changelog.mdx
│   └── roadmap.mdx
├── modules/                     # Individual module docs
│   ├── index.mdx                # Catalogue
│   ├── structure.mdx
│   └── billing.mdx
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
| Getting Started | ✅ Complete | Introduction, docs system, LLM rules |
| Starter Template | ✅ Complete | Architecture, registries, features |
| Module Starter | ✅ Complete | Creating modules, templates, hooks |
| Modules | 🔲 Partial | Catalogue, billing module |
| Reference | 🔲 Partial | CLI, types, API reference |

## Conventions

- **Australian spelling** in prose (colour, behaviour, organisation)
- **American spelling** in code (follows JS/CSS conventions)
- Keep pages focused - one concept per page
- Include practical code examples
- Use Starlight components (Aside, Steps, Tabs, etc.)
