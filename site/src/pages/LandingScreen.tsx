import { useState, useContext, useEffect, useRef } from 'react';
import { Box, Drawer, IconButton, AppBar, Toolbar, Typography, Button, Popover, Tooltip, Snackbar, Alert, Badge } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LockIcon from '@mui/icons-material/Lock';
import SettingsIcon from '@mui/icons-material/Settings';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import { AppContext } from '../AppContext';
import StacMap from '../components/StacMap';
import SearchPanel from '../components/SearchPanel';
import ResultsPanel from '../components/ResultsPanel';
import AuthPanel from '../components/AuthPanel';
import type { STACCollection, STACItem } from '../types';
import { createDateRange, formatStacDate } from '../utils/DateUtils';
import { buildFilter } from '../utils/FilterBuilder';
import { isRefreshRequired, isRefreshTokenExpired, refreshAuthenticationToken } from '../services/AAAService';
import LoadingMask from '../components/masker/LoadingMask';
import { StacSearchService } from '../services/StacSearchService';
import type { StacSearchParams, StacSearchResult } from '../services/StacSearchService';
import LogoutPanel from '../components/LogoutPanel';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import OrderPanel from '../components/OrderPanel';
import PreferencesPanel from '../components/PreferencesPanel';
import { useIsMobile } from '../utils/RenderingUtils';

const DRAWER_WIDTH = 320;

/**
 * Main application layout and state controller for the GEO.CA STAC Explorer.
 * Coordinates data flow between the Map, Search Panel, and Results Panel.
 * * @returns {JSX.Element} The rendered Landing Screen layout.
 */
