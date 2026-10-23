import { CalendarDate } from '@internationalized/date';

export const datePartKeys = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;
export type DatePart = typeof datePartKeys[number];
export type DateParts = Record<DatePart, number | null>;
export type DateSearchErrorKey = 'invalidDateParts' | 'invalidDateRange' | 'invalidLocalTime';

export class DateSearchError extends Error {
    readonly translationKey: DateSearchErrorKey;

    constructor(key: DateSearchErrorKey) {
        super(key);
        this.translationKey = key;
    }
}

export const daysInMonth = (year: number | null, month: number | null): number => {
    if (month === null || month === 0) return 31;
    const date = new CalendarDate(year ?? 2000, month, 1);
    return date.calendar.getDaysInMonth(date);
};

export const readDateParts = (value: string): DateParts => {
    if (value === '..') value = '';
    const match = /^(\d{0,4})(?:-(\d{0,2})(?:-(\d{0,2}))?)?(?:T(\d{0,2})(?::(\d{0,2})(?::(\d{0,2}))?)?)?$/.exec(value);
    if (!match) throw new DateSearchError('invalidDateParts');
    const part = (index: number): number | null => match[index] ? Number(match[index]) : null;
    const parts: DateParts = { year: part(1), month: part(2), day: part(3), hour: part(4), minute: part(5), second: part(6) };
    const limits = [9999, 12, 31, 23, 59, 59];
    datePartKeys.forEach((key, index) => {
        const n = parts[key];
        if (n !== null && (n < 0 || n > limits[index])) {
            throw new DateSearchError('invalidDateParts');
        }
    });
    return parts;
};

export const writeDateParts = (parts: DateParts): string => {
    const separators = ['', '-', '-', 'T', ':', ':'];
    const lastPart = datePartKeys.findLastIndex(key => parts[key] !== null);
    return datePartKeys.slice(0, lastPart + 1).map((key, index) =>
        separators[index] + (parts[key] === null ? '' : String(parts[key]).padStart(index === 0 ? 4 : 2, '0'))).join('');
};

export const validateDateParts = (parts: DateParts): void => {
    let missing = false;
    for (const key of datePartKeys) {
        if (parts[key] === null) missing = true;
        else if (missing) throw new DateSearchError('invalidDateParts');
        else if (['year', 'month', 'day'].includes(key) && parts[key] === 0) {
            throw new DateSearchError('invalidDateParts');
        }
    }
    if (parts.day !== null && parts.day > daysInMonth(parts.year, parts.month)) {
        throw new DateSearchError('invalidDateParts');
    }
};

/** Expand local reduced precision to inclusive whole-second STAC endpoints. */
export const dateRangeEndpoint = (value: string, boundary: 'start' | 'end'): string => {
    if (!value || value === '..') return '..';
    // Existing collection filters store full UTC timestamps rather than local input.
    const absolute = /^(.+)(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (absolute) {
        const parts = readDateParts(absolute[1]);
        validateDateParts(parts);
        if (parts.second === null) throw new DateSearchError('invalidDateParts');
        const date = new Date(value);
        if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) {
            throw new DateSearchError('invalidDateParts');
        }
        return date.toISOString().replace('.000Z', 'Z');
    }
    const parts = readDateParts(value);
    validateDateParts(parts);
    const end = boundary === 'end';
    if (parts.year === null) throw new DateSearchError('invalidDateParts');
    const year = parts.year;
    const month = parts.month ?? (end ? 12 : 1);
    const day = parts.day ?? (end ? daysInMonth(year, month) : 1);
    const hour = parts.hour ?? (end ? 23 : 0);
    const minute = parts.minute ?? (end ? 59 : 0);
    const second = parts.second ?? (end ? 59 : 0);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
        date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
        throw new DateSearchError('invalidLocalTime');
    }
    if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) {
        throw new DateSearchError('invalidDateParts');
    }
    return date.toISOString().replace('.000Z', 'Z');
};

export const customDateRange = (start: string, end: string): string | undefined => {
    const startDate = dateRangeEndpoint(start, 'start');
    const endDate = dateRangeEndpoint(end, 'end');
    if (startDate === '..' && endDate === '..') return undefined;
    if (startDate !== '..' && endDate !== '..' && new Date(startDate) > new Date(endDate)) {
        throw new DateSearchError('invalidDateRange');
    }
    return `${startDate}/${endDate}`;
};

export const dateRangeError = (start: string, end: string): DateSearchErrorKey | undefined => {
    try {
        customDateRange(start, end);
    } catch (error) {
        if (error instanceof DateSearchError) return error.translationKey;
        throw error;
    }
};
