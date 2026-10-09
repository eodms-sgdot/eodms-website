import { useContext, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Box, Tooltip } from '@mui/material';
import { keyframes } from '@emotion/react';
import { AppContext } from '../AppContext';
import type { TranslationKey } from '../i18n';

type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

const SKY_COLOURS: Record<SkyPhase, string> = {
  dawn: '#ff9a8b',
  day: '#4fc3f7',
  dusk: '#ff7043',
  night: '#7c4dff',
};

const SKY_MESSAGES: Record<SkyPhase, TranslationKey> = {
  dawn: 'skyDawn',
  day: 'skyDay',
  dusk: 'skyDusk',
  night: 'skyNight',
};

const getPhase = (hour: number): SkyPhase => {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
};

const useLocalTime = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

const ORBIT_PATH = 'M 52 0 A 52 14 0 1 1 -52 0 A 52 14 0 1 1 52 0';
const ORBIT_TILT = 'rotate(-20)';

const leafDrift = keyframes`
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--drift), 28px) rotate(220deg); opacity: 0; }
`;

/** The plain site title, with a time-of-day greeting on hover and maple leaves on click. */
export function TitleCharm({ title }: { title: string }) {
  const { t } = useContext(AppContext)!;
  const phase = getPhase(useLocalTime().getHours());
  const [leaves, setLeaves] = useState<{ id: number; drift: number; x: number; y: number }[]>([]);

  const dropLeaf = (e: MouseEvent) => {
    const leaf = { id: Date.now() + Math.random(), drift: Math.round(Math.random() * 40 - 20), x: e.clientX, y: e.clientY };
    setLeaves(prev => [...prev, leaf]);
  };

  return (
    <Tooltip title={t(SKY_MESSAGES[phase])}>
      <Box component="span" onClick={dropLeaf}>
        {title}
        {leaves.map(leaf => (
          <Box
            key={leaf.id}
            component="span"
            aria-hidden="true"
            onAnimationEnd={() => setLeaves(prev => prev.filter(l => l.id !== leaf.id))}
            sx={{
              // Fixed so the falling leaf isn't clipped by the title's noWrap overflow.
              position: 'fixed', left: leaf.x - 7, top: leaf.y - 7, fontSize: 14, pointerEvents: 'none', zIndex: 'tooltip',
              '--drift': `${leaf.drift}px`,
              animation: `${leafDrift} 1.6s ease-in forwards`,
              '@media (prefers-reduced-motion: reduce)': { animation: `${leafDrift} 0.01s forwards` },
            }}
          >
            🍁
          </Box>
        ))}
      </Box>
    </Tooltip>
  );
}

function Satellite({ phase }: { phase: SkyPhase }) {
  return (
    <g>
      <rect x="-11" y="-2.5" width="7" height="5" fill="#5c9ded" stroke="#1f3b5c" strokeWidth="0.8" />
      <rect x="-3.5" y="-3.5" width="7" height="7" rx="1" fill="#e6e9ed" stroke="#1f3b5c" strokeWidth="0.8" />
      <rect x="4" y="-2.5" width="7" height="5" fill="#5c9ded" stroke="#1f3b5c" strokeWidth="0.8" />
      <circle cx="0" cy="0" r="1.5" fill={SKY_COLOURS[phase]} />
      <animateMotion dur="5s" repeatCount="indefinite" path={ORBIT_PATH} />
    </g>
  );
}

/** Search loading indicator: a slowly turning globe with a satellite passing behind and in front of it. */
export function OrbitLoader() {
  const phase = getPhase(useLocalTime().getHours());
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) svgRef.current?.pauseAnimations();
  }, []);

  return (
    <svg ref={svgRef} width="140" height="140" viewBox="-70 -70 140 140" aria-hidden="true">
      <defs>
        <clipPath id="orbit-loader-front">
          <rect x="-70" y="0" width="140" height="70" />
        </clipPath>
        <clipPath id="orbit-loader-globe">
          <circle r="28" />
        </clipPath>
      </defs>

      <g transform={ORBIT_TILT}>
        <path d="M -52 0 A 52 14 0 0 1 52 0" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
        <Satellite phase={phase} />
      </g>

      {/* Opaque so the satellite is hidden on the far side, but muted so it stays in the background. */}
      <circle r="28" fill="#26323d" />
      <g clipPath="url(#orbit-loader-globe)" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.18">
        <line x1="-28" y1="0" x2="28" y2="0" />
        <path d="M -25 -13 Q 0 -8 25 -13 M -25 13 Q 0 8 25 13" />
        {[0, 1, 2].map(i => (
          <ellipse key={i} rx="0" ry="28">
            <animate attributeName="rx" values="28;0;28" dur="9s" begin={`${-i * 3}s`} repeatCount="indefinite" />
          </ellipse>
        ))}
      </g>
      <circle r="28" fill="none" stroke={SKY_COLOURS[phase]} strokeWidth="1" opacity="0.5" />

      <g transform={ORBIT_TILT}>
        <path d="M 52 0 A 52 14 0 0 1 -52 0" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
        <g clipPath="url(#orbit-loader-front)">
          <Satellite phase={phase} />
        </g>
      </g>
    </svg>
  );
}

/** A thin strip coloured for the user's local time of day. */
export function SkyBar() {
  const phase = getPhase(useLocalTime().getHours());

  return (
    <Box
      aria-hidden="true"
      sx={{
        height: 3,
        bgcolor: SKY_COLOURS[phase],
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        transition: 'background-color 2s ease',
      }}
    />
  );
}
