import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Function form: Vite 8 (Rolldown) only accepts manualChunks as a
        // function, not the plain object map. `inPkg` matches a package's own
        // node_modules path segment, so `react` never matches `react-dom`.
        manualChunks(id) {
          const inPkg = (pkg: string) => id.includes(`/node_modules/${pkg}/`)

          // Core React ecosystem. `scheduler` (react-dom's) and `react-router`
          // (which react-router-dom re-exports) are otherwise-unassigned
          // transitive deps; the object form pulled them in with their
          // parents, so we do the same here.
          if (
            inPkg('react') ||
            inPkg('react-dom') ||
            inPkg('scheduler') ||
            inPkg('react-router') ||
            inPkg('react-router-dom')
          ) {
            return 'react-vendor'
          }

          // State management
          if (inPkg('zustand')) {
            return 'state'
          }

          // Drag and drop (used for player reordering). `@dnd-kit/` covers
          // @dnd-kit/core, sortable, utilities and core's own transitive dep
          // @dnd-kit/accessibility.
          if (id.includes('/node_modules/@dnd-kit/')) {
            return 'dnd'
          }

          // Radix UI components (modals, tooltips, dropdowns) and the
          // @floating-ui/* positioning primitives Radix's popper pieces pull
          // in transitively.
          if (id.includes('/node_modules/@radix-ui/') || id.includes('/node_modules/@floating-ui/')) {
            return 'radix'
          }

          // Animation library. `motion-dom`/`motion-utils` are framer-
          // motion's own otherwise-unassigned transitive deps.
          if (inPkg('framer-motion') || inPkg('motion-dom') || inPkg('motion-utils')) {
            return 'motion'
          }

          // Icons (can be large)
          if (inPkg('lucide-react')) {
            return 'icons'
          }

          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
