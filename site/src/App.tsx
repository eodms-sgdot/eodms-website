import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, HashRouter, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AppContext } from './AppContext';
import { darkMode, lightMode, type DisplayMode } from './theme';
import { getTranslation, type Language } from './i18n';
import LandingScreen from './pages/LandingScreen';
import type { FilterValue } from './types';
import { getBaseMap, type BaseMap, type BaseMapId } from './basemaps';
import { fields } from './session';
import { useOrderPolling } from './hooks/useOrderPolling';
import { isRefreshRequired, isRefreshTokenExpired, refreshAuthenticationToken } from './services/AAAService';
import { eodmsExperience, naplExperience } from './experiences';
import axios from 'axios';
import { isTemporalFilterField } from './utils/FilterBuilder';

// Refresh this long before the access token expires so in-flight requests don't carry a stale token.
const REFRESH_MARGIN_MS = 60_000;
// AAA only rotates the refresh token during the final ten minutes before it expires.
const REFRESH_TOKEN_ROTATION_MARGIN_MS = 10 * 60_000;

/**
 * Runs once at startup: clears a stored session that can no longer be refreshed
 * (e.g. revisiting after the browser was dormant). A refreshable session is kept and refreshed.
 */
function clearUnrefreshableSession() {
  const authToken = localStorage.getItem(fields.token);
  if (!authToken) return;
  const username = localStorage.getItem(fields.username)?.trim();
  if (!username) {
    [fields.username, fields.token, fields.expiry, fields.refreshToken, fields.refreshExpiry]
      .forEach((key) => localStorage.removeItem(key));
    return;
  }
  const refreshToken = localStorage.getItem(fields.refreshToken);
  const refreshExpiry = localStorage.getItem(fields.refreshExpiry);
  if (refreshToken && refreshExpiry && !isRefreshTokenExpired(refreshExpiry)) return;
  if (!isRefreshRequired(localStorage.getItem(fields.expiry)) && !refreshToken) return;

  [fields.username, fields.token, fields.expiry, fields.refreshToken, fields.refreshExpiry]
    .forEach((key) => localStorage.removeItem(key));
}
clearUnrefreshableSession();

