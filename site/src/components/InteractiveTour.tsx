import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  IconButton,
  Stack,
  Fade,
  Dialog,
  Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  resources?: { label: string; href: string }[];
  target?: string; // CSS selector for element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number;
  action?: () => void | Promise<void>; // Optional callback when step is entered
  collectionId?: string; // Optional collection to select for this step
  temporalOption?: string; // Optional temporal range option (e.g., '1' for last 24 hours)
  presentation?: 'sar-welcome';
}

interface InteractiveTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  isActive: boolean;
  startStep?: number;
  onStepChange?: (step: TourStep, stepIndex: number) => void;
}

export default function InteractiveTour({
  steps,
  onComplete,
  isActive,
  startStep = 0,
  onStepChange,
}: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(startStep);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  // Call onStepChange callback when step changes
  useEffect(() => {
    if (isActive && step.action) {
      Promise.resolve(step.action()).catch(err => console.error('Tour step action failed:', err));
    }
    onStepChange?.(step, currentStep);
  }, [currentStep, isActive, step, onStepChange]);

  // Find and update highlight box for current step
  useEffect(() => {
    if (!isActive) {
      setHighlightRect(null);
      return;
    }

    if (!step.target) {
      // No target element - position card at top center
      const tooltipWidth = 360;
      const viewportMargin = 20;
      
      let top = viewportMargin + 60; // Below the toolbar
      let left = window.innerWidth / 2 - tooltipWidth / 2;
      
      // Clamp horizontal position
      const maxLeft = Math.max(viewportMargin, window.innerWidth - tooltipWidth - viewportMargin);
      left = Math.max(viewportMargin, Math.min(left, maxLeft));
      
      setHighlightRect(null);
      setTooltipPos({ top, left });
      return;
    }

    const updateHighlight = () => {
      const element = document.querySelector(step.target!);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);

        // Calculate tooltip position - be conservative with sizing
        const padding = 16;
        const tooltipWidth = 360;  // Slightly larger but account in clamping
        const tooltipHeight = 200;
        const viewportMargin = 20;  // More aggressive margin

        let top = 0;
        let left = 0;
        let placement = step.placement || 'bottom';

        // Try primary placement first
        switch (placement) {
          case 'bottom':
            top = rect.bottom + padding;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            // If doesn't fit vertically, try top
            if (top + tooltipHeight > window.innerHeight - viewportMargin) {
              top = rect.top - tooltipHeight - padding;
              if (top < viewportMargin) {
                // If top doesn't work either, use bottom with clamp
                top = rect.bottom + padding;
              }
            }
            break;
          case 'top':
            top = rect.top - tooltipHeight - padding;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            // If doesn't fit vertically, try bottom
            if (top < viewportMargin) {
              top = rect.bottom + padding;
              if (top + tooltipHeight > window.innerHeight - viewportMargin) {
                // If bottom doesn't work, position at top of screen
                top = viewportMargin;
              }
            }
            break;
          case 'left':
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.left - tooltipWidth - padding;
            // For left placement, only fall back if REALLY no space, otherwise keep it left
            if (left < viewportMargin) {
              // Try to fit it even if it goes a bit left of margin, but at least some part visible
              left = Math.max(0, rect.left - tooltipWidth - padding);
            }
            break;
          case 'right':
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.right + padding;
            // If doesn't fit horizontally, try left
            if (left + tooltipWidth > window.innerWidth - viewportMargin) {
              left = rect.left - tooltipWidth - padding;
              if (left < viewportMargin) {
                // Center it if both sides don't work
                left = window.innerWidth / 2 - tooltipWidth / 2;
              }
            }
            break;
        }

        // Clamp horizontal position AGGRESSIVELY
        const maxLeft = Math.max(viewportMargin, window.innerWidth - tooltipWidth - viewportMargin);
        left = Math.max(viewportMargin, Math.min(left, maxLeft));

        // Clamp vertical position
        const maxTop = Math.max(viewportMargin, window.innerHeight - tooltipHeight - viewportMargin);
        top = Math.max(viewportMargin, Math.min(top, maxTop));

        setTooltipPos({ top, left });
      }
    };

    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight);
    };
  }, [isActive, step, currentStep]);

  // Draw spotlight canvas
  useEffect(() => {
    if (!isActive || !canvasRef.current || !highlightRect) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [isActive, highlightRect, step.highlightPadding]);

  if (!isActive) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    onComplete?.();
  };

  if (step.presentation === 'sar-welcome') {
    return (
      <Dialog
        open={isActive}
        onClose={handleClose}
        maxWidth={false}
        aria-labelledby="sar-welcome-title"
        aria-describedby="sar-welcome-description"
        slotProps={{
          paper: {
            sx: {
              m: { xs: 1.5, sm: 3 },
              width: 'min(1200px, 94vw)',
              height: 'min(900px, 90dvh)',
              maxHeight: 'calc(100dvh - 24px)',
              borderRadius: 2,
              bgcolor: '#101719',
              color: '#fff',
              overflow: 'auto',
            },
          },
        }}
      >
        <Box sx={{ position: 'relative', flex: 1, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', containerType: 'size' }}>
            <Box
              sx={{
                position: 'absolute',
                width: 'max(100cqw, calc(100cqh * 4 / 3))',
                height: 'max(100cqh, calc(100cqw * 3 / 4))',
                left: 'calc((100cqw - max(100cqw, calc(100cqh * 4 / 3))) * 0.65)',
                top: 'calc((100cqh - max(100cqh, calc(100cqw * 3 / 4))) * 0.14)',
              }}
            >
              <Box
                component="img"
                src={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/ICAN3.jpg`}
                alt="A ground-station antenna operating in a snowy landscape at dusk"
                sx={{ display: 'block', width: '100%', height: '100%' }}
              />
              {[{ left: '64.86%', top: '25.63%' }, { left: '64.78%', top: '26.65%' }].map((beacon) => (
                <Box
                  key={beacon.left}
                  data-tour-beacon
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    ...beacon,
                    width: '0.25%',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#ff3027',
                    boxShadow: '0 0 8px 4px #ff3027, 0 0 24px 10px rgba(255, 35, 25, 0.65)',
                    animation: 'antennaBeacon 2.4s ease-in-out infinite',
                    '@keyframes antennaBeacon': {
                      '0%, 15%, 45%, 100%': { opacity: 0 },
                      '24%, 32%': { opacity: 1 },
                    },
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.7 },
                  }}
                />
              ))}
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 30%, rgba(0,0,0,0.82) 75%, rgba(0,0,0,0.94) 100%)',
            }}
          />
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: { xs: 2, sm: 3 } }}>
            <Typography variant="overline" sx={{ letterSpacing: 0 }}>EODMS / {currentStep + 1} of {steps.length}</Typography>
            <Button onClick={handleClose} startIcon={<CloseIcon />} sx={{ color: '#fff', flexShrink: 0 }}>
              Quit
            </Button>
          </Box>
          <Box sx={{ position: 'relative', mt: 'auto', p: { xs: 3, sm: 5 }, maxWidth: 720 }}>
            <Typography variant="overline" sx={{ color: '#9ee8d7', letterSpacing: 0 }}>Earth observation. Always on.</Typography>
            <Typography id="sar-welcome-title" component="h1" sx={{ fontSize: { xs: '2rem', sm: '3rem' }, fontWeight: 700, lineHeight: 1.12, letterSpacing: 0, mt: 1, mb: 2 }}>
              {step.title}
            </Typography>
            <Typography id="sar-welcome-description" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' }, lineHeight: 1.6, color: '#edf2f2', mb: 3 }}>
              {step.description}
            </Typography>
            <Button variant="contained" onClick={handleNext} endIcon={<ChevronRightIcon />} size="large" sx={{ bgcolor: '#a3eedc', color: '#102d27', '&:hover': { bgcolor: '#c4f6ea' } }}>
              Next
            </Button>
          </Box>
        </Box>
      </Dialog>
    );
  }

  return (
    <Fade in={isActive}>
      <Box
        ref={containerRef}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          pointerEvents: 'none',
        }}
      >
        {/* Tooltip / Instruction Box */}
        <Paper
          sx={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: 340,
            maxWidth: 'calc(100vw - 64px)',
            zIndex: 1301,
            p: 2.5,
            pointerEvents: 'auto',
            boxShadow: (theme) => theme.shadows[10],
            overflow: 'visible',
            '&::after': {
              content: '""',
              position: 'absolute',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '12px 12px 0 12px',
              borderColor: (theme) => `${theme.palette.background.paper} transparent transparent transparent`,
              bottom: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
            }
          }}
        >
          <Stack spacing={2}>
            {/* Step counter and close */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="textSecondary">
                {currentStep + 1} / {steps.length}
              </Typography>
              <IconButton size="small" onClick={handleClose} sx={{ ml: 'auto' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Title */}
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {step.title}
            </Typography>

            {/* Description */}
            <Typography variant="body2" color="textSecondary">
              {step.description}
            </Typography>

            {step.resources && (
              <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2, overflowWrap: 'anywhere' }}>
                {step.resources.map((resource) => (
                  <Box component="li" key={resource.href}>
                    <Link href={resource.href} target="_blank" rel="noopener noreferrer" variant="body2">
                      {resource.label}
                    </Link>
                  </Box>
                ))}
              </Stack>
            )}

            {/* Navigation buttons */}
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button
                size="small"
                startIcon={<ChevronLeftIcon />}
                onClick={handlePrev}
                disabled={currentStep === 0}
                variant="outlined"
              >
                Back
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                endIcon={<ChevronRightIcon />}
                onClick={handleNext}
                variant="contained"
              >
                {currentStep === steps.length - 1 ? 'Done' : 'Next'}
              </Button>
            </Stack>

            {/* Step indicators */}
            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center' }}>
              {steps.map((_, index) => (
                <Box
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor:
                      index === currentStep
                        ? 'primary.main'
                        : index < currentStep
                          ? 'primary.light'
                          : 'action.disabled',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { transform: 'scale(1.3)' },
                  }}
                />
              ))}
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Fade>
  );
}
