import { useEffect, useMemo, useState, useContext } from "react";
import {
  Box,
  Typography,
  IconButton,
  Card,
  CardMedia,
  CardActionArea,
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
  TableHead,
  TableRow,
  TableSortLabel,
  Menu,
  MenuItem,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  Checkbox,
  Tooltip,
  Link,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import CloseIcon from "@mui/icons-material/Close";
import type { STACItem } from "../types";
import { AppContext } from "../AppContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import DownloadDoneIcon from "@mui/icons-material/DownloadDone";
import ReplayIcon from "@mui/icons-material/Replay";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ImageIcon from "@mui/icons-material/Image";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import AssetDownloadButton, { type DownloadableAsset } from "./AssetDownloadButton";

const ASSET_ROLE_ORDER = ["data", "metadata", "license"];

/** Publicly downloadable files on items that have no orderable product (e.g. CEOS-ARD), data files first. */
const getDirectAssets = (item: STACItem): DownloadableAsset[] =>
  Object.entries(item.assets)
    .filter(([, a]) => /^https?:\/\//.test(a.href) && !a["auth:refs"]?.length
      && a.roles?.some(r => ASSET_ROLE_ORDER.includes(r)))
    .map(([key, a]) => ({
      key,
      title: a.title || key,
      href: a.href,
      rank: ASSET_ROLE_ORDER.findIndex(r => a.roles?.includes(r)),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ key, title, href }) => ({ key, title, href }));

const readyPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.6); }
  100% { box-shadow: 0 0 0 10px rgba(46, 125, 50, 0); }
