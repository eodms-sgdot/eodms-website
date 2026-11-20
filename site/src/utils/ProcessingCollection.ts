import type { STACItem } from '../types';

export const PROCESSING_COLLECTION = 'Radarsat-1-Raw';

export const isProcessingItem = (item: Pick<STACItem, 'collection' | 'properties'>): boolean => {
  const beamMode = item.properties.beam_mode;
  return item.collection === PROCESSING_COLLECTION
    && typeof beamMode === 'string'
    && !beamMode.startsWith('ScanSAR');
};
