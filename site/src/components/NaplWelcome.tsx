import { Box, Typography } from '@mui/material';
import heroImage from '../assets/hero.png';
import { AppContext } from '../AppContext';
import { useContext } from 'react';

export default function NaplWelcome() {
  const { t } = useContext(AppContext)!;

  return (
    <Box component="section" sx={{ borderBottom: '4px solid', borderColor: '#b79252' }}>
      <Box sx={{ position: 'relative', height: 190, overflow: 'hidden', bgcolor: '#173f4b' }}>
        <Box
          component="img"
          src={heroImage}
          alt="Historical aerial photograph from the National Air Photo Library"
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
            bgcolor: 'rgba(10, 35, 42, 0.48)',
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
    </Box>
  );
}