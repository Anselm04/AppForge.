import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html', open: true, gzipSize: true, brotliSize: true }),
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, pure_funcs: ['console.log'] },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'tanstack-vendor': ['@tanstack/react-query'],
        },
      },
    },
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  server: { hmr: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
