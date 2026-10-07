import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build date in UTC as YYYY.MM.dd
const appVersion = new Date().toISOString().slice(0, 10).replaceAll("-", ".");

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
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
      "/dds": {
        target: "https://eodms-sgdot.nrcan-rncan.gc.ca",
        changeOrigin: true,
      },
    },
  },
});
