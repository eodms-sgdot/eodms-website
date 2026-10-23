import { useState } from "react";
import type { FilterValue } from "../../types";
import { Box } from "@mui/material";
import DatePicker from "../datepicker/DatePicker";
import { formatStacDateAsLocalInput } from "../../utils/DateUtils";

/**
 * The properties required to populate the filter field for a date-time type.
 *
 * @interface DateTimeFilterProps
 * @typedef {DateTimeFilterProps}
 */
interface DateTimeFilterProps {
    /**
     * The name of the collection the filter belongs to.
     *
     * @type {string}
     */    
    collectionName: string;
    /**
     * The data for the filter.
     *
     * @type {FilterValue}
     */    
    filterData: FilterValue;
    /**
     * A handler to handle what happens when a filter is updated.
     *
     * @type {(collectionName: string, filterData: FilterValue) => void}
     */    
    updateFilterHandler: (collectionName: string, filterData: FilterValue) => void;
}

/**
 * The Panel to enter filters for a date field.
 *
 * @param {string} props.collectionName
 * @param {FilterValue} props.filterData
 * @param {(collectionName: string, filterData: FilterValue) => void} props.updateFilterHandler
 * @returns {React.ElementType}
 */
const DateTimeFilter: React.FC<DateTimeFilterProps> = ({
    collectionName, 
    filterData, 
    updateFilterHandler
}) => {
    const dates = filterData.type === 'date-range' && Array.isArray(filterData.value) ? filterData.value : [];
    const restoreDate = (value: unknown): string => {
        if (typeof value !== 'string' || value === '..') return '';
        if (/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
            const date = new Date(value);
            return Number.isFinite(date.getTime()) ? formatStacDateAsLocalInput(date) : value;
        }
        return value;
    };
    const initTemporal = dates.length ? 'custom' : typeof filterData.value === 'string' && filterData.value
        ? filterData.value : 'anytime';
    const [searchTemporal, setSearchTemporal] = useState<string>(initTemporal);
    const [startDate, setStartDate] = useState<string>(() => restoreDate(dates[0]));
    const [endDate, setEndDate] = useState<string>(() => restoreDate(dates[1]));

    /**
     * Handler to handle what happens when a filter value is updated.
     * @param selectedValue 
     * @param fieldName 
     */
    const handleBetweenFilterValueChange = (selectedValue: string, fieldName: string) => {
        const isCustom = fieldName !== 'temporal' || selectedValue === 'custom';
        const newFilter: FilterValue = isCustom ? {
            ...filterData, operation: 'within', type: 'date-range',
            value: [
                (fieldName === 'startDate' ? selectedValue : startDate) || null,
                (fieldName === 'endDate' ? selectedValue : endDate) || null,
            ],
        } : {
            ...filterData, operation: 'within', type: 'duration',
            value: selectedValue === 'anytime' ? '' : selectedValue,
        };
        updateFilterHandler(collectionName, newFilter);
    };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 1, width: '75vw', maxWidth:566 }}>

        <Box sx={{width: '75vw'}}>
            <DatePicker 
                searchTemporal={searchTemporal}
                setSearchTemporal={setSearchTemporal}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                onChange={handleBetweenFilterValueChange}
            />
        </Box>
    </Box>
  );    
}

export default DateTimeFilter;