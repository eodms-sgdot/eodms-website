import GroundStationLoader from './GroundStationLoader';
import AuroraLoader from './AuroraLoader';
import RiverLoader from './RiverLoader';
import IceLoader from './IceLoader';

export const SEARCH_LOADERS = [
  { name: 'Ground station', Loader: GroundStationLoader },
  { name: 'Aurora', Loader: AuroraLoader },
  { name: 'River flood', Loader: RiverLoader },
  { name: 'Sea ice', Loader: IceLoader },
];
