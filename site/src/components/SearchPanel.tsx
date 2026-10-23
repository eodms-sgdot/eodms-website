import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { Box, Typography, Checkbox, FormControlLabel, FormGroup, Divider, Select, MenuItem, FormControl, InputLabel, CircularProgress, Button, Tooltip, Badge, Alert } from '@mui/material';
import axios from 'axios';
import { AppContext } from '../AppContext';
import type { STACCollection } from '../types'; 
import type { TranslationKey } from '../i18n';
import FilterIcon from '@mui/icons-material/FilterAlt';
import FilterPanel from './filters/FilterPanel';
import DatePicker from './datepicker/DatePicker';
import { getCollection, getCollections } from '../services/StacService';
import { fields } from '../session';
import { isTemporalFilterField } from '../utils/FilterBuilder';
import Blind from './Blind';
import SearchIcon from '@mui/icons-material/Search';
import NaplWelcome from './NaplWelcome';

/**
 * Properties for the SearchPanel component.
 */
export interface SearchPanelProps {
  /** The current URL of the STAC catalog API */
  stacEndpoint: string;
  /** Collection ID enforced by a fixed-collection experience */
  fixedCollectionId?: string;
  /** Array of collections currently selected by the user */
  selectedCollections: STACCollection[];
  /** State setter for updating the selected collections */
  setSelectedCollections: React.Dispatch<React.SetStateAction<STACCollection[]>>;
  /** The maximum number of records to return from the STAC search */
  searchLimit: number;
  /** State setter for the search limit */
  setSearchLimit: (limit: number) => void;
  /** The selected predefined temporal range (e.g., 'anytime', '30', 'custom') */
  searchTemporal: string;
  /** State setter for the temporal range selection */
  setSearchTemporal: (val: string) => void;
  /** Custom start date string in YYYY-MM-DD format */
  startDate: string;
  /** State setter for the custom start date */
  setStartDate: (val: string) => void;
  /** Custom end date string in YYYY-MM-DD format */
  endDate: string;
  /** State setter for the custom end date */
  setEndDate: (val: string) => void;
  /** Boolean indicating if the STAC endpoint supports /search */
  supportsSearch: boolean;
  /** Boolean indicating if the STAC endpoint supports sorting */
  supportsSorting: boolean;
  /** The current sort order */
  sortby: string;
  /** State setter for the sort order */
  setSortby: (val: string) => void;
  /** Callback to execute a search */
  executeSearch: () => void;
}

/**
 * Sidebar component that fetches available STAC collections and provides 
 * form controls for filtering searches by temporal extent and pagination limits.
 * * @param {SearchPanelProps} props - The properties controlling the form states.
 * @returns {JSX.Element} The rendered Search Panel drawer content.
 */
