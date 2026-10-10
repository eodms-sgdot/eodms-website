import {useState, useContext, type ChangeEvent, type ReactNode} from 'react';
import { Alert, Avatar, Box, Typography, TextField, Button, CircularProgress, IconButton, InputAdornment } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LoginIcon from '@mui/icons-material/Login';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { AppContext } from '../AppContext';
import { handleAAAError } from '../services/AAAService';
import { getAuthenticationToken } from '../services/AAAService';
import axios from 'axios';
import type { aaaResponse} from '../types';
import type { TranslationKey } from '../i18n';


export default function AuthPanel({ footerStart }: { footerStart?: ReactNode }) {
  const {authEndpoint, setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setIsAuthOpen, authErrorMessage, setAuthErrorMessage, t } = useContext(AppContext)!;
  const [loading, setLoading] = useState(false);
  const [username, setLocalUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Retrieve authentication token and place in context to be used by other parts of the app.
   * Report errors in the login panel if request failed.
   */
  const fetchAuth = async () => {
    setLoading(true);
    try {
      
      const response: aaaResponse = await getAuthenticationToken(authEndpoint, username, password);

      // calculate expiry times 
      const currentTime = new Date();
      const authExpiry = new Date(+currentTime + response.expires_in * 1000);
      const refreshExpiry = new Date(+currentTime + response.refresh_token_expires_in * 1000);

      // refresh context
      setUsername(username);
      setAuthToken(response.access_token);
      setAuthExpiry(authExpiry.toISOString());
      setRefreshToken(response.refresh_token);
      setRefreshExpiry(refreshExpiry.toISOString());
      setIsAuthOpen(false); 
      setAuthErrorMessage(null);
    } 
    catch (e) {
      if (axios.isAxiosError(e)) {
        const message = handleAAAError(e);
        if(message) {
          setAuthErrorMessage(message);
        }
      }
    }
    finally { 
      setLoading(false); 
    }
  }
  
  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>) => setLocalUsername(e.target.value);
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Avatar sx={{ bgcolor: 'action.selected', color: 'primary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography variant="h6" color="primary">{t('authRequired')}</Typography>
      </Box>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (username && password && !loading) fetchAuth();
        }}
        sx={(theme) => {
          // Autofill paints the whole input, under the floating label; an inset shadow covers it with the panel colour.
          const autofill = {
            boxShadow: `0 0 0 100px ${theme.palette.background.paper} inset`,
            WebkitTextFillColor: theme.palette.text.primary,
            caretColor: theme.palette.text.primary,
          };
          return {
            display: 'flex', flexDirection: 'column', gap: 1.5,
            '& input:-webkit-autofill': autofill,
            '& input:autofill': autofill,
          };
        }}
      >
        <TextField
          label={t('username')} fullWidth size="small" autoFocus
          autoComplete="username" value={username} onChange={handleUsernameChange} disabled={loading}
        />
        <TextField
          label={t('password')} fullWidth size="small"
          autoComplete="current-password" value={password} onChange={handlePasswordChange} disabled={loading}
          type={showPassword ? 'text' : 'password'}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small" edge="end"
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    onClick={() => setShowPassword(show => !show)}
                  >
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        {authErrorMessage && <Alert severity="error" sx={{ py: 0 }}>{t(authErrorMessage as TranslationKey)}</Alert>}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {footerStart}
          <Button type="button" onClick={() => setIsAuthOpen(false)} sx={{ ml: 'auto' }}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!username || !password || loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
          >
            {t('login')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}