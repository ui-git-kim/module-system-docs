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
          label: 'Overview',
          items: [
            { label: 'Introduction', slug: 'introduction' },
          ],
        },
        {
          label: 'Starter Template',
          items: [
            { label: 'Overview', slug: 'starter-template' },
            { label: 'Base Registry', slug: 'starter-template/base-registry' },
            { label: 'Registry Reference', slug: 'starter-template/registries' },
            { label: 'CLI Scripts', slug: 'starter-template/scripts' },
          ],
        },
        {
          label: 'Module Starter',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'module-starter' },
          ],
        },
        {
          label: 'Modules',
          collapsed: true,
          items: [
            { label: 'Catalogue', slug: 'modules' },
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
