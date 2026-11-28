import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Three.js num arquivo separado: o código do jogo fica pequeno e o navegador guarda o
        // Three.js em cache entre atualizações (evita o aviso de arquivo acima de 500 kB).
        manualChunks: { three: ['three'] },
      },
    },
  },
});
