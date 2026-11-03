import type { TourStep } from '../components/InteractiveTour';
import type { Language } from '../i18n';

export const EODMS_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Canada\'s EO. Always On.',
    description: 'Like our flagship RADARSAT synthetic aperture radar program, NRCan\'s mission is to keep Earth observation moving day or night, in all weather. Always on. Discover Canadian EO in the new EODMS; Re-built to serve today\'s EO community.',
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

type TourStepTranslation = Pick<TourStep, 'title' | 'description'> & Pick<TourStep, 'resources'>;

const FRENCH_TOUR_STEPS: Record<'eodms' | 'napl', Record<string, TourStepTranslation>> = {
  eodms: {
    welcome: {
      title: 'L’observation de la Terre au Canada. Toujours en action.',
      description: 'À l’image de notre programme phare de radar à synthèse d’ouverture RADARSAT, la mission de RNCan est de faire progresser l’observation de la Terre jour et nuit, par tous les temps. Toujours en service. Découvrez l’observation de la Terre canadienne dans le nouvel EODMS, reconstruit pour répondre aux besoins de la communauté d’aujourd’hui.',
    },
    modernization: {
      title: 'Un EODMS moderne',
      description: 'Guidés par les Normes numériques du gouvernement du Canada, nous modernisons l’accès grâce aux API de l’OGC, conformément à la Stratégie d’adoption de l’informatique en nuage du GC, et élargissons l’accès aux données prêtes à l’analyse normalisées par le CEOS.',
      resources: [
        { label: 'Normes numériques du gouvernement du Canada', href: 'https://www.canada.ca/en/government/system/digital-government/government-canada-digital-standards.html' },
        { label: 'API de l’OGC', href: 'https://ogcapi.ogc.org/' },
        { label: 'Stratégie d’adoption de l’informatique en nuage du GC', href: 'https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/cloud-services/cloud-adoption-strategy-2023-update.html' },
        { label: 'Données prêtes à l’analyse du CEOS', href: 'https://ceos.org/ard/' },
      ],
    },
    collections: {
      title: 'Collections, filtres et dates',
      description: 'Sélectionnez une ou plusieurs collections de données satellitaires et choisissez une période de recherche. La barre temporelle indique la couverture des collections selon différentes périodes. Utilisez les filtres pour préciser votre recherche et saisissez les dates manuellement. Toutes les heures sont en UTC (temps universel coordonné).',
    },
    'map-controls': {
      title: 'Contrôles cartographiques et zone d’intérêt',
      description: 'Définissez votre zone d’intérêt. Cliquez avec le bouton droit pour dessiner un rectangle, importer un fichier GeoJSON ou saisir des coordonnées. Plusieurs méthodes de recherche sont offertes.',
    },
    'search-button': {
      title: 'Lancer votre recherche',
      description: 'Cliquez sur le bouton Rechercher pour trouver des images satellites correspondant à vos critères. Les résultats s’afficheront dans le panneau de droite.',
    },
    'results-view': {
      title: 'Résultats et téléchargement',
      description: 'Affichez les résultats sous forme de miniatures ou de tableau. Passez des empreintes aux marqueurs ponctuels. Sélectionnez plusieurs résultats et commandez-les en un clic. La connexion est requise pour la plupart des données.',
    },
    'orders-panel': {
      title: 'Téléchargements, préférences et profil',
      description: 'Accédez aux téléchargements et aux préférences avec les boutons en haut à droite. Suivez vos commandes en temps réel et consultez leur progression. Personnalisez votre expérience : changez la carte de base, choisissez la langue, activez le mode sombre ou sélectionnez votre fournisseur de recherche de lieux. Connectez-vous pour accéder à votre compte, à l’historique des commandes et aux produits de données premium.',
    },
  },
  napl: {
    welcome: {
      title: 'Découvrez plus de 100 ans de photos de la BNA',
      description: 'La Bibliothèque nationale de photos aériennes du Canada conserve plus d’un siècle de photographies aériennes. Explorez des vues historiques des paysages, des villes et de l’aménagement du territoire au Canada.',
    },
    collections: {
      title: 'Collections de photos',
      description: 'Choisissez l’accès libre et gratuit (800 ppp) ou des produits payants en haute résolution, numériques ou imprimés.',
    },
    'map-search': {
      title: 'Rechercher par lieu',
      description: 'Dessinez sur la carte ou saisissez des coordonnées pour définir votre zone de recherche. Les photos de cette zone seront affichées.',
    },
    results: {
      title: 'Résultats de photos',
      description: 'Parcourez des photos aériennes de l’histoire du Canada. Cliquez sur une photo pour consulter ses détails, l’ajouter à votre valise ou commander des tirages.',
    },
    valise: {
      title: 'Valise - votre sélection',
      description: 'Ajoutez des photos à votre valise pour passer une commande groupée. Gérez votre sélection et passez à la caisse lorsque vous êtes prêt.',
    },
    preferences: {
      title: 'Téléchargements, préférences et profil',
      description: 'Accédez aux téléchargements et aux préférences avec les boutons en haut à droite. Personnalisez votre expérience : changez la carte de base, choisissez la langue et activez le mode sombre. Connectez-vous pour accéder à votre compte et à l’historique des commandes.',
    },
  },
};

const LOCALIZED_FRENCH_TOUR_STEPS = {
  eodms: EODMS_TOUR_STEPS.map((step) => ({ ...step, ...FRENCH_TOUR_STEPS.eodms[step.id] })),
  napl: NAPL_TOUR_STEPS.map((step) => ({ ...step, ...FRENCH_TOUR_STEPS.napl[step.id] })),
};

export function getTourSteps(experience: 'eodms' | 'napl', language: Language): TourStep[] {
  if (language === 'fr') return LOCALIZED_FRENCH_TOUR_STEPS[experience];
  return experience === 'napl' ? NAPL_TOUR_STEPS : EODMS_TOUR_STEPS;
}
