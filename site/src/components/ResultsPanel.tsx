import { useEffect, useMemo, useState, useContext, type MouseEvent, type KeyboardEvent } from "react";
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
  ButtonGroup,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Pagination,
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
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import CloseIcon from "@mui/icons-material/Close";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import type { STACItem } from "../types";
import { AppContext } from "../AppContext";
import { getHighlightColor } from "../theme";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import LuggageIcon from "@mui/icons-material/Luggage";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import DownloadDoneIcon from "@mui/icons-material/DownloadDone";
import ReplayIcon from "@mui/icons-material/Replay";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ImageIcon from "@mui/icons-material/Image";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ScienceIcon from "@mui/icons-material/Science";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AssetDownloadButton, { type DownloadableAsset } from "./AssetDownloadButton";
import { getNaplOrderOptions, normalizeNaplSelection, submitNaplOrder, type NaplOrderOptions, type NaplOrderSelection } from "../services/NaplOrderService";
import type { ExplorerExperience } from "../experiences";
import NaplContactInfo from "./NaplContactInfo";
import { loadNaplBasket, saveNaplBasket, type NaplBasketEntry } from "../utils/NaplBasket";

const ASSET_ROLE_ORDER = ["data", "metadata", "license"];

const resultActivationHandlers = (item: STACItem, onZoom: (item: STACItem) => void) => ({
  tabIndex: 0,
  onClick: (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element
      && event.target.closest('button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="menuitem"]')) return;
    onZoom(item);
  },
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onZoom(item);
  },
});

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

const getNaplItemLabel = (
  item: STACItem,
  labels: { roll: string; photo: string; unavailable: string },
) => {
  const roll = item.properties.roll_number;
  const photo = item.properties.photo_number;
  const hasRoll = roll !== null && roll !== undefined && String(roll).trim() !== "";
  const hasPhoto = photo !== null && photo !== undefined && String(photo).trim() !== "";
  if (!hasRoll && !hasPhoto) return labels.unavailable;
  return `${labels.roll} ${hasRoll ? String(roll) : "-"} / ${labels.photo} ${hasPhoto ? String(photo) : "-"}`;
};

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
type SortKey = string | null;

const VIEW_STORAGE_KEY = "eodms.resultsView";
const COLUMNS_STORAGE_KEY = "eodms.resultsColumns";

/** The one nominated acquisition date column; always shown first and not user-removable. */
const DATE_KEY = "datetime";

/** Property columns offered first when the user has no saved choice. */
const PREFERRED_COLUMNS = [
  "roll_number", "photo_number", "start_datetime", "beam_mode", "channel", "acquisition_orbit", "total_frames",
  "platform", "sar:product_type", "product_type", "sar:instrument_mode",
  "instrument_mode", "sat:orbit_state", "gsd",
];

const isTemporalKey = (key: string) => /datetime$|^created$|^updated$/.test(key);
const columnLabel = (key: string) => key.split(":").pop()!.replace(/_/g, " ");

