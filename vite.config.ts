import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/solid-planner/',
  plugins: [
    vue(),
    Components({
      resolvers: [PrimeVueResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['pinia'], // Ensure single instance of Pinia across the app to avoid store duplication issues
    // Example error:  TypeError: can't access property "_s", pinia is undefined
  },
  build: {
    outDir: 'dist',
    minify: process.env.DEBUG ? false : 'terser',
    sourcemap: process.env.DEBUG ? true : false,
  },
  server: {
    fs: {
      cachedChecks: false,
    },
  },
})
