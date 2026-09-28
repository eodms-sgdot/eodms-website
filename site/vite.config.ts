import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/aaa": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/search": {
        target: "https://eodms-sgdot.nrcan-rncan.gc.ca",
        changeOrigin: true,
      },
    },
  },
});
