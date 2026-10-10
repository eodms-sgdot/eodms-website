import {useContext, type ReactNode} from 'react';
import { Avatar, Box, Divider, Typography, Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { AppContext } from '../AppContext';
import { getInitials } from '../utils/RenderingUtils';


/** @param footerStart Optional action shown at the left of the button row (e.g. Terms of Use). */
export default function LogoutPanel({ footerStart }: { footerStart?: ReactNode }) {
  const { username, setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setIsAuthOpen, setAuthErrorMessage, t } = useContext(AppContext)!;

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 48, height: 48, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          {getInitials(username)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {username}
          </Typography>
          <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
            {t('signedIn')}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {footerStart}
          <Button 
            variant="outlined"
            startIcon={<LogoutIcon />}
            sx={{ ml: 'auto' }}
            onClick={() => {
                setUsername(null);
                setAuthToken(null);
                setAuthExpiry(null);
                setRefreshToken(null);
                setRefreshExpiry(null);
                setAuthErrorMessage(null);
                setIsAuthOpen(false);
              }}>{t('logout')}
          </Button>
      </Box>
    </Box>
  );
}