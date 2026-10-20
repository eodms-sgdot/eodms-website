import { useEffect, useRef } from 'react';

const CYCLE = 8;
const FRAME = 36;
const FRAME_STEP = 22;
// Two serpentine flight lines with forward overlap and a little sidelap, as in an air photo survey.
const FLIGHT_LINES = [
  { start: 0.3, end: 3.6, y: 62, direction: 1 },
  { start: 4.2, end: 7.5, y: 92, direction: -1 },
];
const PLANE_FROM = -24;
const PLANE_TO = 304;

const sample = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const planeX = (line: typeof FLIGHT_LINES[number], time: number) => {
  const progress = (time - line.start) / (line.end - line.start);
  const along = PLANE_FROM + (PLANE_TO - PLANE_FROM) * progress;
  return line.direction === 1 ? along : PLANE_TO + PLANE_FROM - along;
};

/** A survey plane flying low over farmland, taking overlapping aerial photos along its flight lines. */
export default function AirPhotoLoader({ onComplete }: { onComplete?: () => void }) {
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

    const terrain = document.createElement('canvas');
    terrain.width = width * 2;
    terrain.height = height * 2;
    const terrainContext = terrain.getContext('2d');
    if (!terrainContext) return;
    terrainContext.scale(2, 2);
    const fieldColours = ['#6f8f4e', '#8aa35a', '#b9a65a', '#a08453', '#7c9a63', '#c4b679'];
    const cell = 20;
    for (let row = -1; row < height / cell + 1; row++) {
      for (let column = -1; column < width / cell + 1; column++) {
        const seed = row * 97 + column;
        terrainContext.fillStyle = fieldColours[Math.floor(sample(seed) * fieldColours.length)];
        const x = column * cell + (row % 2) * 4;
        terrainContext.fillRect(x, row * cell, cell - 0.8, cell - 0.8);
        if (sample(seed + 0.5) > 0.6) {
          terrainContext.strokeStyle = 'rgba(0, 0, 0, 0.12)';
          terrainContext.lineWidth = 0.5;
          for (let furrow = 2; furrow < cell - 1; furrow += 3) {
            terrainContext.beginPath();
            terrainContext.moveTo(x + furrow, row * cell);
            terrainContext.lineTo(x + furrow, row * cell + cell - 1);
            terrainContext.stroke();
          }
        }
      }
    }
    terrainContext.strokeStyle = '#d8d2c0';
    terrainContext.lineWidth = 2;
    terrainContext.beginPath();
    terrainContext.moveTo(0, 128);
    terrainContext.lineTo(width, 22);
    terrainContext.stroke();
    terrainContext.strokeStyle = '#4f7fa6';
    terrainContext.lineWidth = 4;
    terrainContext.lineCap = 'round';
    terrainContext.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = 140 - x * 0.18 + Math.sin(x * 0.045) * 12 + Math.sin(x * 0.13) * 3;
      if (x === 0) terrainContext.moveTo(x, y);
      else terrainContext.lineTo(x, y);
    }
    terrainContext.stroke();
    for (let farm = 0; farm < 14; farm++) {
      const x = sample(farm * 3 + 1) * width;
      const y = sample(farm * 3 + 2) * height;
      terrainContext.fillStyle = '#2f4a2a';
      for (let tree = 0; tree < 4; tree++) {
        terrainContext.beginPath();
        terrainContext.arc(x - 4 + tree * 2.5, y - 4, 1.8, 0, Math.PI * 2);
        terrainContext.fill();
      }
      terrainContext.fillStyle = '#e8e2d6';
      terrainContext.fillRect(x, y, 3, 2.5);
    }

    // Archival air photos are black and white.
    const photo = document.createElement('canvas');
    photo.width = terrain.width;
    photo.height = terrain.height;
    const photoContext = photo.getContext('2d');
    if (!photoContext) return;
    const pixels = terrainContext.getImageData(0, 0, terrain.width, terrain.height);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      const luminance = 0.299 * pixels.data[offset] + 0.587 * pixels.data[offset + 1] + 0.114 * pixels.data[offset + 2];
      const contrasted = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128));
      pixels.data[offset] = contrasted;
      pixels.data[offset + 1] = contrasted;
      pixels.data[offset + 2] = contrasted;
    }
    photoContext.putImageData(pixels, 0, 0);

    const frames = FLIGHT_LINES.flatMap(line => {
      const centres: number[] = [];
      for (let x = 30; x <= width - 30; x += FRAME_STEP) centres.push(x);
      if (line.direction === -1) centres.reverse();
      const span = line.end - line.start;
      return centres.map(x => ({
        x, y: line.y,
        captured: line.start + span * ((line.direction === 1 ? x : PLANE_TO + PLANE_FROM - x) - PLANE_FROM) / (PLANE_TO - PLANE_FROM),
      }));
    });

    const horizontalFade = context.createLinearGradient(0, 0, width, 0);
    horizontalFade.addColorStop(0, 'transparent');
    horizontalFade.addColorStop(0.12, '#000');
    horizontalFade.addColorStop(0.88, '#000');
    horizontalFade.addColorStop(1, 'transparent');
    const verticalFade = context.createLinearGradient(0, 0, 0, height);
    verticalFade.addColorStop(0, 'transparent');
    verticalFade.addColorStop(0.15, '#000');
    verticalFade.addColorStop(0.85, '#000');
    verticalFade.addColorStop(1, 'transparent');

    const drawPlane = (x: number, y: number, direction: number, shadow: boolean) => {
      context.save();
      context.translate(x, y);
      context.scale(direction, 1);
      context.fillStyle = shadow ? 'rgba(0, 0, 0, 0.35)' : '#e6e9ed';
      context.strokeStyle = shadow ? 'transparent' : '#1f3b5c';
      context.lineWidth = 0.7;
      context.beginPath();
      context.ellipse(0, 0, 11, 2.2, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.rect(-2, -12, 5, 24);
      context.rect(-11, -4.5, 3, 9);
      context.fill();
      context.stroke();
      if (!shadow) {
        context.fillStyle = '#5c9ded';
        context.fillRect(4, -1, 3, 2);
      }
      context.restore();
    };

    let frame = 0;
    let start: number | null = null;
    let completed = 0;

    const draw = (timestamp: number) => {
      start ??= timestamp;
      const elapsed = (timestamp - start) / 1000;
      const time = motion.matches ? 6.2 : elapsed % CYCLE;
      const fadeOut = Math.min(1, (CYCLE - time) / 0.4);
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 0.4;
      context.drawImage(terrain, 0, 0, width, height);
      context.globalAlpha = 1;

      for (const shot of frames) {
        const age = time - shot.captured;
        if (age < 0) continue;
        const left = shot.x - FRAME / 2;
        const top = shot.y - FRAME / 2;
        context.save();
        context.globalAlpha = fadeOut * Math.min(1, age / 0.2);
        context.beginPath();
        context.rect(left, top, FRAME, FRAME);
        context.clip();
        context.drawImage(photo, 0, 0, width, height);
        context.restore();
        context.globalAlpha = fadeOut;
        context.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        context.lineWidth = 0.8;
        context.strokeRect(left, top, FRAME, FRAME);
        const flash = Math.max(0, 1 - age / 0.35);
        if (flash > 0) {
          context.fillStyle = `rgba(255, 255, 255, ${flash * 0.55})`;
          context.fillRect(left, top, FRAME, FRAME);
        }
        context.globalAlpha = 1;
      }

      const line = FLIGHT_LINES.find(candidate => time >= candidate.start && time <= candidate.end);
      if (line) {
        const x = planeX(line, time);
        context.setLineDash([3, 3]);
        context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        context.lineWidth = 0.8;
        context.strokeRect(x - FRAME / 2, line.y - FRAME / 2, FRAME, FRAME);
        context.setLineDash([]);
        // A short shadow offset reads as low altitude.
        drawPlane(x + 5, line.y + 7, line.direction, true);
        drawPlane(x, line.y, line.direction, false);
      }

      context.save();
      context.globalCompositeOperation = 'destination-in';
      context.fillStyle = horizontalFade;
      context.fillRect(0, 0, width, height);
      context.fillStyle = verticalFade;
      context.fillRect(0, 0, width, height);
      context.restore();

      if (motion.matches) return;
      if (Math.floor(elapsed / CYCLE) > completed) {
        completed = Math.floor(elapsed / CYCLE);
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
