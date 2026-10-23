/**
 * Formats a JavaScript Date object into an ISO 8601 string compatible with strict STAC parsers.
 * Strips milliseconds to prevent backend parsing errors.
 * * @param {Date} date - The date to format.
 * @returns {string} - The formatted STAC datetime string (e.g., "2023-01-01T00:00:00Z").
 */
export const formatStacDate = (date: Date): string => {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

export const formatStacDateAsLocalInput = (date: Date): string => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * Creates a date range starting a number of days in the past until now
 * @param daysToGoBack The number of days ago to set the startDate
 * @returns [startDate = {daysToGoBack} days ago, endDate = now]
 */
export const createDateRange = (daysToGoBack: string): string[] => {
    const days = parseInt(daysToGoBack, 10);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = formatStacDate(start);
    const endStr = formatStacDate(end);

    const ret: string[] = [];
    ret.push(startStr);
    ret.push(endStr);
    return ret;
}