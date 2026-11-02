import { useContext, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AppContext } from '../AppContext';

const SUPPORT_EMAIL = 'eodms-sgdot@nrcan-rncan.gc.ca';

export default function FeedbackControl({ isMobile, hideTrigger = false, open, onOpenChange }: { isMobile: boolean; hideTrigger?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t } = useContext(AppContext)!;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const showFeedback = () => {
    setMenuAnchor(null);
    setOpen(true);
  };

  return (
    <>
      {!hideTrigger && (
        <>
          <Tooltip title={t(isMobile ? 'feedbackMoreOptions' : 'feedback')}>
            <IconButton
              aria-label={t(isMobile ? 'feedbackMoreOptions' : 'feedback')}
              aria-haspopup={isMobile ? 'menu' : 'dialog'}
              aria-expanded={isMobile ? Boolean(menuAnchor) : undefined}
              aria-controls={isMobile && menuAnchor ? 'feedback-menu' : undefined}
              onClick={isMobile ? (event) => setMenuAnchor(event.currentTarget) : showFeedback}
              sx={{ width: 34, height: 34, borderRadius: 1.5, color: 'text.secondary' }}
            >
              {isMobile ? <MoreVertIcon fontSize="small" /> : <ChatBubbleOutlineIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Menu id="feedback-menu" anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem onClick={showFeedback}>
              <ListItemIcon><ChatBubbleOutlineIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{t('feedback')}</ListItemText>
            </MenuItem>
          </Menu>
        </>
      )}
      <Dialog open={isOpen} onClose={() => setOpen(false)} aria-labelledby="feedback-title" fullWidth maxWidth="xs">
        <DialogTitle id="feedback-title">{t('feedback')}</DialogTitle>
        <DialogContent dividers>
          <List disablePadding>
            <ListItemButton component="a" href={`mailto:${SUPPORT_EMAIL}`}>
              <ListItemIcon><EmailOutlinedIcon /></ListItemIcon>
              <ListItemText primary={t('feedbackEmail')} />
            </ListItemButton>
            <ListItemButton component="a" href="https://github.com/orgs/eodms-sgdot/discussions/20" target="_blank" rel="noopener noreferrer">
              <ListItemIcon><ForumOutlinedIcon /></ListItemIcon>
              <ListItemText primary={t('feedbackDiscussion')} />
              <OpenInNewIcon fontSize="small" sx={{ ml: 1, flexShrink: 0 }} aria-hidden="true" />
            </ListItemButton>
            <ListItemButton component="a" href="https://github.com/eodms-sgdot/eodms-website/issues/new/choose" target="_blank" rel="noopener noreferrer">
              <ListItemIcon><BugReportOutlinedIcon /></ListItemIcon>
              <ListItemText primary={t('feedbackBug')} />
              <OpenInNewIcon fontSize="small" sx={{ ml: 1, flexShrink: 0 }} aria-hidden="true" />
            </ListItemButton>
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>{t('close')}</Button></DialogActions>
      </Dialog>
    </>
  );
}