import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import HomeIcon from '@mui/icons-material/Home';
import { AppContext } from '../AppContext';
import AnimationsScreen from './AnimationsScreen';

const TOUR_STEPS = [
  {
    id: 'welcome',
    showAnimation: true,
  },
  {
    id: 'preferences',
  },
  {
    id: 'collections',
  },
  {
    id: 'time',
  },
  {
    id: 'mapControls',
  },
  {
    id: 'results',
  },
  {
    id: 'login',
  },
  {
    id: 'downloads',
  },
  {
    id: 'processing',
  },
];

function clearAllStorage() {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
}

function WelcomeTourStep({
  onContinue,
  onSkip,
}: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useContext(AppContext)!;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background elements */}
      <Box
        sx={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          top: '-250px',
          left: '-250px',
          animation: 'pulse 4s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
            '50%': { transform: 'scale(1.1)', opacity: 0.3 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          bottom: '-200px',
          right: '-200px',
          animation: 'float 6s ease-in-out infinite',
          '@keyframes float': {
            '0%, 100%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(30px)' },
          },
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack spacing={4} sx={{ alignItems: "center", textAlign: "center" }}>
          {/* Hero Animation Section */}
          <Box
            sx={{
              width: '100%',
              height: isMobile ? '200px' : '300px',
              mb: 2,
            }}
          >
            <AnimationsScreen isEmbedded />
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 'bold',
              fontSize: isMobile ? '2rem' : '3.5rem',
              mb: 1,
            }}
          >
            {t('tourWelcomeTitle')}
          </Typography>

          <Typography
            variant="h5"
            sx={{
              fontSize: isMobile ? '1rem' : '1.25rem',
              opacity: 0.95,
              maxWidth: '500px',
              lineHeight: 1.6,
            }}
          >
            {t('tourWelcomeSubtitle')}
          </Typography>

          <Box sx={{ pt: 3 }}>
            <Typography
              variant="body1"
              sx={{
                mb: 3,
                opacity: 0.9,
                fontSize: '1.1rem',
              }}
            >
              {t('tourGetStarted')}
            </Typography>

            <Stack
              spacing={2}
              direction={isMobile ? 'column' : 'row'}
              sx={{ justifyContent: 'center' }}
            >
              <Button
                variant="contained"
                color="secondary"
                size="large"
                onClick={onContinue}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  minWidth: '200px',
                  boxShadow: 3,
                  '&:hover': {
                    boxShadow: 6,
                  },
                }}
              >
                {t('tourStartTour')}
              </Button>
              <Button
                variant="outlined"
                sx={{
                  color: 'white',
                  borderColor: 'white',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  minWidth: '200px',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'white',
                  },
                }}
                endIcon={<SkipNextIcon />}
                onClick={onSkip}
              >
                {t('tourSkip')}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

function PreferencesTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourPreferencesTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourPreferencesDesc')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {t('baseMap')}
              </Typography>
              <Typography variant="body2">
                {t('tourPreferencesBasemapDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {t('language')}
              </Typography>
              <Typography variant="body2">
                {t('tourPreferencesLanguageDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {t('tourDarkMode')}
              </Typography>
              <Typography variant="body2">
                {t('tourPreferencesDarkModeDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {t('locationSearchProvider')}
              </Typography>
              <Typography variant="body2">
                {t('tourPreferencesProviderDetail')}
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function CollectionsTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourCollectionsTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourCollectionsDesc')}
          </Typography>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📊 {t('tourTimeBar')}
              </Typography>
              <Typography variant="body2">
                {t('tourTimeBarDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🔍 {t('tourCollectionFilters')}
              </Typography>
              <Typography variant="body2">
                {t('tourCollectionFiltersDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ✅ {t('tourSameCatalog')}
              </Typography>
              <Typography variant="body2">
                {t('tourSameCatalogDetail')}
              </Typography>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function TimeTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourTimeTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourTimeDesc')}
          </Typography>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📅 {t('tourDatePicker')}
              </Typography>
              <Typography variant="body2">
                {t('tourDatePickerDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ⌨️ {t('tourManualEntry')}
              </Typography>
              <Typography variant="body2">
                {t('tourManualEntryDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🌍 UTC {t('tourTimeZone')}
              </Typography>
              <Typography variant="body2">
                {t('tourTimeZoneDetail')}
              </Typography>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function MapControlsTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourMapControlsTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourMapControlsDesc')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🖱️ {t('tourRightClick')}
              </Typography>
              <Typography variant="body2">
                {t('tourRightClickDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📦 {t('tourGeoJSON')}
              </Typography>
              <Typography variant="body2">
                {t('tourGeoJSONDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📍 {t('tourCoordinates')}
              </Typography>
              <Typography variant="body2">
                {t('tourCoordinatesDetail')}
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function ResultsTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourResultsTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourResultsDesc')}
          </Typography>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🖼️ {t('tourThumbnailView')}
              </Typography>
              <Typography variant="body2">
                {t('tourThumbnailViewDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📋 {t('tourTableView')}
              </Typography>
              <Typography variant="body2">
                {t('tourTableViewDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🎯 {t('tourViewModes')}
              </Typography>
              <Typography variant="body2">
                {t('tourViewModesDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ⬇️ {t('tourExport')}
              </Typography>
              <Typography variant="body2">
                {t('tourExportDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🛒 {t('tourOrdering')}
              </Typography>
              <Typography variant="body2">
                {t('tourOrderingDetail')}
              </Typography>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function LoginTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourLoginTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourLoginDesc')}
          </Typography>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🔐 {t('tourAuth')}
              </Typography>
              <Typography variant="body2">
                {t('tourAuthDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                👤 {t('tourProfile')}
              </Typography>
              <Typography variant="body2">
                {t('tourProfileDetail')}
              </Typography>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function DownloadsTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourDownloadsTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourDownloadsDesc')}
          </Typography>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📊 {t('tourOrderProgress')}
              </Typography>
              <Typography variant="body2">
                {t('tourOrderProgressDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ✅ {t('tourStatusUpdates')}
              </Typography>
              <Typography variant="body2">
                {t('tourStatusUpdatesDetail')}
              </Typography>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function ProcessingTourStep() {
  const { t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('tourProcessingTitle')}
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t('tourProcessingDesc')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🛠️ {t('tourSARToolbox')}
              </Typography>
              <Typography variant="body2">
                {t('tourSARToolboxDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📡 ARD
              </Typography>
              <Typography variant="body2">
                {t('tourARDDetail')}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, bgcolor: 'action.hover', gridColumn: { xs: '1', sm: '1 / -1' } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🎯 {t('tourRADARSAT')}
              </Typography>
              <Typography variant="body2">
                {t('tourRADARSATDetail')}
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

const TOUR_COMPONENTS: Record<string, React.ComponentType<{}>> = {
  preferences: PreferencesTourStep,
  collections: CollectionsTourStep,
  time: TimeTourStep,
  mapControls: MapControlsTourStep,
  results: ResultsTourStep,
  login: LoginTourStep,
  downloads: DownloadsTourStep,
  processing: ProcessingTourStep,
};

export default function TourScreen() {
  const navigate = useNavigate();
  const { t } = useContext(AppContext)!;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Clear all storage when entering tour
    if (!isInitialized) {
      clearAllStorage();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const currentStepData = TOUR_STEPS[currentStep];
  const CurrentComponent = currentStepData && currentStepData.id !== 'welcome'
    ? TOUR_COMPONENTS[currentStepData.id]
    : null;

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate('/');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  if (!isInitialized) {
    return <Skeleton variant="rectangular" height="100vh" />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {currentStep === 0 ? (
        <WelcomeTourStep onContinue={handleNext} onSkip={handleSkip} />
      ) : (
        <>
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'background.paper',
              borderBottom: `1px solid ${theme.palette.divider}`,
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Button
              startIcon={<HomeIcon />}
              onClick={() => navigate('/')}
              variant="text"
            >
              {t('tourExitTour')}
            </Button>

            <Typography variant="body2" color="textSecondary">
              {currentStep} / {TOUR_STEPS.length - 1}
            </Typography>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {CurrentComponent ? <CurrentComponent /> : null}
          </Box>

          {/* Footer Navigation */}
          <Box
            sx={{
              bgcolor: 'background.paper',
              borderTop: `1px solid ${theme.palette.divider}`,
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <IconButton
              onClick={handlePrevious}
              disabled={currentStep <= 1}
              size={isMobile ? 'small' : 'medium'}
            >
              <ChevronLeftIcon />
            </IconButton>

            <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: 'center' }}>
              {TOUR_STEPS.map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    height: 8,
                    width: 8,
                    borderRadius: '50%',
                    bgcolor:
                      index === currentStep
                        ? 'primary.main'
                        : index < currentStep
                          ? 'primary.light'
                          : 'action.disabled',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onClick={() => setCurrentStep(index)}
                />
              ))}
            </Stack>

            <IconButton
              onClick={handleNext}
              size={isMobile ? 'small' : 'medium'}
              color="primary"
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  );
}

