import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { translations } from "./src/i18n.ts";

// Build date in UTC as YYYY.MM.dd
const appVersion = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
const buildId = process.env.VITE_BUILD_ID || new Date().toISOString().replace(/[-:.]/g, "");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appTitle = env.VITE_APP_TITLE || translations.en.appTitle;
  const targetEnvironment = (env.EODMS_TARGET_ENV || (mode === "development" ? "staging" : "production")).toLowerCase();
  if (!["staging", "production"].includes(targetEnvironment)) {
    throw new Error("EODMS_TARGET_ENV must be either staging or production");
  }
  const stagingDomain = (env.EODMS_STAGING_DOMAIN || env.VITE_NAPL_STAGING_DOMAIN || "").replace(/\/+$/, "");
  const productionDomain = (env.EODMS_PRODUCTION_DOMAIN
    || "https://eodms-sgdot.nrcan-rncan.gc.ca").replace(/\/+$/, "");
  if (mode === "development" && targetEnvironment === "staging" && !stagingDomain) {
    throw new Error("Set EODMS_STAGING_DOMAIN in site/.env.local for local staging proxies");
  }
  const eodmsDomain = targetEnvironment === "production" ? productionDomain : stagingDomain;
  const endpointMap = {
    localAaaProxy: "http://127.0.0.1:5000",
    eodmsDomain: eodmsDomain || productionDomain,
    productionDomain,
    stagingDomain,
  };

  return {
    plugins: [
      react(),
      {
        name: "html-app-title",
        transformIndexHtml(html) {
          return html.replace("%APP_TITLE%", appTitle);
        },
      },
    ],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
      "import.meta.env.VITE_EODMS_SHOW_PROXY_BADGE": JSON.stringify(env.EODMS_SHOW_PROXY_BADGE?.toLowerCase() === "true"),
      "import.meta.env.VITE_EODMS_ENDPOINTS": JSON.stringify(endpointMap),
    },
    server: {
      host: true,
      proxy: {
        "/aaa": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
        "/search": {
          target: eodmsDomain,
          changeOrigin: true,
        },
        "/dds": {
          target: eodmsDomain,
          changeOrigin: true,
        },
        "/processing": {
          target: eodmsDomain,
          changeOrigin: true,
        },
        ...(stagingDomain ? {
          "/napl": {
            target: stagingDomain,
            changeOrigin: true,
          },
        } : {}),
      },
    },
  };
});
