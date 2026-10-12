import { useState, useContext, useEffect, useRef } from 'react';
import { Avatar, Box, Divider, Drawer, Fab, IconButton, AppBar, Toolbar, Typography, Button, Tooltip, Snackbar, Alert, Badge, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { AppContext } from '../AppContext';
import StacMap from '../components/StacMap';
import SearchPanel from '../components/SearchPanel';
import ResultsPanel from '../components/ResultsPanel';
import AuthPanel from '../components/AuthPanel';
import TermsOfUseDialog from '../components/TermsOfUseDialog';
import type { STACCollection, STACItem } from '../types';
import { createDateRange, formatStacDate } from '../utils/DateUtils';
import { buildFilter } from '../utils/FilterBuilder';
import LoadingMask from '../components/masker/LoadingMask';
import { StacSearchService } from '../services/StacSearchService';
import type { StacSearchParams, StacSearchResult } from '../services/StacSearchService';
import LogoutPanel from '../components/LogoutPanel';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import OrderPanel from '../components/OrderPanel';
import ProcessingPanel from '../components/ProcessingPanel';
import { useProcessingJobs } from '../hooks/useProcessingJobs';
import type { ProcessingJob, ProcessingSubmission } from '../services/ProcessingService';
import ScienceIcon from '@mui/icons-material/Science';
import OrderReadyNotifier from '../components/OrderReadyNotifier';
import PreferencesPanel from '../components/PreferencesPanel';
import { useIsMobile, getInitials } from '../utils/RenderingUtils';
import { getItemsExtent } from '../utils/GeometryUtils';
import axios from 'axios';
import type { ExplorerExperience } from '../experiences';
import { OrbitLoader, SkyBar, TitleCharm } from '../components/OrbitCharm';
import Blind from '../components/Blind';
import { BlindContainerContext } from '../components/BlindContainerContext';

const DRAWER_WIDTH = 320;
// Matches useIsMobile's default so the first render agrees with it.
const MOBILE_BREAKPOINT = 768;

const barButtonSx = (active: boolean) => ({
  width: 34,
  height: 34,
  borderRadius: 1.5,
  color: active ? 'primary.main' : 'text.secondary',
  bgcolor: active ? 'action.selected' : 'transparent',
  '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16, px: 0.5 },
});
// Side panels cast onto the map and sit tucked under the top bar's shadow.
const TOP_TUCK_SHADOW = 'inset 0 10px 8px -8px rgba(0,0,0,0.35)';

/**
 * Main application layout and state controller for the GEO.CA STAC Explorer.
 * Coordinates data flow between the Map, Search Panel, and Results Panel.
 * * @returns {JSX.Element} The rendered Landing Screen layout.
 */
interface LandingScreenProps {
  experience: ExplorerExperience;
}

export default function LandingScreen({ experience }: LandingScreenProps) {
const { stacEndpoint, searchLimit, setSearchLimit, searchTemporal, setSearchTemporal, searchStartDate, setSearchStartDate, searchEndDate, setSearchEndDate,
    username, authToken, getValidAuthToken, isAuthOpen, setIsAuthOpen,
    displayMode, bbox, setBbox, filters, language, setLanguage, t } = useContext(AppContext)!;
  
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const [manualTermsOpen, setManualTermsOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(() => !window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches);
  const [rightOpen, setRightOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<STACItem[]>([]);
  const [processingCandidateId, setProcessingCandidateId] = useState<string | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState<{ username: string; submission: ProcessingSubmission; job: ProcessingJob | null; processId: string; itemId: string } | null>(null);
  const [submissionToastOpen, setSubmissionToastOpen] = useState(false);
  const { jobs: processingJobs, error: processingJobsError, refreshJobs, registerJob, clearProcessingHistory } = useProcessingJobs(experience.id === 'eodms' ? username : null, getValidAuthToken);
  const [numberMatched, setNumberMatched] = useState<number | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<STACCollection[]>(() =>
    experience.fixedCollectionId
      ? [{ id: experience.fixedCollectionId, description: '', links: [] }]
      : [],
  );
  const [zoomBounds, setZoomBounds] = useState<[number, number, number, number] | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedFootprints, setSelectedFootprints] = useState<Set<string>>(() => new Set());
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeThumbnails, setActiveThumbnails] = useState<Record<string, string>>({});

  const [clearAoiTrigger, setClearAoiTrigger] = useState(0);
  const [supportsSearch, setSupportsSearch] = useState<boolean>(false);
  const [supportsSorting, setSupportsSorting] = useState<boolean>(false);
  const [sortby, setSortby] = useState<string>('-datetime');

  const isMobile = useIsMobile(MOBILE_BREAKPOINT);

  // On phones each panel fills the screen, so only one is open at a time.
  const showLeftPanel = (open: boolean) => {
    setLeftOpen(open);
    if (open && isMobile) setRightOpen(false);
  };
  const showRightPanel = (open: boolean) => {
    setRightOpen(open);
    if (open && isMobile) setLeftOpen(false);
  };
  const firstName = username?.trim().split(/\s+/)[0];
  const endpointMap = import.meta.env.VITE_EODMS_ENDPOINTS;
  const directStacEndpoint = /^https?:\/\//i.test(stacEndpoint);
  const activeStacOrigin = directStacEndpoint
    ? new URL(stacEndpoint).origin
    : import.meta.env.DEV ? endpointMap.eodmsDomain : window.location.origin;
  const activeApiOrigin = import.meta.env.DEV ? endpointMap.eodmsDomain : activeStacOrigin;
  const productionHostname = new URL(endpointMap.productionDomain).hostname.toLowerCase().replace(/^www\./, "");
  const activeStacHostname = new URL(activeStacOrigin, window.location.origin).hostname.toLowerCase().replace(/^www\./, "");
  const showStagingBadge = activeStacHostname !== productionHostname;
  const effectiveSearchEndpoint = directStacEndpoint
    ? stacEndpoint
    : `${activeStacOrigin}${stacEndpoint.startsWith("/") ? "" : "/"}${stacEndpoint}`;
  const effectiveNaplOrigin = import.meta.env.DEV
    ? endpointMap.stagingDomain || activeApiOrigin
    : activeStacOrigin;
  const stagingEndpointTooltip = [
    t("stagingEndpointTooltip"),
    `${t("endpointAAA")}: ${activeApiOrigin}/aaa/v1`,
    `${t("endpointSearch")}: ${effectiveSearchEndpoint}`,
    `${t("endpointDDS")}: ${activeApiOrigin}/dds/v1/item`,
    `${t("endpointProcessing")}: ${activeApiOrigin}/processing`,
    `${t("endpointNapl")}: ${effectiveNaplOrigin}/napl/v1`,
  ].join("\n");
  const proxyEndpointTooltip = [
    t("proxyEndpointTooltip"),
    `${t("endpointAAA")}: /aaa/v1/* -> ${endpointMap.localAaaProxy}/aaa/v1/* -> ${endpointMap.eodmsDomain}/aaa/v1/*`,
    `${t("endpointSearch")}: /search/* -> ${endpointMap.eodmsDomain}/search/*`,
    `${t("endpointDDS")}: /dds/* -> ${endpointMap.eodmsDomain}/dds/*`,
    `${t("endpointProcessing")}: /processing/* -> ${endpointMap.eodmsDomain}/processing/*`,
    `${t("endpointNapl")}: /napl/v1/* -> ${endpointMap.stagingDomain}/napl/v1/*`,
  ].join("\n");

  /**
   * Calculates the appropriate width for the Search & Result panels
   * @returns the width to set the panels to
   */
  const calcDrawerWidth = (): number | string => {
    if(isMobile) {
      // screen.width is the monitor's width, not the viewport's, so narrow desktop windows overflowed.
      return '100%';
    }
    else {
      return DRAWER_WIDTH
    }
  }

  const [searchService] = useState(() => new StacSearchService(stacEndpoint, setSupportsSorting, setSupportsSearch));

  // Keep the endpoint in sync; the service already checked the initial endpoint on creation.
  const lastEndpoint = useRef(stacEndpoint);
  useEffect(() => {
    if (lastEndpoint.current === stacEndpoint) return;
    lastEndpoint.current = stacEndpoint;
    searchService.setEndpoint(stacEndpoint, setSupportsSorting, setSupportsSearch);
  }, [searchService, stacEndpoint]);

  useEffect(() => {
    const timer = setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 300);
    return () => clearTimeout(timer);
  }, [leftOpen, rightOpen]);

  const [pagingState, setPagingState] = useState<{
    hasNext: boolean;
    hasPrevious: boolean;
    currentPage: number;
    totalDiscoveredPages: number;
  }>({ hasNext: false, hasPrevious: false, currentPage: 1, totalDiscoveredPages: 1 });
  // Limit used by the active search, so later changes to the setting don't shift result numbering.
  const [pageSize, setPageSize] = useState(searchLimit);
  const resultNumberOffset = (pagingState.currentPage - 1) * pageSize;
  const [discovered, setDiscovered] = useState({ count: 0, hasMore: false });

  /**
   * Creates the applicable headers needed for the STAC API request. 
   * 
   * @returns the applicable headers needed for the STAC API request.
   */
  const getHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (authToken) {
      try {
        headers['Authorization'] = `Bearer ${await getValidAuthToken()}`;
      } catch (e) {
        setIsSearching(false);
        setRightOpen(false);
        throw e;
      }
    }

    return headers;
  };

  const handleSearchResult = (result: StacSearchResult, zoomToResults = true) => {
    setSearchResults(result.items);
    setSelectedFootprints(new Set());
    setFocusedItem(null);
    const throughThisPage = (result.currentPage - 1) * pageSize + result.items.length;
    setDiscovered(prev => throughThisPage >= prev.count ? { count: throughThisPage, hasMore: result.hasNext } : prev);
    const extent = getItemsExtent(result.items);
    if (extent && zoomToResults) setZoomBounds(extent);
    setPagingState({
      hasNext: result.hasNext,
      hasPrevious: result.hasPrevious,
      currentPage: result.currentPage,
      totalDiscoveredPages: result.totalDiscoveredPages,
    });
  };

  /**
   * Called when the next page of results is requested. 
   */
  const handleNextPage = async () => {
    try {
      const result = await searchService.nextPage(await getHeaders());
      handleSearchResult(result);
    } catch {
      setSearchError(t('errorFetch'));
    }
  };

  /**
   * Called when the previous page of results is requested.
   */
  const handlePreviousPage = async () => {
    try {
      const result = await searchService.previousPage(await getHeaders());
      handleSearchResult(result);
    } catch {
      setSearchError(t('errorFetch'));
    }
  };

  /**
   * Called when a particular page of results is requested. 
   */
  const handleGoToPage = async (page: number) => {
    try {
      const result = await searchService.goToPage(page, await getHeaders());
      handleSearchResult(result);
    } catch {
      setSearchError(t('errorFetch'));
    }
  };

  /**
   * Toggles the selection state of a STAC item footprint.
   * Toggles whether a STAC item is checked (in the cart).
   * Automatically sets the map zoom bounds to the item when it is checked.
   * * @param {STACItem} item - The STAC item to toggle.
   */
  const handleToggleFootprint = (item: STACItem) => {
    setSelectedFootprints(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);

        if(isMobile) {
          setRightOpen(false);
        }

        setZoomBounds(getItemsExtent([item]));
      }
      return next;
    });
  };

  /**
   * Updates the zoomBounds, causing the map to zoom to those coordinates
   * Also closes the Results panel if the App is being viewed via a mobile device
   * @param item The result item to zoom to
   */
  const handleZoom =  (item: STACItem) => {
    if(isMobile) {
      setRightOpen(false);
    }
    
    setZoomBounds(getItemsExtent([item]));
  }

  /**
   * Clears the current results as well as the current AOI. 
   */
  const handleOnResultsClear = () => {
    setSearchResults([]);
    setProcessingCandidateId(null);
    setSelectedFootprints(new Set());
    setActiveThumbnails({});
    setFocusedItem(null);
    setClearAoiTrigger(prev => prev + 1); // increment to trigger AOI clear effect. 
    setBbox(null);
    console.log(pagingState);
    setPagingState({ hasNext: false, hasPrevious: false, currentPage: 1, totalDiscoveredPages: 1 });
    setNumberMatched(null);
    setDiscovered({ count: 0, hasMore: false });
    searchService.reset();
  }; 

  /**
   * Toggles the visibility of a STAC item's thumbnail image overlay on the map.
   * * @param {string} id - The unique identifier of the STAC item.
   * @param {string | undefined} url - The URL of the thumbnail image asset.
   */
  const handleToggleThumbnail = (id: string, url: string | undefined) => {
    if (!url) return;
    setActiveThumbnails(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      }
      else {
        next[id] = url;

        if(isMobile) {
          setRightOpen(false);
        }
      }
      return next;
    });
  };

  /**
   * Sets focus to a specific item when its footprint is clicked on the map.
   * Opens the right panel to ensure the item details are visible.
   * * @param {string} id - The unique identifier of the clicked STAC item.
   */
  const handleMapFeatureClick = (id: string) => {
    setFocusedItem(id);
    showRightPanel(true); 
  };

  /**
   * Executes STAC API search queries, optionally within an Area of Interest (AOI).
   * Constructs the payload, applies temporal/spatial/queryables filters, and updates the search results state.
   * * @async
   * @param {[number, number, number, number]} searchBbox - Optional bounding box [West, South, East, North].
   */
  const handleSearch = async (searchBbox?: [number, number, number, number], zoomToResults = true) => {
    const collectionIDs = experience.fixedCollectionId
      ? [experience.fixedCollectionId]
      : selectedCollections.map(collection => collection.id);

    if (collectionIDs.length === 0) {
      setSearchError(t("errorSelectCollection"));
      return;
    }

    setSearchError(null);
    setSelectedFootprints(new Set());
    setActiveThumbnails({});
    setFocusedItem(null);
    setDiscovered({ count: 0, hasMore: false });

    const params: StacSearchParams = {
      ...(searchBbox && { bbox: searchBbox }),
      collections: collectionIDs,
      limit: searchLimit,
      ...(selectedCollections.length <= 1 && {sortby}),
    };

    if (searchTemporal !== "anytime") {
      let startStr = "..", endStr = "..";
      if (searchTemporal === "custom") {
        if (searchStartDate) {
          startStr = formatStacDate(new Date(`${searchStartDate}Z`));
        }
        if (searchEndDate) {
          endStr = formatStacDate(new Date(`${searchEndDate}Z`));
        }

      } else {
          const dates = createDateRange(searchTemporal);
          startStr = dates[0];
          endStr = dates[1];
        }

        if (startStr !== ".." || endStr !== "..") {
          params.datetime = `${startStr}/${endStr}`;
        }
    }

    if (selectedCollections.length === 1) {
      const collectionFilters = filters[collectionIDs[0]];
      const filtersText = buildFilter(collectionFilters);
      if (filtersText && filtersText.length > 0) {
        params.filter = filtersText;
      }
    }

    setIsSearching(true);
    showRightPanel(true);

    try {
      const result = await searchService.search(params, await getHeaders());
      setPageSize(params.limit);
      handleSearchResult(result, zoomToResults);
      setNumberMatched(searchService.getNumberMatched());
    } catch (e) {
      if (axios.isCancel(e)) return;
      setSearchError(t('errorFetch'));
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const searchWithCurrentAoi = () => {
    const currentBbox = bbox?.split(',').map(Number);
    const searchBbox = currentBbox?.length === 4 && currentBbox.every(Number.isFinite)
      ? currentBbox as [number, number, number, number]
      : undefined;

    handleSearch(searchBbox);
  };

  const [openBlind, setOpenBlind] = useState<'orders' | 'preferences' | 'processing' | null>(null);
  const isPreferencesOpen = openBlind === 'preferences';
  const isOrdersOpen = openBlind === 'orders';
  const isProcessingOpen = openBlind === 'processing';
  const processingCandidates = searchResults.filter(item => selectedFootprints.has(item.id) && item.collection === 'Radarsat-1-FRED');
  const processingCandidate = processingCandidates.find(item => item.id === processingCandidateId) ?? processingCandidates[0] ?? null;
  const toggleBlind = (blind: 'orders' | 'preferences' | 'processing') => {
    setIsAuthOpen(false);
    setOpenBlind(current => current === blind ? null : blind);
  };

  // On phones, the device back button closes whatever panel or blind is covering the map.
  const overlayOpen = isMobile && (leftOpen || rightOpen || isAuthOpen || openBlind !== null);
  useEffect(() => {
    if (!overlayOpen) return;
    window.history.pushState({ eodmsOverlay: true }, '');
    const onPopState = () => {
      // Landing back on one of our own entries (e.g. after a StrictMode remount) isn't a user "back".
      if (window.history.state?.eodmsOverlay) return;
      setLeftOpen(false);
      setRightOpen(false);
      setIsAuthOpen(false);
      setOpenBlind(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // Closed from the UI: drop the history entry we added.
      if (window.history.state?.eodmsOverlay) window.history.back();
    };
  }, [overlayOpen, setIsAuthOpen]);

  // Load data directly from localStorage
  const getLocalOrdersCount = (): number => {
    if (!username) {
      return 0;
    }

    try {
      const raw = localStorage.getItem(`orders_${username}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <BlindContainerContext.Provider value={contentEl}>
    <Box sx={{ display: 'flex', height: '100vh', width: '100%', flexDirection: 'column', overflow: 'hidden' }}>
      <AppBar position="static" color="default" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1}}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => showLeftPanel(!leftOpen)}><MenuIcon /></IconButton>
          <Box
            component="a"
            href={`https://www.canada.ca/${language}.html`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'flex', alignItems: 'center', ml: 1, mr: 1.5, flexShrink: 0 }}
          >
            <Box
              component="img"
              src="https://www.eodms-sgdot.nrcan-rncan.gc.ca/GCWeb/assets/sig-spl.svg"
              alt={t('governmentOfCanada')}
              sx={{
                height: 22,
                // On narrow screens show only the flag symbol (the left 155 of 819 viewBox units).
                width: isMobile ? Math.round(22 * 155.4 / 75.97) : Math.round(22 * 819 / 75.97),
                objectFit: 'cover',
                objectPosition: 'left',
                // Official all-white monochrome form on dark backgrounds.
                filter: displayMode === 'dark' ? 'brightness(0) invert(1)' : 'none',
              }}
            />
          </Box>
          <Divider orientation="vertical" flexItem variant="middle" sx={{ mr: 1.5 }} />
          <Typography variant="h6" color="primary" noWrap sx={{ flexShrink: 0 }}>
            <TitleCharm title={t(experience.titleKey)} accent={experience.titleAccentKey && t(experience.titleAccentKey)} />
          </Typography>
          {showStagingBadge && (
            <Tooltip title={stagingEndpointTooltip} slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line', maxWidth: 440 } } }}>
              <Chip label="STAGING" size="small" color="warning" sx={{ height: 22, fontWeight: 700, flexShrink: 0 }} />
            </Tooltip>
          )}
          {import.meta.env.VITE_EODMS_SHOW_PROXY_BADGE && (
            <Tooltip title={proxyEndpointTooltip} slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line', maxWidth: 520 } } }}>
              <Chip label="PROXY" size="small" color="info" sx={{ height: 22, fontWeight: 700, flexShrink: 0 }} />
            </Tooltip>
          )}

          {/* empty to make widgets below align right */}
          <Box sx={{ flexGrow: 1 }}></Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, p: '2px', border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Tooltip title={authToken && firstName ? `${t('hello')}${firstName}` : t('provideAuth')}>
              <IconButton
                onClick={() => { setOpenBlind(null); setIsAuthOpen(!isAuthOpen); }}
                sx={barButtonSx(isAuthOpen)}
              >
                {authToken ? (
                  <Avatar sx={{ width: 24, height: 24, fontSize: 11, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                    {getInitials(username) || <PersonOutlineIcon sx={{ fontSize: 16 }} />}
                  </Avatar>
                ) : <PersonOutlineIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {username && (
              <Tooltip title={t('viewActiveProcessing')}>
                <IconButton onClick={() => toggleBlind('orders')} sx={barButtonSx(isOrdersOpen)}>
                  <Badge badgeContent={getLocalOrdersCount()} color="warning" max={99}>
                    <ShoppingBagIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            {username && experience.id === 'eodms' && (
              <Tooltip title={`${t('processingJobs')} (${processingJobs?.length ?? 0})`}>
                <IconButton aria-label={`${t('processingJobs')} (${processingJobs?.length ?? 0})`} onClick={() => toggleBlind('processing')} sx={barButtonSx(isProcessingOpen)}>
                  <Badge badgeContent={processingJobs?.length ?? 0} color="secondary" max={99}>
                    <ScienceIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={t('preferences')}>
              <IconButton onClick={() => toggleBlind('preferences')} sx={barButtonSx(isPreferencesOpen)}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <PreferencesPanel 
              open={isPreferencesOpen} 
              onClose={() => setOpenBlind(null)}
            />

            <Tooltip title={t('toggleResults')}>
              <IconButton onClick={() => showRightPanel(!rightOpen)} sx={barButtonSx(rightOpen)}>
                <Badge badgeContent={discovered.count > 0 ? `${discovered.count}${discovered.hasMore ? '…' : ''}` : 0} color="secondary"><ViewSidebarIcon fontSize="small" /></Badge>
              </IconButton>
            </Tooltip>
          </Box>

          <Button
            size="small"
            lang={language === 'en' ? 'fr' : 'en'}
            aria-label={language === 'en' ? 'Français' : 'English'}
            onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
            sx={{ ml: 1.5, minWidth: 0, textTransform: 'none', textDecoration: 'underline', fontWeight: 400 }}
          >
            {isMobile ? (language === 'en' ? 'FR' : 'EN') : (language === 'en' ? 'Français' : 'English')}
          </Button>

          <Blind open={isAuthOpen} onClose={() => setIsAuthOpen(false)} align="right" width={420}>
            {(() => {
              const termsLink = (
                <Button
                  size="small"
                  startIcon={<DescriptionOutlinedIcon />}
                  onClick={() => {
                    setIsAuthOpen(false);
                    setManualTermsOpen(true);
                  }}
                  sx={{ textTransform: 'none', color: 'text.secondary', ml: -0.5 }}
                >
                  {t('termsOfUseTitle')}
                </Button>
              );
              return !authToken ? <AuthPanel footerStart={termsLink} /> : <LogoutPanel footerStart={termsLink} />;
            })()}
          </Blind>
          <OrderPanel 
            key={username ?? 'guest'}
            open={isOrdersOpen}
            onClose={() => setOpenBlind(null)}
          />
          {experience.id === 'eodms' && <ProcessingPanel key={`${username ?? 'guest'}:${processingCandidate?.id ?? 'none'}`} open={isProcessingOpen && !!username} onClose={() => setOpenBlind(null)} onSubmitted={(submission, job, processId, itemId) => {
            setProcessingReceipt(username ? { username, submission, job, processId, itemId } : null);
            setSubmissionToastOpen(true);
            registerJob(job);
            void refreshJobs();
            setSelectedFootprints(new Set());
            setProcessingCandidateId(null);
          }} receipt={processingReceipt?.username === username ? processingReceipt : null} jobs={processingJobs} jobsError={processingJobsError} onRefreshJobs={() => { void refreshJobs(); }} onClearHistory={clearProcessingHistory} candidate={processingCandidate} candidates={processingCandidates} onSelectCandidate={setProcessingCandidateId} />}
        </Toolbar>
        <SkyBar />
      </AppBar>

      <LoadingMask loading={isSearching} indicator={<OrbitLoader />} onCancel={() => searchService.cancel()} cancelText={t('cancel')}>
        <Box ref={setContentEl} sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
          <Drawer variant="persistent" anchor="left" open={leftOpen} sx={{ width: leftOpen ? calcDrawerWidth() : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: calcDrawerWidth(), position: 'relative', boxShadow: `${TOP_TUCK_SHADOW}, 4px 0 12px -4px rgba(0,0,0,0.3)` } }}>
            <SearchPanel 
              stacEndpoint={stacEndpoint} fixedCollectionId={experience.fixedCollectionId}
              selectedCollections={selectedCollections} setSelectedCollections={setSelectedCollections}
              searchLimit={searchLimit} setSearchLimit={setSearchLimit} searchTemporal={searchTemporal} setSearchTemporal={setSearchTemporal}
              startDate={searchStartDate} setStartDate={setSearchStartDate} endDate={searchEndDate} setEndDate={setSearchEndDate} 
              supportsSearch={supportsSearch} supportsSorting={supportsSorting} sortby={sortby} setSortby={setSortby} executeSearch={searchWithCurrentAoi}
            />
          </Drawer>
          <Box sx={{ 
            flexGrow: 1, 
            minWidth: 0,
            position: 'relative',
            '& .leaflet-container': {
              backgroundColor: displayMode == 'dark'
              ? "rgb(34, 34, 34)"
              : "rgb(221, 221, 221)"
            },
            '& .leaflet-control-attribution a': {
              color: displayMode == 'dark'
              ? "#009cda" 
              : "#0078A8",
              backgroundColor: displayMode == 'dark'
              ? "rgba(0, 0, 0, 0.8)"
              : "rgba(255, 255, 255, 0.8)"
            },
            '& .leaflet-control-attribution': {
              color: displayMode == 'dark'
              ? "#FFFFFF" 
              : "#000000",
              backgroundColor: displayMode == 'dark'
              ? "rgba(0, 0, 0, 0.8)"
              : "rgba(255, 255, 255, 0.8)"
            },
            '& .leaflet-tile-pane, & .leaflet-bar, & .leaflet-overlay-pane': {
              color: "#000000",
              filter: displayMode == 'dark'
              ? 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)' 
              : 'none',
            },
            '& .leaflet-marker-icon, & .leaflet-popup-content-wrapper': {
              filter: displayMode == 'dark' 
              ? 'invert(100%) hue-rotate(-180deg)' 
              : 'none',
            } 
          }}>
            <StacMap clearAoiTrigger={clearAoiTrigger} onAoiDrawn={handleSearch} onLocationSelected={(locationBbox) => { setBbox(locationBbox.join(',')); handleSearch(locationBbox, false); }} zoomBounds={zoomBounds} 
              searchResults={searchResults} selectedFootprints={selectedFootprints} onFeatureClick={handleMapFeatureClick} 
              hoveredItem={hoveredItem} onHoverItem={setHoveredItem} numberOffset={resultNumberOffset}
              activeThumbnails={activeThumbnails} setBbox={setBbox}
            />
            {isMobile && !leftOpen && !rightOpen && (
              <Fab
                variant="extended"
                color="primary"
                onClick={() => showLeftPanel(true)}
                sx={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 1001, textTransform: 'none' }}
              >
                <SearchIcon sx={{ mr: 1 }} />
                {t('search')}
              </Fab>
            )}
          </Box>
          <Drawer variant="persistent" anchor="right" open={rightOpen} sx={{width: rightOpen ? calcDrawerWidth() : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: calcDrawerWidth(), position: 'relative', boxShadow: `${TOP_TUCK_SHADOW}, -4px 0 12px -4px rgba(0,0,0,0.3)` } }}>
            <ResultsPanel 
              results={searchResults} onClose={() => setRightOpen(false)} onZoom={handleZoom} 
              onProcessCart={() => { setOpenBlind('processing'); setIsAuthOpen(false); }}
              isSearching={isSearching} selectedFootprints={selectedFootprints}
              onToggleFootprint={handleToggleFootprint} onClearCart={() => setSelectedFootprints(new Set())} focusedItem={focusedItem} 
              hoveredItem={hoveredItem} onHoverItem={setHoveredItem} numberOffset={resultNumberOffset}
              activeThumbnails={activeThumbnails} onToggleThumbnail={handleToggleThumbnail} onClear={handleOnResultsClear}
              hasNext={pagingState.hasNext} hasPrevious={pagingState.hasPrevious} 
              currentPage={pagingState.currentPage} totalDiscoveredPages={pagingState.totalDiscoveredPages} 
              onNextPage={handleNextPage} onPreviousPage={handlePreviousPage} onGoToPage={handleGoToPage} 
              numberMatched={numberMatched} userId={username} authToken={authToken} stacUrl={stacEndpoint}
              experienceId={experience.id}
            />
          </Drawer>
        </Box>
      </LoadingMask>

      <Snackbar open={!!searchError} autoHideDuration={5000} onClose={() => setSearchError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSearchError(null)} severity="error" sx={{ width: '100%' }}>{searchError}</Alert>
      </Snackbar>
      <Snackbar open={submissionToastOpen && processingReceipt?.username === username} autoHideDuration={15000}
        onClose={(_, reason) => { if (reason !== 'clickaway') setSubmissionToastOpen(false); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert severity="success" variant="filled" onClose={() => setSubmissionToastOpen(false)}
          action={<Button color="inherit" size="small" onClick={() => { setOpenBlind('processing'); setSubmissionToastOpen(false); }}>{t('processingJobs')}</Button>}>
          {t('processingSubmitted')} (HTTP {processingReceipt?.submission.status})
        </Alert>
      </Snackbar>
      <OrderReadyNotifier />
      <TermsOfUseDialog
        key={username ?? 'anonymous'}
        username={username}
        authenticated={!!authToken}
        manualOpen={manualTermsOpen}
        onManualClose={() => setManualTermsOpen(false)}
      />
    </Box>
    </BlindContainerContext.Provider>
  );
}