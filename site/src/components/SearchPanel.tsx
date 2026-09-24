import React, { useEffect, useState, useContext, useCallback } from 'react';
import { Box, Typography, Checkbox, FormControlLabel, FormGroup, Divider, Select, MenuItem, FormControl, InputLabel, CircularProgress, Button, Popover, Tooltip, Badge, Radio } from '@mui/material';
import axios from 'axios';
import { AppContext } from '../AppContext';
import type { STACCollection } from '../types'; 
import FilterIcon from '@mui/icons-material/FilterAlt';
import FilterPanel from './filters/FilterPanel';
import DatePicker from './datepicker/DatePicker';
import { getCollections } from '../services/StacService';
import { fields } from '../session';
import { useIsMobile } from '../utils/RenderingUtils';

/**
 * Properties for the SearchPanel component.
 */
export interface SearchPanelProps {
  /** The current URL of the STAC catalog API */
  stacEndpoint: string;
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
  /** Callback to execute a search with the current AOI*/
  executeSearch: () => void;
}

/**
 * Sidebar component that fetches available STAC collections and provides 
 * form controls for filtering searches by temporal extent and pagination limits.
 * * @param {SearchPanelProps} props - The properties controlling the form states.
 * @returns {JSX.Element} The rendered Search Panel drawer content.
 */
export default function SearchPanel({ 
  stacEndpoint, selectedCollections, setSelectedCollections,
  searchTemporal, setSearchTemporal, startDate, setStartDate, endDate, setEndDate, supportsSearch,
  supportsSorting, sortby, setSortby, executeSearch
}: SearchPanelProps) {
  
  const [collections, setCollections] = useState<STACCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedFiltersCount, setAppliedFiltersCount] = useState<number>(0);
  const { authToken, setIsAuthOpen, filters, setFilters, t } = useContext(AppContext)!; 
  const [filterButtonEl, setFilterButtonEl] = useState<HTMLButtonElement | null>(null);

  const isMobile = useIsMobile();

  /**
   * Function that counts the currently applied filters
   * @returns The number of currently applied filters
   */
  const countFilters = useCallback(():number => {
    let count = 0;

    if (filters) {
      Object.keys(filters).forEach((collectionName) => {
          filters[collectionName].forEach((filterValue) => {
              if(filterValue.operation && filterValue.value) {
                count = count + 1;
              }
          });  
      });
    };

    setAppliedFiltersCount(count);
    return count;
  }, [filters]);

  useEffect(() => {
    /**
     * Fetches the available geospatial collections from the active STAC endpoint.
     * Uses the authorization token if one is provided in the AppContext.
     * * @async
     */
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const collections = await(getCollections(stacEndpoint, authToken));
        setCollections(collections);
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 401)) {
          setIsAuthOpen(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, [stacEndpoint, authToken, setIsAuthOpen]);

  /**
   * Recounts the number of applied filters whenever
   * the filters are changed or the filters panel opens/closes
   */
  useEffect(() => {
    const getAppliedCount = () => {
        countFilters();
      };

    getAppliedCount();
  }, [countFilters, filters, filterButtonEl]);

  /**
   * Set selected collections to match filters saved in session
   */
  useEffect(() => {

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

  }, [collections, setCollections, setSelectedCollections]);

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
          <Button
            onClick={(e) => setFilterButtonEl(e.currentTarget)}
            sx={{ minWidth: "40px", p: 0, alignSelf: 'center' }}
            disabled={selectedCollections.length !== 1}
          >
            <Badge color="warning" badgeContent={appliedFiltersCount}>
              {<FilterIcon sx={{color: (selectedCollections.length === 1 ? "white" : "grey")}}/>}
            </Badge>
          </Button>
        </Tooltip>
      </Box>

      <Popover
        open={Boolean(filterButtonEl)}
        anchorEl={filterButtonEl}
        onClose={() => setFilterButtonEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: (isMobile ? "right" : "left") }}
        sx={{ height: "80svh" }}
      >
        <FilterPanel
          selectedCollections={selectedCollections}
          countFilters={countFilters}
          clearFilters={clearFilters}
          onClose={() => setFilterButtonEl(null)}
          executeSearch={executeSearch}
        />
      </Popover>

      {loading ? (
        <CircularProgress size={24} sx={{ my: 2, alignSelf: "center" }} />
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            p: 2,
          }}
        >
          <FormGroup>
            {collections.map((c) => (
              <Tooltip title={c.description || c.title || c.id}>
                <FormControlLabel
                  key={c.id}
                  control={
                    supportsSearch ?
                      <Checkbox
                        size="small"
                        checked={selectedCollections.includes(c)}
                        onChange={() => toggleCollection(c)}
                      />
                    :
                      <Radio
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
      )}

      <Divider />
      <Typography 
        variant="caption" 
        sx={{ 
          fontStyle: "italic", 
          minHeight: "5vh", 
          mb: 2, 
          p: 2,
          ...(!isMobile && { fontSize: "medium" })
        }}
      >
        {t("drawAoi")}
      </Typography>

      <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 2, p:2 }}>
        <Tooltip title={t('temporalExtent')}>
          <Box> {/* box needed to add tooltip to date picker */}
            <DatePicker
              searchTemporal={searchTemporal}
              setSearchTemporal={setSearchTemporal}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              onChange={() => {}}
            />
          </Box>
        </Tooltip>

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