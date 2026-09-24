import { useState, useEffect, useMemo, useCallback } from "react";
import type { OrderInfo } from "../services/IOrderService";
import { createOrderServiceByUrl } from "../services/OrderServiceFactory";

const POLL_INTERVAL = 60000; 

/**
 * Hook to determine if order is supported, trigger new orders and check order status. 
 * 
 * @param userId 
 * @param authToken 
 * @param stacUrl 
 * @returns all active orders, boolean flag to determine if ordering is supported, and function to trigger new orders. 
 */
export function useOrderPolling(userId: string, authToken: string, stacUrl: string) {

  const [orders, setOrders] = useState<OrderInfo[]>(() => {
    if (!userId) return [];
    try {
      const localData = localStorage.getItem(`orders_${userId}`);
      return localData ? JSON.parse(localData) : [];
    } catch (e) {
      console.error("Failed to parse local orders:", e);
      return [];
    }
  });

  const [prevUserId, setPrevUserId] = useState(userId);

  if (userId !== prevUserId) {
    setPrevUserId(userId);
    if (!userId) {
      setOrders([]);
    } else {
      try {
        const localData = localStorage.getItem(`orders_${userId}`);
        setOrders(localData ? JSON.parse(localData) : []);
      } catch (e) {
        console.error("Failed to parse local orders on user change:", e);
        setOrders([]);
      }
    }
  }

  const orderService = useMemo(() => {
    return createOrderServiceByUrl(stacUrl);
  }, [stacUrl]);

  const isOrderingSupported = orderService !== null;

  /**
   * Triggers a new order, normalizes the response via its custom transformer, and tracks it locally.
   */
  const triggerNewOrder = useCallback(async (itemUuids: string[], orderKeys: string[], collection: string) => {
    if (!userId || !authToken) {
      throw new Error("User session invalid or unauthorized.");
    }
    if (!orderService) {
      throw new Error("The active environment strategy lacks ordering pipelines.");
    }
    if (itemUuids.length === 0) {
      return null;
    }

    // Fire the array payload directly down to the service engine implementation
    const orderDate = new Date().toISOString();
    const rawData = await orderService.service.placeOrder(itemUuids, collection, authToken);
    
    // Transform into OrderInfo layout 
    const newOrder = orderService.transform(rawData, itemUuids, orderKeys, collection);
    newOrder.orderDate = orderDate;

    setOrders((prevOrders) => {
      const updated = [newOrder, ...prevOrders];
      localStorage.setItem(`orders_${userId}`, JSON.stringify(updated));
      return updated;
    });

    return newOrder;
  }, [userId, authToken, orderService]);

  /**
   * Expire an order by order id
   */
  const expireOrder = useCallback(async (orderId: string) => {
    if (!userId || !authToken) {
      throw new Error("User session invalid or unauthorized.");
    }
    if (!orderService) {
      throw new Error("The active environment strategy lacks ordering pipelines.");
    }
    if (!orderId) {
      return null;
    }

    setOrders((prevOrders) => {
      const updated = prevOrders.filter((item) => item.orderId !== orderId);
      localStorage.setItem(`orders_${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId, authToken, orderService]);

  // Background Loop Polling
  useEffect(() => {
    if (!userId || !authToken || !orderService || orders.length === 0) return;

    const hasIncompleteOrders = orders.some(
      (o) => o.status !== "Available" && o.status !== "Failed"
    );
    if (!hasIncompleteOrders) return;

    const intervalId = setInterval(async () => {
      let stateChanged = false;

      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
          if (order.status === "Available" || order.status === "Failed") {
            return order;
          }
          try {
            const rawUpdate = await orderService.service.checkStatus(
              order.orderId,
              order.itemIds,
              order.collection,
              authToken
            );
            const update = orderService.transform(
              rawUpdate,
              order.itemIds,
              order.orderKeys,
              order.collection
            );

            if (update.status !== order.status || update.downloadUrl !== order.downloadUrl) {
              stateChanged = true;
              return {
                ...order,
                status: update.status,
                downloadUrl: update.downloadUrl,
              };
            }
          } catch (err) {
            console.error(`Error synchronizing order state for ${order.orderId}:`, err);
          }
          return order;
        })
      );

      if (stateChanged) {
        localStorage.setItem(`orders_${userId}`, JSON.stringify(updatedOrders));
        setOrders(updatedOrders);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [userId, authToken, orders, orderService]); 

  return {
    orders,
    isOrderingSupported,
    triggerNewOrder,
    expireOrder,
  };
}
