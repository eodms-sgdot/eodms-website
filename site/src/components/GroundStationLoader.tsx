import { useEffect, useRef } from 'react';

const CYCLE = 9;
const HORIZON = 134;
const PIVOT_HEIGHT = 9;
const DISH_SCALE = 0.6;
const FEED = 13 * DISH_SCALE;
const MIN_ELEVATION = 0.4;
const PARKED = -Math.PI / 2;
// West to east, as on the map.
const SITES = [
  { name: 'Inuvik', dishes: [34, 50, 66] },
  { name: 'Prince Albert', dishes: [132, 148] },
  { name: 'Gatineau', dishes: [222, 238] },
];
const PASSES = [
  { delay: 0, duration: 3.6, radius: 100, direction: 1, colour: '95, 255, 169' },
  { delay: 1.8, duration: 3.6, radius: 82, direction: -1, colour: '78, 211, 255' },
  { delay: 3.6, duration: 3.6, radius: 108, direction: 1, colour: '255, 196, 92' },
  { delay: 5.2, duration: 3.6, radius: 90, direction: -1, colour: '184, 133, 255' },
];

type Pass = typeof PASSES[number];

const passProgress = (pass: Pass, time: number) => (time - pass.delay) / pass.duration;

const satellitePosition = (pass: Pass, progress: number) => {
  const angle = (pass.direction === 1 ? progress : 1 - progress) * Math.PI;
  return { x: 140 - 135 * Math.cos(angle), y: HORIZON - pass.radius * Math.sin(angle) };
};

