import { useState } from "react";
import type { FilterDate, FilterValue, Duration } from "../../types";
import { Box } from "@mui/material";
import DatePicker from "../datepicker/DatePicker";
import { formatDateTimeLocalAsStac, formatStacDateAsLocalInput } from "../../utils/DateUtils";

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
    let initTemporal: string;

    const tmpStart: Date = new Date();
    tmpStart.setUTCHours(0);
    tmpStart.setUTCMinutes(0);
    tmpStart.setUTCSeconds(1);
    tmpStart.setUTCMilliseconds(0);

    const tmpEnd: Date = new Date();
    tmpEnd.setUTCHours(23);
    tmpEnd.setUTCMinutes(59);
    tmpEnd.setUTCSeconds(59);
    tmpEnd.setUTCMilliseconds(0);    

    let initStart: string = formatStacDateAsLocalInput(tmpStart);
    let initEnd: string = formatStacDateAsLocalInput(tmpEnd);
    
    if(filterData.value === 'anytime' || filterData.value === '1' || filterData.value === '2' || filterData.value === '30' || filterData.value === '90' || filterData.value === '365') {
        initTemporal = filterData.value as string;
    } 
    else if(filterData.value) {
        initTemporal = 'custom';
        const dates = filterData.value as FilterDate[];
        initStart = dates[0] ? formatStacDateAsLocalInput(new Date(dates[0] as unknown as string)): initStart;
        initEnd = dates[1] ? formatStacDateAsLocalInput(new Date(dates[1] as unknown as string)): initEnd;
    }
    else {
        initTemporal = 'anytime';
    }

    const [searchTemporal, setSearchTemporal] = useState<string>(initTemporal);
    const [startDate, setStartDate] = useState<string>(initStart);
    const [endDate, setEndDate] = useState<string>(initEnd);    
    filterData.operation = 'within';

    /**
     * Handler to handle what happens when a filter value is updated.
     * @param selectedValue 
     * @param fieldName 
     */
    const handleBetweenFilterValueChange = (selectedValue: string, fieldName: string) => {
        let newValue: string | number | [number, number] | FilterDate | [FilterDate, FilterDate] | Duration | undefined = '';
        let type: 'string' | 'number' | 'duration' | 'date-range' = 'duration';

        if (fieldName === 'temporal') {
            if(selectedValue === 'anytime') {
                newValue = '';
            }
            else if(selectedValue !== 'custom') {
                newValue = selectedValue as unknown as Duration;
            }
            else {
                const currentStartDate = startDate ? formatDateTimeLocalAsStac(startDate): undefined;
                const currentEndDate = endDate ? formatDateTimeLocalAsStac(endDate) : undefined;
                newValue = [currentStartDate as unknown as FilterDate, currentEndDate as unknown as FilterDate];
                type = 'date-range';
            }
        } 
        else if(fieldName === 'startDate') {
            const newStart = formatDateTimeLocalAsStac(selectedValue);
            const currentEndDate = endDate ? formatDateTimeLocalAsStac(endDate) : undefined;
            newValue = [newStart as unknown as FilterDate,  currentEndDate as unknown as FilterDate];
            type = 'date-range';
        }
        else if(fieldName === 'endDate') {
            const newEnd = formatDateTimeLocalAsStac(selectedValue);
            const currentStartDate = startDate ? formatDateTimeLocalAsStac(startDate): undefined;
            newValue = [currentStartDate as unknown as FilterDate, newEnd as unknown as FilterDate];
            type = 'date-range';
        }

        const newFilter: FilterValue = {...filterData, type: type, value: newValue};
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