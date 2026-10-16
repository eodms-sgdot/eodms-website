import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import LoaderCycle from '../components/LoaderCycle';
import { SEARCH_LOADERS } from '../components/searchLoaderList';

const PANEL_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  minHeight: 220,
  p: 2,
  borderRadius: 2,
  bgcolor: '#0b1016',
  color: '#fff',
  border: '2px solid transparent',
};

/** Preview of the search loaders: the sequence as shown during a search, plus each loader on its own. */
export default function AnimationsScreen() {
  const [active, setActive] = useState(0);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, minHeight: '100vh' }}>
      <Typography variant="h5">Search animations</Typography>
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Search sequence: {SEARCH_LOADERS[active].name}
        </Typography>
        <Box sx={PANEL_SX}>
          <LoaderCycle onIndexChange={setActive} />
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {SEARCH_LOADERS.map(({ name, Loader }, index) => (
          <Box key={name} sx={{ ...PANEL_SX, borderColor: index === active ? 'primary.main' : 'transparent' }}>
            <Loader />
            <Typography variant="body2">{name}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
