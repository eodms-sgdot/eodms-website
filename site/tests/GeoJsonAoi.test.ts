import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { AoiImportError, buildAoiSpatialFilter, getAoiParts, MAX_AOI_POSITIONS, parseGeoJsonAoi } from '../src/utils/GeoJsonAoi.ts';

const geometry = { type: 'Polygon', coordinates: [[[-76, 45], [-75, 45], [-75, 46], [-76, 46], [-76, 45]]] };
const rejects = (input: unknown, key: string) => assert.throws(() => parseGeoJsonAoi(JSON.stringify(input)),
  error => error instanceof AoiImportError && error.translationKey === key);

test('accepts a geometry or Feature and serializes the polygon rather than its bbox', () => {
  assert.deepEqual(parseGeoJsonAoi(JSON.stringify(geometry)), geometry);
  const result = parseGeoJsonAoi(JSON.stringify({ type: 'Feature', properties: {}, geometry }));
  assert.equal(buildAoiSpatialFilter(result), 'S_INTERSECTS(geometry, POLYGON ((-76 45, -75 45, -75 46, -76 46, -76 45)))');
});

test('preserves holes, combines polygon features, and drops altitude', () => {
  const hole = [[-75.8, 45.2], [-75.8, 45.8], [-75.2, 45.8], [-75.2, 45.2], [-75.8, 45.2]];
  const withHole = { ...geometry, coordinates: [...geometry.coordinates, hole] };
  assert.deepEqual(parseGeoJsonAoi(JSON.stringify(withHole)), withHole);
  const separate = { type: 'Polygon', coordinates: [[[-74, 45], [-73, 45], [-73, 46], [-74, 46], [-74, 45]]] };
  const combined = parseGeoJsonAoi(JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: withHole }, { type: 'Feature', geometry: separate },
  ] }));
  assert.equal(combined.type, 'MultiPolygon');
  assert.deepEqual(combined.coordinates, [withHole.coordinates, separate.coordinates]);
  assert.deepEqual(parseGeoJsonAoi(JSON.stringify({ ...geometry, coordinates: geometry.coordinates.map(ring => ring.map(position => [...position, 100])) })), geometry);
});

test('rejects malformed, empty, unsupported, projected, open, or crossing input', () => {
  assert.throws(() => parseGeoJsonAoi('{'), AoiImportError);
  rejects({ type: 'FeatureCollection', features: [] }, 'aoiInvalidGeoJson');
  rejects({ type: 'Circle', coordinates: [-75, 45] }, 'aoiUnsupportedGeometry');
  rejects({ type: 'Feature', geometry: null }, 'aoiUnsupportedGeometry');
  rejects({ ...geometry, crs: { type: 'name', properties: { name: 'EPSG:3857' } } }, 'aoiUnsupportedCrs');
  rejects({ ...geometry, coordinates: [[[500000, 4500000], [0, 0], [1, 1], [500000, 4500000]]] }, 'aoiInvalidCoordinates');
  rejects({ ...geometry, coordinates: [[[-76, 45], [-75, 45], [-75, 46], [-76, 46]]] }, 'aoiInvalidPolygon');
  rejects({ ...geometry, coordinates: [[[-76, 45], [-75, 46], [-75, 45], [-76, 46], [-76, 45]]] }, 'aoiInvalidPolygon');
  rejects({ type: 'GeometryCollection', geometries: [] }, 'aoiInvalidGeoJson');
});

test('rejects excessive geometry complexity', () => {
  const ring = Array.from({ length: 501 }, (_, index) => [-75 + Math.cos(index / 500 * Math.PI * 2), 45 + Math.sin(index / 500 * Math.PI * 2)]);
  ring[ring.length - 1] = ring[0];
  rejects({ type: 'Polygon', coordinates: [ring] }, 'aoiTooComplex');
});