export default function LandingScreen() {
  const { stacEndpoint, refreshEndpoint, searchLimit, setSearchLimit, searchTemporal, setSearchTemporal, searchStartDate, setSearchStartDate, searchEndDate, setSearchEndDate, 
    username, authToken, refreshToken, authExpiry, refreshExpiry, setAuthToken, setRefreshToken, setAuthExpiry, setRefreshExpiry, isAuthOpen, setIsAuthOpen, 
    setUsername, setAuthErrorMessage, displayMode, bbox, setBbox, filters, t } = useContext(AppContext)!;
  
  const [authButtonEl, setAuthButtonEl] = useState<HTMLButtonElement | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<STACItem[]>([]);
  const [numberMatched, setNumberMatched] = useState<number | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<STACCollection[]>([]);
  const [zoomBounds, setZoomBounds] = useState<[number, number, number, number] | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedFootprints, setSelectedFootprints] = useState<Record<string, string>>({});
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [activeThumbnails, setActiveThumbnails] = useState<Record<string, string>>({});

  const [clearAoiTrigger, setClearAoiTrigger] = useState(0);
  const [supportsSearch, setSupportsSearch] = useState<boolean>(false);
  const [supportsSorting, setSupportsSorting] = useState<boolean>(false);
  const [sortby, setSortby] = useState<string>('-datetime');

  const isMobile = useIsMobile();

  /**
   * Calculates the appropriate width for the Search & Result panels
   * @returns the width to set the panels to
   */
  const calcDrawerWidth = (): number => {
    if(isMobile) {
      return window.screen.width;
    }
    else {
      return DRAWER_WIDTH
    }
  }

  const searchService = useRef(
    new StacSearchService(
      stacEndpoint, 
      (supportsSort) => {
        setSupportsSorting(supportsSort);
      },
      (supportsSearch) => {
        setSupportsSearch(supportsSearch);
      }
    ));

  // Keep the endpoint in sync
  useEffect(() => {
    searchService.current.setEndpoint(stacEndpoint, (supports) => {
      setSupportsSorting(supports);
    });
  }, [stacEndpoint]);

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

  /**
   * Creates the applicable headers needed for the STAC API request. 
   * 
   * @returns the applicable headers needed for the STAC API request.
   */
  const getHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (authToken) {
      if (isRefreshRequired(authExpiry)) {
        if (refreshExpiry && isRefreshTokenExpired(refreshExpiry)) {
          setAuthToken(null);
          setAuthExpiry(null);
          setRefreshToken(null);
          setRefreshExpiry(null);
          setUsername(null);
          setAuthErrorMessage('errorCredentialsExpired');
          setIsAuthOpen(true);
          setIsSearching(false);
          setRightOpen(false);
          throw new Error("Credentials expired");
          
        } else if (refreshToken) {
          const response = await refreshAuthenticationToken(
            refreshEndpoint,
            refreshToken,
          );
          const currentTime = new Date();
          const authExpiryTime = new Date(
            +currentTime + response.expires_in * 1000,
          );
          setAuthToken(response.access_token);
          setAuthExpiry(authExpiryTime.toISOString());

          const responseToken = response.refresh_token;
          if(refreshToken !== responseToken) {
            const refreshExpiryTime = new Date(+currentTime + response.refresh_token_expires_in);
            setRefreshToken(responseToken);
            setRefreshExpiry(refreshExpiryTime.toISOString());
          }
        }
    
      }
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  };

  const handleSearchResult = (result: StacSearchResult) => {
    setSearchResults(result.items);
    setSelectedFootprints({});
    setFocusedItem(null);
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
      const result = await searchService.current.nextPage(await getHeaders());
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
      const result = await searchService.current.previousPage(await getHeaders());
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
      const result = await searchService.current.goToPage(page, await getHeaders());
      handleSearchResult(result);
    } catch {
      setSearchError(t('errorFetch'));
    }
  };

  /**
   * Toggles the selection state of a STAC item footprint.
   * Assigns a unique color from a predefined palette if selected, or frees the color if deselected.
   * Automatically sets the map zoom bounds to the selected item.
   * * @param {STACItem} item - The STAC item to toggle.
   */
  const handleToggleFootprint = (item: STACItem) => {
    setSelectedFootprints(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id]; 
      } else {
        const DISTINCT_COLORS = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4'];
        const usedColors = new Set(Object.values(next));
        const colorToUse = DISTINCT_COLORS.find(c => !usedColors.has(c)) || `hsl(${Math.random() * 360}, 100%, 45%)`;
        next[item.id] = colorToUse; 

        if(isMobile) {
          setRightOpen(false);
        }

        setZoomBounds(item.bbox);
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
    
    setZoomBounds(item.bbox);
  }

  /**
   * Clears the current results as well as the current AOI. 
   */
  const handleOnResultsClear = () => {
    setSearchResults([]);
    setSelectedFootprints({});
    setActiveThumbnails({});
    setFocusedItem(null);
    setClearAoiTrigger(prev => prev + 1); // increment to trigger AOI clear effect. 
    console.log(pagingState);
    setPagingState({ hasNext: false, hasPrevious: false, currentPage: 1, totalDiscoveredPages: 1 });
    setNumberMatched(null);
    searchService.current.reset();
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
    setRightOpen(true); 
  };

  /**
   * Executes STAC API search using the previous AOI, which is loaded from local storage
   *  @async
   */
  const searchWithCurrentAoi = async () => {
    if(bbox) {
      const bboxStrings = bbox.split(',');

      if(bboxStrings.length === 4) {
        const west = Number(bboxStrings[0]);
        const south = Number(bboxStrings[1]);
        const east = Number(bboxStrings[2]);
        const north = Number(bboxStrings[3]);

        handleAoiDrawn([west, south, east, north])
      }
    }
  };

  /**
   * Executes STAC API search queries when the user draws an Area of Interest (AOI) on the map.
   * Constructs the payload, applies temporal/spatial/queryables filters, and updates the search results state.
   * * @async
   * @param {[number, number, number, number]} bbox - The bounding box of the drawn area [West, South, East, North].
   */
  const handleAoiDrawn = async (bbox: [number, number, number, number]) => {
    if (selectedCollections.length === 0) {
      setSearchError(t("errorSelectCollection"));
      return;
    }

    setSearchError(null);
    setSelectedFootprints({});
    setActiveThumbnails({});
    setFocusedItem(null);

    const collectionIDs: string[] = [];
    selectedCollections.map(c => {
        collectionIDs.push(c.id)
    });

    const params: StacSearchParams = {
      bbox,
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
    setRightOpen(true);

    try {
      const result = await searchService.current.search(params, await getHeaders());
      handleSearchResult(result);
      setNumberMatched(searchService.current.getNumberMatched());
    } catch {
      setSearchError(t('errorFetch'));
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const [preferencesAnchorEl, setPreferencesAnchorEl] = useState<HTMLButtonElement | null>(null);
  const isPreferencesOpen = Boolean(preferencesAnchorEl);

  const [ordersAnchorEl, setOrdersAnchorEl] = useState<HTMLButtonElement | null>(null);
  const isOrdersOpen = Boolean(ordersAnchorEl);

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
    <Box sx={{ display: 'flex', height: '100vh', width: '100%', flexDirection: 'column', overflow: 'hidden' }}>
      
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'left', width: '100%',
            backgroundColor: displayMode === 'dark' ? "#121212" : "#FFFFFF"
        }}>

        <Typography variant="h6" color="primary" noWrap>
          {import.meta.env.VITE_APP_TITLE || t('appTitle')}
        </Typography>

        {/* empty to make widgets below align right */}
        <Box sx={{width: '20%', alignItems: 'center'}}></Box>
        
        <Box sx={{ display: 'flex', alignItems: 'right'}}>
          {username ? (
              <Typography variant="h6" color="primary" noWrap>
                    {t('hello')+username}
              </Typography>
           ) : ''}
        </Box>
      </Box>
      <AppBar position="static" color="default" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1}}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => setLeftOpen(!leftOpen)}><MenuIcon /></IconButton>

          {/* empty to make widgets below align right */}
          <Box sx={{width: '100%', alignItems: 'center'}}></Box>
          
          <Box sx={{ display: 'flex', alignItems: 'right'}}>

            {!username ? (
            <Typography variant="h6" color="primary"  noWrap sx={{mr:1}}>
              {t('login')+':'}
            </Typography>
            ) : ''}
            
            <Tooltip title={authToken ? t('authenticated') : t('provideAuth')}>
              <Button ref={setAuthButtonEl} variant={authToken ? "contained" : "outlined"} color={authToken ? "success" : "primary"} onClick={() => setIsAuthOpen(!isAuthOpen)} sx={{ minWidth: '40px'}}>
                {authToken ? <LockOpenIcon /> : <LockIcon />}
              </Button>
            </Tooltip>

            {username && (
              <Tooltip title={t('viewActiveProcessing')}>
                <IconButton 
                  onClick={(e) => setOrdersAnchorEl(e.currentTarget)} 
                  color={isOrdersOpen ? "primary" : "default"}
                  sx={{ ml: 0.5 }}
                >
                  <Badge badgeContent={getLocalOrdersCount()} color="warning" max={99}>
                    <ShoppingBagIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={t('preferences')}>
                <IconButton 
                  onClick={(e) => setPreferencesAnchorEl(e.currentTarget)} 
                  color={isPreferencesOpen ? "primary" : "default"}
                >
                <SettingsIcon />
              </IconButton>
            </Tooltip>

            <PreferencesPanel 
              anchorEl={preferencesAnchorEl} 
              onClose={() => setPreferencesAnchorEl(null)}
            />

            <Tooltip title={t('toggleResults')}>
              <IconButton onClick={() => setRightOpen(!rightOpen)} color={rightOpen ? "primary" : "default"}>
                <Badge badgeContent={searchResults.length} color="secondary" max={999}><ViewSidebarIcon /></Badge>
              </IconButton>
            </Tooltip>
          </Box>

          <Popover open={isAuthOpen} anchorEl={authButtonEl} onClose={() => setIsAuthOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {!authToken ?
              <AuthPanel /> : <LogoutPanel/>
            }
          </Popover>
          <OrderPanel 
            anchorEl={ordersAnchorEl}
            onClose={() => setOrdersAnchorEl(null)}
          />
        </Toolbar>
      </AppBar>

      <LoadingMask loading={isSearching}>
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
          <Drawer variant="persistent" anchor="left" open={leftOpen} sx={{ width: leftOpen ? calcDrawerWidth() : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: calcDrawerWidth(), position: 'relative' } }}>
            <SearchPanel 
              stacEndpoint={stacEndpoint} selectedCollections={selectedCollections} setSelectedCollections={setSelectedCollections}
              searchLimit={searchLimit} setSearchLimit={setSearchLimit} searchTemporal={searchTemporal} setSearchTemporal={setSearchTemporal}
              startDate={searchStartDate} setStartDate={setSearchStartDate} endDate={searchEndDate} setEndDate={setSearchEndDate} 
              supportsSearch={supportsSearch} supportsSorting={supportsSorting} sortby={sortby} setSortby={setSortby} executeSearch={searchWithCurrentAoi}
            />
          </Drawer>
          <Box sx={{ 
            flexGrow: 1, 
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
            <StacMap clearAoiTrigger={clearAoiTrigger} onAoiDrawn={handleAoiDrawn} onLocationSelected={handleAoiDrawn} zoomBounds={zoomBounds} 
              searchResults={searchResults} selectedFootprints={selectedFootprints} onFeatureClick={handleMapFeatureClick} 
              activeThumbnails={activeThumbnails} setBbox={setBbox}
            />
          </Box>
          <Drawer variant="persistent" anchor="right" open={rightOpen} sx={{width: rightOpen ? calcDrawerWidth() : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: calcDrawerWidth(), position: 'relative' } }}>
            <ResultsPanel 
              results={searchResults} onClose={() => setRightOpen(false)} onZoom={handleZoom} 
              isSearching={isSearching} selectedFootprints={selectedFootprints}
              onToggleFootprint={handleToggleFootprint} focusedItem={focusedItem} 
              activeThumbnails={activeThumbnails} onToggleThumbnail={handleToggleThumbnail} onClear={handleOnResultsClear}
              hasNext={pagingState.hasNext} hasPrevious={pagingState.hasPrevious} 
              currentPage={pagingState.currentPage} totalDiscoveredPages={pagingState.totalDiscoveredPages} 
              onNextPage={handleNextPage} onPreviousPage={handlePreviousPage} onGoToPage={handleGoToPage} 
              numberMatched={numberMatched} userId={username} authToken={authToken} stacUrl={stacEndpoint}
            />
          </Drawer>
        </Box>
      </LoadingMask>

      <Snackbar open={!!searchError} autoHideDuration={5000} onClose={() => setSearchError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSearchError(null)} severity="error" sx={{ width: '100%' }}>{searchError}</Alert>
      </Snackbar>
    </Box>
  );
}