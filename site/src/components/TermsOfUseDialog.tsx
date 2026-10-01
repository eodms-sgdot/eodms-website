import { useContext, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { AppContext } from '../AppContext';
import { TERMS_OF_USE_REVIEW_INTERVAL_DAYS, TERMS_OF_USE_TEXT } from '../config/termsOfUse.config';

const LAST_VIEWED_STORAGE_KEY = 'terms-of-use-last-viewed';
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

interface TermsOfUseDialogProps {
  username: string | null;
  authenticated: boolean;
  manualOpen: boolean;
  onManualClose: () => void;
}

export default function TermsOfUseDialog({ username, authenticated, manualOpen, onManualClose }: TermsOfUseDialogProps) {
  const { language, t } = useContext(AppContext)!;
  const normalizedUsername = username?.trim().toLowerCase();
  const storageKey = normalizedUsername
    ? `${LAST_VIEWED_STORAGE_KEY}:${encodeURIComponent(normalizedUsername)}`
    : null;
  const [automaticPromptOpen, setAutomaticPromptOpen] = useState(() => {
    if (!storageKey) return false;
    const lastViewed = Date.parse(localStorage.getItem(storageKey) ?? '');
    const reviewInterval = TERMS_OF_USE_REVIEW_INTERVAL_DAYS * DAY_IN_MILLISECONDS;
    return !Number.isFinite(lastViewed) || Date.now() - lastViewed >= reviewInterval;
  });
  const requiresAcknowledgment = authenticated && !!storageKey && automaticPromptOpen;
  const open = manualOpen || requiresAcknowledgment;

  const acknowledgeTerms = () => {
    if (requiresAcknowledgment && storageKey) {
      localStorage.setItem(storageKey, new Date().toISOString());
      setAutomaticPromptOpen(false);
    }
    onManualClose();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!requiresAcknowledgment) onManualClose();
      }}
      aria-labelledby="terms-of-use-title"
    >
      <DialogTitle id="terms-of-use-title">{t('termsOfUseTitle')}</DialogTitle>
      <DialogContent dividers>
        {TERMS_OF_USE_TEXT[language].map((paragraph) => (
          <Typography key={paragraph} component="p" variant="body1" sx={{ mb: 2 }}>
            {paragraph}
          </Typography>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={acknowledgeTerms} variant="contained">
          {requiresAcknowledgment ? t('termsOfUseAgree') : t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}