function getInitialStacEndpoint(fallback: string): string {
  const savedEndpoint = localStorage.getItem(fields.stacEndpoint);
  if (!savedEndpoint) return fallback;

  const endpoint = savedEndpoint.trim();
  if (endpoint.startsWith("/")) return endpoint;

  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return endpoint;
  } catch {
    // Fall back to the configured endpoint for malformed saved values.
  }

  localStorage.removeItem(fields.stacEndpoint);
  return fallback;
}

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
  const [stacEndpoint, setStacEndpoint] = useState(() => getInitialStacEndpoint(initialEndpoint));
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem(fields.token));
  const [authExpiry, setAuthExpiry] = useState<string | null>(() => localStorage.getItem(fields.expiry));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(fields.refreshToken));
  const [refreshExpiry, setRefreshExpiry] = useState<string | null>(() => localStorage.getItem(fields.refreshExpiry));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(fields.language) as Language) ?? 'en');
  const [baseMapId, setBaseMapId] = useState<BaseMapId>(() => {
    const savedBaseMapId = localStorage.getItem(fields.baseMap) as BaseMapId;
    return getBaseMap(savedBaseMapId)?.name ?? 'osm';
  });
  const [baseMapLayer, setBaseMapLayer] = useState<BaseMap|undefined>(() => getBaseMap(baseMapId));
  const [filters, setFilters] = useState<Record<string, FilterValue[]>>(() => {
    try {
      const storedFilters = JSON.parse(localStorage.getItem(fields.filters) as string) as Record<string, FilterValue[]> | null;
      if (!storedFilters) return {};
      Object.entries(storedFilters).forEach(([collectionName, collectionFilters]) => {
        storedFilters[collectionName] = collectionFilters.filter(filter => !isTemporalFilterField(filter.fieldKey));
      });
      return storedFilters;
    } catch {
      return {};
    }
  });

  const refreshInFlight = useRef<Promise<string> | null>(null);

  const signOut = useCallback((message: string | null) => {
    setUsername(null);
    setAuthToken(null);
    setAuthExpiry(null);
    setRefreshToken(null);
    setRefreshExpiry(null);
    setAuthErrorMessage(message);
    if (message) setIsAuthOpen(true);
  }, []);

  /**
   * Returns a usable access token, refreshing it first if it expires within REFRESH_MARGIN_MS.
   * Signs the user out and throws if the session can no longer be refreshed.
   */
  const getValidAuthToken = useCallback(async (): Promise<string> => {
    if (!authToken) {
      throw new Error("Not authenticated");
    }
    const now = Date.now();
    const accessRefreshAt = authExpiry ? Date.parse(authExpiry) - REFRESH_MARGIN_MS : Number.POSITIVE_INFINITY;
    const refreshTokenRefreshAt = refreshExpiry
      ? Date.parse(refreshExpiry) - REFRESH_TOKEN_ROTATION_MARGIN_MS
      : Number.POSITIVE_INFINITY;
    if (Math.min(accessRefreshAt, refreshTokenRefreshAt) > now) {
      return authToken;
    }
    if (!refreshToken || !refreshExpiry || isRefreshTokenExpired(refreshExpiry)) {
      signOut('errorCredentialsExpired');
      throw new Error("Credentials expired");
    }

    // Share one refresh between concurrent callers (e.g. several orders polled at once).
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        try {
          const response = await refreshAuthenticationToken(refreshEndpoint, refreshToken);
          const now = Date.now();
          setAuthToken(response.access_token);
          setAuthExpiry(new Date(now + response.expires_in * 1000).toISOString());
          setRefreshToken(response.refresh_token);
          setRefreshExpiry(new Date(now + response.refresh_token_expires_in * 1000).toISOString());
          return response.access_token;
        } catch (e) {
          if (axios.isAxiosError(e) && (e.response?.status === 400 || e.response?.status === 401)) {
            signOut('errorCredentialsExpired');
          }
          throw e;
        } finally {
          refreshInFlight.current = null;
        }
      })();
    }
    return refreshInFlight.current;
  }, [authToken, authExpiry, refreshToken, refreshExpiry, refreshEndpoint, signOut]);

  /**
   * Keeps the session alive while the page is open: refreshes shortly before either token's
   * refresh deadline, and re-checks when the tab becomes visible again (timers are throttled while dormant).
   */
  useEffect(() => {
    if (!authToken || (!authExpiry && !refreshExpiry)) return;

    const check = () => { getValidAuthToken().catch((e) => console.warn("Token refresh failed:", e)); };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };

    const accessRefreshAt = authExpiry ? Date.parse(authExpiry) - REFRESH_MARGIN_MS : Number.POSITIVE_INFINITY;
    const refreshTokenRefreshAt = refreshExpiry
      ? Date.parse(refreshExpiry) - REFRESH_TOKEN_ROTATION_MARGIN_MS
      : Number.POSITIVE_INFINITY;
    const nextRefreshAt = Math.min(accessRefreshAt, refreshTokenRefreshAt);
    const timer = setTimeout(check, Math.max(0, nextRefreshAt - Date.now()));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [authToken, authExpiry, refreshExpiry, getValidAuthToken]);

  const { orders, isOrderingSupported, triggerNewOrder, expireOrder, refreshOrderStatus, clearOrderHistory } = useOrderPolling(
    (username ? username : ''),
    (authToken ? authToken : ''),
    stacEndpoint,
    getValidAuthToken
  );

  // On load, only drop sessions that can no longer be refreshed; an expired access token is refreshed instead.
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
      getValidAuthToken,
      isAuthOpen, setIsAuthOpen,
      authErrorMessage, setAuthErrorMessage,
      language, setLanguage, 
      filters, setFilters, t,
      orders, isOrderingSupported, triggerNewOrder, expireOrder, refreshOrderStatus, clearOrderHistory
    }}>
      <ThemeProvider theme={displayMode === "light" ? lightMode : darkMode}>
        <CssBaseline />
        <HashRouter>
          <DocumentTitle language={language} />
          <Routes>
            <Route path="/" element={<LandingScreen experience={eodmsExperience} />} />
            <Route path="/napl" element={<LandingScreen experience={naplExperience} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </AppContext.Provider>
  );
}