import { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "../../AppContext";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, CircularProgress, IconButton, Link, Tooltip, Typography } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FilterValue, STACCollection, STACQueryable} from "../../types";
import FilterWidget from "./FilterWidget";
import { getQueryables } from "../../services/StacService";

/**
 * The properties required to populate the filters panel.
 *
 * @interface FilterPanelProps
 * @typedef {FilterPanelProps}
 */
export interface FilterPanelProps {
    /**
     * The currently selected collections.
     *
     * @type {STACCollection[]}
     */     
    selectedCollections: STACCollection[];
    /**
     * Function that recounts the number of currently applied filters
     * 
     * @returns 
     * 
     */
    countFilters: () => number;
    /**
     * Function that clears all filters
     * 
     * @returns 
     * 
     */
    clearFilters: () => void;
    /** The Callback fired when clicking outside the popover to close it */
    onClose: () => void;
    /**
     * Callback to execute a search when clicking the Apply button
     */
    executeSearch: () => void;
}

/**
 * The Panel for displaying filters.
 *
 * @param {STACCollection[]} props.selectedCollections
 * @returns {React.ElementType}
 */
const FilterPanel: React.FC<FilterPanelProps> = ({
        selectedCollections, 
        countFilters, 
        clearFilters,
        onClose,
        executeSearch}) => {
    
    const {
        stacEndpoint, 
        filters,
        setFilters,
        authToken,
        bbox,
        t
    } = useContext(AppContext)!;

    const [loading, setLoading] = useState(false);
    const [queryablesMap] = useState(new Map<string, Record<string, STACQueryable>>);

    /**
     * Local copy of the filter values
     */
    const [valuesMap] = useMemo(() => {
        const valuesMap = new Map<string, Map<string, FilterValue[]>>();
        Object.keys(filters).forEach((collectionName) => {
            const innerMap = new Map<string, FilterValue[]>();
            
            filters[collectionName].forEach((filterValue) => {
                const list = innerMap.get(filterValue.fieldKey) || [];
                innerMap.set(filterValue.fieldKey, [...list, filterValue]);
            });
            
            valuesMap.set(collectionName, innerMap);
        });

        return [valuesMap];
    }, [filters]);

    const handleApply= () => {
        executeSearch();
        onClose();
    };

    /**
     * Stores the new filter info in the AppContext
     * 
     * @param collectionName 
     * @param updatedFilterValue 
     */
    const updateFilters = (collectionName: string, updatedFilterValue: FilterValue) => {
        let collectionFilters: FilterValue[] = filters[collectionName];
        
        if(!collectionFilters) {
            collectionFilters = [];
        }

        const existingFilter = collectionFilters.find((field) => field.id === updatedFilterValue.id)

        if(existingFilter) {
            existingFilter.operation = updatedFilterValue.operation;
            existingFilter.value = updatedFilterValue.value;
            existingFilter.type = updatedFilterValue.type;
        }
        else {
            collectionFilters.push(updatedFilterValue);
        }

        const updatedFilters = {
          ...filters,
          [collectionName]: collectionFilters  
        };

        setFilters(updatedFilters);
        countFilters();
    };

    /**
     * Calls the queryables endpoint for each selected collection
     * to get the STACQueryables used to build the panel
     */
    useEffect(() => {
        const fetchFilters = async () => {
            setLoading(true);

            try {
                for(const collection of selectedCollections) {
                    const collectionName = collection.id
                    const queryablesUrl = collection.links.find(link => link.rel.includes('queryables') && link.type.includes('json'))?.href;

                    if(queryablesUrl) {
                        const queryables:Record<string, STACQueryable> = await getQueryables(queryablesUrl, authToken);
                        queryablesMap.set(collectionName, queryables);
                        let collectionValuesMap = valuesMap.get(collectionName);

                        if(!collectionValuesMap) {
                            collectionValuesMap = new Map<string, FilterValue[]>();
                            valuesMap.set(collectionName, collectionValuesMap)
                        }

                        Object.entries(queryables).map(([qName, queryable]) => {
                            if(queryable) {
                                let filterList = collectionValuesMap.get(qName);
                                
                                if(!filterList) {
                                    filterList = [];
                                    collectionValuesMap.set(qName, filterList);
                                }

                                if(filterList.length === 0) {
                                    const newFilter: FilterValue = {id: `${qName}-0`, fieldKey: qName};
                                    filterList.push(newFilter);
                                }
                            }
                        });
                    }
                }
            } 
            catch (e) {
                console.warn("Queryables for collection unreachable", e); 
            }
            finally { 
                setLoading(false); 
            }
        };

        fetchFilters();
    }, [stacEndpoint, authToken, selectedCollections, queryablesMap, filters, valuesMap]);

    return (
        <Box sx={{width: '100%', height: '100%', overflowY: 'auto', p: 1}}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, overflow: 'hidden' }}>
                <Typography variant="h6" color="primary" >{t('filters')}</Typography>
                {countFilters() > 0 &&
                    <Tooltip title={t('clearFiltersHover')}>
                        <Link sx={{ 
                            display: 'flex', gap: 1, pb: 1, size:'small', cursor:'pointer', 
                            position: 'absolute', top: 7, right: 40
                        }}  
                        onClick={clearFilters}>
                                {t('clear')} ({countFilters()})
                        </Link>
                    </Tooltip>
                }                
                <IconButton sx={{ position: 'absolute', top: 0, right: 0}}
                    onClick={onClose}> 
                    <CloseIcon />
                </IconButton>
            </Box>
            {loading ? <Box  sx={{width:'75vw', maxWidth: 576, alignItems: 'center'}}><CircularProgress /></Box> : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
                    {
                        [...queryablesMap.entries()].map(([collectionName, queryables]) => (
                            <Accordion 
                                key={`${collectionName}-search-panel`}
                                defaultExpanded={selectedCollections.length === 1}
                                disableGutters
                                elevation={0}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    overflow: 'hidden', 
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ border: '1px solid', borderColor: 'divider' }}>
                                    <Typography sx={{fontSize: 'large'}}>{collectionName}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Box key={collectionName} sx={{ mb: 1 }}>
                                    {
                                        queryables === undefined ? (
                                            <Typography sx={{fontSize: 'small'}}>t('noFilters')</Typography>
                                        ) : (
                                            Object.entries(queryables).map(([qName, queryable]) => 
                                                queryable ? 
                                                    <FilterWidget
                                                        key={`${collectionName}-queryable-${qName}`}
                                                        collectionName={collectionName}
                                                        filterData={valuesMap.get(collectionName)?.get(qName) ?? []} 
                                                        qName={qName}
                                                        queryable={queryable}
                                                        updateFilterHandler={updateFilters}
                                                    >
                                                    </FilterWidget>
                                                : (
                                                   <Typography sx={{fontSize: 'small'}}>t('noFilters')</Typography>
                                                )
                                            )
                                        )
                                    }
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        ))
                    }

                    <Box sx={{display: 'flex', flexDirection: 'row'}}>
                        <Tooltip title={t('applyTooltip')}>
                            <Button onClick={handleApply} variant="contained" disabled={bbox === null}>
                                {t('apply')}
                            </Button>
                        </Tooltip>
                        {countFilters() > 0 &&
                            <Tooltip title={t('clearFiltersHover')}>
                                <Link sx={{ display: 'flex', gap: 1, pb: 1, size:'small', cursor:'pointer', marginLeft: 'auto' }}  onClick={clearFilters}>
                                        {t('clear')} ({countFilters()})
                                </Link>
                            </Tooltip>
                        }
                    </Box>
                </Box>
            )}
        </Box>
    );
}

export default FilterPanel;