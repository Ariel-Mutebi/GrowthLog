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
      options: {
        experimental: {
          variableAxis: {
            SOFT: [['0', '100']],
            opsz: [['9', '144']],
            WONK: [['0', '1']],
          },
        },
      },
    },
    {
      provider: fontProviders.google(),
      name: 'Space Mono',
      cssVariable: '--space-mono',
      fallbacks: ['monospace'],
      weights: ['400'],
      styles: ['normal'],
    },
    {
      provider: fontProviders.google(),
      name: 'Work Sans',
      cssVariable: '--work-sans',
      fallbacks: ['Arial', 'sans-serif'],
      weights: ['100 900'],
      styles: ['normal', 'italic'],
    },
  ],
});
