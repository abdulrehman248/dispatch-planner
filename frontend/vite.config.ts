import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          map: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
