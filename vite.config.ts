import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // Aumenta o limite do aviso de 500kb para 1000kb (1MB)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Ensina o Vite a separar as bibliotecas pesadas em ficheiros diferentes
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("html2canvas")) {
              return "html2canvas";
            }
            if (id.includes("vue")) {
              return "vue-vendor";
            }
            return "vendor"; // Restantes bibliotecas
          }
        },
      },
    },
  },
});
