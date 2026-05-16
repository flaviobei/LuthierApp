import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate", // Faz a app atualizar sozinha no telemóvel quando você mudar o código
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Gestão Luthieria",
        short_name: "Luthieria",
        description: "Sistema de gestão para oficinas de luthieria",
        theme_color: "#2c3e50", // A cor do topo do telemóvel (sua cor primária)
        background_color: "#f4f6f8", // A cor do ecrã de carregamento
        display: "standalone", // Faz com que pareça uma app nativa (esconde a barra do navegador)
        orientation: "portrait",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
