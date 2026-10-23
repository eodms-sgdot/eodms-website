import { useContext, useId, useLayoutEffect, useRef } from 'react';
import { Alert, Box, Button, FormHelperText, IconButton, Tooltip, Typography } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import { CalendarDate, CalendarDateTime, createCalendar, parseDate } from '@internationalized/date';
import { useDateField, useDateSegment } from 'react-aria';
import { useDateFieldState, type DateFieldState, type DateSegment } from 'react-stately';
import { AppContext } from '../../AppContext';
import { DateSearchError, datePartKeys, daysInMonth, readDateParts, writeDateParts, type DateParts } from '../../utils/PartialDates';

interface PartialDateFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: boolean;
    describedBy?: string;
}

function Segment({ segment, state, maxDay }: { segment: DateSegment; state: DateFieldState; maxDay: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const boundedSegment = segment.type === 'day' ? { ...segment, maxValue: maxDay } : segment;
    const { segmentProps } = useDateSegment(boundedSegment, state, ref);
    return (
        <Box {...segmentProps} ref={ref} sx={{
            px: segment.isEditable ? 0.15 : 0,
            minWidth: segment.isEditable ? `${segment.placeholder.length}ch` : undefined,
            textAlign: 'end', fontVariantNumeric: 'tabular-nums',
            color: segment.isPlaceholder ? 'text.secondary' : 'text.primary',
            borderRadius: 0.5,
            '&:focus': { outline: '2px solid', outlineColor: 'primary.main', bgcolor: 'action.selected' },
        }}>{segment.text}</Box>
    );
}

export default function PartialDateField(props: PartialDateFieldProps) {
    const { t } = useContext(AppContext)!;
    try {
        readDateParts(props.value);
    } catch (error) {
        if (!(error instanceof DateSearchError)) throw error;
        return <Alert severity="error" action={<Button onClick={() => props.onChange('')}>{t('clear')}</Button>}>
            {props.label}: {t(error.translationKey)}
        </Alert>;
    }
    return <DateField {...props} />;
}

function DateField({ label, value, onChange, error, describedBy }: PartialDateFieldProps) {
    const { language, t } = useContext(AppContext)!;
    const ref = useRef<HTMLDivElement>(null);
    const calendar = useRef<HTMLInputElement>(null);
    const helpId = useId();
    const props = {
        label,
        granularity: 'second' as const,
        hourCycle: 24 as const,
        shouldForceLeadingZeros: true,
        placeholderValue: new CalendarDateTime(2000, 1, 1),
        minValue: new CalendarDate(1, 1, 1),
        maxValue: new CalendarDate(9999, 12, 31),
        'aria-describedby': [describedBy, helpId].filter(Boolean).join(' '),
    };
    const state = useDateFieldState({ ...props, locale: `${language}-CA`, createCalendar });
    const parts: DateParts = { year: null, month: null, day: null, hour: null, minute: null, second: null };
    for (const key of datePartKeys) {
        const segment = state.segments.find(segment => segment.type === key);
        parts[key] = segment && !segment.isPlaceholder ? segment.value ?? null : null;
    }
    const lastValue = useRef<string | undefined>(undefined);
    const restoring = useRef<DateParts | null>(null);
    const maxDay = daysInMonth(parts.year, parts.month);
    // Restore one segment per render: Aria's setters operate on the current render's state.
    useLayoutEffect(() => {
        if (value !== lastValue.current) {
            restoring.current = readDateParts(value);
            lastValue.current = value;
        }
        if (restoring.current) {
            const target = restoring.current;
            const key = datePartKeys.find(key => parts[key] !== target[key]);
            if (key) {
                const n = target[key];
                if (n === null) state.clearSegment(key);
                else state.setSegment(key, n);
                return;
            }
            restoring.current = null;
        }
        if (parts.day !== null && parts.day > maxDay) {
            state.setSegment('day', maxDay);
            return;
        }
        const next = writeDateParts(parts);
        if (next !== lastValue.current) {
            lastValue.current = next;
            onChange(next);
        }
    });
    const adjustDay = (amount: number) =>
        state.setSegment('day', (((parts.day ?? 1) - 1 + amount) % maxDay + maxDay) % maxDay + 1);
    // Both Aria hooks share accessibility data keyed by the state object's identity.
    const boundedState: DateFieldState = {
        ...state,
        increment: type => type === 'day' ? adjustDay(1) : state.increment(type),
        decrement: type => type === 'day' ? adjustDay(-1) : state.decrement(type),
        incrementPage: type => type === 'day' ? adjustDay(7) : state.incrementPage(type),
        decrementPage: type => type === 'day' ? adjustDay(-7) : state.decrementPage(type),
        incrementToMax: type => type === 'day' ? state.setSegment('day', maxDay) : state.incrementToMax(type),
        decrementToMin: type => type === 'day' ? state.setSegment('day', 1) : state.decrementToMin(type),
    };
    const { labelProps, fieldProps } = useDateField(props, boundedState, ref);
    const precision = datePartKeys.findLast(key => parts[key] !== null);
    const precisionKey = precision === 'year' ? 'datePrecisionYear' : precision === 'month' ? 'datePrecisionMonth'
        : precision === 'day' ? 'datePrecisionDay' : precision === 'hour' ? 'datePrecisionHour'
            : precision === 'minute' ? 'datePrecisionMinute' : 'datePrecisionSecond';
    const calendarValue = parts.year !== null && parts.month !== null && parts.day !== null
        ? new CalendarDate(parts.year, parts.month, Math.min(parts.day, maxDay)).toString() : '';

    return (
        <Box>
            <Typography {...labelProps} component="span" variant="body2">{label}</Typography>
            <Box sx={{
                display: 'flex', alignItems: 'center', border: '1px solid',
                borderColor: error ? 'error.main' : 'divider', borderRadius: 1, mt: 0.5, minHeight: 40,
                '&:focus-within': { borderColor: error ? 'error.main' : 'primary.main' },
            }}>
                <Box {...fieldProps} ref={ref} aria-invalid={error || undefined} sx={{
                    display: 'flex', flex: 1, flexWrap: 'wrap', alignItems: 'center',
                    p: 0.75, minWidth: 0, fontSize: '0.875rem',
                }}>
                    {state.segments.map((segment, index) => (
                        <Segment key={index} segment={segment} state={boundedState} maxDay={maxDay} />
                    ))}
                </Box>
                <Tooltip title={t('chooseDate')}>
                    <IconButton size="small" aria-label={`${label}: ${t('chooseDate')}`}
                        onClick={() => calendar.current?.showPicker()}>
                        <CalendarMonthIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('clear')}>
                    <span>
                        <IconButton size="small" aria-label={`${label}: ${t('clear')}`}
                            onClick={() => state.setValue(null)} disabled={!precision}>
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <input ref={calendar} type="date" tabIndex={-1} aria-hidden="true"
                    min="0001-01-01" max="9999-12-31" value={calendarValue}
                    style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0 }}
                    onChange={event => {
                        if (!event.target.value) return;
                        const date = parseDate(event.target.value);
                        onChange(writeDateParts({ ...parts, year: date.year, month: date.month, day: date.day }));
                    }} />
            </Box>
            <FormHelperText id={helpId} sx={{ m: 0, mt: 0.5 }}>
                {precision ? t(precisionKey) : t('dateOpenEndpoint')}
            </FormHelperText>
        </Box>
    );
}
