import {useState, useContext, type ChangeEvent, type FormEvent, type ReactNode} from 'react';
import { Alert, Avatar, Box, Typography, TextField, Button, CircularProgress, IconButton, InputAdornment } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LoginIcon from '@mui/icons-material/Login';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { AppContext } from '../AppContext';
import { createUserAccount, getAuthenticationToken, handleAAAError } from '../services/AAAService';
import axios from 'axios';
import type { aaaResponse} from '../types';
import type { TranslationKey } from '../i18n';
import { USER_PROFILE_ENABLED } from '../config/userProfile.config';
import { getAxiosErrorDetails } from '../utils/HttpErrorDetails';
import CopyErrorDetailsButton from './CopyErrorDetailsButton';

type RegistrationStatus = { severity: 'success' | 'error'; message: string; details?: string } | null;

const getRegistrationErrorDetail = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const data = error.response?.data;
  if (typeof data === 'string') return /^\d{3}\b/.test(data.trim()) ? undefined : data.trim();
  if (!data || typeof data !== 'object') return undefined;
  return ['error', 'detail', 'message']
    .map(key => (data as Record<string, unknown>)[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0 && !/^\d{3}\b/.test(value.trim()))
    ?.trim();
};


export default function AuthPanel({ footerStart }: { footerStart?: ReactNode }) {
  const {authEndpoint, usersEndpoint, language, setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setIsAuthOpen, authErrorMessage, setAuthErrorMessage, t } = useContext(AppContext)!;
  const [loading, setLoading] = useState(false);
  const [username, setLocalUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(null);

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

  const registerAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!USER_PROFILE_ENABLED || registering) return;
    const normalizedUsername = username.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(normalizedUsername)) {
      setRegistrationStatus({ severity: 'error', message: t('usernameRequirements') });
      return;
    }
    if (new TextEncoder().encode(password).length < 15) {
      setRegistrationStatus({ severity: 'error', message: t('passwordTooShort') });
      return;
    }
    if (password !== confirmPassword) {
      setRegistrationStatus({ severity: 'error', message: t('passwordMismatch') });
      return;
    }

    setRegistering(true);
    setRegistrationStatus(null);
    try {
      await createUserAccount(usersEndpoint, {
        username: normalizedUsername,
        password,
        given_name: givenName.trim(),
        surname: surname.trim(),
        email: email.trim(),
        language: language === 'fr' ? 'French' : 'English',
      });
      setPassword('');
      setConfirmPassword('');
      setRegistrationOpen(false);
      setRegistrationStatus({ severity: 'success', message: t('accountCreatedCheckEmail') });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = getRegistrationErrorDetail(error);
      const fallbackMessage = status === 409
        ? t('accountAlreadyExists')
        : status === 429 ? t('errorTooManyRequests')
          : status !== undefined && status < 500 ? t('accountCreationRejected') : t('accountCreationFailed');
      setRegistrationStatus({
        severity: 'error',
        message: detail ?? fallbackMessage,
        details: getAxiosErrorDetails(error),
      });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Avatar sx={{ bgcolor: 'action.selected', color: 'primary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography variant="h6" color="primary">{registrationOpen ? t('createAccount') : t('authRequired')}</Typography>
      </Box>
      {registrationOpen ? (
      <Box component="form" onSubmit={(event: FormEvent) => void registerAccount(event)} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          label={t('username')} fullWidth size="small" autoFocus autoComplete="username" required
          helperText={t('usernameRequirements')} value={username} onChange={handleUsernameChange} disabled={registering}
        />
        <TextField
          label={t('givenName')} fullWidth size="small" autoComplete="given-name" required
          value={givenName} onChange={(event) => setGivenName(event.target.value)} disabled={registering}
        />
        <TextField
          label={t('surname')} fullWidth size="small" autoComplete="family-name" required
          value={surname} onChange={(event) => setSurname(event.target.value)} disabled={registering}
        />
        <TextField
          label={t('email')} fullWidth size="small" type="email" autoComplete="email" required
          value={email} onChange={(event) => setEmail(event.target.value)} disabled={registering}
        />
        <TextField
          label={t('password')} fullWidth size="small" type="password" autoComplete="new-password" required
          helperText={t('passwordRequirement')} value={password} onChange={handlePasswordChange} disabled={registering}
        />
        <TextField
          label={t('confirmPassword')} fullWidth size="small" type="password" autoComplete="new-password" required
          value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={registering}
        />
        {registrationStatus && (
          <Alert severity={registrationStatus.severity} sx={{ py: 0 }}
            action={registrationStatus.details && <CopyErrorDetailsButton details={registrationStatus.details} />}>
            {registrationStatus.message}
          </Alert>
        )}
        {footerStart && <Box sx={{ display: 'flex', mt: 0.5 }}>{footerStart}</Box>}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
          <Button type="button" onClick={() => { setRegistrationOpen(false); setRegistrationStatus(null); }} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t('backToLogin')}
          </Button>
          <Button type="submit" variant="contained" disabled={registering}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            startIcon={registering ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {t('createAccount')}
          </Button>
        </Box>
      </Box>
      ) : <>
      {registrationStatus?.severity === 'success' && <Alert severity="success" sx={{ mb: 1 }}>{registrationStatus.message}</Alert>}
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
      {USER_PROFILE_ENABLED && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="button" size="small" onClick={() => {
            setAuthErrorMessage(null);
            setRegistrationStatus(null);
            setRegistrationOpen(true);
          }} sx={{ textTransform: 'none' }}>
            {t('createAccount')}
          </Button>
        </Box>
      )}
      </>}
    </Box>
  );
}