import { useContext, useState } from 'react';
import { Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { AppContext } from '../AppContext';

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
