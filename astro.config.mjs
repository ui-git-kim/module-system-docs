// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://saas.uniqueicon.com.au',
  integrations: [
    starlight({
      title: 'Module System',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/ui-git-kim',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started' },
            { label: 'Neon Database Setup', slug: 'getting-started/neon-setup' },
            { label: 'Create Script Walkthrough', slug: 'getting-started/create-script' },
            { label: 'LLM Rules', slug: 'getting-started/llm-rules' },
          ],
        },
        {
          label: 'Starter Template',
          items: [
            { label: 'Overview', slug: 'starter-template' },
            { label: 'Architecture', slug: 'starter-template/architecture' },
            { label: 'Project Structure', slug: 'starter-template/structure' },
            { label: 'Built-in Features', slug: 'starter-template/features' },
            { label: 'Configuration', slug: 'starter-template/configuration' },
            { label: 'Base Registry', slug: 'starter-template/base-registry' },
            { label: 'Registry Reference', slug: 'starter-template/registries' },
            { label: 'CLI Scripts', slug: 'starter-template/scripts' },
            { label: 'Updating', slug: 'starter-template/updating' },
          ],
        },
        {
          label: 'Module Starter',
          items: [
            { label: 'Overview', slug: 'module-starter' },
            { label: 'Creating Modules', slug: 'module-starter/creating-modules' },
            { label: 'Module Structure', slug: 'module-starter/module-structure' },
            { label: 'Code Templates', slug: 'module-starter/templates' },
            { label: 'Lifecycle Hooks', slug: 'module-starter/lifecycle-hooks' },
          ],
        },
        {
          label: 'Modules',
          items: [
            { label: 'Catalogue', slug: 'modules' },
            { label: 'Module Structure', slug: 'modules/structure' },
            { label: 'Billing', slug: 'modules/billing' },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { label: 'CLI Commands', slug: 'reference/cli-commands' },
            { label: 'Types', slug: 'reference/types' },
            { label: 'Registries API', slug: 'reference/registries-api' },
            { label: 'BaseRegistry API', slug: 'reference/base-registry-api' },
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
