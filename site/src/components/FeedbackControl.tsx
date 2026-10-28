import { useContext, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AppContext } from '../AppContext';

const SUPPORT_EMAIL = 'eodms-sgdot@nrcan-rncan.gc.ca';

export default function FeedbackControl({ isMobile }: { isMobile: boolean }) {
  const { t } = useContext(AppContext)!;
  const [open, setOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [copyStatus, setCopyStatus] = useState<'success' | 'error' | null>(null);

  const showFeedback = () => {
    setMenuAnchor(null);
    setCopyStatus(null);
    setOpen(true);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  };

  return (
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
      <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="feedback-title" fullWidth maxWidth="xs">
        <DialogTitle id="feedback-title">{t('feedback')}</DialogTitle>
        <DialogContent dividers>
          <List disablePadding>
            <ListItemButton component="a" href={`mailto:${SUPPORT_EMAIL}`}>
              <ListItemIcon><EmailOutlinedIcon /></ListItemIcon>
              <ListItemText primary={t('feedbackEmail')} secondary={t('feedbackEmailDetail')} />
            </ListItemButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 1, pb: 1 }}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>{SUPPORT_EMAIL}</Typography>
              <Tooltip title={t('feedbackCopyEmail')}>
                <IconButton aria-label={t('feedbackCopyEmail')} size="small" onClick={() => void copyEmail()}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <ListItemButton component="a" href="https://github.com/orgs/eodms-sgdot/discussions/20" target="_blank" rel="noopener noreferrer">
              <ListItemIcon><ForumOutlinedIcon /></ListItemIcon>
              <ListItemText primary={t('feedbackDiscussion')} secondary={t('feedbackPublic')} />
              <OpenInNewIcon fontSize="small" sx={{ ml: 1, flexShrink: 0 }} aria-hidden="true" />
            </ListItemButton>
            <ListItemButton component="a" href="https://github.com/eodms-sgdot/eodms-website/issues/new/choose" target="_blank" rel="noopener noreferrer">
              <ListItemIcon><BugReportOutlinedIcon /></ListItemIcon>
              <ListItemText primary={t('feedbackBug')} secondary={t('feedbackPublic')} />
              <OpenInNewIcon fontSize="small" sx={{ ml: 1, flexShrink: 0 }} aria-hidden="true" />
            </ListItemButton>
          </List>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{t('feedbackPrivacy')}</Typography>
          {copyStatus && <Alert severity={copyStatus} sx={{ mt: 2 }}>{t(copyStatus === 'success' ? 'feedbackEmailCopied' : 'feedbackEmailCopyFailed')}</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>{t('close')}</Button></DialogActions>
      </Dialog>
    </>
  );
}