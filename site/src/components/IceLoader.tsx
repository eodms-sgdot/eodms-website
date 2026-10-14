import { useEffect, useRef } from 'react';

export default function IceLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const sample = (seed: number) => {
      const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const coastline = (vertical: number) => 96 + vertical * 0.28
      + Math.sin(vertical * 0.055 + 0.5) * 16
      + Math.sin(vertical * 0.15) * 5 + Math.sin(vertical * 0.37) * 1.5;
    const land = new Path2D();
    const shore = new Path2D();
    land.moveTo(0, 0);
    land.lineTo(coastline(0), 0);
    shore.moveTo(coastline(0), 0);
    for (let vertical = 1; vertical <= height; vertical++) {
      land.lineTo(coastline(vertical), vertical);
      shore.lineTo(coastline(vertical), vertical);
    }
    land.lineTo(0, height);
    land.closePath();
    const island = new Path2D();
    island.moveTo(206, 83);
    island.bezierCurveTo(199, 78, 203, 67, 209, 63);
    island.bezierCurveTo(215, 66, 216, 77, 213, 82);
    island.closePath();
    const water = new Path2D();
    water.rect(0, 0, width, height);
    water.addPath(land);
    water.addPath(island);

    const terrain = document.createElement('canvas');
    terrain.width = width * 2;
    terrain.height = height * 2;
    const terrainContext = terrain.getContext('2d');
    if (!terrainContext) return;
    const texture = terrainContext.createImageData(terrain.width, terrain.height);
    for (let row = 0; row < terrain.height; row++) {
      for (let column = 0; column < terrain.width; column++) {
        const shade = 85 + sample(row * terrain.width + column) * 75
          + Math.sin(column * 0.055 + Math.sin(row * 0.04) * 2) * 16;
        const offset = (row * terrain.width + column) * 4;
        texture.data[offset] = shade;
        texture.data[offset + 1] = shade;
        texture.data[offset + 2] = shade;
        texture.data[offset + 3] = 255;
      }
    }
    terrainContext.putImageData(texture, 0, 0);
    const floes: { horizontal: number; vertical: number; radius: number; path: Path2D; delay: number }[] = [];
    for (let candidate = 0; candidate < 120; candidate++) {
      const vertical = 10 + sample(candidate * 7 + 1) * 140;
      const horizontal = coastline(vertical) + 10 + sample(candidate * 7 + 2) ** 1.5 * 55;
      const radius = 2.5 + sample(candidate * 7 + 3) * 4.5;
      if (floes.some(floe => Math.hypot(horizontal - floe.horizontal, vertical - floe.vertical)
        < radius + floe.radius + 1.5)) continue;
      if (Math.hypot(horizontal - 209, vertical - 74) < radius + 13) continue;
      const path = new Path2D();
      for (let vertex = 0; vertex < 9; vertex++) {
        const angle = vertex / 9 * Math.PI * 2;
        const edge = radius * (0.7 + sample(candidate * 17 + vertex) * 0.4);
        const edgeHorizontal = horizontal + Math.cos(angle) * edge;
        const edgeVertical = vertical + Math.sin(angle) * edge * 0.75;
        if (vertex === 0) path.moveTo(edgeHorizontal, edgeVertical);
        else path.lineTo(edgeHorizontal, edgeVertical);
      }
      path.closePath();
      floes.push({ horizontal, vertical, radius, path,
        delay: vertical / height * 4.5 + sample(candidate * 7 + 4) * 0.8 });
    }
    const horizontalFade = context.createLinearGradient(0, 0, width, 0);
    horizontalFade.addColorStop(0, 'transparent');
    horizontalFade.addColorStop(0.15, '#000');
    horizontalFade.addColorStop(0.85, '#000');
    horizontalFade.addColorStop(1, 'transparent');
    const verticalFade = context.createLinearGradient(0, 0, 0, height);
    verticalFade.addColorStop(0, 'transparent');
    verticalFade.addColorStop(0.15, '#000');
    verticalFade.addColorStop(0.85, '#000');
    verticalFade.addColorStop(1, 'transparent');
    let frame = 0;
    let start: number | null = null;

    const draw = (timestamp: number) => {
      start ??= timestamp;
      const phase = motion.matches ? 8 : ((timestamp - start) / 1000) % 8;
      context.clearRect(0, 0, width, height);
      context.save();
      const coastLand = new Path2D(land);
      coastLand.addPath(island);
      context.clip(coastLand);
      context.globalAlpha = 0.16;
      context.drawImage(terrain, 0, 0, width, height);
      context.restore();
      context.strokeStyle = 'rgba(212, 227, 224, 0.35)';
      context.lineWidth = 0.7;
      context.stroke(shore);
      context.stroke(island);
      context.save();
      context.clip(water, 'evenodd');
      for (const floe of floes) {
        context.fillStyle = 'rgba(220, 235, 238, 0.09)';
        context.fill(floe.path);
        const age = phase - floe.delay;
        if (age < 0) continue;
        const arrival = Math.min(1, age / 0.5);
        const glint = motion.matches ? 0 : Math.max(0, 1 - age / 1.2);
        context.fillStyle = `rgba(191, 235, 246, ${arrival * (0.3 + glint * 0.2)})`;
        context.fill(floe.path);
        context.strokeStyle = `rgba(186, 250, 255, ${arrival * 0.85})`;
        context.lineWidth = 0.8;
        context.stroke(floe.path);
      }
      context.restore();
      context.save();
      context.globalCompositeOperation = 'destination-in';
      context.fillStyle = horizontalFade;
      context.fillRect(0, 0, width, height);
      context.fillStyle = verticalFade;
      context.fillRect(0, 0, width, height);
      context.restore();
      if (!motion.matches) frame = window.requestAnimationFrame(draw);
    };

    const restart = () => {
      window.cancelAnimationFrame(frame);
      start = null;
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