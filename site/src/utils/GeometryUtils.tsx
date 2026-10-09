import type { Geometry } from 'geojson';
import { coordEach } from '@turf/meta';
import type { STACItem } from '../types';

export const getLatLonCoordsFromGeometry = (geometry: Geometry): number[][] => {
  const coords: number[][] = [];
  
  // coordEach automatically iterates through every coordinate pair regardless of geometry type
  coordEach(geometry, (currentCoord) => {
    coords.push([currentCoord[1], currentCoord[0]]);
  });

  return coords;
};

/**
 * Computes the combined [W, S, E, N] extent of the given items' footprints, falling back to each item's bbox.
 * Always returns a new array so repeated zooms to the same extent still trigger.
 */
export const getItemsExtent = (items: STACItem[]): [number, number, number, number] | null => {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const extend = (lon: number, lat: number) => {
    west = Math.min(west, lon); east = Math.max(east, lon);
    south = Math.min(south, lat); north = Math.max(north, lat);
  };

  for (const item of items) {
    if (item.geometry) {
      coordEach(item.geometry, (coord) => extend(coord[0], coord[1]));
    } else if (item.bbox) {
      // bbox may be 3D: [W, S, minZ, E, N, maxZ]
      const b = item.bbox as number[];
      const half = b.length / 2;
      extend(b[0], b[1]);
      extend(b[half], b[half + 1]);
    }
  }

  return Number.isFinite(west) ? [west, south, east, north] : null;
};