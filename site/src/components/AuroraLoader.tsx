import { useEffect, useRef } from 'react';

const CYCLE = 6;
const LIFE = 1.4;
const TAIL = 0.22;
const STRANDS = 80;
const GREEN = '95, 255, 169';
const CYAN = '78, 211, 255';
const VIOLET = '184, 133, 255';
const WISPS = [
  { delay: 0, colour: GREEN, crest: 96, amplitude: 14, frequency: 6, seed: 0.4, length: 40, direction: 1 },
  { delay: 0.5, colour: CYAN, crest: 82, amplitude: 10, frequency: 8, seed: 2.1, length: 30, direction: -1 },
  { delay: 1.1, colour: GREEN, crest: 104, amplitude: 18, frequency: 5, seed: 4.7, length: 46, direction: 1 },
  { delay: 1.7, colour: VIOLET, crest: 76, amplitude: 9, frequency: 9, seed: 1.3, length: 28, direction: 1 },
  { delay: 2.4, colour: GREEN, crest: 92, amplitude: 16, frequency: 7, seed: 3.6, length: 42, direction: -1 },
  { delay: 3.0, colour: CYAN, crest: 100, amplitude: 12, frequency: 6, seed: 5.2, length: 34, direction: 1 },
  { delay: 3.7, colour: GREEN, crest: 86, amplitude: 15, frequency: 8, seed: 0.9, length: 44, direction: -1 },
  { delay: 4.3, colour: VIOLET, crest: 98, amplitude: 11, frequency: 5, seed: 2.8, length: 32, direction: 1 },
];

const easeInOut = (value: number) => value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;

/** Quick aurora wisps that flick across the sky one after another, then signal the end of each cycle. */
export default function AuroraLoader({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = 280;
    const height = 160;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let start: number | null = null;
    let completed = 0;

    const draw = (timestamp: number) => {
      start ??= timestamp;
      const elapsed = (timestamp - start) / 1000;
      // Reduced motion shows a single wisp mid-flight.
      const time = motion.matches ? 0.8 : elapsed % CYCLE;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      context.lineCap = 'round';
      for (const wisp of WISPS) {
        const age = time - wisp.delay;
        if (age < 0 || age > LIFE) continue;
        const progress = age / LIFE;
        const head = -0.05 + 1.4 * easeInOut(progress);
        const fade = Math.sin(Math.PI * progress) ** 0.6;
        for (let strand = 0; strand < STRANDS; strand++) {
          const position = strand / (STRANDS - 1);
          const behind = head - position;
          if (behind < -0.03) continue;
          const glow = behind < 0 ? 1 + behind / 0.03 : Math.exp(-behind / TAIL);
          const flicker = 0.65 + 0.35 * Math.sin(position * 41 + elapsed * 18 + wisp.seed * 7);
          const edge = Math.sin(position * Math.PI) ** 0.8;
          const opacity = glow * fade * flicker * edge * 0.55;
          if (opacity < 0.02) continue;
          const along = wisp.direction === 1 ? position : 1 - position;
          const horizontal = 20 + along * 240;
          const crest = wisp.crest
            + Math.sin(along * wisp.frequency + wisp.seed + age * 2.5) * wisp.amplitude
            + Math.sin(along * 17 - age * 4) * 2.5;
          const length = wisp.length * (0.55 + 0.45 * flicker) * (0.6 + 0.4 * glow);
          const lean = Math.sin(wisp.seed + along * 5 + age * 3) * 6 - wisp.direction * behind * 10;
          const gradient = context.createLinearGradient(horizontal, crest - length, horizontal, crest + 4);
          gradient.addColorStop(0, `rgba(${wisp.colour}, 0)`);
          gradient.addColorStop(0.7, `rgba(${wisp.colour}, ${opacity * 0.4})`);
          gradient.addColorStop(0.93, `rgba(${wisp.colour}, ${opacity})`);
          gradient.addColorStop(1, `rgba(${wisp.colour}, 0)`);
          context.strokeStyle = gradient;
          context.lineWidth = 1.6;
          context.beginPath();
          context.moveTo(horizontal + lean, crest - length);
          context.quadraticCurveTo(horizontal + lean * 0.3, crest - length * 0.4, horizontal, crest + 4);
          context.stroke();
        }
      }
      if (motion.matches) return;
      const cycles = Math.floor(elapsed / CYCLE);
      if (cycles > completed) {
        completed = cycles;
        onCompleteRef.current?.();
      }
      frame = window.requestAnimationFrame(draw);
    };

    const restart = () => {
      window.cancelAnimationFrame(frame);
      start = null;
      completed = 0;
      frame = window.requestAnimationFrame(draw);
    };
    restart();
    motion.addEventListener('change', restart);
    return () => {
      window.cancelAnimationFrame(frame);
      motion.removeEventListener('change', restart);
    };
  }, []);

  return <canvas ref={canvasRef} width={280} height={160} aria-hidden="true"
    style={{ display: 'block', width: 280, height: 160, maxWidth: 'calc(100vw - 32px)' }} />;
}