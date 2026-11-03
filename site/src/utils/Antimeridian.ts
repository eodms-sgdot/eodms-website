import { bboxClip } from '@turf/turf';
import type { Geometry, Position } from 'geojson';

type PolygonCoordinates = Position[][];

export function getShortestLongitudeBounds(longitudes: number[]): [number, number] {
  const sorted = longitudes.map(longitude => ((longitude % 360) + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1;
  let gapIndex = sorted.length - 1;

  for (let index = 0; index < sorted.length; index += 1) {
    const next = index === sorted.length - 1 ? sorted[0] + 360 : sorted[index + 1];
    const gap = next - sorted[index];
    if (gap > largestGap) {
      largestGap = gap;
      gapIndex = index;
    }
  }

  const west = gapIndex === sorted.length - 1 ? sorted[0] : sorted[gapIndex + 1];
  const east = gapIndex === sorted.length - 1 ? sorted[gapIndex] : sorted[gapIndex] + 360;
  const shift = 360 * Math.floor((west + 180) / 360);
  return [west - shift, east - shift];
}

function crossesAntimeridian(ring: Position[]): boolean {
  return ring.some((position, index) => index > 0 && Math.abs(position[0] - ring[index - 1][0]) > 180);
}

function unwrapRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;

  const unwrapped: Position[] = [[...ring[0]]];
  for (let index = 1; index < ring.length; index += 1) {
    const position = ring[index];
    let longitude = position[0];
    const previousLongitude = unwrapped[index - 1][0];
    while (longitude - previousLongitude > 180) longitude -= 360;
    while (longitude - previousLongitude < -180) longitude += 360;
    unwrapped.push([longitude, ...position.slice(1)]);
  }

  const first = unwrapped[0];
  const last = unwrapped[unwrapped.length - 1];
  if (Math.abs(last[0] - first[0]) > 180) {
    const meanLatitude = unwrapped.reduce((sum, position) => sum + position[1], 0) / unwrapped.length;
    const poleLatitude = meanLatitude >= 0 ? 90 : -90;
    unwrapped.push([last[0], poleLatitude], [first[0], poleLatitude], [...first]);
  }

  return unwrapped;
}

function alignRing(ring: Position[], referenceLongitude: number): Position[] {
  const meanLongitude = ring.reduce((sum, position) => sum + position[0], 0) / ring.length;
  const shift = 360 * Math.round((referenceLongitude - meanLongitude) / 360);
  return shift === 0 ? ring : ring.map(position => [position[0] + shift, ...position.slice(1)]);
}

function splitPolygon(coordinates: PolygonCoordinates): { parts: PolygonCoordinates[]; changed: boolean } {
  if (!coordinates.some(crossesAntimeridian)) return { parts: [coordinates], changed: false };

  const outerRing = unwrapRing(coordinates[0]);
  const referenceLongitude = outerRing.reduce((sum, position) => sum + position[0], 0) / outerRing.length;
  const unwrappedCoordinates = [outerRing, ...coordinates.slice(1).map(ring => alignRing(unwrapRing(ring), referenceLongitude))];
  const longitudes = unwrappedCoordinates.flatMap(ring => ring.map(position => position[0]));
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const firstStrip = Math.floor((minimumLongitude + 180) / 360);
  let lastStrip = Math.floor((maximumLongitude + 180) / 360);
  if (lastStrip > firstStrip && Math.abs(maximumLongitude - (-180 + lastStrip * 360)) < 1e-10) lastStrip -= 1;

  const parts: PolygonCoordinates[] = [];
  const feature = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: unwrappedCoordinates },
  };

  try {
    for (let strip = firstStrip; strip <= lastStrip; strip += 1) {
      const west = -180 + strip * 360;
      const east = 180 + strip * 360;
      const clipped = bboxClip(feature, [west, -90, east, 90]);
      const polygons = clipped.geometry.type === 'Polygon'
        ? [clipped.geometry.coordinates]
        : clipped.geometry.type === 'MultiPolygon'
          ? clipped.geometry.coordinates
          : [];
      for (const polygon of polygons) {
        if (polygon.length === 0 || polygon[0].length < 4) continue;
        parts.push(polygon.map(ring => ring.map(position => [position[0] - strip * 360, ...position.slice(1)])));
      }
    }
  } catch {
    return { parts: [coordinates], changed: false };
  }

  return parts.length > 0 ? { parts, changed: true } : { parts: [coordinates], changed: false };
}

export function splitAntimeridianGeometry(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    const { parts, changed } = splitPolygon(geometry.coordinates);
    return !changed ? geometry : parts.length === 1
      ? { type: 'Polygon', coordinates: parts[0] }
      : { type: 'MultiPolygon', coordinates: parts };
  }

  if (geometry.type === 'MultiPolygon') {
    const results = geometry.coordinates.map(splitPolygon);
    if (!results.some(result => result.changed)) return geometry;
    return { type: 'MultiPolygon', coordinates: results.flatMap(result => result.parts) };
  }

  if (geometry.type === 'GeometryCollection') {
    const geometries = geometry.geometries.map(splitAntimeridianGeometry);
    return geometries.some((part, index) => part !== geometry.geometries[index])
      ? { type: 'GeometryCollection', geometries }
      : geometry;
  }

  return geometry;
}