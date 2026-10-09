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
    // En local el front habla con la API por su URL absoluta (VITE_API_URL,
    // :5173 -> :3000), sin proxy. Desplegado usa VITE_API_URL=/api y el
    // rewrite de apps/web/vercel.json lo lleva a Render: mismo origen y
    // cookie first-party, que Safari e incognito no bloquean (ver D13).
    strictPort: true,
  },
});
