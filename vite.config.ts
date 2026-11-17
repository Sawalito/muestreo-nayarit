import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En GitHub Pages el sitio vive en https://<usuario>.github.io/muestreo-nayarit/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/muestreo-nayarit/' : '/',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { katex: ['katex'], d3: ['d3'], react: ['react', 'react-dom'] },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
