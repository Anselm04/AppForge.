import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
  // Explicit client-only entry and isolation
  root: '.',
  appType: 'spa',
  buildExclude: ['src/server.ts', 'src/routers', 'src/routes', 'src/services', 'src/agents', 'src/middleware', 'src/pages'],
});
