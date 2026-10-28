import { useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Avatar, Box, Button, CircularProgress, Collapse, Divider, MenuItem, TextField, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import axios from 'axios';
import { AppContext } from '../AppContext';
import { getInitials } from '../utils/RenderingUtils';
import { getUserProfile, handleUserProfileError, readUserProfile, updateUserProfile, type UserProfileFields } from '../services/AAAService';
import type { TranslationKey } from '../i18n';
import { getAxiosErrorDetails } from '../utils/HttpErrorDetails';
import CopyErrorDetailsButton from './CopyErrorDetailsButton';

// The users API expects these language values, as in the EODMS CLI.
const PROFILE_LANGUAGES: { value: string; key: TranslationKey }[] = [
  { value: 'English', key: 'profileLanguageEnglish' },
  { value: 'French', key: 'profileLanguageFrench' },
];
const TEXT_FIELDS: { field: keyof UserProfileFields; key: TranslationKey; type?: string; autoComplete: string }[] = [
  { field: 'given_name', key: 'givenName', autoComplete: 'given-name' },
  { field: 'surname', key: 'surname', autoComplete: 'family-name' },
  { field: 'email', key: 'email', type: 'email', autoComplete: 'email' },
  { field: 'address', key: 'address', autoComplete: 'street-address' },
];
const MINIMUM_PASSWORD_BYTES = 15;
const USER_PROFILE_ENABLED = import.meta.env.VITE_ENABLE_USER_PROFILE === 'true';

type Status = { severity: 'success' | 'error'; message: string; details?: string } | null;

const describeError = (error: unknown, t: (key: TranslationKey) => string): Status => {
  const details = getAxiosErrorDetails(error);
  if (!axios.isAxiosError(error)) return { severity: 'error', message: t('profileRequestFailed') };
  const { key, detail } = handleUserProfileError(error);
  return { severity: 'error', message: detail ? `${t(key)}: ${detail}` : t(key), details };
};

const StatusAlert = ({ status, action }: { status: NonNullable<Status>; action?: ReactNode }) => (
  <Alert severity={status.severity} sx={{ py: 0 }}
    action={(action || status.details) && <>{action}{status.details && <CopyErrorDetailsButton details={status.details} />}</>}>
    {status.message}
  </Alert>
);

/** @param footerStart Optional action shown at the left of the button row (e.g. Terms of Use). */
export default function LogoutPanel({ footerStart }: { footerStart?: ReactNode }) {
  const { username, usersEndpoint, getValidAuthToken, setUsername, setAuthToken, setAuthExpiry, setRefreshToken, setRefreshExpiry, setIsAuthOpen, setAuthErrorMessage, t } = useContext(AppContext)!;
  const [saved, setSaved] = useState<UserProfileFields | null>(null);
  const [draft, setDraft] = useState<UserProfileFields>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  // Token refreshes change this function; a ref keeps them from reloading the profile over unsaved edits.
  const getTokenRef = useRef(getValidAuthToken);
  useEffect(() => { getTokenRef.current = getValidAuthToken; });
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const fetchProfile = useCallback(async () => {
    if (!USER_PROFILE_ENABLED || !username) return;
    try {
      const token = await getTokenRef.current();
      const fields = readUserProfile(await getUserProfile(usersEndpoint, username, token));
      setSaved(fields);
      setDraft(fields);
      setStatus(null);
    } catch (error) {
      setStatus(describeError(error, tRef.current));
    } finally {
      setLoading(false);
    }
  }, [username, usersEndpoint]);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const changes = Object.fromEntries(Object.entries(draft)
    .filter(([field, value]) => value !== undefined && value !== saved?.[field as keyof UserProfileFields])) as UserProfileFields;
  const hasChanges = Object.keys(changes).length > 0;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!USER_PROFILE_ENABLED || !username || !hasChanges) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateUserProfile(usersEndpoint, username, await getValidAuthToken(), changes);
      setSaved(previous => ({ ...previous, ...changes }));
      setEditing(false);
      setStatus({ severity: 'success', message: t('profileSaved') });
    } catch (error) {
      setStatus(describeError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!USER_PROFILE_ENABLED || !username) return;
    if (new TextEncoder().encode(newPassword).length < MINIMUM_PASSWORD_BYTES) {
      setPasswordStatus({ severity: 'error', message: t('passwordTooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ severity: 'error', message: t('passwordMismatch') });
      return;
    }
    setSaving(true);
    setPasswordStatus(null);
    try {
      await updateUserProfile(usersEndpoint, username, await getValidAuthToken(), { password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ severity: 'success', message: t('passwordChanged') });
    } catch (error) {
      setPasswordStatus(describeError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const currentLanguage = draft.language;
  const languageOptions = currentLanguage && !PROFILE_LANGUAGES.some(option => option.value === currentLanguage)
    ? [...PROFILE_LANGUAGES, { value: currentLanguage, key: null }]
    : PROFILE_LANGUAGES;
  const languageLabel = (value: string) => {
    const option = PROFILE_LANGUAGES.find(candidate => candidate.value === value);
    return option ? t(option.key) : value;
  };
  const shownFields = saved ? TEXT_FIELDS.filter(({ field }) => saved[field] !== undefined) : [];

  const startEditing = () => {
    if (!saved) return;
    setDraft(saved);
    setStatus(null);
    setEditing(true);
  };
  const cancelEditing = () => {
    if (saved) setDraft(saved);
    setStatus(null);
    setEditing(false);
  };

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
      {USER_PROFILE_ENABLED && <>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="overline" color="text.secondary">{t('profile')}</Typography>
        {saved && !editing && !loading && (
          <Button size="small" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={startEditing} sx={{ ml: 'auto' }}>
            {t('edit')}
          </Button>
        )}
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
      ) : !editing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
          {saved && (
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 0.75 }}>
              {shownFields.map(({ field, key }) => (
                <Box key={field} sx={{ display: 'contents' }}>
                  <Typography component="dt" variant="body2" color="text.secondary">{t(key)}</Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                    {saved[field] || '—'}
                  </Typography>
                </Box>
              ))}
              {saved.language !== undefined && (
                <>
                  <Typography component="dt" variant="body2" color="text.secondary">{t('language')}</Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>{saved.language ? languageLabel(saved.language) : '—'}</Typography>
                </>
              )}
            </Box>
          )}
          {status && (
            <StatusAlert status={status}
              action={!saved ? <Button color="inherit" size="small" onClick={() => { setLoading(true); setStatus(null); void fetchProfile(); }}>{t('retryNow')}</Button> : undefined} />
          )}
        </Box>
      ) : (
        <Box component="form" onSubmit={saveProfile} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
          {shownFields.map(({ field, key, type, autoComplete }) => (
            <TextField
              key={field} label={t(key)} size="small" fullWidth type={type} autoComplete={autoComplete}
              multiline={field === 'address'} disabled={saving}
              value={draft[field] ?? ''}
              onChange={(e) => setDraft(previous => ({ ...previous, [field]: e.target.value }))}
            />
          ))}
          {saved?.language !== undefined && (
            <TextField
              select label={t('language')} size="small" fullWidth disabled={saving}
              value={draft.language ?? ''}
              onChange={(e) => setDraft(previous => ({ ...previous, language: e.target.value }))}
            >
              {languageOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>{option.key ? t(option.key) : option.value}</MenuItem>
              ))}
            </TextField>
          )}
          {status && <StatusAlert status={status} />}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button type="button" disabled={saving} onClick={cancelEditing}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={!hasChanges || saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {t('saveProfile')}
            </Button>
          </Box>
        </Box>
      )}
      <Button size="small" onClick={() => { setPasswordOpen(open => !open); setPasswordStatus(null); }}
        sx={{ mt: 1, ml: -0.5, textTransform: 'none' }}>
        {t('changePassword')}
      </Button>
      <Collapse in={passwordOpen} unmountOnExit>
        <Box component="form" onSubmit={changePassword} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <TextField
            label={t('newPassword')} type="password" size="small" fullWidth autoComplete="new-password"
            helperText={t('passwordRequirement')} disabled={saving}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            label={t('confirmPassword')} type="password" size="small" fullWidth autoComplete="new-password" disabled={saving}
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordStatus && <StatusAlert status={passwordStatus} />}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button type="button" disabled={saving}
              onClick={() => { setNewPassword(''); setConfirmPassword(''); setPasswordStatus(null); setPasswordOpen(false); }}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="outlined" disabled={!newPassword || !confirmPassword || saving}>
              {t('changePassword')}
            </Button>
          </Box>
        </Box>
      </Collapse>
      </>}
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