import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://microcalorietracker.online',
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
  }),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['mysql2', 'memjs'],
    },
  },
  integrations: [sitemap()],
});
