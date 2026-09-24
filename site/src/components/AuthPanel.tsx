import {useState, useContext, type ChangeEvent} from 'react';
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material';
import { AppContext } from '../AppContext';
import { handleAAAError } from '../services/AAAService';
import { getAuthenticationToken } from '../services/AAAService';
import axios from 'axios';
import type { aaaResponse} from '../types';
import type { TranslationKey } from '../i18n';


export default function AuthPanel() {
  const {authEndpoint, setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setIsAuthOpen, authErrorMessage, setAuthErrorMessage, t } = useContext(AppContext)!;
  const [loading, setLoading] = useState(false);
  const [username, setLocalUsername] = useState('');
  const [password, setPassword] = useState('');

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
    <Box sx={{ p: 1}}>
      <Typography variant="h6" color="primary" gutterBottom>{t('authRequired')}</Typography>
      {loading ? <CircularProgress size={20} /> : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField label={t('username')} fullWidth size="small" value={username} onChange={handleUsernameChange} />
          <TextField label={t('password')} fullWidth size="small" value={password} onChange={handlePasswordChange} type="password"/>
          {authErrorMessage ? <Typography color="error">{t(authErrorMessage as TranslationKey)}</Typography>:<></>}
          <Box sx={{ display: 'flex', gap: 1 }}>

            <Button 
              fullWidth variant="outlined" 
              onClick={() => { 
                setIsAuthOpen(false); 
              }}> {t('cancel')}
            </Button>

            <Button 
              fullWidth variant="contained" 
              disabled={!username || !password} 
              onClick={() => {
                  fetchAuth();
                }}> {t('login')}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}