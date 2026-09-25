import type { IOrderService, RegistryEntry } from "./IOrderService";
import { SERVICE_REGISTRY } from "../config/orderService.config";

export interface OrderService {
  service: IOrderService;
  transform: RegistryEntry["transformResponse"];
}

/**
 * Evaluates the STAC entry URL and creates the matching configured ordering service.
 * Returns null if no match rules are registered.
 */
export function createOrderServiceByUrl(
  stacUrl: string,
): OrderService | null {
  try {
    const parsedUrl = new URL(
      /^https?:\/\//i.test(stacUrl) ? stacUrl : 
      `${window.location.protocol}//${window.location.hostname}${window.location.port && window.location.port !== '80' ? `:${window.location.port}` : ''}${stacUrl}`
    );
    const match = SERVICE_REGISTRY.find((entry) => entry.condition(parsedUrl));

    if (match) {
      const targetOrderEndpoint = match.getOrderEndpoint(parsedUrl);

      console.log(
        `[Factory] Matching configuration: "${match.name}"`,
      );
      return {
        service: new match.ServiceClass(targetOrderEndpoint),
        transform: match.transformResponse,
      };
    }
  } catch (error) {
    console.warn(
      "[Factory] Error parsing catalog reference target URL:",
      error,
    );
  }

  console.log(
    `[Factory] Catalog URL "${stacUrl}" has no ordering microservices assigned.`,
  );

  return null;
}
