import type { IOrderService } from './IOrderService';

export interface GetItemResponse {
  code: number;
  download_url?: string;
  format: 'Unarchived' | 'Zip' | '';
  error?: string
  lastUpdate: string;
  message?: string;
  order_id?: string;
  request_id: string;
  status: 'Invalid' | 'Queued' | 'Acquired' | 'Processing' | 'ItemsRestoring' | 'ItemsRestored' 
    | 'PartiallyAvailable' | 'Available' | 'Evicting' | 'Evicted' | 'Failed' | 'AwaitingPermissionsCheck';
  suggested_retry_interval: number;
}

/**
 * The order service that handles ordering from the EODMS catalog. 
 */
export class EODMSOrderService implements IOrderService {
  private orderEndpoint: string;
  // private numberTimesChecked: Map<string, number>;

  constructor(orderEndpoint: string) {
    this.orderEndpoint = orderEndpoint;
    // this.numberTimesChecked = new Map<string, number>();
  }

  /**
   * Submits a new order for a STAC item.
   */
  async placeOrder(itemIds: string[], collection: string, authToken: string): Promise<GetItemResponse | null> {
    
    // Generate a UUID for the order. 
    // const orderUuid = generateUUID();

    try {
      const response = await fetch(`${this.orderEndpoint}/EODMS/${collection}/${itemIds[0]}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      /*
      if (!response.ok) {
        throw new Error(`Failed to check status for order ${itemIds[0]}`);
      }
      */

      return response.json();

    } catch (e) {
      console.error("Network failure", e);
      return null;
    }
  }

  /**
   * Checks the status of an existing order
   */
  async checkStatus(_orderId: string, itemIds: string[], collection: string, authToken: string): Promise<GetItemResponse | null> {

    return this.placeOrder(itemIds, collection, authToken);
    
    /*
    const response = await fetch(`${this.orderEndpoint}/orders/${orderId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check status for order ${orderUuid}`);
    }

    return response.json();
    */
  }
}