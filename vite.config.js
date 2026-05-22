import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
        timeout: 600000, // 10 min — rotas pesadas como top-customers
        proxyTimeout: 600000,
      },
    },
    watch: {
      // Ignora arquivos transitórios do backend (WhatsApp wwebjs gera lockfiles
      // que somem entre o lstat() e o open() — quebra o FSWatcher do Vite)
      ignored: [
        '**/backend/**',
        '**/.wwebjs_auth/**',
        '**/.wwebjs_cache/**',
        '**/.cache/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Vendor splitting reduz invalidação de cache: mudanças no app não
        // invalidam chunks de libs. Cada grupo abaixo vira um arquivo .js.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-chartjs': [
            'chart.js',
            'react-chartjs-2',
            'chartjs-plugin-annotation',
            'chartjs-plugin-datalabels',
          ],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-xlsx': ['xlsx'],
          'vendor-icons': ['phosphor-react', '@phosphor-icons/react'],
        },
      },
    },
  },
});
