import type { FilterValue, STACQueryable } from "../../types";
import { Box, Typography } from "@mui/material";
import StringFilter from "./StringFilter";
import IntegerFilter from "./IntegerFilter";
import DateTimeFilter from "./DateTimeFilter";
import NumberFilter from "./NumberFilter";
import QueryableChoiceFilter from "./QueryableChoiceFilter";

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
    const queryableKey = `${qName}-${JSON.stringify(queryable)}`;
    const queryableType = Array.isArray(queryable.type)
        ? queryable.type.find(typeName => typeName !== 'null')
        : queryable.type;
    const isDateTime = queryableType === 'datetime'
        || (queryableType === 'string' && (queryable.format === 'date-time' || queryable.contentEncoding === 'date-time'));
    const fieldTitle = queryable.title || qName;

    /**
     * Selects the Filter element type to be displayed for a given FilterValue
     * 
     * @param filterValue The FilterValue to be displayed
     * @returns 
     */
    const getFilterForField = (filterValue: FilterValue) => {
        if (queryable.enum?.length || queryableType === 'boolean') {
            return (
                <QueryableChoiceFilter
                    key={filterValue.id}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (queryableType === 'string' && (!queryable.format || queryable.format != 'date-time') 
                && (!queryable.contentEncoding || queryable.contentEncoding != 'date-time')) {

            return (
                <StringFilter
                    key={queryableKey}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (queryableType === 'number') {
            return (
                <NumberFilter
                    key={queryableKey}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (queryableType === 'integer') {
            return (
                <IntegerFilter
                    key={queryableKey}
                    collectionName={collectionName}
                    filterData={filterValue}
                    queryable={queryable}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        } else if (isDateTime) {

            return (
                <DateTimeFilter
                    key={queryableKey}
                    collectionName={collectionName}
                    filterData={filterValue}
                    updateFilterHandler={updateFilterHandler}
                />
            );
        }

        return null;
    };

    /**
     * The array of Filter elements belonging to this widget
     */
    const fields = filterData.map(getFilterForField).filter(Boolean);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 0.5 }}>
            {fields.map((field) => (
                <Box
                    key={qName}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'left',
                        gap: 0.5,
                        mb: 0.5,
                        width: '75vw',
                        maxWidth:576
                    }}
                >
                    {isDateTime && <Typography variant="body2">{fieldTitle}</Typography>}

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