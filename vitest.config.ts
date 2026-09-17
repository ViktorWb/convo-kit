import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.test.tsx'],
        clearMocks: true,
        // Process CSS so the `*.module.css` namespace import resolves to real class names.
        css: true
    }
})
