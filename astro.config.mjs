// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import vercel from '@astrojs/vercel';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server', // Server-side rendering - allows runtime environment variables
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel(), // Vercel Adapter
});