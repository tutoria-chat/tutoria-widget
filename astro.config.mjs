// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

import react from '@astrojs/react';

// https://astro.build/config
// Static output: the widget is a client-rendered iframe app (a single page that
// mounts a client:only React island). PUBLIC_* env vars are inlined at build,
// so no SSR/adapter is needed. Builds to dist/ — which AWS Amplify serves.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});