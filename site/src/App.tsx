import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, HashRouter, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AppContext } from './AppContext';
import { darkMode, lightMode, type DisplayMode } from './theme';
import { getTranslation, type Language } from './i18n';
import LandingScreen from './pages/LandingScreen';
import AnimationsScreen from './pages/AnimationsScreen';
import DateFieldPrototype from './pages/DateFieldPrototype';
import type { FilterValue } from './types';
import { getBaseMap, type BaseMap, type BaseMapId } from './basemaps';
import { fields } from './session';
import { isStagingEndpoint } from './utils/StagingUtils';
import { useOrderPolling } from './hooks/useOrderPolling';
import { isRefreshRequired, isRefreshTokenExpired, refreshAuthenticationToken } from './services/AAAService';
import { decodeJWTPayload } from './utils/JWTUtils';
import { eodmsExperience, naplExperience } from './experiences';
import axios from 'axios';

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
     [fields.username, fields.token, fields.authSource, fields.decodedToken, fields.expiry, fields.refreshToken, fields.refreshExpiry]
      .forEach((key) => localStorage.removeItem(key));
    return;
  }
  const refreshToken = localStorage.getItem(fields.refreshToken);
  const refreshExpiry = localStorage.getItem(fields.refreshExpiry);
  if (refreshToken && refreshExpiry && !isRefreshTokenExpired(refreshExpiry)) return;
  if (!isRefreshRequired(localStorage.getItem(fields.expiry)) && !refreshToken) return;

   [fields.username, fields.token, fields.authSource, fields.decodedToken, fields.expiry, fields.refreshToken, fields.refreshExpiry]
    .forEach((key) => localStorage.removeItem(key));
}
clearUnrefreshableSession();
localStorage.removeItem('bbox');

// Clear stale search criteria to prevent inconsistent search results.
// Preferences (basemap, dark mode, language, auth) are preserved.
[fields.filters, fields.searchLimit, fields.searchTemporal, fields.searchStartDate, fields.searchEndDate]
  .forEach((key) => localStorage.removeItem(key));

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
  const usersEndpoint = import.meta.env.DEV
    ? '/aaa/v1/users'
    : import.meta.env.VITE_DEFAULT_USERS_URL || '/aaa/v1/users';

  const [searchLimit, setSearchLimit] = useState<number>(100);

  const [searchTemporal, setSearchTemporal] = useState<string>('anytime');
  const [searchStartDate, setSearchStartDate] = useState<string>('');
  const [searchEndDate, setSearchEndDate] = useState<string>('');
  const [locationSearchProvider, setLocationSearchProvider] = useState<string>(() => localStorage.getItem(fields.locationSearchProvider) ?? 'osm');

  const [displayMode, setDisplayMode] = useState<DisplayMode | null>(() => {
    const savedMode = localStorage.getItem(fields.displayMode) as DisplayMode;
    if (savedMode) return savedMode;

    // Default to light mode on new visits
    return 'light';
  });

  const [bbox, setBbox] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(fields.username));
  const [stacEndpoint, setStacEndpoint] = useState(() => getInitialStacEndpoint(initialEndpoint));
  const showStagingBadge = isStagingEndpoint(stacEndpoint, import.meta.env.DEV, import.meta.env.VITE_EODMS_ENDPOINTS);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem(fields.token));
  const [_decodedToken, _setDecodedToken] = useState<string | null>(() => localStorage.getItem(fields.decodedToken));
  const [authExpiry, setAuthExpiry] = useState<string | null>(() => localStorage.getItem(fields.expiry));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(fields.refreshToken));
  const [refreshExpiry, setRefreshExpiry] = useState<string | null>(() => localStorage.getItem(fields.refreshExpiry));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
    if (requestedLanguage === 'en' || requestedLanguage === 'fr') return requestedLanguage;
    return localStorage.getItem(fields.language) === 'fr' ? 'fr' : 'en';
  });
  const [baseMapId, setBaseMapId] = useState<BaseMapId>(() => {
    const savedBaseMapId = localStorage.getItem(fields.baseMap) as BaseMapId;
    return getBaseMap(savedBaseMapId)?.name ?? 'osm';
  });
  const [baseMapLayer, setBaseMapLayer] = useState<BaseMap|undefined>(() => getBaseMap(baseMapId));
  const [filters, setFilters] = useState<Record<string, FilterValue[]>>({});

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

  /**
   * Decode the auth token and store the full payload in localStorage for inspection.
   * Updates whenever the auth token changes (new login or token refresh).
   */
  useEffect(() => {
    if (!authToken) {
      _setDecodedToken(null);
      localStorage.removeItem(fields.decodedToken);
      return;
    }

    const decoded = decodeJWTPayload(authToken);
    if (decoded) {
      const decodedJson = JSON.stringify(decoded, null, 2);
      _setDecodedToken(decodedJson);
      localStorage.setItem(fields.decodedToken, decodedJson);
    }
  }, [authToken]);

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
   * Updates the user's saved preferences when any of the values in this effect are changed.
   * Search criteria (filters, temporal, dates, etc.) are NOT persisted to avoid stale state issues.
   */
  useEffect(() => {
    
    // Preferences
    updateSession(fields.language, language);
    updateSession(fields.stacEndpoint, stacEndpoint);
    updateSession(fields.displayMode, displayMode);
    updateSession(fields.baseMap, baseMapId);
    updateSession(fields.locationSearchProvider, locationSearchProvider);

    // Authentication
    updateSession(fields.username, username);
    updateSession(fields.token, authToken);
    if (!authToken) localStorage.removeItem(fields.authSource);
    updateSession(fields.expiry, authExpiry);
    updateSession(fields.refreshToken, refreshToken);
    updateSession(fields.refreshExpiry, refreshExpiry);
    
  }, [
    language, stacEndpoint, displayMode, baseMapId, locationSearchProvider,
    username, authToken, authExpiry, refreshToken, refreshExpiry
  ]);

  /**
   Synchronizes the app theme with the browser if the user has not explicitly
   chosen a preferred setting in the past.
  */
  useEffect(() => {
    // Only sync with system theme if user hasn't set a preference
    if (localStorage.getItem(fields.displayMode)) {
      return;
    }
    
    // On initial mount with no saved preference, default to light mode.
    // Don't check media query - user wants light mode as the default for new visits.
    // The displayMode state was already initialized to 'light' in useState.
    
    // Still set up a listener for future system theme changes (respects user's system setting once set)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setDisplayMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  return (
    <AppContext.Provider value={{ 
      authEndpoint, refreshEndpoint, usersEndpoint,
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
      <ThemeProvider theme={displayMode === "light" ? lightMode : displayMode === "dark" ? darkMode : lightMode}>
        <CssBaseline />
        <HashRouter>
          <DocumentTitle language={language} />
          <Routes>
            <Route path="/" element={<LandingScreen experience={eodmsExperience} />} />
            <Route path="/tour" element={<Navigate to="/?tour=start" replace />} />
            <Route path="/napl" element={showStagingBadge || import.meta.env.DEV || import.meta.env.VITE_EODMS_ENDPOINTS.targetEnvironment === 'production'
              ? <LandingScreen experience={naplExperience} />
              : <Navigate to="/" replace />} />
            <Route path="/animations" element={<AnimationsScreen />} />
            {import.meta.env.DEV && <Route path="/date-prototype" element={<DateFieldPrototype />} />}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </AppContext.Provider>
  );
}