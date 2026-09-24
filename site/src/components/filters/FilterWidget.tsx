import { useMemo} from "react";
import type { FilterValue, STACQueryable } from "../../types";
import { Box, Typography } from "@mui/material";
import StringFilter from "./StringFilter";
import IntegerFilter from "./IntegerFilter";
import DateTimeFilter from "./DateTimeFilter";
import NumberFilter from "./NumberFilter";

/**
 * The properties required to populate filter fields.
 *
 * @interface FilterWidgetProps
 * @typedef {FilterWidgetProps}
 */
export interface FilterWidgetProps {
    /**
     * The name of the collection the filters belongs to.
     *
     * @type {string}
     */     
    collectionName: string;
    /**
     * The data for the filters.
     *
     * @type {FilterValue}
     */     
    filterData: FilterValue[];
    /**
     * The key of the STAC queryable property the filters apply to.
     *
     * @type {string}
     */     
    qName: string;
    /**
     * The STAC queryable field.
     *
     * @type {STACQueryable}
     */      
    queryable: STACQueryable;
    /**
     * A handler to handle what happens when a filter is updated.
     *
     * @type {(collectionName: string, filterData: FilterValue) => void}
     */    
    updateFilterHandler: (collectionName: string, filterData: FilterValue) => void;
}

/**
 * The widget containing Filter elements to enter filter values.
 *
 * @param {string} props.collectionName
 * @param {FilterValue} props.filterData
 * @param {string} props.qName  
 * @param {STACQueryable} props.queryable
 * @param {(collectionName: string, filterData: FilterValue) => void} props.updateFilterHandler
 * @returns {React.ElementType}
 */
const FilterWidget: React.FC<FilterWidgetProps> =({
    collectionName, 
    filterData, 
    qName, 
    queryable, 
    updateFilterHandler
}) => {

    /**
     * Selects the Filter element type to be displayed for a given FilterValue
     * 
     * @param filterValue The FilterValue to be displayed
     * @returns 
     */
    const getFilterForField = (filterValue: FilterValue) => {
        if (queryable.type === 'string' && (!queryable.format || queryable.format != 'date-time') 
                && (!queryable.contentEncoding || queryable.contentEncoding != 'date-time')) {

            return (
                <StringFilter
                    key={qName}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (queryable.type === 'number') {
            return (
                <NumberFilter
                    key={qName}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (queryable.type === 'integer') {
            return (
                <IntegerFilter
                    key={qName}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (queryable.type === 'datetime' || (queryable.type === 'string' && queryable.format && queryable.format === 'date-time')
                || (queryable.type === 'string' && queryable.contentEncoding && queryable.contentEncoding === 'date-time')) {

            return (
                <DateTimeFilter
                    key={qName}
                    collectionName={collectionName}
                    filterData={filterValue}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        // } else if (queryable.type === 'boolean') {
        //     return (
        //         <BooleanFilter
        //             key={qName}
        //             collectionName={collectionName}
        //             filterData={filterValue}
        //             queryable={queryable}
        //             updateFilterHandler={updateFilterHandler}
        //         />
        //     );
        }

        return null;
    };

    /**
     * The array of Filter elements belonging to this widget
     */
    const fields = useMemo(() => {
        const fieldArray = [];
        for (const filterField of filterData) {
            const field = getFilterForField(filterField);
            if (field) {
                fieldArray.push(field);
            }
        }
        return fieldArray;
    }, [filterData]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
            {fields.map((field) => (
                <Box
                    key={qName}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'left',
                        gap: 1,
                        mb: 1,
                        width: '75vw',
                        maxWidth:576
                    }}
                >
                    <Box sx={{display:'flex', flexDirection: 'row'}}>
                        <Typography variant="body2">{queryable.title ? queryable.title : qName}</Typography>
                    </Box>

                    {/* Filter Input */}
                    <Box sx={{ flexGrow: 1 }} >
                        {field}
                    </Box>

                    {/* Add / Remove Buttons */}
                    {/* {schema.allowMultiple &&
                        (index === 0 ? (
                        <IconButton aria-label="Add" onClick={handleFilterAdd}>
                            <AddIcon sx={{ ':hover': { color: 'green', cursor: 'pointer' } }} />
                        </IconButton>
                        ) : (
                        <IconButton aria-label="Remove" onClick={() => handleFilterRemoval(filterData[index].id)}>
                            <ClearIcon sx={{ ':hover': { color: 'red', cursor: 'pointer' } }} />
                        </IconButton>
                    ))} */}
                </Box>
            ))}
        </Box>
    )
}

export default FilterWidget;