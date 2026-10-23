import type { FilterValue, STACQueryable} from "../types";
import { createDateRange } from "./DateUtils";
import { customDateRange, DateSearchError } from "./PartialDates";
import { buildQueryableFilterClauses, isFilterAllowedByQueryables } from "./QueryableFilterUtils";

const TEMPORAL_FILTER_FIELDS = new Set(["datetime", "start_datetime", "end_datetime"]);

export const isTemporalFilterField = (fieldKey: string): boolean =>
    TEMPORAL_FILTER_FIELDS.has(fieldKey.toLowerCase());

/**
 * Builds a CQL2 filter query parameter based on the supplied filters
 * @param filters The filters to be added to the 
 * @returns a CQL2 filter query parameter to be added to STAC search requests
 */
export const buildFilter = (
    filters: FilterValue[] = [],
    queryables?: Record<string, STACQueryable>,
): string => {
    const clauses = buildQueryableFilterClauses(filters, queryables);

    for (const filterValue of filters) {
        const { fieldKey, operation, type, value } = filterValue;
        if (isTemporalFilterField(fieldKey)) continue;
        if (!isFilterAllowedByQueryables(filterValue, queryables)) continue;

        if (!operation || value === undefined || value === '') continue;

        if (type === 'duration' && value !== null) {
            if (value !== 'anytime') {
                const [start, end] = createDateRange(value.toString());
                if (start && end) {
                    clauses.push(`${fieldKey} >= TIMESTAMP('${start}') AND ${fieldKey} <= TIMESTAMP('${end}')`);
                }
            }
        } else if (type === 'date-range') {
            if (!Array.isArray(value) || value.length !== 2 ||
                value.some(date => date !== null && typeof date !== 'string')) {
                throw new DateSearchError('invalidDateParts');
            }
            const range = customDateRange(String(value[0] ?? ''), String(value[1] ?? ''));
            if (range) {
                const [start, end] = range.split('/');
                const dateClauses: string[] = [];
                if (start !== '..') dateClauses.push(`${fieldKey} >= TIMESTAMP('${start}')`);
                if (end !== '..') dateClauses.push(`${fieldKey} <= TIMESTAMP('${end}')`);
                if (dateClauses.length) clauses.push(dateClauses.join(' AND '));
            }
        }
    }

    return clauses.join(' AND ');
};