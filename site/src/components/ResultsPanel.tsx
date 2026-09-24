import { useEffect, useState, useContext } from "react";
import {
  Box,
  Typography,
  IconButton,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Skeleton,
  Checkbox,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";
import ViewHeadline from "@mui/icons-material/ViewHeadline";
import ZoomInMap from "@mui/icons-material/ZoomInMap";
import type { STACItem } from "../types";
import { AppContext } from "../AppContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";

/**
 * Properties for the ResultsPanel component.
 */
interface ResultsPanelProps {
  /** Array of STAC features to display as cards */
  results: STACItem[];
  /** Callback fired to close the results drawer */
  onClose: () => void;
  /** Callback fired to zoom the map to a specific item's bounds */
  onZoom: (item: STACItem) => void;
  /** Boolean indicating if a network request is currently active */
  isSearching: boolean;
  /** Dictionary tracking which STAC Items are checked for footprint highlighting */
  selectedFootprints: Record<string, string>;
  /** Callback fired when a user checks/unchecks an item's footprint box */
  onToggleFootprint: (item: STACItem) => void;
  /** The ID of the item currently clicked/focused on the map */
  focusedItem: string | null;
  /** Dictionary tracking which STAC Items have their map thumbnails active */
  activeThumbnails: Record<string, string>;
  /** Callback fired when a user toggles the image overlay button */
  onToggleThumbnail: (id: string, url: string | undefined) => void;
  /** Callback fired to clear all results */
  onClear: () => void;

  /** Boolean indicating more results are available */
  hasNext: boolean;
  /** Boolean indicating previous results are available */
  hasPrevious: boolean;
  /** Number indicating the current result page */
  currentPage: number;
  /** Number indicating the total number of result pages so far */
  totalDiscoveredPages: number;
  /** Callback when the next button is selected */
  onNextPage: () => void;
  /** Callback when the previous button is selected */
  onPreviousPage: () => void;
  /** Callback when a particular page number button is selected */
  onGoToPage: (page: number) => void;
  /** Number indicating the total number of results found */
  numberMatched: number | null;
  /** The current active STAC Catalog URL target */
  stacUrl: string;
  /** The user id or user name for the current user logged.  */
  userId: string | null;
  /** The token returned from authentication service */
  authToken: string | null;
}

/**
 * Sidebar component that displays a list of STAC Item results returned from a search.
 * Renders individual cards allowing users to view metadata, toggle map footprints, 
 * and render satellite thumbnails.
 * * @param {ResultsPanelProps} props - The properties controlling the list view.
 * @returns {JSX.Element} The rendered Results Panel drawer content.
 */
export default function ResultsPanel({
  results,
  onClose,
  onZoom,
  isSearching,
  selectedFootprints,
  onToggleFootprint,
  focusedItem,
  activeThumbnails,
  onToggleThumbnail,
  onClear,
  hasNext,
  hasPrevious,
  currentPage,
  totalDiscoveredPages,
  onNextPage,
  onPreviousPage,
  onGoToPage,
  numberMatched,
  userId
}: ResultsPanelProps) {
  const [activeMetadata, setActiveMetadata] = useState<STACItem | null>(null);
  const { t, orders, isOrderingSupported, triggerNewOrder, expireOrder, stacEndpoint} = useContext(AppContext)!;
  
  // Tracks multiple item IDs currently ordered. 
  const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});

  /**
   * Creates an order request using the itemUuid, order key and collection. 
   * 
   * @param itemUuid 
   * @param orderKey 
   * @param collection 
   */
  const handleCreateOrder = async (itemUuid: string, orderKey: string, collection: string) => {
    try {
      setItemsLoading(prev => ({ ...prev, [itemUuid]: true }));
      await triggerNewOrder([itemUuid], [orderKey], collection);
    } catch (e) {
      console.error("Order submission error:", e);
      alert(t("errorOrderSubmitFailed"));
    } finally {
      setItemsLoading(prev => ({ ...prev, [itemUuid]: false }));
    }
  };

  /**
   * Determine if order link is still valid.
   * 
   * @param orderId the orderId associated with the link
   * @param downloadUrl the download url associated with the order.
   */
  const handleOrderLink = async (orderId: string, downloadUrl: string|null) => {
    
    if(downloadUrl) {
      const url = new URL(downloadUrl);
      const expiresStr = url.searchParams.get("Expires")
      if(expiresStr) {
        const expiryDate = new Date(parseInt(expiresStr) * 1000);
        if(new Date() < expiryDate) {
          window.open(downloadUrl, '_blank')?.focus();
          return;
        }
      }
    }

    expireOrder(orderId);

  };

  /**
   * Extract filesize from url and convert it to the best 4 digit fit unit.
   * 
   * @param downloadUrl the download url associated with the order.
   * @returns filesize string or empty string if not found/invalid.
   */
  const getFilesizeFromUrl = (downloadUrl: string|null) => {

    if(downloadUrl) {
      const url = new URL(downloadUrl);
      const sizeStr = url.searchParams.get('size');
      if(sizeStr) {
        try{
          const sizeValue = parseInt(sizeStr);
          
          if (sizeValue === 0) return '0 B';
    
          const units = [t('bAbbr'), t('kbAbbr'), t('mbAbbr'), t('gbAbbr'), t('tbAbbr'), t('pbAbbr')];
          const i = Math.min(
            Math.floor(Math.log(sizeValue) / Math.log(1024)),
            units.length - 1
          );
          
          const value = sizeValue / Math.pow(1024, i);
          
          const formatted = value >= 100 
            ? value.toFixed(0) 
            : value >= 10 
            ? value.toFixed(1) 
            : value.toFixed(2);
            
          return ` ${parseFloat(formatted)}${units[i]}`;
              
        } catch {
          // size invalid
        }
      }
    }

    return '';

  };

  // Scrolls the list to the focused item when a user clicks a footprint on the map
  useEffect(() => {
    if (focusedItem) {
      const element = document.getElementById(`result-card-${focusedItem}`);
      if (element)
        element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedItem]);

  const buildThumbUrl = (item: STACItem) => {
    const rawUrl = item.assets.thumbnail?.href || item.assets.preview?.href || item.assets.overview?.href;

    if (!rawUrl || !rawUrl.startsWith('/')) {
      return rawUrl;
    }

    const _stacUrl = URL.parse(stacEndpoint);

    if(_stacUrl) {
      return _stacUrl.protocol + '//' + _stacUrl.host + rawUrl
    }

    return rawUrl;
  }

  const openItemSource = (item: STACItem) => {
    if(item) {
      const itemUrl = item.links.find(link => link.rel.includes('self') && link.type.includes('json'))?.href;
      
      if(itemUrl) {
        window.open(itemUrl, "_blank", "noopener,noreferrer");
      }
    }
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          bgcolor: "primary.main",
          color: "white",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6">{t("results")}</Typography>
            <Tooltip title={t("clearResultsHover")}>
              <Button
                onClick={onClear}
                sx={{
                  color: "white",
                  textTransform: "none",
                  textDecoration: "underline",
                }}
              >
                {t("clear")}
              </Button>
            </Tooltip>
          </Box>
          {numberMatched !== null && numberMatched > 0 && (
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {numberMatched} {t("recordsMatched")}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 1, overflowY: "auto", flexGrow: 1 }}>
        {isSearching ? (
          Array.from(new Array(5)).map((_, i) => (
            <Card
              key={i}
              sx={{ mb: 2, borderRadius: 0, borderLeft: "4px solid #ccc" }}
            >
              <Skeleton variant="rectangular" height={100} />
              <CardContent>
                <Skeleton />
              </CardContent>
            </Card>
          ))
        ) : results.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ p: 2, textAlign: "center", color: "text.secondary" }}
          >
            {t("noResults")}
          </Typography>
        ) : (
          results.map((item) => {
            const itemColor = selectedFootprints[item.id] || "#005696";
            const isSelected = !!selectedFootprints[item.id];
            const isThumbnailActive = !!activeThumbnails[item.id];
            const isFocused = item.id === focusedItem;
            const thumbUrl = buildThumbUrl(item);
            // Check to see if there is an associated order
            const associatedOrder = orders.find(o => o?.itemIds?.includes(item.id));
            const isItemLoading = !!itemsLoading[item.id];

            // Handle order information
            const canOrderItem:boolean = item.assets.product ? true : false;
            const loginRequired:boolean = item.assets.product?.["auth:refs"] ? true : false;
            const directDownload:string|null = item.assets.product?.href ? item.assets.product.href : null;
            const orderKey:string|null = item.properties?.order_key ? String(item.properties?.order_key) : null;
            const filesize = associatedOrder ? getFilesizeFromUrl((associatedOrder.downloadUrl ? associatedOrder.downloadUrl : null)) : '';

            return (
              <Card
                key={item.id}
                id={`result-card-${item.id}`}
                sx={{
                  mb: 2,
                  borderRadius: 0,
                  borderLeft: `4px solid ${itemColor}`,
                  bgcolor: isFocused ? "#e3f2fd" : "white",
                }}
              >
                <CardMedia
                  component="img"
                  height="100"
                  image={thumbUrl}
                  sx={{ bgcolor: "black" }}
                />
                <CardContent
                  sx={{
                    p: 0,
                    pl: 0.5,
                    pr: 1,
                    pt: 1,
                    display: "flex",
                    alignItems: "flex-start",
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => onToggleFootprint(item)}
                    sx={{
                      p: 0.5,
                      color: isSelected ? itemColor : "default",
                      "&.Mui-checked": { color: itemColor },
                    }}
                  />

                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      wordBreak: "break-all",
                      fontWeight: isFocused ? 900 : isSelected ? 700 : 400,
                      color: isFocused ? "primary.main" : "text.primary",
                    }}
                  >
                    {item.collection}-{item.id}
                  </Typography>
                </CardContent>
                <CardActions 
                  sx={{ 
                    px: 1, pb: 1, display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', justifyContent: 'start', justifyItems: 'start', 
                    '& > :not(style)': {
                      marginLeft: '0px !important',
                    }
                  }}>
                  <Tooltip title={t("metadataHover")}>
                    <Button
                      size="small" startIcon={<ViewHeadline />}
                      onClick={() => setActiveMetadata(item)}
                    >
                      {t("metadata")}
                    </Button>
                  </Tooltip>
                  <Tooltip title={t("zoomHover")}>
                    <Button size="small" startIcon={<ZoomInMap />} onClick={() => onZoom(item)}>
                      {t("zoom")}
                    </Button>
                  </Tooltip>
                  <Tooltip
                    title={
                      isThumbnailActive ? t("hideMapHover") : t("showMapHover")
                    }
                  >
                    <Button
                      size="small"
                      startIcon={<ImageIcon />}
                      color={isThumbnailActive ? "success" : "primary"}
                      onClick={() => onToggleThumbnail(item.id, thumbUrl)}
                      disabled={!thumbUrl}
                    >
                      {isThumbnailActive ? t("hideMap") : t("showMap")}
                    </Button>
                  </Tooltip>

                  {/* ======================================================== */}
                  {/* CONDITIONAL ORDER BLOCK                                  */}
                  {/* ======================================================== */}
                  {isOrderingSupported && (
                    <>
                      {!canOrderItem ? (
                        <Box/>
                      ) : directDownload && !loginRequired ? (
                        <Tooltip title={t("download")}>
                          <span>
                            <Button
                              size="small"
                              // variant="contained"
                              color="success"
                              startIcon={<DownloadIcon />}
                              href={directDownload}
                              target="_blank"
                            >
                              {t("download")}
                            </Button>
                          </span>
                        </Tooltip>
                      ) : !userId ? (
                        <Tooltip title={t("loginToOrder")}>
                          <span>
                            <Button
                              size="small"
                              disabled
                              startIcon={<ShoppingBagIcon />}
                            >
                              {t("orderZip")}
                            </Button>
                          </span>
                        </Tooltip>
                      ) : !associatedOrder ? (
                        <Tooltip title={t("downloadZipArchive")}>
                          <Button
                            size="small"
                            // variant="contained"
                            color="secondary"
                            startIcon={<ShoppingBagIcon />}
                            disabled={isItemLoading}
                            onClick={() => handleCreateOrder(item.id, (orderKey ? orderKey : ''), item.collection)}
                          >
                            {isItemLoading ? t("requesting") : t("orderZip")}
                          </Button>
                        </Tooltip>
                      ) : associatedOrder.status === "Available" ? (
                        <Tooltip title={t("download") + filesize}>
                          <Button
                            size="small"
                            // variant="contained"
                            color="success"
                            startIcon={<DownloadIcon />}
                            onClick={() => handleOrderLink(associatedOrder.orderId, (associatedOrder.downloadUrl ? associatedOrder.downloadUrl : null))}
                          >
                            {t("download") + filesize}
                          </Button>
                        </Tooltip>
                      ) : associatedOrder.status === "Failed" ? ( 
                        <Tooltip 
                          title={`${associatedOrder.message}`}
                        >
                          <span>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<ShoppingBagIcon />}
                              disabled={isItemLoading}
                              onClick={() => handleCreateOrder(item.id, (orderKey ? orderKey : ''), item.collection)}
                        >
                            {isItemLoading ? t("requesting") : t("retryOrder")}
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip
                          title={`${t("currentStatus")}: ${associatedOrder.status}. ${t("checkingSeconds")}`}
                        >
                          <span>
                            <Button
                              size="small"
                              // variant="outlined"
                              color="warning"
                              disabled
                              startIcon={<HourglassEmptyIcon />}
                            >
                              {t("processing")}
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </>
                  )}
                </CardActions>
              </Card>
            );
          })
        )}
      </Box>

      {(totalDiscoveredPages > 1 || hasNext) && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 0.5,
            mt: 1,
            mb: 1,
            flexWrap: "wrap",
          }}
        >
          <Tooltip title={t("previousHover")}>
            <IconButton
              size="small"
              onClick={onPreviousPage}
              disabled={!hasPrevious}
            >
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>

          {Array.from({ length: totalDiscoveredPages }, (_, i) => i + 1).map(
            (page) => (
              <Tooltip key={page} title={t("pageHover") + " " + page}>
                <Button
                  size="small"
                  variant={page === currentPage ? "contained" : "text"}
                  onClick={() => onGoToPage(page)}
                  sx={{ minWidth: "32px", p: "2px" }}
                >
                  {page}
                </Button>
              </Tooltip>
            ),
          )}

          {hasNext && (
            <Typography variant="body2" sx={{ alignSelf: "center" }}>
              ...
            </Typography>
          )}

          <Tooltip title={t("nextHover")}>
            <IconButton size="small" onClick={onNextPage} disabled={!hasNext}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Dialog
        open={!!activeMetadata}
        onClose={() => setActiveMetadata(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: "primary.main", color: "white" }}>
          {t("itemMetadata")}
        </DialogTitle>
        <DialogContent dividers>
          <Table size="small">
            <TableBody>
              {activeMetadata &&
                Object.entries(activeMetadata.properties).map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell sx={{ fontWeight: "bold" }}>{k}</TableCell>
                    <TableCell>{String(v)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
            {activeMetadata && 
              (<Tooltip title={t("viewSourceTooltip")}>
                <Button variant="contained" onClick={() => openItemSource(activeMetadata)}>
                  {t("viewSource")}
                </Button>
              </Tooltip>
            )}
          <Tooltip title={t("close")}>
            <Button variant="contained" onClick={() => setActiveMetadata(null)}>
              {t("close")}
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
