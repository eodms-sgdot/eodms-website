import { coordEach } from "@turf/meta";
import type { STACItem } from "../types";

export const hasUsableItemGeometry = (
  item: Pick<STACItem, "properties"> & { geometry?: GeoJSON.Geometry | null },
  requiresGeometryValidity = false,
): boolean => {
  if (
    (requiresGeometryValidity && item.properties?.geometry_valid !== true) ||
    item.properties?.geometry_valid === false ||
    !item.geometry
  ) return false;

  let coordinateCount = 0;
  let hasInvalidCoordinate = false;

  try {
    coordEach(item.geometry, coordinate => {
      if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) {
        hasInvalidCoordinate = true;
        return;
      }
      coordinateCount += 1;
    });
  } catch {
    return false;
  }

  return coordinateCount > 0 && !hasInvalidCoordinate;
};