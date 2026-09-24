import {
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Popover,
  Tooltip,
  IconButton,
} from "@mui/material";
import type { OrderInfo } from "../services/IOrderService"; // Adjust path to match your folder structure
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useContext, useState } from "react";
import { AppContext } from "../AppContext";

interface OrderPanelProps {
  /** The anchor element controlling the popover visibility */
  anchorEl: HTMLButtonElement | null;
  /** The Callback fired when clicking outside the popover to close it */
  onClose: () => void;
}

export default function OrderPanel({
  anchorEl,
  onClose,
}: OrderPanelProps) {

  const isOpen = Boolean(anchorEl);
  const { username, language, t } = useContext(AppContext)!;
  const [copiedOrderKey, setCopiedOrderKey] = useState<string | null>(null);

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
    switch (order.status) {
      case "Available":
        return (
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
              flexDirection: "column",
              alignItems: "flex-end",
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
          </Box>
        );

      case "Processing":
        return (
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
        );

      case "Pending":
      default:
        return (
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
        );
    }
  }

  const localOrders = getLocalOrders();

  return (
    <Popover
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      disableAutoFocus={true}
      disableEnforceFocus={true}
    >
      <Box sx={{ p: 1, width: "90vw", maxWidth: 600, maxHeight: 800, overflowY: "scroll" }}>
        <Typography variant="h6" color="primary" gutterBottom>{t('orderHistory')}</Typography>
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
              {localOrders.map((order: OrderInfo, idx: number) => (
                <TableRow key={order.orderId || order.requestId || idx} hover>
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
                      <strong>{t("requestId")}:</strong> {order.requestId}
                    </Typography>
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
                        <strong>{t("dateOrdered")}:</strong> {new Date(order.orderDate).toLocaleString(language, {
                          timeZone: 'UTC',
                          timeZoneName: 'short',
                          hour12: false,
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Popover>
  );
}
