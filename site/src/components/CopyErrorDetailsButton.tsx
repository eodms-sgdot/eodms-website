import { useContext, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { AppContext } from '../AppContext';

/** Alert action that copies raw HTTP error details to the clipboard. */
export default function CopyErrorDetailsButton({ details }: { details: string }) {
  const { t } = useContext(AppContext)!;
  const [copied, setCopied] = useState<'success' | 'error' | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied('success');
    } catch {
      setCopied('error');
    }
  };

  const title = copied === 'success' ? t('errorDetailsCopied')
    : copied === 'error' ? t('errorDetailsCopyFailed') : t('copyErrorDetails');

  return (
    <Tooltip title={title} onClose={() => setCopied(null)}>
      <IconButton size="small" color="inherit" aria-label={t('copyErrorDetails')} onClick={() => void copy()}>
        {copied === 'success' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
