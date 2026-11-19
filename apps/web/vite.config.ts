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
  preview: {
    // Mismo origen que en Vercel (D13): el build sin VITE_API_URL llama a
    // /api relativo y este proxy lo lleva a la API. Los E2E (MIR-61) corren
    // contra `vite preview` y pasan E2E_API_PORT=3100 para no tocar la API de
    // desarrollo; un `npm run preview` manual sigue apuntando a :3000.
    proxy: {
      '/api': `http://localhost:${process.env.E2E_API_PORT ?? '3000'}`,
    },
  },
});
