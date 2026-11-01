import type { TourStep } from '../components/InteractiveTour';

export const EODMS_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to EODMS',
    description: 'Discover Canada\'s Earth Observation capabilities with our new and improved interface. This guided tour will show you all the key features.',
    placement: 'bottom',
  },
  {
    id: 'collections',
    title: 'Collections, Filters & Dates',
    description: 'Select one or more satellite data collections and choose your search time range. The time bar shows which collections have coverage across different time ranges. Use filters to narrow your search and enter dates manually. All times are in UTC (Coordinated Universal Time).',
    target: '[data-tour="collections"]',
    placement: 'right',
  },
  {
    id: 'map-controls',
    title: 'Map Controls & AOI',
    description: 'Define your area of interest. Right-click to draw a box, upload a GeoJSON file, or enter coordinates directly. Multiple search methods available.',
    target: '.leaflet-control-container .leaflet-control-zoom',
    placement: 'right',
  },
  {
    id: 'search-button',
    title: 'Start Your Search',
    description: 'Click the Search button to find satellite imagery matching your criteria. Results will appear in the panel on the right.',
    target: '[data-tour="search-button"]',
    placement: 'top',
    collectionId: 'RCMImageProducts',
    temporalOption: '1', // Last 24 hours
  },
  {
    id: 'results-view',
    title: 'Search Results & Ordering',
    description: 'View results in thumbnail or table format. Toggle between footprints and point markers. Select multiple results and order them with one click. Login required for most data.',
    target: '[data-tour="results-panel"]',
    placement: 'left',
  },
  {
    id: 'orders-panel',
    title: 'Orders, Downloads & Preferences',
    description: 'Access your orders and preferences from the top right buttons. Monitor your orders in real-time and see download progress. Customize your experience with preferences: change base map, select language, enable dark mode, or choose your location search provider. Log in to access your account, view order history, and access premium data products.',
    placement: 'top',
  },
];

export const NAPL_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to NAPL',
    description: 'Explore Canada\'s historical aerial photography collection. Find images by location and date.',
    placement: 'bottom',
  },
  {
    id: 'collections',
    title: 'Photo Collections',
    description: 'Choose between free open access (800 DPI) or paid high-resolution digital/print products.',
    target: '[data-tour="collections"]',
    placement: 'right',
  },
  {
    id: 'map-search',
    title: 'Search by Location',
    description: 'Draw on the map or enter coordinates to define your search area. Photos within this area will be displayed.',
    target: '[data-tour="map"]',
    placement: 'top',
  },
  {
    id: 'results',
    title: 'Photo Results',
    description: 'Browse aerial photos from Canada\'s history. Click on a photo to see details, add to valise, or order prints.',
    target: '[data-tour="results-panel"]',
    placement: 'left',
  },
  {
    id: 'valise',
    title: 'Valise - Your Selection',
    description: 'Add photos to your valise for bulk ordering. Manage your selections and check out when ready.',
    target: '[data-tour="cart"]',
    placement: 'left',
  },
];
