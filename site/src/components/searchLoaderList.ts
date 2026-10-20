import type { ComponentType } from 'react';
import GroundStationLoader from './GroundStationLoader';
import AuroraLoader from './AuroraLoader';
import RiverLoader from './RiverLoader';
import IceLoader from './IceLoader';
import AirPhotoLoader from './AirPhotoLoader';

export interface SearchLoader {
  name: string;
  Loader: ComponentType<{ onComplete?: () => void }>;
}

export const SEARCH_LOADERS: SearchLoader[] = [
  { name: 'Ground station', Loader: GroundStationLoader },
  { name: 'Aurora', Loader: AuroraLoader },
  { name: 'River flood', Loader: RiverLoader },
  { name: 'Sea ice', Loader: IceLoader },
];

export const NAPL_SEARCH_LOADERS: SearchLoader[] = [
  { name: 'Air photo survey', Loader: AirPhotoLoader },
];