const formatCell = (key: string, value: unknown, dateOnly = false) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(entry => typeof entry === "object" ? JSON.stringify(entry) : String(entry)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return isTemporalKey(key) ? text.slice(0, dateOnly ? 10 : 16).replace("T", " ") : text;
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
  loadedResults: STACItem[];
  /** Callback fired to close the results drawer */
  onClose: () => void;
  /** Callback fired to zoom the map to a specific item's bounds */
  onZoom: (item: STACItem) => void;
  /** Callback fired to zoom the map to all results on the current page */
  onZoomToResults: () => void;
  onProcessCart: () => void;
  /** Boolean indicating if a network request is currently active */
  isSearching: boolean;
  /** Dictionary tracking which STAC Items are checked for footprint highlighting */
  selectedFootprints: ReadonlySet<string>;
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
  experienceId: ExplorerExperience["id"];
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
  loadedResults,
  onClose,
  onZoom,
  onZoomToResults,
  onProcessCart,
  isSearching,
  selectedFootprints,
  onToggleFootprint,
  onClearCart,
  focusedItem,
  hoveredItem,
  onHoverItem,
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
  userId,
  experienceId,
}: ResultsPanelProps) {
  const [activeMetadata, setActiveMetadata] = useState<STACItem | null>(null);
  const [sourceCopyNotice, setSourceCopyNotice] = useState<"success" | "error" | null>(null);
  const [view, setView] = useState<ResultsView>(() =>
    localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "cards");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [columnPrefs, setColumnPrefs] = useState<string[] | null>(loadColumnPrefs);
  const [columnMenuEl, setColumnMenuEl] = useState<HTMLElement | null>(null);
  const [exportError, setExportError] = useState(false);
  const theme = useTheme();
  const brandColor = theme.palette.primary.main;
  const highlightColor = getHighlightColor(theme.palette.mode);
  const { t, orders, isOrderingSupported, triggerNewOrder, expireOrder, stacEndpoint, authToken, getValidAuthToken } = useContext(AppContext)!;

  
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
  const cartItems = useMemo(() => results.filter(i => selectedFootprints.has(i.id)), [results, selectedFootprints]);
  const [cartBusy, setCartBusy] = useState(false);
  const isNaplExperience = experienceId === "napl";
  const [naplOptions, setNaplOptions] = useState<NaplOrderOptions | null>(null);
  const [naplTargetItems, setNaplTargetItemsState] = useState<NaplBasketEntry[]>(loadNaplBasket);
  const [naplStorageError, setNaplStorageError] = useState(false);
  const [naplDialogOpen, setNaplDialogOpen] = useState(false);
  const [naplOptionsLoading, setNaplOptionsLoading] = useState(false);
  const [naplSubmitting, setNaplSubmitting] = useState(false);
  const [naplError, setNaplError] = useState<string | null>(null);
  const naplItemOptions = Object.fromEntries(naplTargetItems.map(entry => [entry.id, entry.options]));
  const naplMediaLabels: Record<string, string> = {
    PaperPrint: t("naplPaperPrint"),
    Mosaic: t("naplMosaic"),
    ContactTransparency: t("naplContactTransparency"),
    Uncorrected: t("naplUncorrected"),
    TransparencyEnlargement: t("naplTransparencyEnlargement"),
  };
  const naplPhotoCounts = new Map<string, number>();
  for (const entry of naplTargetItems) {
    const count = (naplPhotoCounts.get(entry.itemId) ?? 0) + entry.quantity;
    naplPhotoCounts.set(entry.itemId, count);
  }
  const renderValiseCount = (itemId: string) => (
    <Badge badgeContent={naplPhotoCounts.get(itemId) ?? 0} color="secondary" max={100}
      aria-label={t("naplValiseCount").replace("{count}", String(naplPhotoCounts.get(itemId) ?? 0))}>
      <LuggageIcon fontSize="small" />
    </Badge>
  );
  const [naplConfirmation, setNaplConfirmation] = useState<{
    orderId?: string;
    items: { id: string; label: string; quantity: number; options: NaplOrderSelection }[];
  } | null>(null);
  const [naplNotice, setNaplNotice] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const setNaplTargetItems = (update: NaplBasketEntry[] | ((previous: NaplBasketEntry[]) => NaplBasketEntry[])) => {
    const entries = typeof update === "function" ? update(naplTargetItems) : update;
    try {
      saveNaplBasket(entries);
      setNaplStorageError(false);
    } catch {
      setNaplStorageError(true);
    }
    setNaplTargetItemsState(entries);
  };
  const needsLogin = (item: STACItem) => !!item.assets.product && !(item.assets.product.href && !item.assets.product["auth:refs"]);
  const cartLoginBlocked = isNaplExperience
    ? (!userId || !authToken) && cartItems.some(item => !item.assets.product || needsLogin(item))
    : !userId && cartItems.some(needsLogin);

  const handleCartToggle = (item: STACItem) => {
    if (isNaplExperience && !selectedFootprints.has(item.id) && cartItems.length > 0
      && !!cartItems[0].assets.product !== !!item.assets.product) {
      setCartError(t("naplCartMixBlocked"));
      return;
    }
    setCartError(null);
    onToggleFootprint(item);
  };

  const openNaplOrder = async (items: STACItem[]) => {
    if (naplSubmitting || naplOptionsLoading) return;
    if (naplTargetItems.length + items.length > 100) {
      setNaplError(t("naplOrderLimit"));
      setNaplDialogOpen(true);
      return;
    }
    setNaplDialogOpen(true);
    setNaplError(null);

    setNaplOptionsLoading(true);
    try {
      const options = await getNaplOrderOptions();
      setNaplOptions(options);
      const entries = items.map(item => ({
        id: crypto.randomUUID(),
        itemId: item.id,
        quantity: 1,
        label: getNaplItemLabel(item, {
          roll: t("naplRollLabel"), photo: t("naplPhotoLabel"), unavailable: t("naplRollPhotoUnavailable"),
        }),
        options: normalizeNaplSelection({ media_type: options.media_types[0] ?? "" }, options),
      }));
      setNaplTargetItems(previous => [
        ...previous.map(entry => ({ ...entry, options: normalizeNaplSelection(entry.options, options) })),
        ...entries,
      ]);
    } catch (error) {
      setNaplError(error instanceof Error ? error.message : t("naplOptionsUnavailable"));
    } finally {
      setNaplOptionsLoading(false);
    }
  };

  const naplSelectionValid = naplTargetItems.length > 0 && naplTargetItems.length <= 100
    && naplTargetItems.every(item => {
      const options = naplItemOptions[item.id];
      const rule = naplOptions?.media_type_options[options.media_type];
      return Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 2147483647
        && options && naplOptions?.media_types.includes(options.media_type)
        && rule
        && (rule.file_formats.length ? rule.file_formats.includes(options.file_format ?? "") : options.file_format === undefined)
        && (rule.image_resolutions.length ? rule.image_resolutions.includes(options.image_resolution ?? 0) : options.image_resolution === undefined)
        && (options.flight_line_index_map === undefined
          || naplOptions.flight_line_index_maps.includes(options.flight_line_index_map));
    });

  const updateNaplItemOptions = (id: string, patch: Partial<NaplOrderSelection>) => {
    if (!naplOptions) return;
    setNaplTargetItems(previous => previous.map(entry => entry.id === id
      ? { ...entry, options: normalizeNaplSelection({ ...entry.options, ...patch }, naplOptions) } : entry));
  };

  const handleNaplSubmit = async () => {
    if (!naplSelectionValid || !authToken || naplSubmitting) return;
    setNaplSubmitting(true);
    setNaplError(null);
    try {
      const response = await submitNaplOrder(naplTargetItems.map(item => ({
        unique_identifier: item.itemId,
        quantity: item.quantity,
        options: naplItemOptions[item.id],
      })), await getValidAuthToken());
      const displayOrderId = response.order_number ?? response.order_id;
      const orderId = displayOrderId !== undefined ? ` (${displayOrderId})` : "";
      setNaplConfirmation({
        orderId: displayOrderId !== undefined ? String(displayOrderId) : undefined,
        items: naplTargetItems.map(item => ({
          id: item.id,
          label: item.label,
          quantity: item.quantity,
          options: naplItemOptions[item.id],
        })),
      });
      setNaplNotice(`${t("naplOrderSubmitted")}${orderId}`);
      setNaplDialogOpen(false);
      setNaplTargetItems([]);
      if (naplTargetItems.some(item => selectedFootprints.has(item.itemId))) onClearCart();
    } catch (error) {
      setNaplError(error instanceof Error ? error.message : t("errorOrderSubmitFailed"));
    } finally {
      setNaplSubmitting(false);
    }
  };

  /** Applies each item's Prepare download rules: open a ready download, or submit one DDS order per item. */
  const handleCartDownload = async () => {
    if (isNaplExperience && !cartItems[0]?.assets.product) {
      await openNaplOrder(cartItems);
      return;
    }

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
      else onClearCart();
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

  const sortedRows = useMemo(() => {
    const rows = results.map(item => ({
      item,
      label: item.properties?.order_key ? String(item.properties.order_key) : item.id,
    }));
    const sortKey = sort.key;
    if (sortKey === null) return rows;

    const factor = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sortKey === "id") return a.label.localeCompare(b.label, undefined, { numeric: true }) * factor;
      const va: unknown = a.item.properties?.[sortKey];
      const vb: unknown = b.item.properties?.[sortKey];
      const missingA = va === null || va === undefined || va === "";
      const missingB = vb === null || vb === undefined || vb === "";
      // Items without a value always sort last.
      if (missingA !== missingB) return missingA ? 1 : -1;
      if (missingA) return 0;
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : formatCell(sortKey, va).localeCompare(formatCell(sortKey, vb), undefined, { numeric: true });
      return cmp * factor;
    });
  }, [results, sort]);

  // Property columns offered by the current results, so any mission's fields are available.
  const candidateKeys = useMemo(() => {
    const found = new Set<string>();
    for (const item of results) {
      for (const key of Object.keys(item.properties ?? {})) {
        if (key !== DATE_KEY) found.add(key);
      }
    }
    const preferred = PREFERRED_COLUMNS.filter(k => found.has(k));
    return [...preferred, ...[...found].filter(k => !preferred.includes(k)).sort()];
  }, [results]);

  const visibleKeys = useMemo(() => {
    const saved = columnPrefs?.filter(k => candidateKeys.includes(k));
    // Saved favourites that this collection lacks fall back to the defaults.
    const selected = columnPrefs && (columnPrefs.length === 0 || saved!.length > 0) ? saved! : candidateKeys;
    if (!isNaplExperience) return selected;
    const naplFirst = ["roll_number", "photo_number"].filter(key => candidateKeys.includes(key));
    return [...naplFirst, ...selected.filter(key => !naplFirst.includes(key))];
  }, [columnPrefs, candidateKeys, isNaplExperience]);

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

  const metadataThumbUrl = activeMetadata ? buildThumbUrl(activeMetadata) : undefined;

  const handleExportResults = () => {
    if (isSearching || loadedResults.length === 0) return;
    setExportError(false);
    try {
      const collections = [...new Set(loadedResults.map(item => item.collection))];
      const collection = (collections.length === 1 ? collections[0] : "multiple-collections")
        .replace(/[<>:"/\\|?*]/g, "_");
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, "0");
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const content = JSON.stringify({ type: "FeatureCollection", features: loadedResults }, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: "application/geo+json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `eodms-${collection}-${loadedResults.length}-${timestamp}.json`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch {
      setExportError(true);
    }
  };

  const copyItemSource = async (item: STACItem) => {
    const json = JSON.stringify(item, null, 2);
    try {
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        const textArea = document.createElement("textarea");
        textArea.value = json;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("Clipboard copy failed");
      }
      setSourceCopyNotice("success");
    } catch {
      setSourceCopyNotice("error");
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
    const valiseActionLabel = `${t("naplValiseAdd")} (${t("naplValiseCount").replace("{count}", String(naplPhotoCounts.get(item.id) ?? 0))})`;

    if (compact) {
      const order = () => handleCreateOrder(item.id, orderKey ?? '', item.collection);
      const openOrder = (o: NonNullable<typeof associatedOrder>) => handleOrderLink(o.orderId, o.downloadUrl ?? null);
      let action = null;

      if (isNaplExperience && !canOrderItem) {
        action = (
          <Tooltip title={userId && authToken ? valiseActionLabel : t("loginToOrder")}>
            <span><IconButton size="small" color="primary" disabled={!userId || !authToken || naplSubmitting || naplOptionsLoading} aria-label={valiseActionLabel} onClick={() => void openNaplOrder([item])}>
              {renderValiseCount(item.id)}
            </IconButton></span>
          </Tooltip>
        );
      } else if (isOrderingSupported && canOrderItem) {
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
          {directAssets.length > 0 && <AssetDownloadButton assets={directAssets} compact />}
          {action}
        </>
      );
    }

    return (
      <>
        {directAssets.length > 0 && <AssetDownloadButton assets={directAssets} />}
        {isNaplExperience && !canOrderItem ? (
            <Button size="small" variant="outlined" startIcon={renderValiseCount(item.id)} aria-label={valiseActionLabel} disabled={!userId || !authToken || naplSubmitting || naplOptionsLoading} onClick={() => void openNaplOrder([item])}>
              {t("naplValiseAdd")}
            </Button>
        ) : isOrderingSupported && (
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

    const dateKey = results.some(i => Object.hasOwn(i.properties ?? {}, DATE_KEY)) ? DATE_KEY : undefined;
    const otherKeys = [...visibleKeys.filter(k => !isTemporalKey(k)), ...visibleKeys.filter(isTemporalKey)];

    return (
      <>
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
      <Table size="small" stickyHeader sx={{
        "& td, & th": { whiteSpace: "nowrap", py: 0.25, px: 0.75 },
        "& th:nth-of-type(-n+4), & td:nth-of-type(-n+4)": { width: "1%", px: 0.25 },
        "& .MuiTableCell-paddingCheckbox": { width: "1%", px: 0.25 },
      }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell padding="checkbox" />
            <TableCell padding="checkbox" aria-label={t("actions")} />
            {dateKey && sortCell(dateKey, columnLabel(dateKey), dateKey)}
            {sortCell("id", t("itemId"))}
            {otherKeys.map(key => sortCell(key, columnLabel(key), key))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map(({ item, label }) => {
            const isSelected = selectedFootprints.has(item.id);
            const itemColor = isSelected ? highlightColor : brandColor;
            const isHovered = item.id === hoveredItem;
            const isThumbnailActive = !!activeThumbnails[item.id];
            const isFocused = item.id === focusedItem;
            const isHighlighted = isSelected || isFocused;
            const thumbUrl = buildThumbUrl(item);

            return (
              <TableRow
                key={item.id}
                id={`result-row-${item.id}`}
                {...resultActivationHandlers(item, onZoom)}
                aria-label={`${t("zoomHover")} - ${label}`}
                onMouseEnter={() => onHoverItem(item.id)}
                onMouseLeave={() => onHoverItem(null)}
                sx={{
                  cursor: "pointer",
                  "&:focus-visible": { outline: `2px solid ${brandColor}`, outlineOffset: -2 },
                  bgcolor: isFocused ? alpha(brandColor, 0.1) : isSelected ? alpha(highlightColor, 0.12) : isHovered ? alpha(itemColor, 0.12) : undefined,
                  "& > td": isHighlighted ? { borderTop: `2px solid ${brandColor}`, borderBottom: `2px solid ${brandColor}` } : undefined,
                  "& > td:first-of-type": { borderLeft: isHighlighted ? `2px solid ${brandColor}` : `4px solid ${itemColor}` },
                  "& > td:last-of-type": isHighlighted ? { borderRight: `2px solid ${brandColor}` } : undefined,
                }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => handleCartToggle(item)}
                    slotProps={{ input: { "aria-label": label } }}
                    sx={{ p: 0.25, "&.Mui-checked": { color: highlightColor } }}
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
                {dateKey && <TableCell>{formatCell(dateKey, item.properties?.[dateKey], isNaplExperience)}</TableCell>}
                <TableCell sx={{ width: 160, maxWidth: 160, overflow: "hidden" }}>
                  <Tooltip title={`${item.collection} - ${label} - ${t("metadataHover")}`}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => setActiveMetadata(item)}
                      sx={{ display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", ...(isSelected && { color: highlightColor, textDecorationColor: highlightColor }) }}
                    >
                      {label}
                    </Link>
                  </Tooltip>
                </TableCell>
                {otherKeys.map(key => (
                  <TableCell key={key}>{formatCell(key, item.properties?.[key], isNaplExperience)}</TableCell>
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

      {isNaplExperience && (
        <Box sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
          <Button startIcon={<LuggageIcon />} onClick={() => void openNaplOrder([])} disabled={naplSubmitting || naplOptionsLoading}>
            {t("naplValise")} ({naplTargetItems.length})
          </Button>
          {naplStorageError && <Alert severity="warning">{t("naplValiseStorageError")}</Alert>}
        </Box>
      )}
      {cartItems.length > 0 && (
        <Box sx={{ px: 2, py: 0.5, display: "flex", alignItems: "center", gap: 1, bgcolor: alpha(brandColor, 0.08), borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title={`${t("cart")} (${cartItems.length})`}>
              <Badge badgeContent={cartItems.length} color="secondary" max={99} role="img" aria-label={`${t("cart")} (${cartItems.length})`}
                sx={{ ml: 0.5, '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16, px: 0.5 } }}>
                <ShoppingCartIcon fontSize="small" color="primary" />
              </Badge>
            </Tooltip>
            <ButtonGroup size="small" variant="outlined" aria-label={`${t('cart')} ${t('actions')}`}
              sx={{ '& .MuiButtonGroup-grouped': { minWidth: 34, px: 0.5, py: 0.5 } }}>
              <Tooltip title={cartLoginBlocked ? t("loginToOrder") : isNaplExperience && !cartItems[0]?.assets.product ? `${t("naplValiseAdd")} (${cartItems.length})` : t("downloadCartHover")}>
                <span>
                  <Button aria-label={isNaplExperience && !cartItems[0]?.assets.product ? `${t("naplValiseAdd")} (${cartItems.length})` : t("download")} disabled={cartBusy || cartLoginBlocked || naplSubmitting || naplOptionsLoading} onClick={handleCartDownload}>
                    {cartBusy ? <CircularProgress size={20} /> : isNaplExperience && !cartItems[0]?.assets.product ? <LuggageIcon fontSize="small" /> : <DownloadIcon fontSize="small" />}
                  </Button>
                </span>
              </Tooltip>
              {!isNaplExperience && <Tooltip title={cartItems.some(item => item.collection === 'Radarsat-1-FRED') ? t('processingCartHover') : t('processingSelectCandidate')}>
                <span>
                  <Button aria-label={t('processingPrepare')} disabled={!userId || !cartItems.some(item => item.collection === 'Radarsat-1-FRED')} onClick={onProcessCart}>
                    <ScienceIcon fontSize="small" />
                  </Button>
                </span>
              </Tooltip>}
            </ButtonGroup>
          </Box>
          <Tooltip title={t("emptyCartHover")}>
            <Button size="small" onClick={onClearCart} sx={{ ml: 'auto' }}>{t("clear")}</Button>
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
          results.map(item => {
            const isSelected = selectedFootprints.has(item.id);
            const itemColor = isSelected ? highlightColor : brandColor;
            const isHovered = item.id === hoveredItem;
            const isThumbnailActive = !!activeThumbnails[item.id];
            const isFocused = item.id === focusedItem;
            const isHighlighted = isSelected || isFocused;
            const thumbUrl = buildThumbUrl(item);
            const orderKey:string|null = item.properties?.order_key ? String(item.properties?.order_key) : null;
            const datetime = formatCell(DATE_KEY, item.properties?.[DATE_KEY], isNaplExperience);

            return (
              <Card
                key={item.id}
                id={`result-card-${item.id}`}
                {...resultActivationHandlers(item, onZoom)}
                aria-label={`${t("zoomHover")} - ${orderKey ?? item.id}`}
                onMouseEnter={() => onHoverItem(item.id)}
                onMouseLeave={() => onHoverItem(null)}
                sx={{
                  mb: 1,
                  cursor: "pointer",
                  "&:focus-visible": { outline: `2px solid ${brandColor}`, outlineOffset: -2 },
                  position: "relative",
                  borderRadius: 0,
                  borderLeft: `4px solid ${itemColor}`,
                  bgcolor: isFocused ? alpha(brandColor, 0.1) : isSelected ? alpha(highlightColor, 0.12) : "background.paper",
                  outline: isHighlighted ? `2px solid ${brandColor}` : undefined,
                  outlineOffset: isHighlighted ? "-2px" : undefined,
                  boxShadow: isHovered && !isSelected ? `0 0 0 2px ${alpha(itemColor, 0.6)}` : undefined,
                  transition: "box-shadow 150ms ease",
                }}
              >
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onChange={() => handleCartToggle(item)}
                  slotProps={{ input: { "aria-label": `${t("cart")} - ${item.collection} - ${orderKey ?? item.id}` } }}
                  sx={{
                    position: "absolute", top: 6, right: 6, zIndex: 2,
                    width: 32, height: 32, p: 0.5, borderRadius: 1,
                    bgcolor: alpha(theme.palette.background.paper, 0.94),
                    "&:hover": { bgcolor: "background.paper" },
                    "&.Mui-checked": { color: highlightColor },
                  }}
                />
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
                    p: 1,
                    "&:last-child": { pb: 1 },
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: "1 1 0", minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap title={item.collection}>
                      {item.collection}
                    </Typography>
                    <Tooltip title={`${item.collection} - ${orderKey ?? item.id} - ${t("metadataHover")}`}>
                      <Link
                        component="button"
                        variant="body2"
                        aria-label={`${item.collection} - ${orderKey ?? item.id}`}
                        onClick={() => setActiveMetadata(item)}
                        sx={{
                          display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          textAlign: "left",
                          ...(isSelected && { color: highlightColor, textDecorationColor: highlightColor }),
                        }}
                      >
                        {orderKey ?? item.id}
                      </Link>
                    </Tooltip>
                    {datetime && (
                      <Typography variant="caption" color="text.secondary" component="div" noWrap
                        title={String(item.properties?.[DATE_KEY])}>
                        {datetime}
                      </Typography>
                    )}
                  </Box>
                  <CardActions disableSpacing sx={{ p: 0, gap: 0.25, flexShrink: 0, maxWidth: "50%", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {renderOrderActions(item, true)}
                  </CardActions>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      {(totalDiscoveredPages > 1 || hasNext || results.length > 0) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mt: 1,
            mb: 1,
            flexWrap: "nowrap",
            minWidth: 0,
          }}
        >
          {(totalDiscoveredPages > 1 || hasNext) && <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25, flex: "1 1 0", minWidth: 0, flexWrap: "nowrap" }}>
          <Tooltip title={t("previousHover")}>
            <IconButton
              size="small"
              aria-label={t("previousHover")}
              onClick={onPreviousPage}
              disabled={!hasPrevious}
              sx={{ flexShrink: 0 }}
            >
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ minWidth: 0, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            <Pagination
              count={totalDiscoveredPages}
              page={currentPage}
              onChange={(_, page) => onGoToPage(page)}
              size="small"
              color="primary"
              siblingCount={0}
              boundaryCount={1}
              hidePrevButton
              hideNextButton
              getItemAriaLabel={(_, page) => `${t("pageHover")} ${page}`}
              sx={{
                "& .MuiPagination-ul": { flexWrap: "nowrap" },
                "& .MuiPaginationItem-root": { minWidth: 24, height: 28, mx: 0, px: 0.5 },
              }}
            />
          </Box>

          {hasNext && currentPage === totalDiscoveredPages && (
            <Typography variant="body2" sx={{ alignSelf: "center", flexShrink: 0 }}>
              ...
            </Typography>
          )}

          <Tooltip title={t("nextHover")}>
            <IconButton size="small" aria-label={t("nextHover")} onClick={onNextPage} disabled={!hasNext} sx={{ flexShrink: 0 }}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
          </Box>}
          <Box sx={{ ml: "auto", mr: 1, display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <ButtonGroup size="small" variant="outlined" aria-label={`${t("zoomToResultExtents")}, ${t("exportResults")}, ${t("columns")}`}
              sx={{ "& .MuiButtonGroup-grouped": { minWidth: 34, p: 0.5 } }}>
              <Tooltip title={t("zoomToResultExtents")}>
                <span>
                  <Button aria-label={t("zoomToResultExtents")} disabled={results.length === 0} onClick={onZoomToResults}>
                    <ZoomOutMapIcon fontSize="small" />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={`${t("exportResults")} (${loadedResults.length.toLocaleString()})`}>
                <span>
                  <Button aria-label={`${t("exportResults")} (${loadedResults.length.toLocaleString()})`}
                    disabled={isSearching || loadedResults.length === 0} onClick={handleExportResults}>
                    <Badge badgeContent={loadedResults.length.toLocaleString()} color="secondary"
                      sx={{ mr: loadedResults.length >= 1000 ? 1.5 : 0.5, "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16, px: 0.5 } }}>
                      <DownloadIcon fontSize="small" />
                    </Badge>
                  </Button>
                </span>
              </Tooltip>
              {view === "table" && !isSearching && results.length > 0 && (
                <Tooltip title={t("columns")}>
                  <Button aria-label={t("columns")} aria-haspopup="menu" aria-expanded={!!columnMenuEl}
                    onClick={event => setColumnMenuEl(event.currentTarget)}>
                    <ViewColumnIcon fontSize="small" />
                  </Button>
                </Tooltip>
              )}
            </ButtonGroup>
          </Box>
        </Box>
      )}

      <Dialog open={naplDialogOpen} onClose={() => !naplSubmitting && setNaplDialogOpen(false)} maxWidth="md" fullWidth
        slotProps={{ paper: { sx: { maxWidth: 640 } } }}>
        <DialogTitle>{t("naplValise")}</DialogTitle>
        <DialogContent dividers sx={{ display: "grid", gap: 3, py: 3, px: { xs: 2, sm: 3 } }}>
          {naplError && <Alert severity="error">{naplError}</Alert>}
          {naplStorageError && <Alert severity="warning">{t("naplValiseStorageError")}</Alert>}
          {naplOptionsLoading ? <CircularProgress size={24} /> : naplOptions && naplTargetItems.map(item => naplItemOptions[item.id] && (
            <Box key={item.id} component="section" aria-labelledby={`napl-entry-${item.id}`}
              sx={{ minWidth: 0, "& + section": { borderTop: 1, borderColor: "divider", pt: 3 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                <Typography id={`napl-entry-${item.id}`} variant="subtitle2" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  {item.label}
                </Typography>
                <Tooltip title={t("naplValiseDuplicate")}>
                  <span><IconButton size="small" aria-label={t("naplValiseDuplicate")} disabled={naplSubmitting || naplTargetItems.length >= 100}
                    onClick={() => setNaplTargetItems(previous => [...previous, { ...item, id: crypto.randomUUID(), options: { ...item.options } }])}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton></span>
                </Tooltip>
                <Tooltip title={t("naplValiseRemove")}>
                  <span><IconButton size="small" color="error" aria-label={t("naplValiseRemove")} disabled={naplSubmitting}
                    onClick={() => { setNaplTargetItems(previous => previous.filter(entry => entry.id !== item.id)); setNaplError(null); }}>
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton></span>
                </Tooltip>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                <TextField size="small" type="number" fullWidth label={t("naplQuantity")} value={item.quantity} disabled={naplSubmitting}
                  slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1, "aria-label": `${t("naplQuantity")}: ${item.label}` } }}
                  onChange={event => {
                    const quantity = Number(event.target.value);
                    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 2147483647) {
                      setNaplTargetItems(previous => previous.map(entry => entry.id === item.id ? { ...entry, quantity } : entry));
                    }
                  }} />
                <TextField select size="small" fullWidth label={t("naplMediaType")} disabled={naplSubmitting}
                  value={naplItemOptions[item.id].media_type} onChange={event => updateNaplItemOptions(item.id, { media_type: event.target.value })}>
                  {naplOptions.media_types.map(value => <MenuItem key={value} value={value}>{naplMediaLabels[value] ?? value}</MenuItem>)}
                </TextField>
                {!!naplOptions.media_type_options[item.options.media_type]?.file_formats.length && (
                <TextField select size="small" fullWidth label={t("naplFileFormat")}
                  disabled={naplSubmitting}
                  slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
                  value={naplItemOptions[item.id].file_format ?? ""} onChange={event => updateNaplItemOptions(item.id, { file_format: event.target.value })}>
                  {(naplOptions.media_type_options[item.options.media_type]?.file_formats ?? []).map(value => <MenuItem key={value} value={value}>{value === "ContactPrint" ? t("naplContactPrint") : value === "Enlargement" ? t("naplEnlargement") : value}</MenuItem>)}
                </TextField>
                )}
                {!!naplOptions.media_type_options[item.options.media_type]?.image_resolutions.length && (
                <TextField select size="small" fullWidth label={t("naplImageResolution")}
                  disabled={naplSubmitting}
                  slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
                  value={naplItemOptions[item.id].image_resolution === undefined ? "" : String(naplItemOptions[item.id].image_resolution)} onChange={event => updateNaplItemOptions(item.id, { image_resolution: Number(event.target.value) })}>
                  {(naplOptions.media_type_options[item.options.media_type]?.image_resolutions ?? []).map(value => <MenuItem key={value} value={String(value)}>{value}</MenuItem>)}
                </TextField>
                )}
                {naplOptions.flight_line_index_maps.length > 0 && (
                <TextField select size="small" fullWidth label={t("naplFlightLineIndexMap")}
                  sx={{ gridColumn: "1 / -1" }} disabled={naplSubmitting}
                  slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
                  value={naplItemOptions[item.id].flight_line_index_map ?? ""}
                  onChange={event => updateNaplItemOptions(item.id, {
                    flight_line_index_map: event.target.value === "PDF" || event.target.value === "Paper" ? event.target.value : undefined,
                  })}>
                  <MenuItem value="">{t("naplMapNotRequested")}</MenuItem>
                  {naplOptions.flight_line_index_maps.map(value => <MenuItem key={value} value={value}>{value === "Paper" ? t("naplMapPaper") : value}</MenuItem>)}
                </TextField>
                )}
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button color="error" startIcon={<DeleteOutlinedIcon />} sx={{ mr: "auto" }}
            disabled={naplSubmitting || naplOptionsLoading || naplTargetItems.length === 0}
            onClick={() => { setNaplTargetItems([]); setNaplError(null); }}>
            {t("naplValiseEmpty")}
          </Button>
          <Button onClick={() => setNaplDialogOpen(false)} disabled={naplSubmitting}>{t("naplValiseContinue")}</Button>
          <Button variant="contained" onClick={() => void handleNaplSubmit()} disabled={naplSubmitting || naplOptionsLoading || !userId || !authToken || !naplSelectionValid}>
            {naplSubmitting ? <CircularProgress size={18} /> : t("naplOrderAction")}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!naplNotice} autoHideDuration={6000} onClose={() => setNaplNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" onClose={() => setNaplNotice(null)}>{naplNotice}</Alert>
      </Snackbar>
      <Dialog open={!!naplConfirmation} onClose={() => setNaplConfirmation(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("naplOrderSubmitted")}</DialogTitle>
        <DialogContent dividers sx={{ display: "grid", gap: 1.5 }}>
          <Alert severity="success">{t("naplCheckEmail")}</Alert>
          <Typography variant="body2">{t("naplOrderFollowup")}</Typography>
          {naplConfirmation && <>
            <Typography variant="subtitle2">{t("naplOrderSummary")}</Typography>
            {naplConfirmation.orderId && <Typography variant="body2">{t("orderId")}: {naplConfirmation.orderId}</Typography>}
            <Typography variant="body2">{naplConfirmation.items.length} {t("itemId")}{naplConfirmation.items.length === 1 ? "" : "s"}</Typography>
            <Typography variant="body2">{t("naplTotalQuantity")}: {naplConfirmation.items.reduce((total, item) => total + item.quantity, 0)}</Typography>
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {naplConfirmation.items.map(item => (
                <Box key={item.id} sx={{ borderTop: 1, borderColor: "divider", pt: 1, overflowWrap: "anywhere" }}>
                  <Typography variant="subtitle2">{item.label}</Typography>
                  <Typography variant="body2">{t("naplQuantity")}: {item.quantity}</Typography>
                  <Typography variant="body2">{t("naplMediaType")}: {naplMediaLabels[item.options.media_type] ?? item.options.media_type}</Typography>
                  {item.options.file_format !== undefined && <Typography variant="body2">{t("naplFileFormat")}: {item.options.file_format}</Typography>}
                  {item.options.image_resolution !== undefined && <Typography variant="body2">{t("naplImageResolution")}: {item.options.image_resolution}</Typography>}
                  <Typography variant="body2">{t("naplFlightLineIndexMap")}: {item.options.flight_line_index_map === "Paper"
                    ? t("naplMapPaper") : item.options.flight_line_index_map ?? t("naplMapNotRequested")}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
              <NaplContactInfo />
            </Box>
          </>}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setNaplConfirmation(null)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!cartError} autoHideDuration={5000} onClose={() => setCartError(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="warning" onClose={() => setCartError(null)}>{cartError}</Alert>
      </Snackbar>

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
          {metadataThumbUrl && activeMetadata && (
            <Box
              component="img"
              src={metadataThumbUrl}
              alt={`${activeMetadata.collection} - ${activeMetadata.id}`}
              sx={{ display: "block", width: "100%", height: { xs: 180, sm: 240 }, objectFit: "contain", bgcolor: "action.hover", mb: 2 }}
            />
          )}
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
          {activeMetadata && (isNaplExperience
            ? !activeMetadata.assets.product
            : isOrderingSupported && !!activeMetadata.assets.product) && renderOrderActions(activeMetadata)}
            {activeMetadata && 
              (<Tooltip title={t("copyStacJsonTooltip")}>
                <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={() => void copyItemSource(activeMetadata)}>
                  {t("copyStacJson")}
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
      <Snackbar open={exportError} autoHideDuration={5000} onClose={() => setExportError(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" onClose={() => setExportError(false)}>{t("errorExportResults")}</Alert>
      </Snackbar>
      <Snackbar open={!!sourceCopyNotice} autoHideDuration={4000} onClose={() => setSourceCopyNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={sourceCopyNotice === "success" ? "success" : "error"} onClose={() => setSourceCopyNotice(null)}>
          {sourceCopyNotice === "success" ? t("stacJsonCopied") : t("stacJsonCopyFailed")}
        </Alert>
      </Snackbar>
    </Box>
  );
}
