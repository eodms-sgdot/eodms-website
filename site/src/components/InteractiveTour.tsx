import { useContext, useEffect, useState, useRef } from 'react';
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
import { AppContext } from '../AppContext';

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
  presentation?: 'sar-welcome' | 'napl-welcome';
}

interface InteractiveTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  isActive: boolean;
  startStep?: number;
  onStepChange?: (step: TourStep, stepIndex: number) => void;
}

const AURORA_WISPS = [
  { y: 0.12, length: 0.68, height: 0.11, amplitude: 0.045, frequency: 10, speed: 0.72, phase: 0.4, delay: 0, period: 4.8, duration: 1.7, direction: 1, colour: '103, 255, 180' },
  { y: 0.24, length: 0.78, height: 0.09, amplitude: 0.055, frequency: 8, speed: 0.86, phase: 2.2, delay: 1.3, period: 5.3, duration: 1.9, direction: -1, colour: '77, 228, 202' },
  { y: 0.08, length: 0.58, height: 0.12, amplitude: 0.04, frequency: 12, speed: 0.66, phase: 4.1, delay: 2.4, period: 4.5, duration: 1.5, direction: 1, colour: '163, 255, 190' },
  { y: 0.32, length: 0.72, height: 0.1, amplitude: 0.05, frequency: 9, speed: 0.8, phase: 1.6, delay: 3.2, period: 5.1, duration: 1.8, direction: -1, colour: '99, 222, 233' },
  { y: 0.18, length: 0.62, height: 0.13, amplitude: 0.04, frequency: 11, speed: 0.94, phase: 5.3, delay: 0.8, period: 4.6, duration: 1.6, direction: 1, colour: '168, 255, 196' },
  { y: 0.27, length: 0.56, height: 0.08, amplitude: 0.06, frequency: 13, speed: 0.7, phase: 3.3, delay: 2.1, period: 5.5, duration: 1.5, direction: -1, colour: '113, 207, 255' },
];

function AuroraCurtainOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let start: number | null = null;
    let width = 0;
    let height = 0;
    let ratio = 1;

    const draw = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = motion.matches ? 2.4 : (timestamp - start) / 1000;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'screen';

      for (const wisp of AURORA_WISPS) {
        const age = (elapsed + wisp.delay) % wisp.period;
        if (age > wisp.duration) continue;

        const progress = age / wisp.duration;
        const fade = Math.sin(Math.PI * progress) ** 0.7;
        const head = wisp.direction === 1
          ? -wisp.length + progress * (1 + wisp.length)
          : 1 + wisp.length - progress * (1 + wisp.length);
        const centerY = height * (wisp.y + Math.sin(elapsed * wisp.speed + wisp.phase) * 0.018);
        const maxThickness = height * wisp.height;
        const gradient = context.createLinearGradient(0, centerY - maxThickness, 0, centerY + maxThickness);
        gradient.addColorStop(0, `rgba(${wisp.colour}, 0)`);
        gradient.addColorStop(0.35, `rgba(${wisp.colour}, 0.28)`);
        gradient.addColorStop(0.55, `rgba(${wisp.colour}, 0.7)`);
        gradient.addColorStop(0.78, `rgba(${wisp.colour}, 0.18)`);
        gradient.addColorStop(1, `rgba(${wisp.colour}, 0)`);
        context.strokeStyle = gradient;

        const strands = Math.max(120, Math.round(width / 8));
        for (let strand = 0; strand < strands; strand += 1) {
          const position = strand / (strands - 1);
          const x = width * (head - wisp.direction * wisp.length * (1 - position));
          const wave = position * wisp.frequency + elapsed * wisp.speed + wisp.phase;
          const flutter = 0.72 + 0.28 * Math.sin(position * 37 + elapsed * 12 + wisp.phase);
          const edge = Math.sin(Math.PI * position) ** 0.45;
          const center = centerY
            + Math.sin(wave) * height * wisp.amplitude
            + Math.sin(wave * 0.57 + wisp.phase) * height * wisp.amplitude * 0.42;
          const thickness = maxThickness * (0.55 + 0.45 * Math.sin(wave * 0.8));
          const bend = Math.sin(wave + 1.2) * width * 0.006;

          context.beginPath();
          context.moveTo(x, center - thickness);
          context.bezierCurveTo(
            x + bend, center - thickness * 0.3,
            x - bend * 0.7, center + thickness * 0.35,
            x + Math.sin(wave + 2) * width * 0.003, center + thickness,
          );
          context.globalAlpha = fade * edge * flutter * 0.42;
          context.lineWidth = Math.max(4, width / 110);
          context.stroke();
          context.globalAlpha = fade * edge * flutter * 1.1;
          context.lineWidth = Math.max(1.4, width / 670);
          context.stroke();
        }
      }

      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      if (!motion.matches) frame = window.requestAnimationFrame(draw);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (motion.matches) draw(0);
    };

    const restart = () => {
      window.cancelAnimationFrame(frame);
      start = null;
      if (motion.matches) draw(0);
      else frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    motion.addEventListener('change', restart);
    resize();
    if (!motion.matches) frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      motion.removeEventListener('change', restart);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

export default function InteractiveTour({
  steps,
  onComplete,
  isActive,
  startStep = 0,
  onStepChange,
}: InteractiveTourProps) {
  const { t } = useContext(AppContext)!;
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
                onLoad={(event) => { event.currentTarget.style.animationPlayState = 'running'; }}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  animation: 'tourImageFade 400ms ease-out both paused',
                  '@keyframes tourImageFade': {
                    from: { opacity: 0 },
                    to: { opacity: 1 },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
              <AuroraCurtainOverlay />
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
            <Box
              component="img"
              src={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/NRCan.svg`}
              alt={t('tourNrcanAlt')}
              sx={{
                height: { xs: 14, sm: 18 },
                width: 'auto',
                opacity: 0.7,
                filter: 'grayscale(100%)',
              }}
            />
            <Button onClick={handleClose} startIcon={<CloseIcon />} sx={{ color: '#fff', flexShrink: 0 }}>
              {t('tourExitTour')}
            </Button>
          </Box>
          <Box sx={{ position: 'absolute', bottom: { xs: 12, sm: 18 }, right: { xs: 12, sm: 18 }, fontSize: '0.75rem', color: '#9ee8d7', letterSpacing: 0.5 }}>
            EODMS / {currentStep + 1} {t('tourOf')} {steps.length}
          </Box>
          <Box sx={{ position: 'relative', mt: 'auto', p: { xs: 3, sm: 5 }, maxWidth: 720 }}>
            <Typography variant="overline" sx={{ color: '#9ee8d7', letterSpacing: 0 }}>{t('tourEodmsSubtitle')}</Typography>
            <Typography id="sar-welcome-title" component="h1" sx={{ fontSize: { xs: '2rem', sm: '3rem' }, fontWeight: 700, lineHeight: 1.12, letterSpacing: 0, mt: 1, mb: 2 }}>
              {step.title}
            </Typography>
            <Typography id="sar-welcome-description" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' }, lineHeight: 1.6, color: '#edf2f2', mb: 3 }}>
              {step.description}
            </Typography>
            <Button variant="contained" onClick={handleNext} endIcon={<ChevronRightIcon />} size="large" sx={{ bgcolor: '#a3eedc', color: '#102d27', '&:hover': { bgcolor: '#c4f6ea' } }}>
              {t('tourNext')}
            </Button>
          </Box>
        </Box>
      </Dialog>
    );
  }

  if (step.presentation === 'napl-welcome') {
    return (
      <Dialog
        open={isActive}
        onClose={handleClose}
        maxWidth={false}
        aria-labelledby="napl-welcome-title"
        aria-describedby="napl-welcome-description"
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
                src={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/rcm-river.jpg`}
                alt={t('tourNaplImageAlt')}
                onLoad={(event) => { event.currentTarget.style.animationPlayState = 'running'; }}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  animation: 'tourImageFade 400ms ease-out both paused',
                  '@keyframes tourImageFade': {
                    from: { opacity: 0 },
                    to: { opacity: 1 },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
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
            <Box
              component="img"
              src={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/NRCan.svg`}
              alt={t('tourNrcanAlt')}
              sx={{
                height: { xs: 14, sm: 18 },
                width: 'auto',
                opacity: 0.7,
                filter: 'grayscale(100%)',
              }}
            />
            <Button onClick={handleClose} startIcon={<CloseIcon />} sx={{ color: '#fff', flexShrink: 0 }}>
              {t('tourExitTour')}
            </Button>
          </Box>
          <Box sx={{ position: 'absolute', bottom: { xs: 12, sm: 18 }, right: { xs: 12, sm: 18 }, fontSize: '0.75rem', color: '#9ee8d7', letterSpacing: 0.5 }}>
            NAPL / {currentStep + 1} {t('tourOf')} {steps.length}
          </Box>
          <Box sx={{ position: 'relative', mt: 'auto', p: { xs: 3, sm: 5 }, maxWidth: 720 }}>
            <Typography variant="overline" sx={{ color: '#9ee8d7', letterSpacing: 0 }}>{t('tourNaplSubtitle')}</Typography>
            <Typography id="napl-welcome-title" component="h1" sx={{ fontSize: { xs: '2rem', sm: '3rem' }, fontWeight: 700, lineHeight: 1.12, letterSpacing: 0, mt: 1, mb: 2 }}>
              {step.title}
            </Typography>
            <Typography id="napl-welcome-description" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' }, lineHeight: 1.6, color: '#edf2f2', mb: 3 }}>
              {step.description}
            </Typography>
            <Button variant="contained" onClick={handleNext} endIcon={<ChevronRightIcon />} size="large" sx={{ bgcolor: '#a3eedc', color: '#102d27', '&:hover': { bgcolor: '#c4f6ea' } }}>
              {t('tourNext')}
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
              ...(step.placement === 'top' && {
                borderWidth: '0 12px 12px 12px',
                borderColor: (theme) => `transparent transparent ${theme.palette.background.paper} transparent`,
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
              }),
              ...(step.placement === 'bottom' && {
                borderWidth: '12px 12px 0 12px',
                borderColor: (theme) => `${theme.palette.background.paper} transparent transparent transparent`,
                bottom: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
              }),
              ...(step.placement === 'left' && {
                borderWidth: '12px 12px 12px 0',
                borderColor: (theme) => `transparent ${theme.palette.background.paper} transparent transparent`,
                left: '-12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }),
              ...(step.placement === 'right' && {
                borderWidth: '12px 0 12px 12px',
                borderColor: (theme) => `transparent transparent transparent ${theme.palette.background.paper}`,
                right: '-12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }),
              ...(!step.placement && {
                borderWidth: '12px 12px 0 12px',
                borderColor: (theme) => `${theme.palette.background.paper} transparent transparent transparent`,
                bottom: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
              }),
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
                {t('tourBack')}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                endIcon={<ChevronRightIcon />}
                onClick={handleNext}
                variant="contained"
              >
                {currentStep === steps.length - 1 ? t('tourDone') : t('tourNext')}
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
