import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customDateRange } from '../src/utils/PartialDates.ts';
import { buildStacSearchUrl } from '../src/utils/StacSearchUrl.ts';
import { isCollectionSelected, toggleCollectionSelection } from '../src/utils/CollectionSelection.ts';
import type { STACCollection } from '../src/types.ts';

process.env.TZ = 'UTC';

const spatialFilter = 'S_INTERSECTS(geometry, POINT(-75 45))';
const datetime = customDateRange('2005', '2006');

for (const supportsSearch of [true, false]) {
  test(`uses the same custom date constraints with and without AOI (item search: ${supportsSearch})`, () => {
    for (const filter of [undefined, spatialFilter]) {
      const url = new URL(buildStacSearchUrl('/stac', {
        collections: ['Radarsat-1-Raw'], limit: 100, datetime, filter, sortby: '-datetime',
      }, supportsSearch, true), 'http://localhost');

      assert.equal(url.pathname, supportsSearch ? '/stac/search' : '/stac/collections/Radarsat-1-Raw/items');
      assert.equal(url.searchParams.get('datetime'), datetime);
      assert.equal(url.searchParams.get('datetime'), '2005-01-01T00:00:00Z/2006-12-31T23:59:59Z');
      assert.equal(url.searchParams.get('filter-lang'), filter ? 'cql2-text' : null);
      assert.equal(url.searchParams.get('filter'), filter ?? null);
      assert.equal(url.searchParams.get('limit'), '100');
      assert.equal(url.searchParams.get('sortby'), '-datetime');
      assert.equal(url.searchParams.get('collections'), supportsSearch ? 'Radarsat-1-Raw' : null);
    }
  });
}

test('preserves open date bounds and exact instants', () => {
  for (const range of [
    '2005-01-01T00:00:00Z/..',
    '../2006-12-31T23:59:59Z',
    '2005-01-01T00:00:00Z',
  ]) {
    const url = new URL(buildStacSearchUrl('/stac', {
      collections: ['test'], limit: 10, datetime: range,
    }, true, false), 'http://localhost');
    assert.equal(url.searchParams.get('filter'), null);
    assert.equal(url.searchParams.get('datetime'), range);
  }
});

test('changing and clearing AOI and temporal controls leaves no previous request parameters', () => {
  for (const [filter, range] of [
    [spatialFilter, customDateRange('2003-01-01', '2003-01-03')],
    ['S_INTERSECTS(geometry, POINT(-76 46))', customDateRange('2005', '2006')],
    [undefined, customDateRange('', '2006')],
    [spatialFilter, undefined],
    [undefined, undefined],
  ]) {
    const url = new URL(buildStacSearchUrl('/stac', {
      collections: ['NAPL'], limit: 100, filter, datetime: range,
    }, true, false), 'http://localhost');
    assert.equal(url.searchParams.get('filter'), filter ?? null);
    assert.equal(url.searchParams.get('filter-lang'), filter ? 'cql2-text' : null);
    assert.equal(url.searchParams.get('datetime'), range ?? null);
    assert.equal(url.searchParams.get('bbox'), null);
  }
});

test('anytime searches add no temporal constraint and preserve OR filter grouping', () => {
  for (const filter of [undefined, `${spatialFilter} OR S_INTERSECTS(geometry, POINT(-76 46))`]) {
    const url = new URL(buildStacSearchUrl('/stac', {
      collections: ['test'], limit: 10, filter, sortby: '-datetime',
    }, true, false), 'http://localhost');
    assert.equal(url.searchParams.get('datetime'), null);
    assert.equal(url.searchParams.get('filter'), filter ?? null);
    assert.equal(url.searchParams.get('sortby'), null);
  }
});

test('NAPL, mixed, and RADARSAT searches follow collection IDs across refreshed objects', () => {
  const napl = { id: 'NAPL', description: '', links: [] } as STACCollection;
  const radar = { id: 'Radarsat-1-Raw', description: '', links: [] } as STACCollection;
  let selected: STACCollection[] = [];
  for (const [collection, expected] of [
    [napl, 'NAPL'],
    [radar, 'NAPL,Radarsat-1-Raw'],
    [{ ...napl }, 'Radarsat-1-Raw'],
    [{ ...radar }, null],
    [{ ...napl }, 'NAPL'],
  ] as const) {
    selected = toggleCollectionSelection(selected, collection, true);
    assert.equal(isCollectionSelected(selected, { ...collection }), expected !== null && expected.split(',').includes(collection.id));
    const url = new URL(buildStacSearchUrl('/stac', {
      collections: selected.map(current => current.id), limit: 100,
    }, true, false), 'http://localhost');
    assert.equal(url.searchParams.get('collections'), expected ?? '');
  }
});

test('toggling repairs duplicate collection selections by ID', () => {
  const napl = { id: 'NAPL', description: '', links: [] } as STACCollection;
  const radar = { id: 'Radarsat-1-Raw', description: '', links: [] } as STACCollection;
  assert.deepEqual(toggleCollectionSelection([napl, radar, { ...napl }], { ...napl }, true), [radar]);
  assert.deepEqual(toggleCollectionSelection([napl, { ...napl }], radar, true), [napl, radar]);
});

test('endpoints without item-search replace selection and deselect refreshed objects by ID', () => {
  const napl = { id: 'NAPL', description: '', links: [] } as STACCollection;
  const radar = { id: 'Radarsat-1-Raw', description: '', links: [] } as STACCollection;
  assert.deepEqual(toggleCollectionSelection([napl], radar, false), [radar]);
  assert.deepEqual(toggleCollectionSelection([napl], { ...napl }, false), []);
});