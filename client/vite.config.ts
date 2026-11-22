import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// In dev, Vite serves the SPA on :5173 and forwards the API and socket to the
// server on :3000 (npm run dev:server). In production the server serves dist/.
export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'dev'),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/version.json': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
