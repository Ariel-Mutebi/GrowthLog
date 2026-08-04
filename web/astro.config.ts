import { defineConfig, fontProviders } from 'astro/config';
import svelte from '@astrojs/svelte';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [svelte()],
  server: { port: 5000 },

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Fraunces',
      cssVariable: '--fraunces',
      fallbacks: ['serif'],
      weights: ['100 900'], 
      styles: ['normal', 'italic'],
    },
    {
      provider: fontProviders.google(),
      name: 'DM Mono',
      cssVariable: '--dm-mono',
      fallbacks: ['monospace'],
      weights: ['400'],
      styles: ['normal'],
    }
  ]
});
