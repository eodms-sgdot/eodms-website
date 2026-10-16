import { useContext, useEffect, useState, type MouseEvent } from 'react';
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

const leafDrift = keyframes`
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--drift), 28px) rotate(220deg); opacity: 0; }
`;

// A pushbroom-style scan line that sweeps the frame, then rests.
const frameScan = keyframes`
  0% { left: 0; opacity: 0; }
  8% { opacity: 0.9; }
  40% { left: calc(100% - 2px); opacity: 0.9; }
  48%, 100% { left: calc(100% - 2px); opacity: 0; }
`;

const CORNER = '7px';
const EDGE = '2px';

/** Viewfinder corner marks, like the frame around an imaged scene. */
const frameCorners = {
  backgroundImage: Array(8).fill('linear-gradient(var(--sky), var(--sky))').join(', '),
  backgroundRepeat: 'no-repeat',
  backgroundSize: Array(4).fill(`${CORNER} ${EDGE}, ${EDGE} ${CORNER}`).join(', '),
  backgroundPosition: 'left top, left top, right top, right top, left bottom, left bottom, right bottom, right bottom',
};

/** The loader's satellite as a cursor, with its beacon in the time-of-day colour. */
const satelliteCursor = (sky: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='-12 -12 24 24'><g transform='rotate(-20)'>`
    + `<rect x='-11' y='-2.5' width='7' height='5' fill='#5c9ded' stroke='#1f3b5c' stroke-width='0.8'/>`
    + `<rect x='-3.5' y='-3.5' width='7' height='7' rx='1' fill='#e6e9ed' stroke='#1f3b5c' stroke-width='0.8'/>`
    + `<rect x='4' y='-2.5' width='7' height='5' fill='#5c9ded' stroke='#1f3b5c' stroke-width='0.8'/>`
    + `<circle r='1.5' fill='${sky}'/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, pointer`;
};

/** Maple leaf, satellite, ground-station dish. */
const FALLING_GLYPHS = ['\u{1F341}', '\u{1F6F0}\uFE0F', '\u{1F4E1}'];

/** The plain site title, with a time-of-day greeting on hover and maple leaves on click. */
export function TitleCharm({ title, accent }: { title: string; accent?: string }) {
  const { t } = useContext(AppContext)!;
  const phase = getPhase(useLocalTime().getHours());
  const [leaves, setLeaves] = useState<{ id: number; drift: number; x: number; y: number; glyph: string }[]>([]);
  const accentAt = accent ? title.indexOf(accent) : -1;

  const dropLeaf = (e: MouseEvent) => {
    const leaf = { id: Date.now() + Math.random(), drift: Math.round(Math.random() * 40 - 20), x: e.clientX, y: e.clientY, glyph: FALLING_GLYPHS[Math.floor(Math.random() * FALLING_GLYPHS.length)] };
    setLeaves(prev => [...prev, leaf]);
  };

  return (
    <Tooltip title={t(SKY_MESSAGES[phase])}>
      <Box component="span" onClick={dropLeaf}>
        {accent && accentAt >= 0 ? (
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 400 }}>
            {title.slice(0, accentAt)}
            <Box
              component="span"
              sx={{
                '--sky': SKY_COLOURS[phase],
                ...frameCorners,
                cursor: satelliteCursor(SKY_COLOURS[phase]),
                position: 'relative',
                display: 'inline-block',
                mx: '3px',
                // Letter-spacing trails the last glyph, so the left side gets the same extra space.
                pl: 'calc(5px + 0.04em)',
                pr: '5px',
                // Caps sit high in the line box; trim to cap height where supported, else pad the top more.
                lineHeight: 1,
                pt: '0.26em',
                pb: '0.1em',
                '@supports (text-box: trim-both cap alphabetic)': { textBox: 'trim-both cap alphabetic', py: '0.22em' },
                fontWeight: 700,
                letterSpacing: '0.04em',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '3px',
                  bottom: '3px',
                  width: '2px',
                  background: 'linear-gradient(transparent, var(--sky), transparent)',
                  animation: `${frameScan} 7s ease-in-out infinite`,
                },
                '@media (prefers-reduced-motion: reduce)': { '&::after': { display: 'none' } },
              }}
            >
              {accent}
            </Box>
            {title.slice(accentAt + accent.length)}
          </Box>
        ) : title}
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
            {leaf.glyph}
          </Box>
        ))}
      </Box>
    </Tooltip>
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
