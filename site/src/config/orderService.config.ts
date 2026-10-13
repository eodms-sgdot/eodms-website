import type { RegistryEntry, OrderInfo } from "../services/IOrderService";
import { EODMSOrderService, } from "../services/EODMSOrderService";

export const SERVICE_REGISTRY: RegistryEntry[] = [
  {
    name: "EODMS STAC Catalog",
    // Relative /search is the same-origin EODMS proxy in local dev and on staging deployments.
    condition: (url) => url.hostname === "eodms-sgdot.nrcan-rncan.gc.ca"
      || (url.origin === window.location.origin
        && (url.pathname === "/search" || url.pathname.startsWith("/search/"))),
    ServiceClass: EODMSOrderService,
    // DDS has no CORS headers, so local dev goes through the Vite /dds proxy.
    getOrderEndpoint: (url) => `${import.meta.env.DEV ? '' : url.origin}/dds/v1/item`,

    // 1. Define how to transform the order service response in a general way.
    transformResponse: (raw: unknown, itemIds: string[], orderKeys: string[], collection: string): OrderInfo => {
      // A null response means a network failure; treat it as retryable.
      const payload = (raw ?? {}) as Record<string, unknown>;

      let normalizedStatus: OrderInfo['status'] = 'Pending';
      const serverStatus = payload.status ? String(payload.status) : undefined;

      // DDS can return code 200 with a terminal non-available status, so check status first.
      const statusCode = Number(payload.code) || 0;
      if (serverStatus === 'Failed' || serverStatus === 'Invalid' || serverStatus === 'Evicting' || serverStatus === 'Evicted') {
        normalizedStatus = 'Failed';
      } else if (statusCode === 200) {
        normalizedStatus = serverStatus === 'Available' && payload.download_url ? 'Available' : 'Processing';
      } else if (statusCode === 202) {
        normalizedStatus = 'Processing';
      } else if (statusCode === 0 || statusCode === 401 || statusCode === 429 || statusCode === 503) {
        normalizedStatus = 'Pending';
      } else if (statusCode >= 400) {
        normalizedStatus = 'Failed';
      }

      const retryInterval = payload.suggested_retry_interval;

      // 2. Perform translation
      return {
        orderId: payload.order_id ? String(payload.order_id) : '',
        itemIds: itemIds,
        status: normalizedStatus,
        message: payload.message ? String(payload.message) : (raw ? '' : 'Network error'),
        error: payload.error ? String(payload.error) : undefined,
        downloadUrl: payload.download_url ? String(payload.download_url) : undefined,
        lastUpdate: payload.last_update ? String(payload.last_update) : new Date().toISOString(),
        code: statusCode,
        collection: collection,
        requestId: payload.request_id ? String(payload.request_id) : '',
        format: payload.format ? String(payload.format) : '',
        orderKeys: orderKeys ? [String(orderKeys)] : [],
        serverStatus,
        retryAfterSeconds: typeof retryInterval === 'number' && retryInterval >= 0 ? retryInterval : undefined,
      };
    },
  },
];
