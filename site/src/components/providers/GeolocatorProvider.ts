import { JsonProvider } from 'leaflet-geosearch';
import type { EndpointArgument, ParseArgument, SearchResult } from 'leaflet-geosearch/src/providers/provider.ts';

/**
 * Expect format of multiple results from Geolocator.
 */
export type RequestResult = RawResult[];

/**
 * Expected result format of results from Geolocator.
 */
export interface RawResult {
  title: string;
  qualifier: string;
  type: string;
  bbox?: [string, string, string, string];
  geometry: {
    type: string;
    coordinates: [string, string];
  };
}

/**
 * Provider to search and convert results from Gelocator's API to leaflet geosearch.
 */
export class GeolocatorProvider extends JsonProvider {

  endpoint({ query } : EndpointArgument) : string {
    return this.getUrl('https://www.geolocator.api.geo.ca/geolocation/en/locate', {
      expand: 'component,score',
      q: query + "*",
      f: 'json',
    });
  }

  parse({ data } : ParseArgument<RequestResult>) : SearchResult<RawResult>[] {
    return data.map((r) => ({
      x: parseFloat(r.geometry.coordinates[0]),
      y: parseFloat(r.geometry.coordinates[1]),
      label: r.title,
      bounds: r.bbox ? [
            [parseFloat(r.bbox[1]), parseFloat(r.bbox[0])], // s, w
            [parseFloat(r.bbox[3]), parseFloat(r.bbox[2])], // n, e,
        ] : null,
      raw: r
    }));
  }
}