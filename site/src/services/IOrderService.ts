/**
 * Data structure to store general order information. 
 */
export interface OrderInfo {
  orderId: string;
  itemIds: string[];
  status: 'Pending' | 'Processing' | 'Available' | 'Failed';
  downloadUrl?: string;
  lastUpdate: string;
  orderDate?: string;
  message?: string;
  error?: string;
  code: number;
  collection: string;
  requestId: string;
  format?: string;
  orderKeys: string[];
}

/**
 * Interface that all environment-specific API service classes must implement.
 */
export interface IOrderService {
  placeOrder(itemIds: string[], collection: string, authToken: string): Promise<unknown>;
  checkStatus(orderId: string, itemIds: string[], collection: string, authToken: string): Promise<unknown>;
}

export type OrderServiceConstructor = new (apiEndpoint: string) => IOrderService;

/**
 * The configuration interface used to map items in the centralized registry config file.
 */
export interface RegistryEntry {
  name: string;
  condition: (url: URL) => boolean;
  ServiceClass: OrderServiceConstructor;
  getOrderEndpoint: (url: URL) => string;
  
  /**
   * Converts unknown server structures into frontend OrderInfo objects. 
   */
  transformResponse: (raw: unknown, itemUuids: string[], orderKeys: string[], collection: string) => OrderInfo;
}