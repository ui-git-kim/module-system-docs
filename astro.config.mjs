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
