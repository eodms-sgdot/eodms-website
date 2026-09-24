import type { Geometry } from 'geojson';
import { coordEach } from '@turf/meta';

export const getLatLonCoordsFromGeometry = (geometry: Geometry): number[][] => {
  const coords: number[][] = [];
  
  // coordEach automatically iterates through every coordinate pair regardless of geometry type
  coordEach(geometry, (currentCoord) => {
    coords.push([currentCoord[1], currentCoord[0]]);
  });

  return coords;
};