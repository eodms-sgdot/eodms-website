// src/AppContext.tsx
import { createContext } from 'react';
import type { Language, TranslationKey } from './i18n';
import type { DisplayMode } from './theme';
import type { FilterValue } from './types';
import type { OrderInfo } from './services/IOrderService';
import type { BaseMap, BaseMapId } from './basemaps';

export interface AppContextType {
  authEndpoint: string;
  refreshEndpoint: string;
  displayMode: DisplayMode | null;
  setDisplayMode: (displayMode: DisplayMode | null) => void;
  searchLimit : number;
  setSearchLimit: (searchLimit: number) => void;
  searchTemporal: string;
  setSearchTemporal: (searchTemporal: string) => void;
  searchStartDate: string;
  setSearchStartDate: (searchStartDate: string) => void;
  searchEndDate: string;
  setSearchEndDate: (searchEndDate: string) => void;
  username : string | null;
  setUsername: (username: string | null) => void;
  locationSearchProvider : string;
  setLocationSearchProvider: (locationSearchProvider: string) => void;
  stacEndpoint: string;
  setStacEndpoint: (url: string) => void;
  baseMapId: BaseMapId;
  setBaseMapId: (baseMapId: BaseMapId) => void;
  baseMapLayer: BaseMap | undefined;
  setBaseMapLayer: (baseMapLayer: BaseMap | undefined) => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  authExpiry: string | null;
  setAuthExpiry: (token: string | null) => void;
  refreshToken: string | null;
  setRefreshToken: (token: string | null) => void;
  refreshExpiry: string | null;
  setRefreshExpiry: (token: string | null) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (isOpen: boolean) => void;
  authErrorMessage: string | null;
  setAuthErrorMessage: (authErrorMessage: string | null) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  filters: Record<string, FilterValue[]>;
  setFilters: (filters: Record<string, FilterValue[]>) => void;
  bbox: string | null;
  setBbox: (bbox: string | null) => void;
  t: (key: TranslationKey) => string;
  orders: OrderInfo[];
  isOrderingSupported: boolean;
  triggerNewOrder: (itemIds: string[], orderKeys: string[], collection: string) => Promise<OrderInfo | null>;
  expireOrder: (orderId: string) => Promise<null | undefined>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);