import { Box, Typography } from '@mui/material';
import { AppContext } from '../AppContext';
import { useContext } from 'react';
import NaplContactInfo from './NaplContactInfo';

export default function NaplWelcome() {
  const { t } = useContext(AppContext)!;

  return (
    <Box component="section" sx={{ borderBottom: '4px solid', borderColor: '#b79252' }}>
      <Box sx={{ position: 'relative', height: 190, overflow: 'hidden', bgcolor: '#173f4b' }}>
        <Box
          component="img"
          src={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/A28409_318.png`}
          alt="Archival black-and-white aerial photograph of a city"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            p: 2,
            background: 'linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.62) 100%)',
            color: 'common.white',
          }}
        >
          <Typography variant="h6" component="h1">
            {t('naplWelcomeTitle')}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ p: 2, bgcolor: 'background.paper', lineHeight: 1.6 }}>
        {t('naplWelcomeBody')}
      </Typography>
      <Box sx={{ px: 2, pb: 1.5, bgcolor: 'background.paper' }}>
        <NaplContactInfo />
      </Box>
    </Box>
  );
}