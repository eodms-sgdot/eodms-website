import type { FilterDate, FilterValue} from "../types";
import { createDateRange } from "./DateUtils";

const TEMPORAL_FILTER_FIELDS = new Set(["datetime", "start_datetime", "end_datetime"]);

export const isTemporalFilterField = (fieldKey: string): boolean =>
    TEMPORAL_FILTER_FIELDS.has(fieldKey.toLowerCase());

/**
 * Builds a CQL2 filter query parameter based on the supplied filters
 * @param filters The filters to be added to the 
 * @returns a CQL2 filter query parameter to be added to STAC search requests
 */
export const buildFilter = (filters: FilterValue[]): string => {
    if(!filters || filters.length === 0) {
        return '';
    }

    const applicableFilters = filters.filter(filterValue => !isTemporalFilterField(filterValue.fieldKey));
    if (applicableFilters.length === 0) {
        return '';
    }
    
    const tokens:string[]  = []
    let first:boolean = true;

    applicableFilters.forEach((filterValue) => {
        const value = filterValue.value;
        const operation = filterValue.operation
        const type = filterValue.type;

        if(operation && value) {
            if(!first) {
                tokens.push(' AND ')
            }

            if(type === 'string') {
                tokens.push(filterValue.fieldKey);
                tokens.push(' ');
                tokens.push(operation);
                tokens.push(' \'');
                // CQL2 escapes a single quote inside a string literal by doubling it.
                tokens.push(value.toString().replace(/'/g, "''"));
                tokens.push('\' ');
                first = false;
            }
            else if(type === 'number') {
                tokens.push(filterValue.fieldKey);
                tokens.push(' ');
                tokens.push(operation);
                tokens.push(' ');
                tokens.push(value.toString());
                first = false;
            }
            else if(type === 'duration') {
                if(value !== 'anytime') {
                    const dates = createDateRange(value.toString())
                    const start = dates[0];
                    const end = dates[1];

                    if(start && end) {
                        tokens.push(filterValue.fieldKey);
                        tokens.push(' >= ');
                        tokens.push('TIMESTAMP(\'');
                        tokens.push(start.toString());
                        tokens.push('\')');
                        tokens.push(' AND ')
                        tokens.push(filterValue.fieldKey);
                        tokens.push(' <= ');
                        tokens.push('TIMESTAMP(\'');
                        tokens.push(end.toString());
                        tokens.push('\')');
                        first = false;
                    }
                }
            }
            else if(type === 'date-range') {
                const dates = value as unknown as FilterDate[]
                const start = dates[0];
                const end = dates[1];

                tokens.push(filterValue.fieldKey);
                tokens.push(' >= ');
                tokens.push('TIMESTAMP(\'');
                tokens.push(start.toString());
                tokens.push('\')');
                tokens.push(' AND ')
                tokens.push(filterValue.fieldKey);
                tokens.push(' <= ');
                tokens.push('TIMESTAMP(\'');
                tokens.push(end.toString());
                tokens.push('\')');
            }            
        }
    });

    return tokens.join('');
};