/** Ground station antennas at Inuvik, Prince Albert and Gatineau tracking passing satellites and receiving their downlinks. */
export default function GroundStationLoader({ onComplete }: { onComplete?: () => void }) {
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
    const horizonFade = context.createLinearGradient(0, 0, width, 0);
    horizonFade.addColorStop(0, 'rgba(255, 255, 255, 0)');
    horizonFade.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    horizonFade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    const pivotY = HORIZON - PIVOT_HEIGHT;
    const dishes = SITES.flatMap((site, siteIndex) =>
      site.dishes.map(x => ({ siteIndex, x, aim: PARKED, pass: null as Pass | null })));
    let frame = 0;
    let start: number | null = null;
    let previous: number | null = null;
    let completed = 0;

    const drawSatellite = (x: number, y: number, colour: string, opacity: number) => {
      context.save();
      context.globalAlpha = opacity;
      context.translate(x, y);
      context.rotate(-0.35);
      context.lineWidth = 0.6;
      context.strokeStyle = '#1f3b5c';
      context.fillStyle = '#5c9ded';
      context.fillRect(-9, -2, 6, 4);
      context.strokeRect(-9, -2, 6, 4);
      context.fillRect(3, -2, 6, 4);
      context.strokeRect(3, -2, 6, 4);
      context.fillStyle = '#e6e9ed';
      context.fillRect(-3, -3, 6, 6);
      context.strokeRect(-3, -3, 6, 6);
      context.fillStyle = `rgb(${colour})`;
      context.beginPath();
      context.arc(0, 0, 1.2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawDish = (x: number, aim: number) => {
      context.fillStyle = '#4a5866';
      context.beginPath();
      context.moveTo(x - 2, pivotY);
      context.lineTo(x + 2, pivotY);
      context.lineTo(x + 4.5, HORIZON);
      context.lineTo(x - 4.5, HORIZON);
      context.closePath();
      context.fill();
      context.save();
      context.translate(x, pivotY);
      context.rotate(aim);
      context.scale(DISH_SCALE, DISH_SCALE);
      context.fillStyle = '#e6e9ed';
      context.strokeStyle = '#8a97a3';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(3, -13);
      context.quadraticCurveTo(-9, 0, 3, 13);
      context.quadraticCurveTo(-4, 0, 3, -13);
      context.fill();
      context.stroke();
      context.strokeStyle = '#c3ccd4';
      context.beginPath();
      context.moveTo(3, -12);
      context.lineTo(13, 0);
      context.lineTo(3, 12);
      context.stroke();
      context.restore();
    };

    const draw = (timestamp: number) => {
      start ??= timestamp;
      const elapsed = (timestamp - start) / 1000;
      const delta = previous === null ? 0 : Math.min(0.1, (timestamp - previous) / 1000);
      previous = timestamp;
      const time = motion.matches ? 2.6 : elapsed % CYCLE;
      context.clearRect(0, 0, width, height);

      context.strokeStyle = horizonFade;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, HORIZON);
      context.lineTo(width, HORIZON);
      context.stroke();

      const visible = PASSES
        .map(pass => ({ pass, progress: passProgress(pass, time) }))
        .filter(({ progress }) => progress > 0 && progress < 1)
        .map(({ pass, progress }) => ({ pass, progress, position: satellitePosition(pass, progress) }));

      for (const { pass, progress, position } of visible) {
        context.strokeStyle = `rgba(${pass.colour}, 0.12)`;
        context.lineWidth = 1;
        context.setLineDash([2, 4]);
        context.beginPath();
        context.ellipse(140, HORIZON, 135, pass.radius, 0, Math.PI, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        drawSatellite(position.x, position.y, pass.colour, Math.min(1, progress / 0.08, (1 - progress) / 0.08));
      }

      const siteViews = SITES.map((site, siteIndex) => {
        const centre = site.dishes.reduce((sum, x) => sum + x, 0) / site.dishes.length;
        const inView = visible.filter(({ position }) =>
          Math.atan2(pivotY - position.y, Math.abs(position.x - centre)) >= MIN_ELEVATION);
        const siteDishes = dishes.filter(dish => dish.siteIndex === siteIndex);
        // Antennas keep their contact until the satellite drops below the site's mask.
        siteDishes.forEach(dish => {
          if (!inView.some(({ pass }) => pass === dish.pass)) dish.pass = null;
        });
        return { inView, siteDishes };
      });
      // A satellite holds one contact at a time across all sites; spare antennas stow.
      siteViews.forEach(({ inView, siteDishes }) => inView.forEach(({ pass }) => {
        if (dishes.some(dish => dish.pass === pass)) return;
        const free = siteDishes.find(dish => !dish.pass);
        if (free) free.pass = pass;
      }));

      siteViews.forEach(({ inView, siteDishes }) => {
        siteDishes.forEach(dish => {
          const satellite = inView.find(({ pass }) => pass === dish.pass);
          const target = satellite
            ? Math.atan2(satellite.position.y - pivotY, satellite.position.x - dish.x)
            : PARKED;
          dish.aim = motion.matches ? target : dish.aim + (target - dish.aim) * (1 - Math.exp(-delta * 6));
          const feed = { x: dish.x + Math.cos(dish.aim) * FEED, y: pivotY + Math.sin(dish.aim) * FEED };
          if (satellite && Math.abs(target - dish.aim) < 0.12) {
            const { position, pass } = satellite;
            const beam = context.createLinearGradient(position.x, position.y, feed.x, feed.y);
            beam.addColorStop(0, `rgba(${pass.colour}, 0.04)`);
            beam.addColorStop(1, `rgba(${pass.colour}, 0.28)`);
            context.strokeStyle = beam;
            context.lineWidth = 0.8;
            context.beginPath();
            context.moveTo(position.x, position.y);
            context.lineTo(feed.x, feed.y);
            context.stroke();
            context.fillStyle = `rgb(${pass.colour})`;
            for (let packet = 0; packet < 4; packet++) {
              const along = (elapsed * 1.5 + packet / 4 + dish.x * 0.013) % 1;
              context.globalAlpha = Math.sin(along * Math.PI);
              context.fillRect(position.x + (feed.x - position.x) * along - 0.8,
                position.y + (feed.y - position.y) * along - 0.8, 1.6, 1.6);
            }
            context.globalAlpha = 1;
            const pulse = (elapsed * 1.5 + dish.x * 0.013) % 1;
            context.strokeStyle = `rgba(${pass.colour}, ${0.6 * (1 - pulse)})`;
            context.beginPath();
            context.arc(feed.x, feed.y, 1.5 + pulse * 5, 0, Math.PI * 2);
            context.stroke();
          }
          drawDish(dish.x, dish.aim);
          context.fillStyle = satellite ? `rgb(${satellite.pass.colour})` : '#8a97a3';
          context.beginPath();
          context.arc(feed.x, feed.y, 1.1, 0, Math.PI * 2);
          context.fill();
        });
      });

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
      previous = null;
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
