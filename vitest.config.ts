/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure Node environment — DRC/export modules have zero DOM/browser deps
    environment: 'node',
    globals: true,
    // Pattern for test files
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    // Exclude browser-only component tests from this run
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/validation/**',
        'src/export/**',
        'src/data/**',
      ],
    },
  },
})
