import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Enable Network Access (LAN)
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large vendor libraries into separate chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'utils-vendor': ['dompurify', 'html2canvas']
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1000kb
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    minify: 'esbuild' // Use esbuild (default, faster and no extra dependency needed)
  }
})
