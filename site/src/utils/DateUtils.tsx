/**
 * Formats a JavaScript Date object into an ISO 8601 string compatible with strict STAC parsers.
 * Strips milliseconds to prevent backend parsing errors.
 * * @param {Date} date - The date to format.
 * @returns {string} - The formatted STAC datetime string (e.g., "2023-01-01T00:00:00Z").
 */
export const formatStacDate = (date: Date): string => {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

/**
 * Creates a date range starting a number of days in the past until now
 * @param daysToGoBack The number of days ago to set the startDate
 * @returns [startDate = {daysToGoBack} days ago, endDate = now]
 */
export const createDateRange = (daysToGoBack: string): string[] => {
    const days = parseInt(daysToGoBack, 10);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const startStr = formatStacDate(start);
    const endStr = formatStacDate(end);

    const ret: string[] = [];
    ret.push(startStr);
    ret.push(endStr);
    return ret;
}