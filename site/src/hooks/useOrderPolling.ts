import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { OrderInfo } from "../services/IOrderService";
import { createOrderServiceByUrl } from "../services/OrderServiceFactory";

const DEFAULT_RETRY_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 600;

const isIncomplete = (order: OrderInfo) => order.status !== "Available" && order.status !== "Failed";

const dueTime = (order: OrderInfo) => (order.nextCheckAt ? Date.parse(order.nextCheckAt) : 0);

/**
 * Sets nextCheckAt from the server's retry hint, or exponential backoff when no hint is given.
 */
const scheduleNextCheck = (order: OrderInfo, previousAttempts = 0): OrderInfo => {
  if (!isIncomplete(order)) {
    return { ...order, nextCheckAt: undefined, attempts: 0 };
  }
  const attempts = order.retryAfterSeconds === undefined ? previousAttempts + 1 : 0;
  const delaySeconds = Math.max(1, order.retryAfterSeconds
    ?? Math.min(DEFAULT_RETRY_SECONDS * 2 ** (attempts - 1), MAX_BACKOFF_SECONDS));
  return { ...order, attempts, nextCheckAt: new Date(Date.now() + delaySeconds * 1000).toISOString() };
};

/**
 * Hook to determine if order is supported, trigger new orders and check order status. 
 * 
 * @param userId 
 * @param authToken 
 * @param stacUrl 
 * @param getValidAuthToken returns a non-expired access token, refreshing if needed
 * @returns all active orders, boolean flag to determine if ordering is supported, and function to trigger new orders. 
 */
export function useOrderPolling(userId: string, authToken: string, stacUrl: string, getValidAuthToken: () => Promise<string>) {

  // Lets in-flight requests detect a logout or user switch before writing results.
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

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
    const rawData = await orderService.service.placeOrder(itemUuids, collection, await getValidAuthToken());
    if (currentUserId.current !== userId) return null;
    
    // Transform into OrderInfo layout 
    const transformed = orderService.transform(rawData, itemUuids, orderKeys, collection);
    const newOrder = scheduleNextCheck({
      ...transformed,
      // The order was never placed, so let the user retry instead of polling.
      status: rawData === null ? "Failed" : transformed.status,
      orderDate,
    });

    setOrders((prevOrders) => {
      // Replace any earlier order for the same item so retries don't leave duplicates.
      const others = prevOrders.filter(
        (o) => !(o.collection === collection && o.itemIds.some((id) => itemUuids.includes(id)))
      );
      const updated = [newOrder, ...others];
      localStorage.setItem(`orders_${userId}`, JSON.stringify(updated));
      return updated;
    });

    return newOrder;
  }, [userId, authToken, orderService, getValidAuthToken]);

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

  // Background polling: wake up when the earliest pending order is due.
  useEffect(() => {
    if (!userId || !authToken || !orderService) return;

    const pending = orders.filter(isIncomplete);
    if (pending.length === 0) return;

    const delay = Math.max(0, Math.min(...pending.map(dueTime)) - Date.now());

    const timeoutId = setTimeout(async () => {
      const due = pending.filter((order) => dueTime(order) <= Date.now());
      const updates = new Map<OrderInfo, OrderInfo>();

      await Promise.all(
        due.map(async (order) => {
          try {
            const rawUpdate = await orderService.service.checkStatus(
              order.orderId,
              order.itemIds,
              order.collection,
              await getValidAuthToken()
            );
            const update = orderService.transform(
              rawUpdate,
              order.itemIds,
              order.orderKeys,
              order.collection
            );

            updates.set(order, scheduleNextCheck({
              ...order,
              status: update.status,
              serverStatus: update.serverStatus,
              code: update.code,
              message: update.message,
              error: update.error,
              lastUpdate: update.lastUpdate,
              retryAfterSeconds: update.retryAfterSeconds,
              orderId: update.orderId || order.orderId,
              downloadUrl: update.downloadUrl ?? order.downloadUrl,
            }, order.attempts));
          } catch (err) {
            console.error(`Error synchronizing order state for ${order.orderId}:`, err);
            updates.set(order, scheduleNextCheck({ ...order, retryAfterSeconds: undefined }, order.attempts));
          }
        })
      );

      // Match by reference so orders added or removed during the requests are preserved.
      if (currentUserId.current !== userId) return;
      setOrders((prevOrders) => {
        const updated = prevOrders.map((order) => updates.get(order) ?? order);
        localStorage.setItem(`orders_${userId}`, JSON.stringify(updated));
        return updated;
      });
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [userId, authToken, orders, orderService, getValidAuthToken]); 

  return {
    orders,
    isOrderingSupported,
    triggerNewOrder,
    expireOrder,
  };
}
