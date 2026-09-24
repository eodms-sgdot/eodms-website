import type { RegistryEntry, OrderInfo } from "../services/IOrderService";
import { EODMSOrderService, } from "../services/EODMSOrderService";

export const SERVICE_REGISTRY: RegistryEntry[] = [
  {
    name: "EODMS STAC Catalog",
    condition: (url) => url.hostname === "eodms-sgdot.nrcan-rncan.gc.ca",
    ServiceClass: EODMSOrderService,
    getOrderEndpoint: (url) => `${url.origin}/dds/v1/item`,

    // 1. Define how to transform the order service response in a general way.
    transformResponse: (raw: unknown, itemIds: string[], orderKeys: string[], collection: string): OrderInfo => {
      const payload = raw as Record<string, unknown>;

      let normalizedStatus: OrderInfo['status'] = 'Pending';
      /*
      if (payload.status === 'Available') {
        normalizedStatus = 'Available';
      } else if (payload.status === 'Failed' || payload.status === 'Invalid') {
        normalizedStatus = 'Failed';
      } else if (payload.status === 'Processing' || payload.status === 'Queued' || payload.status === 'Acquired') {
        normalizedStatus = 'Processing';
      }
      */

      const statusCode = Number(payload.code);
      if (statusCode === 200) {
        normalizedStatus = 'Available';
      } else if (statusCode === 202) {
        normalizedStatus = 'Processing';
      } else if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 429 || statusCode === 500 || statusCode === 503) {
        normalizedStatus = 'Failed';
      }

      // 2. Perform translation
      return {
        orderId: payload.order_id ? String(payload.order_id) : '',
        itemIds: itemIds,
        status: normalizedStatus,
        message: payload.message ? String(payload.message) : '',
        downloadUrl: payload.download_url ? String(payload.download_url) : undefined,
        lastUpdate: payload.last_update ? String(payload.last_update) : new Date().toISOString(),
        code: Number(payload.code),
        collection: collection,
        requestId: String(payload.request_id),
        format: payload.format ? String(payload.format) : '',
        orderKeys: orderKeys ? [String(orderKeys)] : []
      };
    },
  },
];
