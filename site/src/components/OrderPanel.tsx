import {
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  ButtonBase,
  Collapse,
  Link,
  Tooltip,
  IconButton,
  CircularProgress,
} from "@mui/material";
import type { OrderInfo } from "../services/IOrderService"; // Adjust path to match your folder structure
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import ReplayIcon from "@mui/icons-material/Replay";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ScheduleIcon from "@mui/icons-material/Schedule";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Fragment, useContext, useState } from "react";
import { AppContext } from "../AppContext";
import Blind from "./Blind";

const LONG_WAIT_THRESHOLD_MS = 15 * 60 * 1000;

const getNextCheckDelay = (nextCheckAt: string | undefined): number | null => {
  if (!nextCheckAt) return null;
  const milliseconds = Date.parse(nextCheckAt) - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
  return milliseconds;
};

interface OrderPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function OrderPanel({
  open,
  onClose,
}: OrderPanelProps) {

  const { username, language, orders, expireOrder, triggerNewOrder, refreshOrderStatus, clearOrderHistory, t } = useContext(AppContext)!;
  const [copiedOrderKey, setCopiedOrderKey] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [refreshingOrderIds, setRefreshingOrderIds] = useState<Set<string>>(() => new Set());
  const refreshableOrders = orders.filter(order => order.status === "Processing" || order.status === "Pending");

  const handleStatusRefresh = async (orderId: string) => {
    setRefreshingOrderIds(previous => new Set(previous).add(orderId));
    try {
      await refreshOrderStatus(orderId);
    } finally {
      setRefreshingOrderIds(previous => {
        const updated = new Set(previous);
        updated.delete(orderId);
        return updated;
      });
    }
  };

  const handleRefreshAllOrders = async () => {
    const orderIds = refreshableOrders.map(order => order.orderId);
    setRefreshingOrderIds(previous => new Set([...previous, ...orderIds]));
    try {
      for (const order of refreshableOrders) {
        await refreshOrderStatus(order.orderId);
      }
    } finally {
      setRefreshingOrderIds(previous => {
        const updated = new Set(previous);
        orderIds.forEach(orderId => updated.delete(orderId));
        return updated;
      });
    }
  };

  const handleRetry = async (order: OrderInfo) => {
    const key = order.collection + order.itemIds.join();
    setRetrying(key);
    try {
      await triggerNewOrder(order.itemIds, order.orderKeys, order.collection);
    } catch (e) {
      console.error("Order retry error:", e);
      alert(t("errorOrderSubmitFailed"));
    } finally {
      setRetrying(null);
    }
  };

  /**
   * Opens the download link if it hasn't expired, otherwise removes the order so it can be re-ordered.
   * Mirrors the download behaviour in ResultsPanel.
   */
  const handleDownload = (order: OrderInfo) => {
    if (order.downloadUrl) {
      const expiresStr = new URL(order.downloadUrl).searchParams.get("Expires");
      if (expiresStr && new Date() < new Date(parseInt(expiresStr) * 1000)) {
        window.open(order.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }
    expireOrder(order.orderId);
  };

  /**
   * Copies the order key to the user's clipboard.
   * @param key 
   */
  const handleOrderKeyCopy = async (key: string) => {
    const success = await copyToClipboard(key);
    if (success) {
      setCopiedOrderKey(key);
      setTimeout(() => setCopiedOrderKey(null), 2000); // Reset icon back after 2 seconds
    }
  };

  /**
   * Get the latest orders hostory from the local storage.
   * @returns the latest orders hostory from the local storage.
   */
  const getLocalOrders = (): OrderInfo[] => {
    if (!username) return [];
    try {
      const raw = localStorage.getItem(`orders_${username}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to parse local orders:", e);
      return [];
    }
  };

  /**
   * Copies text to the system clipboard. 
   * Tries the copy using both the new and old way (if necessary).
   */
  async function copyToClipboard(text: string): Promise<boolean> {
    // 1. Try the modern Clipboard API first (Secure context required)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("Modern Clipboard API failed, attempting fallback...", err);
      }
    }

    // 2. Failsafe fallback for HTTP, older browsers, or sandboxed environments
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Prevent scrolling or shifting layout while appending
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      
      if (successful) return true;
      throw new Error("execCommand returned false");
    } catch (err) {
      console.error("Failed to copy text using both methods:", err);
      return false;
    }
  }

  /**
   * The associated order status react elements for the order object. 
   * 
   * @param order - the ordered item object 
   * @param t - the translatoin hook
   * @returns associated order status react elements for the order object. 
   */
  function OrderStatusAction({
    order,
  }: {
    order: OrderInfo;
  }) {
    const nextCheckDelay = getNextCheckDelay(order.nextCheckAt);
    const isRestoring = order.serverStatus === "ItemsRestoring";
    const isLongWait = nextCheckDelay !== null && nextCheckDelay >= LONG_WAIT_THRESHOLD_MS;

    if ((isRestoring || isLongWait) && order.status !== "Available" && order.status !== "Failed") {
      return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
            <Typography
              component="span"
              variant="caption"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontWeight: "bold",
                px: 1,
                py: 0.5,
                borderRadius: "4px",
                bgcolor: isRestoring ? "#d9edff" : "#fff0cc",
                color: isRestoring ? "#073b5c" : "#573b00",
                whiteSpace: "nowrap",
              }}
            >
              {isRestoring ? <CloudDownloadIcon sx={{ fontSize: 14 }} /> : <ScheduleIcon sx={{ fontSize: 14 }} />}
              {isRestoring ? t("statusRestoring") : t("statusWaitingLong")}
            </Typography>
            <RefreshOrderButton order={order} />
            <CancelOrderButton order={order} />
        </Box>
      );
    }

    switch (order.status) {
      case "Available":
        return order.downloadUrl ? (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <ButtonBase
              onClick={() => handleDownload(order)}
              sx={{
                typography: "caption",
                fontWeight: "bold",
                px: 1,
                py: 0.5,
                gap: 0.5,
                borderRadius: "4px",
                bgcolor: "#e8f5e9",
                color: "success.main",
                whiteSpace: "nowrap",
                "&:hover, &.Mui-focusVisible": { bgcolor: "#c8e6c9" },
              }}
            >
              <DownloadIcon sx={{ fontSize: 14 }} />
              {t("download")}
            </ButtonBase>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: "bold",
                px: 1,
                py: 0.5,
                borderRadius: "4px",
                bgcolor: "#e8f5e9",
                color: "success.main",
                whiteSpace: "nowrap",
              }}
            >
              {t("statusAvailable")}
            </Typography>
          </Box>
        );

      case "Failed":
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.5,
            }}
          >
            <Tooltip
              title={
                order.error ||
                order.message ||
                t("errorUnknownProcessingFailure")
              }
              arrow
            >
              <Typography
                variant="caption"
                sx={{
                  cursor: "help",
                  fontWeight: "bold",
                  px: 1,
                  py: 0.5,
                  borderRadius: "4px",
                  bgcolor: "#ffebee",
                  color: "error.main",
                }}
              >
                {t("statusFailed")} ⚠
              </Typography>
            </Tooltip>
            <Tooltip title={t("retryOrder")}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={retrying === order.collection + order.itemIds.join()}
                  onClick={() => handleRetry(order)}
                >
                  <ReplayIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );

      case "Processing":
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: "bold",
              px: 1,
              py: 0.5,
              borderRadius: "4px",
              bgcolor: "#fff3e0",
              color: "warning.main",
            }}
          >
            {t("statusProcessing")}
          </Typography>
          <RefreshOrderButton order={order} />
          <CancelOrderButton order={order} />
          </Box>
        );

      case "Pending":
      default:
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: "bold",
              px: 1,
              py: 0.5,
              borderRadius: "4px",
              bgcolor: "#f5f5f5",
              color: "text.secondary",
            }}
          >
            {t("statusPending")}
          </Typography>
          <RefreshOrderButton order={order} />
          <CancelOrderButton order={order} />
          </Box>
        );
    }
  }

  function CancelOrderButton({ order }: { order: OrderInfo }) {
    return (
      <Tooltip title={t("cancelPreparing")}>
        <IconButton size="small" aria-label={t("cancelPreparing")} onClick={() => expireOrder(order.orderId)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  function RefreshOrderButton({ order }: { order: OrderInfo }) {
    const isRefreshing = refreshingOrderIds.has(order.orderId);
    return (
      <Tooltip title={t("refreshStatus")}>
        <span>
          <IconButton
            size="small"
            aria-label={t("refreshStatus")}
            disabled={isRefreshing}
            onClick={() => void handleStatusRefresh(order.orderId)}
          >
            {isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  const localOrders = getLocalOrders();

  const formatDate = (iso: string) => new Date(iso).toLocaleString(language, {
    timeZone: 'UTC',
    timeZoneName: 'short',
    hour12: false,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  /** Every known field of an order, skipping empty ones. The raw download URL is signed, so only its expiry is shown. */
  const getOrderDetails = (order: OrderInfo): [string, string][] => {
    const expires = order.downloadUrl ? new URL(order.downloadUrl).searchParams.get("Expires") : null;
    const rows: [string, string | number | undefined | null][] = [
      [t("orderId"), order.orderId],
      [t("requestId"), order.requestId],
      [t("currentStatus"), order.serverStatus && order.serverStatus !== order.status ? `${order.status} (${order.serverStatus})` : order.status],
      [t("collection"), order.collection],
      [t("itemId"), order.itemIds.join(", ")],
      [t("orderKey"), order.orderKeys?.join(", ")],
      [t("fileFormat"), order.format],
      [t("dateOrdered"), order.orderDate && formatDate(order.orderDate)],
      [t("lastUpdated"), order.lastUpdate && formatDate(order.lastUpdate)],
      [t("nextCheck"), order.nextCheckAt && formatDate(order.nextCheckAt)],
      [t("linkExpires"), expires && Number.isFinite(Number(expires)) ? formatDate(new Date(Number(expires) * 1000).toISOString()) : undefined],
      [t("statusCode"), order.code],
      [t("statusMessage"), order.message],
      [t("errorDetails"), order.error],
    ];
    return rows.filter((row): row is [string, string | number] => row[1] !== undefined && row[1] !== null && row[1] !== "")
      .map(([label, value]) => [label, String(value)]);
  };

  return (
    <Blind open={open} onClose={onClose} align="right" width={600} disableEnforceFocus>
      <Box sx={{ px: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" color="primary" gutterBottom>{t('orderHistory')}</Typography>
          <Box
            role="group"
            aria-label={`${t('refreshAllOrders')}, ${t('clearCompletedHistory')}`}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.25, p: '2px', border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Tooltip title={refreshableOrders.length ? t('refreshAllOrders') : t('noActiveOrdersToRefresh')}>
              <span><IconButton size="small" aria-label={t('refreshAllOrders')}
                disabled={refreshingOrderIds.size > 0 || refreshableOrders.length === 0}
                onClick={() => void handleRefreshAllOrders()}>
                {refreshingOrderIds.size > 0 ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
              </IconButton></span>
            </Tooltip>
            <Tooltip title={t('clearCompletedHistory')}>
              <span><IconButton size="small" aria-label={t('clearCompletedHistory')}
                disabled={!localOrders.some(order => order.status === 'Available' || order.status === 'Failed')}
                color={localOrders.some(order => order.status === 'Available' || order.status === 'Failed') ? 'error' : 'default'}
                onClick={clearOrderHistory}><DeleteSweepIcon fontSize="small" /></IconButton></span>
            </Tooltip>
          </Box>
        </Box>
        {localOrders.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 1, textAlign: "center" }}
          >
            {t("noOrders")}
          </Typography>
        ) : (
          <Table size="small">
            <TableBody>
              {localOrders.map((order: OrderInfo, idx: number) => {
                const rowKey = order.orderId || order.requestId || String(idx);
                const isExpanded = expandedOrder === rowKey;
                return (
                <Fragment key={rowKey}>
                <TableRow hover sx={{ '& > td': { borderBottom: isExpanded ? 0 : undefined } }}>
                  <TableCell
                    sx={{
                      p: 1,
                      width: "75%",
                      maxWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      component="div"
                      sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      <strong>{t("collection")}:</strong> {order.collection}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      component="div"
                      sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      <strong>{t("itemId")}:</strong> {order.itemIds.join(", ")}
                    </Typography>
                    {order.orderDate && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        component="div"
                        sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        <strong>{t("dateOrdered")}:</strong> {formatDate(order.orderDate)}
                      </Typography>
                    )}
                    {order.orderKeys && order.orderKeys.length > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          width: "100%",
                          mt: 0
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="div"
                          sx={{
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            lineHeight: "inherit",
                          }}
                        >
                          <strong>{t("orderKey")}:</strong>
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="div"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flexGrow: 1,
                            minWidth: 0, 
                            lineHeight: "inherit"
                          }}
                          title={order.orderKeys[0]} // Shows the full key on native hover
                        >
                          {order.orderKeys[0]}
                        </Typography>

                        <Tooltip 
                          title={
                            copiedOrderKey === order.orderKeys[0] 
                              ? (t("copied")!) 
                              : (t("copyToClipboard"))
                          }
                        >
                          <IconButton
                            size="small"
                            color={copiedOrderKey === order.orderKeys[0] ? "success" : "default"}
                            sx={{ p: 0.2, flexShrink: 0 }}
                            onClick={() => handleOrderKeyCopy(order.orderKeys![0])}
                          >
                            {copiedOrderKey === order.orderKeys[0] ? (
                              <CheckIcon sx={{ fontSize: "0.9rem" }} />
                            ) : (
                              <ContentCopyIcon sx={{ fontSize: "0.9rem" }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                    <Link
                      component="button"
                      variant="caption"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedOrder(isExpanded ? null : rowKey)}
                      sx={{ display: "inline-flex", alignItems: "center", mt: 0.25 }}
                    >
                      {isExpanded ? t("hideDetails") : t("showDetails")}
                      <ExpandMoreIcon sx={{ fontSize: 16, transition: "transform 150ms", transform: isExpanded ? "rotate(180deg)" : "none" }} />
                    </Link>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ p: 1, verticalAlign: "middle", width: "auto" }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        width: "100%",
                      }}
                    >
                      <OrderStatusAction order={order} />
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} sx={{ py: 0, px: 1, ...(!isExpanded && { borderBottom: 0 }) }}>
                    <Collapse in={isExpanded} unmountOnExit>
                      <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 2, rowGap: 0.5, m: 0, pb: 1.5, typography: "caption" }}>
                        {getOrderDetails(order).map(([label, value]) => (
                          <Fragment key={label}>
                            <Box component="dt" sx={{ fontWeight: "bold", color: "text.secondary" }}>{label}</Box>
                            <Box component="dd" sx={{ m: 0, wordBreak: "break-all" }}>{value}</Box>
                          </Fragment>
                        ))}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
                </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>
    </Blind>
  );
}
