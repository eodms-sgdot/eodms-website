import { Box, FormControl, InputLabel, MenuItem, Select, TextField, type SelectChangeEvent } from "@mui/material"
import { useContext } from "react";
import { AppContext } from "../../AppContext";

/**
 * The properties required to populate the DatePicker.
 *
 * @interface DatePickerProps
 * @typedef {DatePickerProps}
 */
export interface DatePickerProps {
    /**
     * The initial date range option.
     *
     * @type {string}
     */     
    searchTemporal: string;
    /**
     * Callback for updating the date range
     * @param val 
     * @returns 
     */
    setSearchTemporal: (val: string) => void;
    /**
     * The initial startDate
     */
    startDate: string;
    /**
     * Callback for updating the startDate
     * @param val 
     * @returns 
     */
    setStartDate: (val: string) => void;
    /**
     * The initial endDate
     */
    endDate: string;
    /**
     * Callback for updating the endDate
     * @param val 
     * @returns 
     */
    setEndDate: (val: string) => void; 
    /**
     * Callback for when a value changes
     * @param newValue 
     * @param fieldName 
     * @returns 
     */
    onChange: (newValue: string, fieldName: string) => void; 
}

/**
 * A Widget for entering dates.
 *
 * @param {string} props.searchTemporal
 * @param {(val: string) => void} props.setSearchTemporal
 * @param {string} props.startDate
 * @param {(val: string) => void} props.setStartDate
 * @param {string} props.endDate
 * @param {(val: string) => void} props.setEndDate
 * @param {(newValue: string, fieldName: string) => void} props.onChange
 * @returns {React.ElementType}
 */
const DatePicker: React.FC<DatePickerProps> = ({
    searchTemporal, setSearchTemporal,
    startDate, setStartDate,
    endDate, setEndDate,
    onChange
}) => {

    const {t } = useContext(AppContext)!; 

    /**
     * Handles a new 'temporal' value being selected
     * @param event 
     */
    const temporalChange = (event: SelectChangeEvent) => {
        setSearchTemporal(event.target.value)
        onChange(event.target.value, 'temporal');
    }

    /**
     * Handles a new startDate being selected
     * @param event 
     */
    const startChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(event.target.value);
        onChange(event.target.value, 'startDate');
    }

    /**
     * Handles a new endDate being selected
     * @param event 
     */
    const endChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(event.target.value);
        onChange(event.target.value, 'endDate');
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column'}}>
            <FormControl fullWidth size="small" >
                <InputLabel>{t('temporalExtent')}</InputLabel>
                <Select value={searchTemporal} label={t('temporalExtent')} onChange={temporalChange}>
                    <MenuItem value="anytime">{t('anytime')}</MenuItem>
                    <MenuItem value="30">{t('last30')}</MenuItem>
                    <MenuItem value="90">{t('last90')}</MenuItem>
                    <MenuItem value="365">{t('last1Year')}</MenuItem>
                    <MenuItem value="custom">{t('customDate')}</MenuItem>
                </Select>
            </FormControl>

            {searchTemporal === 'custom' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1.5, border: '1px solid #ddd', borderRadius: 1, bgcolor: 'white' }}>
                    <TextField label={t('startDate')} type="datetime-local" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={startDate} onChange={startChange} />
                    <TextField label={t('endDate')} type="datetime-local" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={endDate} onChange={endChange} />
                </Box>
            )}
        </Box>
    )
}

export default DatePicker;