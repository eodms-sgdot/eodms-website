import { useEffect, useRef } from 'react';

export default function AuroraLoader() {
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
    let frame = 0;
    let start: number | null = null;

    const draw = (timestamp: number) => {
      start ??= timestamp;
      const time = motion.matches ? 0 : (timestamp - start) / 1000;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      const colours = ['95, 255, 169', '78, 211, 255', '184, 133, 255'];
      colours.forEach((colour, ribbon) => {
        const phase = time * 0.35 + ribbon * 1.8;
        for (let strand = 0; strand < 110; strand++) {
          const position = strand / 109;
          const horizontal = 18 + position * 244;
          const crest = 74 + ribbon * 13
            + Math.sin(position * 7 + phase) * 17
            + Math.sin(position * 15 - phase * 0.7) * 6;
          const length = 32 + Math.sin(position * 9 + phase) * 12 + ribbon * 6;
          const opacity = Math.sin(position * Math.PI) ** 1.5
            * (0.2 + 0.15 * Math.sin(position * 20 + phase));
          const gradient = context.createLinearGradient(horizontal, crest - length, horizontal, crest + 8);
          gradient.addColorStop(0, `rgba(${colour}, 0)`);
          gradient.addColorStop(0.65, `rgba(${colour}, ${opacity * 0.45})`);
          gradient.addColorStop(0.9, `rgba(${colour}, ${opacity})`);
          gradient.addColorStop(1, `rgba(${colour}, 0)`);
          context.strokeStyle = gradient;
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(horizontal + Math.sin(phase + position * 5) * 14, crest - length);
          context.bezierCurveTo(horizontal - 8, crest - length * 0.6,
            horizontal + 7, crest - length * 0.2, horizontal, crest + 8);
          context.stroke();
        }
      });
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