import type { TourStep } from '../components/InteractiveTour';

export const EODMS_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Canada\'s EO. Always On.',
    description: 'Building on Canada\'s legacy in synthetic aperture radar, we keep Earth observation moving day or night, in all weather. Always available, always ready—streamlined access to Canada\'s observation data built for today.',
    presentation: 'sar-welcome',
  },
  {
    id: 'modernization',
    title: 'A Modern EODMS',
    description: 'Guided by the Government of Canada Digital Standards, we\'re modernizing access through OGC APIs, aligning with the GC Cloud Strategy, and expanding access to CEOS-standardized analysis-ready data.',
    placement: 'bottom',
    resources: [
      {
        label: 'Government of Canada Digital Standards',
        href: 'https://www.canada.ca/en/government/system/digital-government/government-canada-digital-standards.html',
      },
      {
        label: 'OGC APIs',
        href: 'https://ogcapi.ogc.org/',
      },
      {
        label: 'GC Cloud Strategy',
        href: 'https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/cloud-services/cloud-adoption-strategy-2023-update.html',
      },
      {
        label: 'CEOS Analysis Ready Data',
        href: 'https://ceos.org/ard/',
      },
    ],
  },
  {
    id: 'collections',
    title: 'Collections, Filters & Dates',
    description: 'Select one or more satellite data collections and choose your search time range. The time bar shows which collections have coverage across different time ranges. Use filters to narrow your search and enter dates manually. All times are in UTC (Coordinated Universal Time).',
    target: '[data-tour="collections"]',
    placement: 'left',
  },
  {
    id: 'map-controls',
    title: 'Map Controls & AOI',
    description: 'Define your area of interest. Right-click to draw a box, upload a GeoJSON file, or enter coordinates directly. Multiple search methods available.',
    target: '.leaflet-control-container .leaflet-control-zoom',
    placement: 'bottom',
  },
  {
    id: 'search-button',
    title: 'Start Your Search',
    description: 'Click the Search button to find satellite imagery matching your criteria. Results will appear in the panel on the right.',
    target: '[data-tour="search-button"]',
    placement: 'left',
    collectionId: 'RCMImageProducts',
    temporalOption: '1', // Last 24 hours
  },
  {
    id: 'results-view',
    title: 'Results and Downloading',
    description: 'View results in thumbnail or table format. Toggle between footprints and point markers. Select multiple results and order them with one click. Login required for most data.',
    target: '[data-tour="results-panel"]',
    placement: 'top',
  },
  {
    id: 'orders-panel',
    title: 'Downloads, Preferences & Profile',
    description: 'Access your downloads and preferences from the top right buttons. Monitor your orders in real-time and see download progress. Customize your experience with preferences: change base map, select language, enable dark mode, or choose your location search provider. Log in to access your account, view order history, and access premium data products.',
    placement: 'top',
  },
];

export const NAPL_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Discover NAPL Photos spanning over 100 years.',
    description: 'Canada\'s National Air Photo Library preserves over a century of aerial photography. Explore historical perspectives of Canadian landscapes, cities, and development.',
    presentation: 'napl-welcome',
    placement: 'bottom',
  },
  {
    id: 'collections',
    title: 'Photo Collections',
    description: 'Choose between free open access (800 DPI) or paid high-resolution digital/print products.',
    target: '[data-tour="collections"]',
    placement: 'left',
  },
  {
    id: 'map-search',
    title: 'Search by Location',
    description: 'Draw on the map or enter coordinates to define your search area. Photos within this area will be displayed.',
    target: '[data-tour="map"]',
    placement: 'left',
  },
  {
    id: 'results',
    title: 'Photo Results',
    description: 'Browse aerial photos from Canada\'s history. Click on a photo to see details, add to valise, or order prints.',
    target: '[data-tour="results-panel"]',
    placement: 'right',
  },
  {
    id: 'valise',
    title: 'Valise - Your Selection',
    description: 'Add photos to your valise for bulk ordering. Manage your selections and check out when ready.',
    target: '[data-tour="cart"]',
    placement: 'right',
  },
  {
    id: 'preferences',
    title: 'Downloads, Preferences & Profile',
    description: 'Access your downloads and preferences from the top right buttons. Customize your experience: change base map, select language, enable dark mode. Log in to access your account and order history.',
    placement: 'top',
  },
];
