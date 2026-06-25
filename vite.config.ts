import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        timeout: 60000, // 60s - body language analysis with large video payloads can be slow
      },
      '/ws': {
        target: 'ws://127.0.0.1:5001',
        ws: true,
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  css: {
    postcss: './postcss.config.js',
  }
});
