import axios from "axios";
import type { STACCollection, STACQueryable } from "../types";

/**
 * Fetches the available geospatial collections from the active STAC endpoint.
 * Uses the authorization token if one is provided in the AppContext.
 * * @async
 */
export const getCollections = async (
  stacEndpoint: string,
  authToken: string | null,
): Promise<STACCollection[]> => {
  const headers: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  headers["Accept"] = "application/json";

  const res = await axios.get<{ collections: STACCollection[] }>(
    `${stacEndpoint}/collections`,
    { headers, withCredentials: true },
  );
  const sorted = [...res.data.collections].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return sorted;
};

/**
 * Fetches the available queryables for a collection from the active STAC endpoint.
 * @param collectionName
 * @param stacEndpoint
 * @returns
 */
export const getQueryables = async (
  queryablesEndpoint: string,
  authToken: string | null,
): Promise<Record<string, STACQueryable>> => {

  const headers: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  headers["Accept"] = "application/json";

  const response = await axios.get<{
    properties: Partial<Record<string, STACQueryable>>;
  }>(queryablesEndpoint, { headers, withCredentials: true  });

  const queryables = response.data.properties;
  const sortedQueryables: Record<string, STACQueryable> = {};

  if (queryables) {
    const sortedKeys = Object.keys(queryables).sort((a, b) =>
      a.localeCompare(b),
    );

    sortedKeys.map((propertyName) => {
      if (queryables[propertyName]) {
        sortedQueryables[propertyName] = queryables[propertyName];
      }
    });
  }

  return sortedQueryables;
}; 