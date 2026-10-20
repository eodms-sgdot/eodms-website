import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import LoaderCycle from '../components/LoaderCycle';
import { NAPL_SEARCH_LOADERS, SEARCH_LOADERS, type SearchLoader } from '../components/searchLoaderList';

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

/** One experience's search sequence as shown during a search, plus each of its loaders on its own. */
function LoaderSet({ title, loaders }: { title: string; loaders: SearchLoader[] }) {
  const [active, setActive] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">{title}</Typography>
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Search sequence: {loaders[active].name}
        </Typography>
        <Box sx={PANEL_SX}>
          <LoaderCycle loaders={loaders} onIndexChange={setActive} />
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {loaders.map(({ name, Loader }, index) => (
          <Box key={name} sx={{ ...PANEL_SX, borderColor: index === active ? 'primary.main' : 'transparent' }}>
            <Loader />
            <Typography variant="body2">{name}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Preview of the search loaders for each experience. */
export default function AnimationsScreen() {
  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 4, minHeight: '100vh' }}>
      <Typography variant="h5">Search animations</Typography>
      <LoaderSet title="EODMS" loaders={SEARCH_LOADERS} />
      <LoaderSet title="NAPL" loaders={NAPL_SEARCH_LOADERS} />
    </Box>
  );
}
