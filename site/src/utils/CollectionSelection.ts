import type { STACCollection } from '../types';

export const isCollectionSelected = (selected: STACCollection[], collection: STACCollection): boolean =>
  selected.some(current => current.id === collection.id);

export const toggleCollectionSelection = (
  selected: STACCollection[],
  collection: STACCollection,
  supportsSearch: boolean,
): STACCollection[] => {
  const unique = [...new Map(selected.map(current => [current.id, current])).values()];
  if (isCollectionSelected(unique, collection)) {
    return unique.filter(current => current.id !== collection.id);
  }
  return supportsSearch ? [...unique, collection] : [collection];
};