import { area, booleanDisjoint, booleanValid, booleanWithin, featureCollection, kinks, lineIntersect, polygon, union } from '@turf/turf';
import { geojsonToWKT } from '@terraformer/wkt';

export const MAX_AOI_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_AOI_POSITIONS = 500;
const MAX_ENCODED_SPATIAL_FILTER_LENGTH = 6000;

export type AoiGeometry = GeoJSON.Geometry;
export type AoiErrorKey = 'aoiInvalidGeoJson' | 'aoiUnsupportedGeometry' | 'aoiInvalidCoordinates' | 'aoiInvalidPolygon' | 'aoiTooComplex' | 'aoiSearchUrlTooLong' | 'aoiUnsupportedCrs' | 'aoiFileTooLarge';

export class AoiImportError extends Error {
  readonly translationKey: AoiErrorKey;

  constructor(translationKey: AoiErrorKey) {
    super(translationKey);
    this.translationKey = translationKey;
  }
}

export function buildAoiSpatialFilter(geometry: AoiGeometry): string {
  const predicates = getAoiParts(geometry).map(part => `S_INTERSECTS(geometry, ${geojsonToWKT(part)})`);
  const filter = predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`;
  if (encodeURIComponent(filter).length > MAX_ENCODED_SPATIAL_FILTER_LENGTH) throw new AoiImportError('aoiSearchUrlTooLong');
  return filter;
}

export function getAoiParts(geometry: AoiGeometry): Array<GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon> {
  switch (geometry.type) {
    case 'GeometryCollection': return geometry.geometries.flatMap(getAoiParts);
    case 'MultiPoint': return geometry.coordinates.map(coordinates => ({ type: 'Point', coordinates }));
    case 'MultiLineString': return geometry.coordinates.map(coordinates => ({ type: 'LineString', coordinates }));
    case 'MultiPolygon': return geometry.coordinates.map(coordinates => ({ type: 'Polygon', coordinates }));
    default: return [geometry];
  }
}

export function parseGeoJsonAoi(text: string): AoiGeometry {
  let input: unknown;
  try {
    input = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new AoiImportError('aoiInvalidGeoJson');
  }
  let positions = 0;
  const readPosition = (position: unknown): GeoJSON.Position => {
    if (++positions > MAX_AOI_POSITIONS) throw new AoiImportError('aoiTooComplex');
    if (!Array.isArray(position) || position.length < 2 || position.length > 3
      || !position.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate))
      || position[0] < -180 || position[0] > 180 || position[1] < -90 || position[1] > 90) {
      throw new AoiImportError('aoiInvalidCoordinates');
    }
    return [position[0], position[1]];
  };
  const readArray = (value: unknown): unknown[] => {
    if (!Array.isArray(value) || value.length === 0) throw new AoiImportError('aoiInvalidGeoJson');
    return value;
  };
  const readLine = (value: unknown): GeoJSON.Position[] => {
    const coordinates = readArray(value).map(readPosition);
    if (coordinates.length < 2 || new Set(coordinates.map(position => position.join(','))).size < 2) {
      throw new AoiImportError('aoiInvalidCoordinates');
    }
    return coordinates;
  };
  const readPolygon = (value: unknown): GeoJSON.Position[][] => {
    if (!Array.isArray(value) || value.length === 0) throw new AoiImportError('aoiInvalidPolygon');
    const rings = value.map((ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 4) throw new AoiImportError('aoiInvalidPolygon');
      const coordinates = ring.map(readPosition);
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]
        || new Set(coordinates.map(position => position.join(','))).size < 3) throw new AoiImportError('aoiInvalidPolygon');
      return coordinates;
    });
    const feature = polygon(rings);
    if (!booleanValid(feature) || kinks(feature).features.length > 0) throw new AoiImportError('aoiInvalidPolygon');
    const exterior = polygon([rings[0]]);
    if (area(exterior) === 0) throw new AoiImportError('aoiInvalidPolygon');
    const holes = rings.slice(1).map(ring => polygon([ring]));
    for (const [index, hole] of holes.entries()) {
      if (area(hole) === 0 || !booleanWithin(hole, exterior) || lineIntersect(hole, exterior).features.length > 0
        || holes.slice(0, index).some(other => !booleanDisjoint(hole, other))) throw new AoiImportError('aoiInvalidPolygon');
    }
    return rings;
  };
  const combine = (geometries: AoiGeometry[]): AoiGeometry => {
    if (geometries.length === 1) return geometries[0];
    if (geometries.every(geometry => geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
      const polygons = geometries.flatMap(geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);
      const merged = union(featureCollection(polygons.map(coordinates => polygon(coordinates))))?.geometry;
      if (!merged) throw new AoiImportError('aoiInvalidPolygon');
      return merged;
    }
    return { type: 'GeometryCollection', geometries };
  };
  const readGeometry = (value: unknown, depth = 0): AoiGeometry => {
    if (depth > 16) throw new AoiImportError('aoiTooComplex');
    if (!value || typeof value !== 'object') throw new AoiImportError('aoiInvalidGeoJson');
    const object = value as Record<string, unknown>;
    if (object.crs !== undefined) throw new AoiImportError('aoiUnsupportedCrs');
    switch (object.type) {
      case 'Point': return { type: 'Point', coordinates: readPosition(object.coordinates) };
      case 'MultiPoint': return { type: 'MultiPoint', coordinates: readArray(object.coordinates).map(readPosition) };
      case 'LineString': return { type: 'LineString', coordinates: readLine(object.coordinates) };
      case 'MultiLineString': return { type: 'MultiLineString', coordinates: readArray(object.coordinates).map(readLine) };
      case 'Polygon': return { type: 'Polygon', coordinates: readPolygon(object.coordinates) };
      case 'MultiPolygon': return combine(readArray(object.coordinates).map(coordinates => ({ type: 'Polygon', coordinates: readPolygon(coordinates) })));
      case 'GeometryCollection': return {
        type: 'GeometryCollection',
        geometries: readArray(object.geometries).map(geometry => readGeometry(geometry, depth + 1)),
      };
      default: throw new AoiImportError('aoiUnsupportedGeometry');
    }
  };
  const readFeature = (value: unknown): AoiGeometry => {
    if (!value || typeof value !== 'object' || (value as Record<string, unknown>).type !== 'Feature') throw new AoiImportError('aoiInvalidGeoJson');
    const feature = value as Record<string, unknown>;
    if (feature.crs !== undefined) throw new AoiImportError('aoiUnsupportedCrs');
    if (feature.geometry === null) throw new AoiImportError('aoiUnsupportedGeometry');
    return readGeometry(feature.geometry);
  };
  if (!input || typeof input !== 'object') throw new AoiImportError('aoiInvalidGeoJson');
  const object = input as Record<string, unknown>;
  if (object.crs !== undefined) throw new AoiImportError('aoiUnsupportedCrs');
  const geometry = object.type === 'FeatureCollection' ? combine(readArray(object.features).map(readFeature))
    : object.type === 'Feature' ? readFeature(object) : readGeometry(object);
  buildAoiSpatialFilter(geometry);
  return geometry;
}