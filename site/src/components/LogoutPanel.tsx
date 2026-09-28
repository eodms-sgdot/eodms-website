import {useContext} from 'react';
import { Box, Typography, Button } from '@mui/material';
import { AppContext } from '../AppContext';


export default function LogoutPanel() {
  const { username, setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setIsAuthOpen, setAuthErrorMessage, t } = useContext(AppContext)!;

  return (
    <Box sx={{ p: 1}}>
      <Typography variant="h6" color="primary" gutterBottom>{username}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            fullWidth variant="contained" 
            onClick={() => {
                setUsername(null);
                setAuthToken(null);
                setAuthExpiry(null);
                setRefreshToken(null);
                setRefreshExpiry(null);
                setAuthErrorMessage(null);
                setIsAuthOpen(false);
              }}> {t('logout')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}