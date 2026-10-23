import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGeometryValidityFilter, buildQueryableFilterClauses } from '../src/utils/QueryableFilterUtils.ts';
import { hasUsableItemGeometry } from '../src/utils/STACItemUtils.ts';

test('uses current queryables and supports array enums without adding geometry constraints', () => {
    const queryables = {
        geometry_valid: { type: 'boolean' },
        'sar:polarizations': { type: 'array', enum: ['HH', 'HH HV'] },
        'nested:choices': { type: 'array', items: { type: 'string', enum: ['VV'] } },
        retired_field: undefined,
    };
    const filters = [
        { id: 'validity', fieldKey: 'geometry_valid', type: 'boolean', operation: '=', value: false },
        { id: 'polarization', fieldKey: 'sar:polarizations', type: 'string', operation: '=', value: 'HH HV' },
        { id: 'nested', fieldKey: 'nested:choices', type: 'string', operation: '=', value: 'VV' },
        { id: 'retired', fieldKey: 'retired_field', type: 'string', operation: '=', value: 'old' },
    ];

    assert.equal(buildQueryableFilterClauses(filters, queryables).join(' AND '), "sar:polarizations = 'HH HV' AND nested:choices = 'VV'");
});

test('preserves false and numeric zero when building CQL2', () => {
    const queryables = {
        is_active: { type: 'boolean' },
        count: { type: 'integer', minimum: 0 },
    };
    const filters = [
        { id: 'active', fieldKey: 'is_active', type: 'boolean', operation: '=', value: false },
        { id: 'count', fieldKey: 'count', type: 'number', operation: '=', value: 0 },
    ];

    assert.equal(buildQueryableFilterClauses(filters, queryables).join(' AND '), 'is_active = FALSE AND count = 0');
});

test('drops enum selections that the current schema no longer advertises', () => {
    assert.deepEqual(buildQueryableFilterClauses([
        { id: 'mode', fieldKey: 'mode', type: 'string', operation: '=', value: 'removed' },
        ], { mode: { type: 'string', enum: ['current'] } }), []);
});

test('ignores saved geometry_valid filters even without queryables', () => {
    assert.deepEqual(buildQueryableFilterClauses([
        { id: 'validity', fieldKey: 'geometry_valid', type: 'boolean', operation: '=', value: false },
    ]), []);
});

test('adds the fixed geometry-validity constraint only when advertised', () => {
    assert.equal(buildGeometryValidityFilter([{ geometry_valid: { type: 'boolean' } }]), 'geometry_valid = TRUE');
    assert.equal(buildGeometryValidityFilter([{ geometry_valid: { type: ['boolean', 'null'] } }]), 'geometry_valid = TRUE');
    assert.equal(buildGeometryValidityFilter([{ other: { type: 'boolean' } }]), '');
});

test('allows collections without geometry_valid in a multi-collection search', () => {
    assert.equal(buildGeometryValidityFilter([
        { geometry_valid: { type: 'boolean' } },
        { platform: { type: 'string' } },
    ]), '(geometry_valid = TRUE OR geometry_valid IS NULL)');
});

test('rejects explicitly invalid, missing, empty, or non-finite geometries', () => {
    const point = { type: 'Point', coordinates: [0, 0] } as GeoJSON.Point;
    const properties = { geometry_valid: false };

    assert.equal(hasUsableItemGeometry({ geometry: point, properties }), false);
    assert.equal(hasUsableItemGeometry({ geometry: null, properties: {} }), false);
    assert.equal(hasUsableItemGeometry({
        geometry: { type: 'GeometryCollection', geometries: [] }, properties: {},
    }), false);
    assert.equal(hasUsableItemGeometry({
        geometry: { type: 'Point', coordinates: [Number.NaN, 0] }, properties: {},
    }), false);
    assert.equal(hasUsableItemGeometry({ geometry: point, properties: {} }), true);
    assert.equal(hasUsableItemGeometry({ geometry: point, properties: {} }, true), false);
    assert.equal(hasUsableItemGeometry({ geometry: point, properties: { geometry_valid: true } }, true), true);
});