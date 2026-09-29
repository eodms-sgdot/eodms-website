import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AppContext } from './AppContext';
import { darkMode, lightMode, type DisplayMode } from './theme';
import { getTranslation, type Language } from './i18n';
import LandingScreen from './pages/LandingScreen';
import type { FilterValue } from './types';
import { getBaseMap, type BaseMap, type BaseMapId } from './basemaps';
import { fields } from './session';
import { useOrderPolling } from './hooks/useOrderPolling';
import { isRefreshRequired, isRefreshTokenExpired } from './services/AAAService';
import { eodmsExperience, naplExperience } from './experiences';

function DocumentTitle({ language }: { language: Language }) {
  const location = useLocation();

  useEffect(() => {
    const isNapl = location.pathname === '/napl';
    document.title = isNapl
      ? import.meta.env.VITE_NAPL_APP_TITLE || getTranslation(language, 'naplTitle')
      : import.meta.env.VITE_APP_TITLE || getTranslation(language, 'appTitle');
  }, [language, location.pathname]);

  return null;
}

export default function App() {
  const initialEndpoint = import.meta.env.VITE_DEFAULT_STAC_URL || '/search';
  const authEndpoint = import.meta.env.DEV
    ? '/aaa/v1/login'
    : import.meta.env.VITE_DEFAULT_AUTH_URL || '/aaa/v1/login';
  const refreshEndpoint = import.meta.env.DEV
    ? '/aaa/v1/refresh'
    : import.meta.env.VITE_DEFAULT_REFRESH_URL || '/aaa/v1/refresh';

  const [searchLimit, setSearchLimit] = useState<number>(() => localStorage.getItem(fields.searchLimit) ? Number(localStorage.getItem(fields.searchLimit)) : 50);

  const [searchTemporal, setSearchTemporal] = useState<string>(() => localStorage.getItem(fields.searchTemporal) ?? 'anytime');
  const [searchStartDate, setSearchStartDate] = useState<string>(() => localStorage.getItem(fields.searchStartDate) ?? '');
  const [searchEndDate, setSearchEndDate] = useState<string>(() => localStorage.getItem(fields.searchEndDate) ?? '');
  const [locationSearchProvider, setLocationSearchProvider] = useState<string>(() => localStorage.getItem(fields.locationSearchProvider) ?? 'osm');

  const [displayMode, setDisplayMode] = useState<DisplayMode | null>(() => {
    const savedMode = localStorage.getItem(fields.displayMode) as DisplayMode;
    if (savedMode) return savedMode;

    // Fallback to browser/system preference if no user choice is saved
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  const [bbox, setBbox] = useState<string | null>(() => localStorage.getItem(fields.bbox));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(fields.username));
  const [stacEndpoint, setStacEndpoint] = useState(() => localStorage.getItem(fields.stacEndpoint) ?? initialEndpoint);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem(fields.token));
  const [authExpiry, setAuthExpiry] = useState<string | null>(() => localStorage.getItem(fields.expiry));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(fields.refreshToken));
  const [refreshExpiry, setRefreshExpiry] = useState<string | null>(() => localStorage.getItem(fields.refreshExpiry));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(fields.language) as Language) ?? 'en');
  const [baseMapId, setBaseMapId] = useState<BaseMapId>(() => (localStorage.getItem(fields.baseMap) as BaseMapId) ?? 'osm');
  const [baseMapLayer, setBaseMapLayer] = useState<BaseMap|undefined>(() => (getBaseMap(localStorage.getItem(fields.baseMap) as BaseMapId)));
  const [filters, setFilters] = useState<Record<string, FilterValue[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem(fields.filters) as string) ?? {};
    } catch {
      return {};
    }
  });

  const { orders, isOrderingSupported, triggerNewOrder, expireOrder } = useOrderPolling(
    (username ? username : ''),
    (authToken ? authToken : ''),
    stacEndpoint
  );

  useEffect(() => {
    const hasExpiredAccessToken = Boolean(authToken && (!authExpiry || isRefreshRequired(authExpiry)));
    const hasExpiredRefreshToken = Boolean(refreshToken && (!refreshExpiry || isRefreshTokenExpired(refreshExpiry)));

    if (hasExpiredAccessToken || hasExpiredRefreshToken) {
      setUsername(null);
      setAuthToken(null);
      setAuthExpiry(null);
      setRefreshToken(null);
      setRefreshExpiry(null);
      setAuthErrorMessage(null);
    }
  }, [authToken, authExpiry, refreshToken, refreshExpiry, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setUsername, setAuthErrorMessage]);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);

  /**
   * Add/Update a value in the session or Remove it if value is null.
   * 
   * @param key key of value to update
   * @param value new value of field
   */
  const updateSession = (key:string, value: string|null) => {
    if(value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  };

  /**
   * Updates the user's saved session when any of the values in this effect are changed.
   */
  useEffect(() => {
    
    // General
    updateSession(fields.language, language);
    updateSession(fields.stacEndpoint, stacEndpoint);
    updateSession(fields.displayMode, displayMode);
    updateSession(fields.baseMap, baseMapId);

    
    // Search
    updateSession(fields.filters, JSON.stringify(filters));
    updateSession(fields.searchLimit, searchLimit.toString());
    updateSession(fields.searchTemporal, searchTemporal);
    updateSession(fields.searchStartDate, searchStartDate);
    updateSession(fields.searchEndDate, searchEndDate);
    updateSession(fields.locationSearchProvider, locationSearchProvider);
    updateSession(fields.bbox, bbox);

    // Authentication
    updateSession(fields.username, username);
    updateSession(fields.token, authToken);
    updateSession(fields.expiry, authExpiry);
    updateSession(fields.refreshToken, refreshToken);
    updateSession(fields.refreshExpiry, refreshExpiry);
    
  }, [
    language, stacEndpoint, displayMode, baseMapId, bbox,
    filters, searchLimit, searchTemporal, searchStartDate, searchEndDate, 
    locationSearchProvider, username, authToken, authExpiry, refreshToken, refreshExpiry
  ]);

  /**
   Synchronizes the app theme with the browser if the user has not explicitly
   chosen a preferred setting in the past.
  */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if the user hasn't explicitly set a preference in localStorage
      if (!localStorage.getItem(fields.displayMode)) {
        setDisplayMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  return (
    <AppContext.Provider value={{ 
      authEndpoint, refreshEndpoint, 
      displayMode, setDisplayMode,
      baseMapId, setBaseMapId,
      baseMapLayer, setBaseMapLayer,
      searchLimit, setSearchLimit,
      searchTemporal, setSearchTemporal,
      searchStartDate, setSearchStartDate,
      searchEndDate, setSearchEndDate,
      locationSearchProvider, setLocationSearchProvider,
      bbox, setBbox,
      username, setUsername,
      stacEndpoint, setStacEndpoint, 
      authToken, setAuthToken, authExpiry, setAuthExpiry,
      refreshToken, setRefreshToken, refreshExpiry, setRefreshExpiry,
      isAuthOpen, setIsAuthOpen,
      authErrorMessage, setAuthErrorMessage,
      language, setLanguage, 
      filters, setFilters, t,
      orders, isOrderingSupported, triggerNewOrder, expireOrder
    }}>
      <ThemeProvider theme={displayMode === "light" ? lightMode : darkMode}>
        <CssBaseline />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <DocumentTitle language={language} />
          <Routes>
            <Route path="/" element={<LandingScreen experience={eodmsExperience} />} />
            <Route path="/napl" element={<LandingScreen experience={naplExperience} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AppContext.Provider>
  );
}