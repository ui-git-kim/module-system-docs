# CLAUDE.md

> **Project:** Module System Documentation
> **Type:** Starlight documentation site
> **Purpose:** Central documentation for the React module system

## Overview

This is the documentation site for the module system - a registry-based architecture for building modular React applications.

## Tech Stack

- **Framework:** Astro + Starlight
- **Styling:** Tailwind CSS
- **Components:** React (for interactive examples)
- **Hosting:** Static files on saas.uniqueicon.com.au

## Structure

```
src/content/docs/           # All documentation pages (MDX)
├── index.mdx               # Landing page
├── introduction.mdx        # System introduction
├── starter-template/       # Starter template docs
│   └── index.mdx
├── module-starter/         # Module starter docs (TODO)
└── modules/                # Individual module docs (TODO)
```

## Commands

```bash
npm run dev      # Start dev server (localhost:4321)
npm run build    # Build for production (outputs to ./dist/)
npm run preview  # Preview production build
```

## Adding Documentation

1. Create `.mdx` file in appropriate folder under `src/content/docs/`
2. Add frontmatter with title and description:
   ```mdx
   ---
   title: Page Title
   description: Brief description
   ---
   ```
3. Add to sidebar in `astro.config.mjs`

## Deployment

```bash
npm run build
```

Upload contents of `./dist/` folder to the web hosting at `/saas.ui/` directory.

## Documentation Sections

| Section | Status | Description |
|---------|--------|-------------|
| Overview | ✅ Created | Introduction, architecture |
| Starter Template | ✅ Started | App foundation docs |
| Module Starter | 🔲 TODO | How to create modules |
| Modules | 🔲 TODO | Individual module docs |
| Reference | 🔲 TODO | Types and registry reference |

## Conventions

- Use Australian spelling in content (colour, behaviour, organisation)
- Code examples use American spelling (follows JS/CSS conventions)
- Keep pages focused - one concept per page
- Include practical code examples
