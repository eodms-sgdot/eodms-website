import { useContext, type ReactNode } from 'react';
import { Box, ButtonBase, Drawer } from '@mui/material';
import { AppContext } from '../AppContext';
import { BlindContainerContext } from './BlindContainerContext';

interface BlindProps {
  open: boolean;
  onClose: () => void;
  /** Which edge of the content area the blind hangs from */
  align?: 'left' | 'right';
  /** Maximum width in pixels on larger screens */
  width?: number;
  /** Lets focus leave the blind, e.g. for clipboard fallbacks or tooltips */
  disableEnforceFocus?: boolean;
  children: ReactNode;
}

/** A panel that unrolls down from under the top bar like a window blind. */
export default function Blind({ open, onClose, align = 'left', width = 640, disableEnforceFocus, children }: BlindProps) {
  const container = useContext(BlindContainerContext);
  const { t } = useContext(AppContext)!;

  return (
    <Drawer
      anchor="top"
      open={open}
      onClose={onClose}
      container={container}
      disableAutoFocus={disableEnforceFocus}
      disableEnforceFocus={disableEnforceFocus}
      transitionDuration={{ enter: 380, exit: 240 }}
      sx={{ position: 'absolute', '& .MuiBackdrop-root': { position: 'absolute' } }}
      slotProps={{
        transition: { easing: { enter: 'cubic-bezier(0.2, 0.8, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)' } },
        paper: {
          sx: {
            position: 'absolute',
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            width: { xs: '100%', sm: `min(${width}px, 100%)` },
            maxHeight: '85%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '0 0 12px 12px',
            // Solid paper colour (no dark-mode elevation tint) so content like autofill covers can match it.
            backgroundImage: 'none',
            // Inset top shadow makes the blind look tucked under the top bar.
            boxShadow: 'inset 0 10px 8px -8px rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.25)',
          },
        },
      }}
    >
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', pt: 1 }}>
        {children}
      </Box>
      <ButtonBase
        aria-label={t('close')}
        onClick={onClose}
        sx={{ py: 1, '&:hover > span': { width: 64, bgcolor: 'primary.main' } }}
      >
        <Box component="span" sx={{ display: 'block', width: 40, height: 5, borderRadius: 3, bgcolor: 'divider', transition: 'width 150ms ease, background-color 150ms ease' }} />
      </ButtonBase>
    </Drawer>
  );
}
