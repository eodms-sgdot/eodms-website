import { Alert, AlertTitle, Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, type SelectChangeEvent } from "@mui/material"
import { useContext, useId } from "react";
import { AppContext } from "../../AppContext";
import PartialDateField from "./PartialDateField";
import { dateRangeError } from "../../utils/PartialDates";

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
    const helpId = useId();
    const errorId = useId();
    const dateError = searchTemporal === 'custom' ? dateRangeError(startDate, endDate) : undefined;
    const describedBy = [helpId, dateError ? errorId : ''].filter(Boolean).join(' ');

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
    const startChange = (value: string) => {
        setStartDate(value);
        onChange(value, 'startDate');
    }

    /**
     * Handles a new endDate being selected
     * @param event 
     */
    const endChange = (value: string) => {
        setEndDate(value);
        onChange(value, 'endDate');
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column'}}>
            <FormControl fullWidth size="small" >
                <InputLabel>{t('temporalExtent')}</InputLabel>
                <Select value={searchTemporal} label={t('temporalExtent')} onChange={temporalChange}>
                    <MenuItem value="anytime">{t('anytime')}</MenuItem>
                    <MenuItem value="1">{t('last24Hours')}</MenuItem>
                    <MenuItem value="2">{t('last48Hours')}</MenuItem>
                    <MenuItem value="30">{t('last30')}</MenuItem>
                    <MenuItem value="90">{t('last90')}</MenuItem>
                    <MenuItem value="365">{t('last1Year')}</MenuItem>
                    <MenuItem value="custom">{t('customDate')}</MenuItem>
                </Select>
            </FormControl>

            {searchTemporal === 'custom' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                    <PartialDateField label={t('startDate')} value={startDate} onChange={startChange}
                        error={!!dateError} describedBy={describedBy} />
                    <PartialDateField label={t('endDate')} value={endDate} onChange={endChange}
                        error={!!dateError} describedBy={describedBy} />
                    {dateError && <FormHelperText id={errorId} error role="alert" sx={{ m: 0 }}>{t(dateError)}</FormHelperText>}
                    <Alert severity="info" id={helpId} sx={{
                        px: 1, py: 0.5, fontSize: '0.7rem', lineHeight: 1.35,
                        '& .MuiAlert-message': { minWidth: 0, py: 0 },
                        '& .MuiAlert-icon': { fontSize: 18, mr: 0.75, py: 0 },
                    }}>
                        <AlertTitle sx={{ fontSize: '0.75rem', lineHeight: 1.4, mb: 0.25 }}>{t('dateSearchTips')}</AlertTitle>
                        <Box>{t('dateBriefHelp')}</Box>
                        <Box component="details" sx={{ mt: 0.5 }}>
                            <Box component="summary" sx={{ cursor: 'pointer' }}>{t('dateEntryHelp')}</Box>
                            <Box sx={{ my: 1 }}>{t('datePartialHelp')}</Box>
                            <Box sx={{ mb: 1 }}>{t('dateKeyboardHelp')}</Box>
                            <Box>{t('dateCalendarHelp')}</Box>
                        </Box>
                    </Alert>
                </Box>
            )}
        </Box>
    )
}

export default DatePicker;