export default function SearchPanel({ 
  stacEndpoint, fixedCollectionId, selectedCollections, setSelectedCollections,
  searchTemporal, setSearchTemporal, startDate, setStartDate, endDate, setEndDate, supportsSearch,
  supportsSorting, sortby, setSortby, executeSearch
}: SearchPanelProps) {
  
  const [collections, setCollections] = useState<STACCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<{ key: TranslationKey; status?: number } | null>(null);
  const {
    authToken,
    setUsername,
    setAuthToken,
    setAuthExpiry,
    setRefreshToken,
    setRefreshExpiry,
    setIsAuthOpen,
    setAuthErrorMessage,
    filters,
    setFilters,
    getValidAuthToken,
    t,
  } = useContext(AppContext)!;
  const [filterButtonEl, setFilterButtonEl] = useState<HTMLButtonElement | null>(null);

  // Identifies what the list shows; a refreshed token keeps it, so that refetch runs silently.
  const listKey = `${stacEndpoint}|${!!authToken}|${fixedCollectionId ?? ''}`;
  const lastListKey = useRef<string | null>(null);

  /**
   * Function that counts the currently applied filters
   * @returns The number of currently applied filters
   */
  const countFilters = useCallback(():number => {
    let count = 0;

    if (filters) {
      Object.keys(filters)
        .filter(collectionName => !fixedCollectionId || collectionName === fixedCollectionId)
        .forEach((collectionName) => {
          filters[collectionName].forEach((filterValue) => {
              if(filterValue.operation && filterValue.value !== undefined && filterValue.value !== '' && !isTemporalFilterField(filterValue.fieldKey)) {
                count = count + 1;
              }
          });  
      });
    };

    return count;
  }, [filters, fixedCollectionId]);

  useEffect(() => {
    /**
     * Fetches the available geospatial collections from the active STAC endpoint.
     * Uses the authorization token if one is provided in the AppContext.
     * * @async
     */
    const fetchCollections = async () => {
      const silent = lastListKey.current === listKey;
      lastListKey.current = listKey;
      if (!silent) setLoading(true);
      setCollectionsError(null);
      // Keep the existing array (and object identities) when nothing changed.
      const keepIfSame = (next: STACCollection[]) => (prev: STACCollection[]) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      try {
        const collectionAuthToken = authToken ? await getValidAuthToken() : null;
        if (fixedCollectionId) {
          const collection = await getCollection(stacEndpoint, fixedCollectionId, collectionAuthToken);
          if (cancelled) return;
          setCollections(keepIfSame([collection]));
          if (!silent) setSelectedCollections([collection]);
        } else {
          const collections = await getCollections(stacEndpoint, collectionAuthToken);
          if (cancelled) return;
          setCollections(keepIfSame(collections));
          setSelectedCollections(previous => previous.flatMap(selected => {
            const current = collections.find(collection => collection.id === selected.id);
            return current ? [current] : [];
          }));
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // This can happen after a page refresh when a stale auth token is still present
          // in localStorage. Clearing the auth session lets the user sign back in without
          // leaving the collections list permanently blank.
          setUsername(null);
          setAuthToken(null);
          setAuthExpiry(null);
          setRefreshToken(null);
          setRefreshExpiry(null);
          setAuthErrorMessage('errorCredentialsExpired');
          setIsAuthOpen(true);
        } else {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          setCollectionsError({
            key: status === 429 ? 'collectionsRateLimited' : 'failedToLoadCollections',
            status,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    let cancelled = false;
    fetchCollections();
    return () => { cancelled = true; };
  }, [
    stacEndpoint, authToken, listKey, fixedCollectionId, setSelectedCollections,
    setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry,
    setAuthErrorMessage, setIsAuthOpen, getValidAuthToken,
  ]);

  /**
   * Set selected collections to match filters saved in session
   */
  useEffect(() => {
    if (fixedCollectionId) return;

    if(localStorage.getItem(fields.filters)) { 
      setSelectedCollections([]);
      const sessionFilters = JSON.parse(localStorage.getItem(fields.filters) as string);

      Object.keys(sessionFilters).forEach((key) => {
        Object.values(collections).forEach((collection) => {
          if(collection.id === key) {
            setSelectedCollections(prev => prev.includes(collection) ? prev.filter(x => x !== collection) : [...prev, collection])
          }
        });
      });
    }

  }, [collections, fixedCollectionId, setSelectedCollections]);

  /**
   * Function that clears the filters
   */
  const clearFilters= (() => {
        setFilters({});
    });

  /**
   * Function that clears the selected collections
   * and the filters
   */
  const clearCollections = (() => {
    setSelectedCollections([])
    clearFilters();
  });

  /**
   * Function that handles checking/unchecking a collection
   * It adds/removes it from the selectedCollections list
   * & clears its filters if it's being unchecked
   * @param collection The checked/unchecked collection
   */
  const toggleCollection = ((collection: STACCollection) => {
    // Without item-search only one collection can be queried, so selecting replaces the selection.
    if(!supportsSearch && !selectedCollections.includes(collection)) {
      setFilters({ [collection.id]: [] });
      setSelectedCollections([collection]);
      return;
    }

    if(selectedCollections.includes(collection)) {
      const updated = {...filters};
      delete updated[collection.id];
      setFilters(updated);
      countFilters();
    } else {
      const updated = {...filters};
      updated[collection.id] = [];
      setFilters(updated);
      countFilters();
    }

    setSelectedCollections(prev => prev.includes(collection) ? prev.filter(x => x !== collection) : [...prev, collection])
  });

  return (
    <Box sx={{display: "flex", flexDirection: "column", height: "100%" }}>
      {fixedCollectionId ? <NaplWelcome /> : <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          bgcolor: "primary.main",
          color: "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p:0 }}>
          <Typography variant="h6">
            {t("collections")}
          </Typography>

          {selectedCollections.length > 0 && (
            <Tooltip title={t('clearCollectionsHover')}>
              <Button sx={{color: "white", textTransform: "none", textDecoration: "underline", p:0}} 
                  onClick={clearCollections}>
                {t("clear")} ({selectedCollections.length})
              </Button>
            </Tooltip>
          )}
        </Box>

        <Tooltip title={t("filtersHover")}>
          <span>
            <Button
              onClick={(e) => setFilterButtonEl(e.currentTarget)}
              sx={{ minWidth: "40px", p: 0, alignSelf: 'center' }}
              disabled={selectedCollections.length !== 1}
            >
              <Badge color="warning" badgeContent={countFilters()}>
                {<FilterIcon sx={{color: (selectedCollections.length === 1 ? "white" : "grey")}}/>}
              </Badge>
            </Button>
          </span>
        </Tooltip>
      </Box>}

      {collectionsError && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
        {t(collectionsError.key)}{collectionsError.status ? ` (HTTP ${collectionsError.status})` : ''}
      </Alert>}

      {fixedCollectionId && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pt: 1 }}>
          <Tooltip title={t("filtersHover")}>
            <span>
              <Button
                onClick={(e) => setFilterButtonEl(e.currentTarget)}
                disabled={loading || selectedCollections.length !== 1}
                sx={{ minWidth: 40 }}
              >
                <Badge color="warning" badgeContent={countFilters()}>
                  <FilterIcon />
                </Badge>
              </Button>
            </span>
          </Tooltip>
        </Box>
      )}

      <Blind open={Boolean(filterButtonEl)} onClose={() => setFilterButtonEl(null)}>
        <FilterPanel
          selectedCollections={selectedCollections}
          countFilters={countFilters}
          clearFilters={clearFilters}
          onClose={() => setFilterButtonEl(null)}
          executeSearch={executeSearch}
        />
      </Blind>

      {loading ? (
        <CircularProgress size={24} sx={{ my: 2, alignSelf: "center" }} />
      ) : !fixedCollectionId ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            minHeight: 120,
            p: 2,
          }}
        >
          <FormGroup>
            {collections.map((c) => (
              <Tooltip key={c.id} title={c.description || c.title || c.id}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedCollections.includes(c)}
                      onChange={() => toggleCollection(c)}
                    />
                  }
                  label={
                    <Typography variant="body2">{c.title || c.id}</Typography>
                  }
                />
              </Tooltip>
            ))}
          </FormGroup>
        </Box>
      ) : null}

      <Divider />
      <Button
        variant="contained"
        startIcon={<SearchIcon />}
        onClick={executeSearch}
        sx={{ m: 2 }}
      >
        {t("search")}
      </Button>

      <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 2, p:2 }}>
        <DatePicker
          searchTemporal={searchTemporal}
          setSearchTemporal={setSearchTemporal}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onChange={() => {}}
        />

        {supportsSorting && (
          <FormControl fullWidth size="small" disabled={selectedCollections.length > 1}>
            <InputLabel>{t('sortBy')}</InputLabel>
            <Select value={sortby} label={t('sortBy')} onChange={(e) => setSortby(e.target.value)}>
              <MenuItem value="">{t('noSort')}</MenuItem>
              <MenuItem value="-datetime">{t('newestFirst')}</MenuItem>
              <MenuItem value="+datetime">{t('oldestFirst')}</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>
    </Box>
  );
}