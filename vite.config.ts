import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    hmr: {
      // In proxied environments (e.g. v0 sandbox), use the page's origin for the WS connection
      host: undefined,
      clientPort: 443,
      protocol: 'wss',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    exclude: ['tests/**', 'node_modules/**'], // Exclude Playwright tests
  },
})
