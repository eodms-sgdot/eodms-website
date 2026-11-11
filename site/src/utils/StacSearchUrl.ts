export interface StacSearchParams {
  bbox?: [number, number, number, number];
  collections: string[];
  limit: number;
  datetime?: string;
  filter?: string;
  sortby?: string;
}

export function buildStacSearchUrl(
  endpoint: string,
  params: StacSearchParams,
  supportsSearch: boolean,
  supportsSorting: boolean,
): string {
  const query = new URLSearchParams();
  if (supportsSearch) query.set('collections', params.collections.join(','));
  if (params.bbox) query.set('bbox', params.bbox.join(','));
  query.set('limit', String(params.limit));

  if (params.datetime) query.set('datetime', params.datetime);
  if (params.filter) {
    query.set('filter-lang', 'cql2-text');
    query.set('filter', params.filter);
  }
  if (params.sortby && supportsSorting) query.set('sortby', params.sortby);

  const path = supportsSearch ? '/search' : `/collections/${params.collections[0]}/items`;
  return `${endpoint}${path}?${query}`;
}