`;

/**
 * The order service reports no percentage, so progress is staged by status and
 * eases toward the end of each stage the longer the order takes.
 */
const estimateOrderProgress = (status: string, orderDate: string | undefined, now: number) => {
  const elapsed = orderDate ? Math.max(0, now - Date.parse(orderDate)) : 0;
  const ease = (from: number, to: number) => from + (to - from) * (1 - Math.exp(-elapsed / 90_000));
  return status === "Processing" ? ease(40, 92) : ease(12, 38);
};

const inButtonProgressSx = { overflow: "hidden" };

/** A thin bar along the bottom edge of a button; indeterminate when no value is given. */
const ButtonProgress = ({ value, color }: { value?: number; color: "primary" | "warning" | "success" | "error" }) => (
  <LinearProgress
    aria-hidden
    color={color}
    variant={value === undefined ? "indeterminate" : "determinate"}
    value={value}
    sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3 }}
  />
);

type ResultsView = "cards" | "table";
type SortKey = string;

const VIEW_STORAGE_KEY = "eodms.resultsView";
const COLUMNS_STORAGE_KEY = "eodms.resultsColumns";

/** The one nominated acquisition date column; always shown first and not user-removable. */
const DATE_KEY = "datetime";

/** Property columns offered first, and shown by default when the user has no saved choice. */
const PREFERRED_COLUMNS = [
  "start_datetime", "platform", "sar:product_type", "product_type",
  "sar:instrument_mode", "instrument_mode", "sat:orbit_state", "gsd",
];
const MAX_DEFAULT_COLUMNS = 4;
const HIDDEN_PROPERTIES = new Set(["order_key"]);

const isTemporalKey = (key: string) => /datetime$|^created$|^updated$/.test(key);
const columnLabel = (key: string) => key.split(":").pop()!.replace(/_/g, " ");

const isScalar = (v: unknown) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

const formatCell = (key: string, value: unknown) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  const text = String(value);
  return isTemporalKey(key) ? text.slice(0, 16).replace("T", " ") : text;
};

const loadColumnPrefs = (): string[] | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    return Array.isArray(parsed) ? parsed.filter(k => typeof k === "string") : null;
  } catch {
    return null;
  }
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

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
  /** Callback fired to empty the cart (uncheck every item) */
  onClearCart: () => void;
  /** The ID of the item currently clicked/focused on the map */
  focusedItem: string | null;
  /** The ID of the item currently hovered on the map or in this list */
  hoveredItem: string | null;
  /** Callback fired when the pointer enters or leaves a result card */
  onHoverItem: (id: string | null) => void;
  /** Added to each result's list position to number it across pages */
  numberOffset: number;
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
  onClearCart,
  focusedItem,
  hoveredItem,
  onHoverItem,
  numberOffset,
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
  const [view, setView] = useState<ResultsView>(() =>
    localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "cards");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "number", dir: "asc" });
  const [columnPrefs, setColumnPrefs] = useState<string[] | null>(loadColumnPrefs);
  const [columnMenuEl, setColumnMenuEl] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const brandColor = theme.palette.primary.main;
  const { t, orders, isOrderingSupported, triggerNewOrder, expireOrder, stacEndpoint} = useContext(AppContext)!;
  
  // Tracks multiple item IDs currently ordered. 
  const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});
  // Order IDs downloaded during this session.
  const [downloadedOrders, setDownloadedOrders] = useState<Set<string>>(() => new Set());
  // Orders that became ready while this panel was mounted; each pulses once.
  const [justReady, setJustReady] = useState<Set<string>>(() => new Set());
  const [prevOrders, setPrevOrders] = useState(orders);
  if (orders !== prevOrders) {
    const wasPreparing = new Set(prevOrders.filter(o => o.status === "Pending" || o.status === "Processing").map(o => o.orderId));
    const ready = orders.filter(o => o.status === "Available" && wasPreparing.has(o.orderId)).map(o => o.orderId);
    setPrevOrders(orders);
    if (ready.length > 0) setJustReady(prev => new Set([...prev, ...ready]));
  }

  const hasPreparingOrders = orders.some(o => o.status === "Pending" || o.status === "Processing");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasPreparingOrders) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasPreparingOrders]);

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

  // The cart is the set of checked results; it empties whenever the results change.
  const cartItems = useMemo(() => results.filter(i => !!selectedFootprints[i.id]), [results, selectedFootprints]);
  const [cartBusy, setCartBusy] = useState(false);
  const needsLogin = (item: STACItem) => !!item.assets.product && !(item.assets.product.href && !item.assets.product["auth:refs"]);
  const cartLoginBlocked = !userId && cartItems.some(needsLogin);

  /** Applies each item's Prepare download rules: open a ready download, or submit one DDS order per item. */
  const handleCartDownload = async () => {
    let handled = 0;
    const toOrder: STACItem[] = [];
    setCartBusy(true);
    try {
      for (const item of cartItems) {
        if (!isOrderingSupported || !item.assets.product) continue;
        if (!needsLogin(item)) {
          window.open(item.assets.product.href, "_blank", "noopener,noreferrer");
          handled++;
          continue;
        }
        if (!userId) continue;
        const order = orders.find(o => o?.itemIds?.includes(item.id));
        if (order?.status === "Available") {
          await handleOrderLink(order.orderId, order.downloadUrl ?? null);
          handled++;
        } else if (!order || order.status === "Failed") {
          toOrder.push(item);
        }
      }

      handled += toOrder.length;
      // Flag every result as requesting at once, then let the per-item handler clear each as it finishes.
      setItemsLoading(prev => ({ ...prev, ...Object.fromEntries(toOrder.map(i => [i.id, true])) }));
      await Promise.all(toOrder.map(item =>
        handleCreateOrder(item.id, item.properties?.order_key ? String(item.properties.order_key) : "", item.collection)));

      if (handled === 0) alert(t("cartNothingToDownload"));
    } finally {
      setCartBusy(false);
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
          setDownloadedOrders(prev => new Set(prev).add(orderId));
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
          
          // A zero or unparsable size means the size is unknown, so show nothing.
          if (!sizeValue || sizeValue < 0) return '';
    
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
            
          return ` ${parseFloat(formatted)} ${units[i]}`;
              
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
      const element = document.getElementById(`result-card-${focusedItem}`)
        ?? document.getElementById(`result-row-${focusedItem}`);
      if (element)
        element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedItem, view]);

  const changeView = (next: ResultsView | null) => {
    if (!next) return;
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const toggleSort = (key: SortKey) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));

  // Same `results` datasource as the cards; `number` keeps the map marker numbering.
  const sortedRows = useMemo(() => {
    const rows = results.map((item, index) => ({
      item,
      number: numberOffset + index + 1,
      label: item.properties?.order_key ? String(item.properties.order_key) : item.id,
    }));
    const factor = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.key === "number") return (a.number - b.number) * factor;
      if (sort.key === "id") return a.label.localeCompare(b.label, undefined, { numeric: true }) * factor;
      const va: unknown = a.item.properties?.[sort.key];
      const vb: unknown = b.item.properties?.[sort.key];
      const missingA = va === null || va === undefined || va === "";
      const missingB = vb === null || vb === undefined || vb === "";
      // Items without a value always sort last.
      if (missingA !== missingB) return missingA ? 1 : -1;
      if (missingA) return a.number - b.number;
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : formatCell(sort.key, va).localeCompare(formatCell(sort.key, vb), undefined, { numeric: true });
      return cmp * factor || a.number - b.number;
    });
  }, [results, numberOffset, sort]);

  // Property columns offered by the current results, so any mission's fields are available.
  const candidateKeys = useMemo(() => {
    const found = new Set<string>();
    for (const item of results) {
      for (const [key, value] of Object.entries(item.properties ?? {})) {
        if (HIDDEN_PROPERTIES.has(key) || key === DATE_KEY) continue;
        if (isScalar(value) || (Array.isArray(value) && value.every(isScalar))) found.add(key);
      }
    }
    const preferred = PREFERRED_COLUMNS.filter(k => found.has(k));
    return [...preferred, ...[...found].filter(k => !preferred.includes(k)).sort()];
  }, [results]);

  const visibleKeys = useMemo(() => {
    const saved = columnPrefs?.filter(k => candidateKeys.includes(k));
    // Saved favourites that this collection lacks fall back to the defaults.
    if (columnPrefs && (columnPrefs.length === 0 || saved!.length > 0)) return saved!;
    const defaults = PREFERRED_COLUMNS.filter(k => candidateKeys.includes(k)).slice(0, MAX_DEFAULT_COLUMNS);
    return defaults.length > 0 ? defaults : candidateKeys.slice(0, 3);
  }, [columnPrefs, candidateKeys]);

  const saveColumns = (next: string[] | null) => {
    setColumnPrefs(next);
    if (next) localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(COLUMNS_STORAGE_KEY);
  };

  const toggleColumn = (key: string) =>
    saveColumns(visibleKeys.includes(key) ? visibleKeys.filter(k => k !== key) : [...visibleKeys, key]);

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

  /** Download/order controls for one item, shared by the card and table views. */
  const renderOrderActions = (item: STACItem, compact = false) => {
    const associatedOrder = orders.find(o => o?.itemIds?.includes(item.id));
    const isItemLoading = !!itemsLoading[item.id];
    const canOrderItem: boolean = !!item.assets.product;
    const loginRequired: boolean = !!item.assets.product?.["auth:refs"];
    const directDownload: string | null = item.assets.product?.href ?? null;
    const orderKey: string | null = item.properties?.order_key ? String(item.properties.order_key) : null;
    const filesize = associatedOrder ? getFilesizeFromUrl(associatedOrder.downloadUrl ?? null) : '';
    const directAssets = canOrderItem ? [] : getDirectAssets(item);

    if (compact) {
      const order = () => handleCreateOrder(item.id, orderKey ?? '', item.collection);
      const openOrder = (o: NonNullable<typeof associatedOrder>) => handleOrderLink(o.orderId, o.downloadUrl ?? null);
      let action = null;

      if (isOrderingSupported && canOrderItem) {
        if (directDownload && !loginRequired) {
          action = (
            <Tooltip title={t("download")}>
              <IconButton size="small" color="success" aria-label={t("download")} href={directDownload} target="_blank" rel="noopener noreferrer">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        } else if (!userId) {
          action = (
            <Tooltip title={t("loginToOrder")}>
              <span><IconButton size="small" disabled aria-label={t("orderZip")}><Inventory2Icon fontSize="small" /></IconButton></span>
            </Tooltip>
          );
        } else if (!associatedOrder) {
          action = (
            <Tooltip title={isItemLoading ? t("requesting") : `${t("orderZip")} - ${t("downloadZipArchive")}`}>
              <span>
                <IconButton size="small" color="primary" disabled={isItemLoading} aria-label={t("orderZip")} onClick={order}>
                  {isItemLoading ? <CircularProgress size={18} /> : <Inventory2Icon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          );
        } else if (associatedOrder.status === "Available") {
          const done = downloadedOrders.has(associatedOrder.orderId);
          action = (
            <Tooltip title={(done ? t("downloadAgain") : t("download")) + filesize}>
              <IconButton
                size="small"
                color="success"
                aria-label={t("download")}
                onClick={() => openOrder(associatedOrder)}
                onAnimationEnd={() => setJustReady(prev => { const next = new Set(prev); next.delete(associatedOrder.orderId); return next; })}
                sx={{
                  animation: !done && justReady.has(associatedOrder.orderId) ? `${readyPulse} 1.2s ease-out 3` : "none",
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              >
                {done ? <DownloadDoneIcon fontSize="small" /> : <DownloadIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          );
        } else if (associatedOrder.status === "Failed") {
          action = (
            <Tooltip title={`${t("retryOrder")} - ${associatedOrder.error || associatedOrder.message || `${t("currentStatus")}: ${associatedOrder.serverStatus ?? associatedOrder.status}`}`}>
              <span>
                <IconButton size="small" color="error" disabled={isItemLoading} aria-label={t("retryOrder")} onClick={order}>
                  <ReplayIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          );
        } else {
          action = (
            <>
              <Tooltip title={`${t("preparingHover")} ${t("currentStatus")}: ${associatedOrder.serverStatus ?? associatedOrder.status}.${associatedOrder.nextCheckAt ? ` ${t("nextCheck")} ${new Date(associatedOrder.nextCheckAt).toLocaleTimeString()}.` : ''}`}>
                <Box component="span" role="img" aria-label={t("preparing")} sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30 }}>
                  <CircularProgress
                    size={28}
                    thickness={3}
                    color="warning"
                    variant="determinate"
                    value={estimateOrderProgress(associatedOrder.status, associatedOrder.orderDate, now)}
                    sx={{ position: "absolute" }}
                  />
                  <HourglassEmptyIcon color="warning" sx={{ fontSize: 16 }} />
                </Box>
              </Tooltip>
              <Tooltip title={t("cancelPreparing")}>
                <IconButton size="small" aria-label={t("cancelPreparing")} onClick={() => expireOrder(associatedOrder.orderId)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          );
        }
      }

      return (
        <>
          {directAssets.length > 0 && <AssetDownloadButton assets={directAssets} />}
          {action}
        </>
      );
    }

    return (
      <>
        {directAssets.length > 0 && <AssetDownloadButton assets={directAssets} />}
        {isOrderingSupported && (
          <>
            {!canOrderItem ? (
              null
            ) : directDownload && !loginRequired ? (
              <Tooltip title={t("download")}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<DownloadIcon />}
                    href={directDownload}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("download")}
                  </Button>
                </span>
              </Tooltip>
            ) : !userId ? (
              <Tooltip title={t("loginToOrder")}>
                <span>
                  <Button size="small" variant="outlined" disabled startIcon={<Inventory2Icon />}>
                    {t("orderZip")}
                  </Button>
                </span>
              </Tooltip>
            ) : !associatedOrder ? (
              <Tooltip title={t("downloadZipArchive")}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Inventory2Icon />}
                  disabled={isItemLoading}
                  onClick={() => handleCreateOrder(item.id, (orderKey ? orderKey : ''), item.collection)}
                  sx={inButtonProgressSx}
                >
                  {isItemLoading ? t("requesting") : t("orderZip")}
                  {isItemLoading && <ButtonProgress color="primary" />}
                </Button>
              </Tooltip>
            ) : associatedOrder.status === "Available" ? (
              downloadedOrders.has(associatedOrder.orderId) ? (
                <Tooltip title={t("downloadAgain") + filesize}>
                  <Button
                    size="small"
                    color="success"
                    startIcon={<DownloadDoneIcon />}
                    onClick={() => handleOrderLink(associatedOrder.orderId, (associatedOrder.downloadUrl ? associatedOrder.downloadUrl : null))}
                  >
                    {t("downloaded")}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title={t("download") + filesize}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleOrderLink(associatedOrder.orderId, (associatedOrder.downloadUrl ? associatedOrder.downloadUrl : null))}
                    onAnimationEnd={() => setJustReady(prev => { const next = new Set(prev); next.delete(associatedOrder.orderId); return next; })}
                    sx={{
                      ...inButtonProgressSx,
                      animation: justReady.has(associatedOrder.orderId) ? `${readyPulse} 1.2s ease-out 3` : "none",
                      "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                    }}
                  >
                    {t("download") + filesize}
                    {justReady.has(associatedOrder.orderId) && <ButtonProgress value={100} color="success" />}
                  </Button>
                </Tooltip>
              )
            ) : associatedOrder.status === "Failed" ? (
              <Tooltip
                title={associatedOrder.error || associatedOrder.message || `${t("currentStatus")}: ${associatedOrder.serverStatus ?? associatedOrder.status}`}
              >
                <span>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<ReplayIcon />}
                    disabled={isItemLoading}
                    onClick={() => handleCreateOrder(item.id, (orderKey ? orderKey : ''), item.collection)}
                    sx={inButtonProgressSx}
                  >
                    {isItemLoading ? t("requesting") : t("retryOrder")}
                    <ButtonProgress value={isItemLoading ? undefined : 100} color={isItemLoading ? "primary" : "error"} />
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <>
                <Tooltip
                  title={`${t("preparingHover")} ${t("currentStatus")}: ${associatedOrder.serverStatus ?? associatedOrder.status}.${associatedOrder.nextCheckAt ? ` ${t("nextCheck")} ${new Date(associatedOrder.nextCheckAt).toLocaleTimeString()}.` : ''}`}
                >
                  <span>
                    <Button
                      size="small"
                      color="warning"
                      disabled
                      startIcon={<HourglassEmptyIcon />}
                      sx={inButtonProgressSx}
                    >
                      {t("preparing")}
                      {associatedOrder.orderDate && ` ${formatElapsed(now - Date.parse(associatedOrder.orderDate))}`}
                      <ButtonProgress color="warning" value={estimateOrderProgress(associatedOrder.status, associatedOrder.orderDate, now)} />
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={t("cancelPreparing")}>
                  <IconButton
                    size="small"
                    aria-label={t("cancelPreparing")}
                    onClick={() => expireOrder(associatedOrder.orderId)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </>
        )}
      </>
    );
  };

  const renderTable = () => {
    const sortCell = (key: SortKey, label: string, tooltip?: string) => (
      <TableCell key={key} sortDirection={sort.key === key ? sort.dir : false} sx={{ whiteSpace: "nowrap", textTransform: "capitalize" }}>
        <Tooltip title={tooltip ?? ""}>
          <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.dir : "asc"} onClick={() => toggleSort(key)}>
            {label}
          </TableSortLabel>
        </Tooltip>
      </TableCell>
    );

    const dateKey = results.some(i => i.properties?.[DATE_KEY]) ? DATE_KEY : undefined;
    const otherKeys = [...visibleKeys.filter(k => !isTemporalKey(k)), ...visibleKeys.filter(isTemporalKey)];

    return (
      <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", p: 0.5 }}>
        <Button size="small" startIcon={<ViewColumnIcon />} onClick={e => setColumnMenuEl(e.currentTarget)} sx={{ textTransform: "none" }}>
          {t("columns")}
        </Button>
        <Menu anchorEl={columnMenuEl} open={!!columnMenuEl} onClose={() => setColumnMenuEl(null)} slotProps={{ paper: { sx: { maxHeight: 360 } } }}>
          {dateKey && (
            <MenuItem dense disabled>
              <Checkbox size="small" edge="start" checked tabIndex={-1} disableRipple />
              <ListItemText primary={columnLabel(dateKey)} sx={{ textTransform: "capitalize" }} />
            </MenuItem>
          )}
          {candidateKeys.map(key => (
            <MenuItem key={key} dense onClick={() => toggleColumn(key)}>
              <Checkbox size="small" edge="start" checked={visibleKeys.includes(key)} tabIndex={-1} disableRipple />
              <ListItemText primary={columnLabel(key)} secondary={columnLabel(key) === key ? undefined : key} sx={{ textTransform: "capitalize", "& .MuiListItemText-secondary": { textTransform: "none" } }} />
            </MenuItem>
          ))}
          <MenuItem dense divider={false} onClick={() => { saveColumns(null); setColumnMenuEl(null); }}>
            <ListItemText primary={t("resetColumns")} />
          </MenuItem>
        </Menu>
      </Box>
      <Table size="small" stickyHeader sx={{ "& td, & th": { whiteSpace: "nowrap", py: 0.25, px: 0.75 }, "& .MuiTableCell-paddingCheckbox": { width: "auto", px: 0.25 } }}>
        <TableHead>
          <TableRow>
            {sortCell("number", "#")}
            <TableCell padding="checkbox" />
            <TableCell padding="checkbox" />
            <TableCell padding="checkbox" aria-label={t("actions")} />
            {dateKey && sortCell(dateKey, columnLabel(dateKey), dateKey)}
            {sortCell("id", t("itemId"))}
            {otherKeys.map(key => sortCell(key, columnLabel(key), key))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map(({ item, number, label }) => {
            const itemColor = selectedFootprints[item.id] || brandColor;
            const isSelected = !!selectedFootprints[item.id];
            const isHovered = item.id === hoveredItem;
            const isThumbnailActive = !!activeThumbnails[item.id];
            const isFocused = item.id === focusedItem;
            const thumbUrl = buildThumbUrl(item);

            return (
              <TableRow
                key={item.id}
                id={`result-row-${item.id}`}
                onMouseEnter={() => onHoverItem(item.id)}
                onMouseLeave={() => onHoverItem(null)}
                sx={{
                  bgcolor: isFocused ? alpha(brandColor, 0.1) : isHovered ? alpha(itemColor, 0.12) : undefined,
                  "& > td:first-of-type": { borderLeft: `4px solid ${itemColor}` },
                }}
              >
                <TableCell sx={{ fontWeight: 700 }}>{number}</TableCell>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => onToggleFootprint(item)}
                    slotProps={{ input: { "aria-label": label } }}
                    sx={{ p: 0.25, color: isSelected ? itemColor : "default", "&.Mui-checked": { color: itemColor } }}
                  />
                </TableCell>
                <TableCell padding="checkbox">
                  <Tooltip title={isThumbnailActive ? t("hideMapHover") : t("showMapHover")}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!thumbUrl}
                        color={isThumbnailActive ? "success" : "default"}
                        aria-label={isThumbnailActive ? t("hideMapHover") : t("showMapHover")}
                        onClick={() => {
                          onZoom(item);
                          onToggleThumbnail(item.id, thumbUrl);
                        }}
                      >
                        {isThumbnailActive ? <ImageIcon fontSize="small" /> : <ImageOutlinedIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell padding="checkbox">
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {renderOrderActions(item, true)}
                  </Box>
                </TableCell>
                {dateKey && <TableCell>{formatCell(dateKey, item.properties?.[dateKey])}</TableCell>}
                <TableCell sx={{ width: 160, maxWidth: 160, overflow: "hidden" }}>
                  <Tooltip title={`${item.collection} - ${label} - ${t("metadataHover")}`}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => setActiveMetadata(item)}
                      sx={{ display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", fontWeight: isFocused ? 900 : isSelected ? 700 : 400 }}
                    >
                      {label}
                    </Link>
                  </Tooltip>
                </TableCell>
                {otherKeys.map(key => (
                  <TableCell key={key}>{formatCell(key, item.properties?.[key])}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </>
    );
  };

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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, next: ResultsView | null) => changeView(next)}
            sx={{
              "& .MuiToggleButton-root": { color: "white", borderColor: alpha("#fff", 0.5), py: 0.25 },
              "& .Mui-selected": { bgcolor: `${alpha("#fff", 0.25)} !important` },
            }}
          >
            <ToggleButton value="cards" aria-label={t("cardView")}>
              <Tooltip title={t("cardView")}><ViewAgendaIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="table" aria-label={t("tableView")}>
              <Tooltip title={t("tableView")}><TableRowsIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={onClose} size="small" sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {cartItems.length > 0 && (
        <Box sx={{ px: 2, py: 0.5, display: "flex", alignItems: "center", gap: 1, bgcolor: alpha(brandColor, 0.08), borderBottom: 1, borderColor: "divider" }}>
          <ShoppingCartIcon fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {t("cart")} ({cartItems.length})
          </Typography>
          <Tooltip title={cartLoginBlocked ? t("loginToOrder") : t("downloadCartHover")}>
            <span>
              <Button size="small" variant="contained" startIcon={cartBusy ? <CircularProgress size={14} /> : <DownloadIcon />} disabled={cartBusy} onClick={handleCartDownload}>
                {t("download")}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={t("emptyCartHover")}>
            <Button size="small" onClick={onClearCart}>{t("clear")}</Button>
          </Tooltip>
        </Box>
      )}

      <Box sx={{ p: view === "table" && !isSearching && results.length > 0 ? 0 : 1, overflowY: "auto", flexGrow: 1 }}>
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
        ) : view === "table" ? (
          renderTable()
        ) : (
          results.map((item, index) => {
            const itemColor = selectedFootprints[item.id] || brandColor;
            const isSelected = !!selectedFootprints[item.id];
            const isHovered = item.id === hoveredItem;
            const isThumbnailActive = !!activeThumbnails[item.id];
            const isFocused = item.id === focusedItem;
            const thumbUrl = buildThumbUrl(item);
            const orderKey:string|null = item.properties?.order_key ? String(item.properties?.order_key) : null;

            return (
              <Card
                key={item.id}
                id={`result-card-${item.id}`}
                onMouseEnter={() => onHoverItem(item.id)}
                onMouseLeave={() => onHoverItem(null)}
                sx={{
                  mb: 2,
                  position: "relative",
                  borderRadius: 0,
                  borderLeft: `4px solid ${itemColor}`,
                  bgcolor: isFocused ? alpha(brandColor, 0.1) : "white",
                  boxShadow: isHovered ? `0 0 0 2px ${alpha(itemColor, 0.6)}` : undefined,
                  transition: "box-shadow 150ms ease",
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    zIndex: 1,
                    minWidth: 24,
                    height: 24,
                    px: 0.5,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                    fontSize: 12,
                    fontWeight: 700,
                    pointerEvents: "none",
                    bgcolor: isSelected || isHovered ? itemColor : alpha(brandColor, 0.75),
                    color: theme.palette.getContrastText(itemColor),
                  }}
                >
                  {numberOffset + index + 1}
                </Box>
                <Tooltip title={isThumbnailActive ? t("hideMapHover") : t("showMapHover")}>
                  <CardActionArea
                    disabled={!thumbUrl}
                    onClick={() => {
                      onZoom(item);
                      onToggleThumbnail(item.id, thumbUrl);
                    }}
                    sx={{
                      outline: isThumbnailActive ? "3px solid" : "none",
                      outlineColor: "success.main",
                      outlineOffset: "-3px",
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="100"
                      image={thumbUrl}
                      sx={{ bgcolor: "black" }}
                    />
                  </CardActionArea>
                </Tooltip>
                <CardContent
                  sx={{
                    p: 0,
                    pl: 1,
                    pr: 1.5,
                    pt: 1.25,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 0.5,
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

                  <Tooltip title={t("metadataHover")}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => setActiveMetadata(item)}
                      sx={{
                        mt: 0.5,
                        textAlign: "left",
                        wordBreak: "break-all",
                        fontWeight: isFocused ? 900 : isSelected ? 700 : 400,
                      }}
                    >
                      {`${item.collection} - ${orderKey ?? item.id}`}
                    </Link>
                  </Tooltip>
                </CardContent>
                <CardActions
                  sx={{
                    // Indent to line up with the title text, past the checkbox column.
                    pl: '40px', pr: 1.5, pt: 1.25, pb: 1.5,
                    gap: 0.5,
                    '& > :not(style) ~ :not(style)': { ml: 0 },
                    '& .MuiButton-root': { whiteSpace: 'nowrap', minWidth: 'max-content' },
                  }}
                >
                  {renderOrderActions(item)}
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
