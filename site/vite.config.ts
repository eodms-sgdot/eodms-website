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
  if (!["staging", "production", "proxy"].includes(targetEnvironment)) {
    throw new Error("EODMS_TARGET_ENV must be staging, production, or proxy");
  }
  const proxyPort = env.EODMS_PROXY_PORT;
  if (env.EODMS_AAA_TUNNEL_PORT) {
    throw new Error("EODMS_AAA_TUNNEL_PORT is no longer supported. Use EODMS_TARGET_ENV=proxy and EODMS_PROXY_PORT to route all APIs together.");
  }
  if (targetEnvironment === "proxy" && (!proxyPort || !Number.isInteger(Number(proxyPort)) || Number(proxyPort) < 1 || Number(proxyPort) > 65535)) {
    throw new Error("EODMS_TARGET_ENV=proxy requires EODMS_PROXY_PORT to be a valid TCP port");
  }
  if (targetEnvironment !== "proxy" && proxyPort) {
    throw new Error("Set EODMS_TARGET_ENV=proxy when using EODMS_PROXY_PORT");
  }
  const stagingDomain = (env.EODMS_STAGING_DOMAIN || env.VITE_NAPL_STAGING_DOMAIN || "").replace(/\/+$/, "");
  const productionDomain = (env.EODMS_PRODUCTION_DOMAIN
    || "https://eodms-sgdot.nrcan-rncan.gc.ca").replace(/\/+$/, "");
  if (mode === "development" && targetEnvironment === "staging" && !stagingDomain) {
    throw new Error("Set EODMS_STAGING_DOMAIN in site/.env.local for local staging proxies");
  }
  const eodmsDomain = targetEnvironment === "proxy"
    ? `http://127.0.0.1:${proxyPort}`
    : targetEnvironment === "production" ? productionDomain : stagingDomain;
  const endpointMap = {
    localAaaProxy: "http://127.0.0.1:5000",
    aaaUpstream: eodmsDomain,
    eodmsDomain: eodmsDomain || productionDomain,
    productionDomain,
    stagingDomain,
    targetEnvironment,
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
