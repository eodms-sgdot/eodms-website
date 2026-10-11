import { useContext, useState } from 'react';
import { Button, ButtonBase, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { AppContext } from '../AppContext';
import { getS3RecursiveCommand } from '../services/ProcessingService';

export interface DownloadableAsset {
  key: string;
  title: string;
  href: string;
}

/** Download button for items whose files are directly downloadable; offers a file menu when there is more than one. */
export default function AssetDownloadButton({ assets, compact = false }: { assets: DownloadableAsset[]; compact?: boolean }) {
  const { t } = useContext(AppContext)!;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (compact && assets.length === 1) {
    return (
      <Tooltip title={`${t('download')} - ${assets[0].title}`}>
        <IconButton size="small" color="success" aria-label={t('download')} href={assets[0].href} target="_blank" rel="noopener noreferrer">
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  if (assets.length === 1) {
    return (
      <Tooltip title={assets[0].title}>
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<DownloadIcon />}
          href={assets[0].href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('download')}
        </Button>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title={t('chooseFileHover')}>
        {compact ? (
          <IconButton
            size="small"
            color="success"
            aria-label={t('download')}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={!!anchorEl}
          >
            <DownloadIcon fontSize="small" />
            <ArrowDropDownIcon fontSize="small" sx={{ ml: -0.5 }} />
          </IconButton>
        ) : (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<DownloadIcon />}
          endIcon={<ArrowDropDownIcon />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={!!anchorEl}
        >
          {t('download')}
        </Button>
        )}
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {assets.map(asset => (
          <MenuItem
            key={asset.key}
            component="a"
            href={asset.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchorEl(null)}
            dense
          >
            <ListItemIcon><InsertDriveFileOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{asset.title}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export function S3CopyButton({ assets }: { assets: DownloadableAsset[] }) {
  const { t } = useContext(AppContext)!;
  const [message, setMessage] = useState('');
  const command = getS3RecursiveCommand(assets.map(asset => asset.href));

  const copyCommand = async () => {
    if (!command) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(command);
      setMessage(t('copied'));
    } catch {
      const input = document.createElement('textarea');
      input.value = command;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      try {
        input.select();
        setMessage(document.execCommand('copy') ? t('copied') : t('processingCopyS3Failed'));
      } catch {
        setMessage(t('processingCopyS3Failed'));
      } finally {
        input.remove();
      }
    }
  };

  return <>
    <Tooltip title={command ?? t('processingS3NoSharedFolder')}
      slotProps={{ tooltip: { sx: { maxWidth: 360, overflowWrap: 'anywhere', fontFamily: command ? 'monospace' : undefined } } }}>
      <span><ButtonBase aria-label={command ? t('processingCopyS3Label') : t('processingS3NoSharedFolder')}
        disabled={!command} onClick={() => void copyCommand()}
        sx={{ typography: 'caption', fontWeight: 'bold', px: 1, py: 0.5, gap: 0.5, borderRadius: '4px',
          bgcolor: '#e8f5e9', color: 'success.main', whiteSpace: 'nowrap',
          '&:hover, &.Mui-focusVisible': { bgcolor: '#c8e6c9' },
        }}>
        <ContentCopyIcon sx={{ fontSize: 14 }} />
        {command ? t('processingCopyS3Label') : t('processingSuccessful')}
      </ButtonBase></span>
    </Tooltip>
    <Snackbar open={!!message} autoHideDuration={3000} onClose={() => setMessage('')} message={message} />
  </>;
}
