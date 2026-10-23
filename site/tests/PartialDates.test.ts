import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customDateRange, dateRangeError, dateRangeEndpoint, daysInMonth, readDateParts, writeDateParts } from '../src/utils/PartialDates.ts';

process.env.TZ = 'UTC';

test('whole-year, month, day, hour and minute intervals have inclusive STAC endpoints', () => {
    const cases = [
        ['1985', '1985-01-01T00:00:00Z/1985-12-31T23:59:59Z'],
        ['1985-10', '1985-10-01T00:00:00Z/1985-10-31T23:59:59Z'],
        ['2024-02', '2024-02-01T00:00:00Z/2024-02-29T23:59:59Z'],
        ['2023-02', '2023-02-01T00:00:00Z/2023-02-28T23:59:59Z'],
        ['1985-10-26', '1985-10-26T00:00:00Z/1985-10-26T23:59:59Z'],
        ['1985-10-26T14', '1985-10-26T14:00:00Z/1985-10-26T14:59:59Z'],
        ['1985-10-26T14:20', '1985-10-26T14:20:00Z/1985-10-26T14:20:59Z'],
        ['1985-10-26T14:20:30', '1985-10-26T14:20:30Z/1985-10-26T14:20:30Z'],
        ['0001', '0001-01-01T00:00:00Z/0001-12-31T23:59:59Z'],
        ['9999', '9999-01-01T00:00:00Z/9999-12-31T23:59:59Z'],
    ];
    for (const [input, expected] of cases) assert.equal(customDateRange(input, input), expected, input);
});

test('open bounds omit only the intended side; mixed precision includes the end period', () => {
    assert.equal(customDateRange('', ''), undefined);
    assert.equal(customDateRange('..', '..'), undefined);
    assert.equal(customDateRange('1985', ''), '1985-01-01T00:00:00Z/..');
    assert.equal(customDateRange('', '1985-10'), '../1985-10-31T23:59:59Z');
    assert.equal(customDateRange('1985-10-26T14', '1985'),
        '1985-10-26T14:00:00Z/1985-12-31T23:59:59Z');
});

test('missing interior parts survive serialization but prevent a search', () => {
    for (const value of ['1985--26', '1985-10-26T:30', 'T14', '-02-29']) {
        assert.deepEqual(readDateParts(writeDateParts(readDateParts(value))), readDateParts(value));
        assert.equal(dateRangeError(value, ''), 'invalidDateParts', value);
    }
    assert.equal(writeDateParts(readDateParts('1985')), '1985');
    assert.equal(writeDateParts(readDateParts('')), '');
});

test('leading zero during segment editing is retained but cannot be submitted', () => {
    const editing = readDateParts('1985-00');
    assert.equal(editing.month, 0);
    assert.equal(writeDateParts(editing), '1985-00');
    assert.equal(dateRangeError('1985-00', ''), 'invalidDateParts');
    assert.equal(dateRangeError('1985-01', ''), undefined);
});

test('calendar boundaries and malformed input cannot become an unrestricted search', () => {
    for (const value of ['0000', '123456', '2023-02-29', '2024-02-30', '2024-04-31',
        '1985-00', '1985-13', '1985-10-00', '1985-10-26T24', '1985-10-26T14:60',
        '1985-10-26T14:30:60', 'not a date', '--', '1985Z', '1985-10-26T14:30:00+25:00']) {
        assert.equal(dateRangeError(value, ''), 'invalidDateParts', value);
    }
    assert.equal(dateRangeError('1986', '1985'), 'invalidDateRange');
    assert.equal(dateRangeError('1985-10', '1985'), undefined);
    assert.equal(daysInMonth(2023, 2), 28);
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(null, 2), 29);
    assert.equal(daysInMonth(2024, 4), 30);
});

test('stored absolute collection-filter timestamps retain their instant', () => {
    assert.equal(dateRangeEndpoint('1985-10-26T14:20:30Z', 'end'), '1985-10-26T14:20:30Z');
    assert.equal(dateRangeEndpoint('1985-10-26T14:20:30+02:00', 'start'), '1985-10-26T12:20:30Z');
    assert.equal(dateRangeError('2023-02-29T14:20:30Z', ''), 'invalidDateParts');
});

test('local timezone conversion and daylight-saving transitions are explicit', () => {
    process.env.TZ = 'America/Toronto';
    try {
        assert.equal(customDateRange('2024-03-10', '2024-03-10'),
            '2024-03-10T05:00:00Z/2024-03-11T03:59:59Z');
        assert.equal(customDateRange('2024-11-03', '2024-11-03'),
            '2024-11-03T04:00:00Z/2024-11-04T04:59:59Z');
        assert.equal(dateRangeEndpoint('2024-10-22T14:20', 'start'), '2024-10-22T18:20:00Z');
        assert.equal(dateRangeError('2024-03-10T02:30', ''), 'invalidLocalTime');
        assert.equal(dateRangeError('', '9999'), 'invalidDateParts');
    } finally {
        process.env.TZ = 'UTC';
    }
});