test('rejects zero-area rings, exterior holes, and nested holes', () => {
  rejects({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [2, 0], [0, 0]]] }, 'aoiInvalidPolygon');
  const exteriorHole = [[-74, 45.1], [-73.8, 45.1], [-73.8, 45.2], [-74, 45.2], [-74, 45.1]];
  rejects({ ...geometry, coordinates: [...geometry.coordinates, exteriorHole] }, 'aoiInvalidPolygon');
  const hole = [[-75.8, 45.2], [-75.8, 45.8], [-75.2, 45.8], [-75.2, 45.2], [-75.8, 45.2]];
  const nested = [[-75.7, 45.3], [-75.7, 45.7], [-75.3, 45.7], [-75.3, 45.3], [-75.7, 45.3]];
  rejects({ ...geometry, coordinates: [...geometry.coordinates, hole, nested] }, 'aoiInvalidPolygon');
});

test('normalizes overlapping FeatureCollection polygons into a valid union', () => {
  const result = parseGeoJsonAoi(JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry }, { type: 'Feature', geometry },
  ] }));
  assert.deepEqual(result, geometry);
});

test('imports the Ottawa sample with every geometry type, preserving mixed geometries and holes', () => {
  const text = readFileSync(new URL('../public/examples/ottawa-all-geometries.geojson', import.meta.url), 'utf8');
  const result = parseGeoJsonAoi(text);
  assert.equal(result.type, 'GeometryCollection');
  if (result.type !== 'GeometryCollection') return;
  assert.deepEqual(result.geometries.map(geometry => geometry.type), ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']);
  assert.equal(getAoiParts(result).length, 13);
  assert.ok(getAoiParts(result).some(geometry => geometry.type === 'Polygon' && geometry.coordinates.length === 2));
  const filter = buildAoiSpatialFilter(result);
  assert.equal(filter.match(/S_INTERSECTS/g)?.length, 13);
  assert.ok(filter.startsWith('(') && filter.endsWith(')'));
  assert.ok(filter.includes(' OR '));
  assert.ok(!filter.includes('GEOMETRYCOLLECTION'));
});

test('accepts point and line variants with their exact dimensions', () => {
  for (const input of [
    { type: 'Point', coordinates: [-75, 45] },
    { type: 'MultiPoint', coordinates: [[-75, 45], [-76, 46]] },
    { type: 'LineString', coordinates: [[-75, 45], [-76, 46]] },
    { type: 'MultiLineString', coordinates: [[[-75, 45], [-76, 46]], [[-74, 45], [-73, 46]]] },
  ]) assert.deepEqual(parseGeoJsonAoi(JSON.stringify(input)), input);
  assert.equal(buildAoiSpatialFilter(parseGeoJsonAoi('{"type":"Point","coordinates":[-75,45]}')), 'S_INTERSECTS(geometry, POINT (-75 45))');
  rejects({ type: 'LineString', coordinates: [[-75, 45]] }, 'aoiInvalidCoordinates');
  rejects({ type: 'LineString', coordinates: [[-75, 45], [-75, 45]] }, 'aoiInvalidCoordinates');
  rejects({ type: 'Point', coordinates: ['-75', 45] }, 'aoiInvalidCoordinates');
});

test('enforces a total position limit across features and guards deeply nested collections', () => {
  const points = Array.from({ length: MAX_AOI_POSITIONS }, (_, index) => [-75, 45 + index / 10000]);
  const accepted = { type: 'MultiPoint', coordinates: points };
  assert.doesNotThrow(() => parseGeoJsonAoi(JSON.stringify({ type: 'LineString',
    coordinates: Array.from({ length: MAX_AOI_POSITIONS }, (_, index) => [index === MAX_AOI_POSITIONS - 1 ? 1 : 0, 0]),
  })));
  rejects({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: accepted }, { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } },
  ] }, 'aoiTooComplex');
  let nested: unknown = { type: 'Point', coordinates: [0, 0] };
  for (let depth = 0; depth < 18; depth++) nested = { type: 'GeometryCollection', geometries: [nested] };
  rejects(nested, 'aoiTooComplex');
});

test('reports URL length separately from vertex complexity', () => {
  const coordinates = Array.from({ length: 200 }, (_, index) => [-75.123456789 + index / 100000, 45.123456789]);
  rejects({ type: 'MultiPoint', coordinates }, 'aoiSearchUrlTooLong');
});