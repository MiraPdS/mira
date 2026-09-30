import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // El front habla con la API por su URL absoluta (VITE_API_URL) y no por
    // proxy: asi el entorno local se comporta igual que el desplegado, donde
    // web y api viven en dominios distintos (Vercel y Render) y las cookies
    // cross-site tienen que funcionar de verdad.
    strictPort: true,
  },
});
