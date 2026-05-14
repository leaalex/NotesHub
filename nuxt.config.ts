// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui'],

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Corinthia:wght@400;700&display=swap',
        },
      ],
    },
  },

  css: ['./app/assets/css/main.css'],

  alias: {
    '#shared': resolve(__dirname, 'shared'),
  },

  vite: {
    server: {
      watch: {
        usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      },
    },
    optimizeDeps: {
      include: [
        '@vueuse/core',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'better-auth/vue',
        'better-auth/client/plugins',
        '@tiptap/vue-3',
        '@tiptap/starter-kit',
      ],
    },
  },

  nitro: {
    preset: process.env.NITRO_PRESET || undefined,
  },

  runtimeConfig: {
    databaseUrl: process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || 'file:./data/dev.sqlite',
    betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },
})
