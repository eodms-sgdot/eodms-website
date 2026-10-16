import { useEffect, useRef } from 'react';
import rcmRiverImage from '../assets/rcm-river.jpg';

const IMAGE_CROP = { left: 120, top: 0, width: 290.5, height: 166 };
const RIVER_CENTRELINE = [
  [350, 0], [350, 12], [354, 22], [357, 31], [355, 38], [360, 44],
  [367, 48], [368, 54], [361, 60], [365, 67], [365, 74], [359, 81],
  [356, 90], [360, 102], [360, 112], [362, 120], [358, 128],
  [359, 137], [355, 147], [354, 157], [352, 166],
];
const LAKE_OUTLINE = [
  [170, 147], [166, 139], [170, 129], [175, 122], [170, 118],
  [174, 109], [178, 102], [177, 95], [181, 90], [190, 85],
  [201, 86], [204, 92], [215, 87], [221, 79], [229, 74],
  [232, 78], [222, 85], [214, 93], [217, 99], [220, 103],
  [210, 110], [201, 113], [196, 118], [191, 128], [186, 132],
  [186, 141], [177, 151],
];

export default function RiverLoader({ onComplete }: { onComplete?: () => void }) {
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
    const image = new Image();
    let frame = 0;
    let start: number | null = null;
    let ready = false;
    let completed = 0;
    let imageLeft = 0;
    let imageTop = 0;
    let imageWidth = 0;
    let imageHeight = 0;
    let floodPolygon = new Path2D();
    let channelPolygon = new Path2D();
    let floodArea = new Path2D();
    const pixelSize = 3;
    const floodPixels: { horizontal: number; vertical: number; delay: number; brightness: number }[] = [];
    let horizontalFade = context.createLinearGradient(0, 0, width, 0);
    let verticalFade = context.createLinearGradient(0, 0, 0, height);

    const draw = (timestamp: number) => {
      start ??= timestamp;
      const time = motion.matches ? 0 : (timestamp - start) / 1000;
      const phase = motion.matches ? 8 : time % 8;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = 0.22;
      context.drawImage(image, IMAGE_CROP.left, IMAGE_CROP.top, IMAGE_CROP.width, IMAGE_CROP.height,
        imageLeft, imageTop, imageWidth, imageHeight);
      context.restore();
      const revealedPixels = new Path2D();
      context.save();
      context.clip(floodArea, 'evenodd');
      for (const pixel of floodPixels) {
        const age = phase - pixel.delay;
        if (age < 0) continue;
        const arrival = Math.min(1, age / 0.25);
        const shimmer = motion.matches ? 0 : Math.max(0, 1 - age / 0.8);
        const opacity = arrival * (0.28 + pixel.brightness * 0.13 + shimmer * 0.35);
        context.fillStyle = `rgba(75, 236, 219, ${opacity})`;
        context.fillRect(pixel.horizontal, pixel.vertical, pixelSize - 0.3, pixelSize - 0.3);
        revealedPixels.rect(pixel.horizontal, pixel.vertical, pixelSize, pixelSize);
      }
      context.restore();
      context.save();
      context.clip(revealedPixels);
      context.strokeStyle = '#91fff0';
      context.lineWidth = 0.85;
      context.lineJoin = 'round';
      context.stroke(floodPolygon);
      context.strokeStyle = 'rgba(115, 231, 223, 0.6)';
      context.lineWidth = 0.5;
      context.stroke(channelPolygon);
      context.restore();
      context.save();
      context.globalCompositeOperation = 'destination-in';
      context.fillStyle = horizontalFade;
      context.fillRect(0, 0, width, height);
      context.fillStyle = verticalFade;
      context.fillRect(0, 0, width, height);
      context.restore();
      if (motion.matches) return;
      if (Math.floor(time / 8) > completed) {
        completed = Math.floor(time / 8);
        onCompleteRef.current?.();
      }
      frame = window.requestAnimationFrame(draw);
    };

    const restart = () => {
      window.cancelAnimationFrame(frame);
      start = null;
      completed = 0;
      if (ready) frame = window.requestAnimationFrame(draw);
    };

    image.onload = () => {
      const scale = Math.min(width / IMAGE_CROP.width, height / IMAGE_CROP.height);
      imageWidth = IMAGE_CROP.width * scale;
      imageHeight = IMAGE_CROP.height * scale;
      imageLeft = (width - imageWidth) / 2;
      imageTop = (height - imageHeight) / 2;
      horizontalFade = context.createLinearGradient(imageLeft, 0, imageLeft + imageWidth, 0);
      horizontalFade.addColorStop(0, 'transparent');
      horizontalFade.addColorStop(0.14, '#000');
      horizontalFade.addColorStop(0.86, '#000');
      horizontalFade.addColorStop(1, 'transparent');
      verticalFade = context.createLinearGradient(0, imageTop, 0, imageTop + imageHeight);
      verticalFade.addColorStop(0, 'transparent');
      verticalFade.addColorStop(0.2, '#000');
      verticalFade.addColorStop(0.8, '#000');
      verticalFade.addColorStop(1, 'transparent');
      const centre = (vertical: number) => {
        const index = RIVER_CENTRELINE.findIndex(point => point[1] >= vertical);
        const upper = RIVER_CENTRELINE[Math.max(0, index - 1)];
        const lower = RIVER_CENTRELINE[Math.max(0, index)];
        const fraction = lower[1] === upper[1] ? 0 : (vertical - upper[1]) / (lower[1] - upper[1]);
        return upper[0] + (lower[0] - upper[0]) * fraction;
      };
      floodPolygon = new Path2D();
      channelPolygon = new Path2D();
      for (const side of [-1, 1]) {
        for (let vertex = 0; vertex <= IMAGE_CROP.height * 2; vertex++) {
          const vertical = IMAGE_CROP.top + (side === -1 ? vertex / 2 : IMAGE_CROP.height - vertex / 2);
          const channelWidth = 1.8 + Math.sin(vertical * 0.07) * 0.5;
          const extent = channelWidth + 5 + (Math.sin(vertical * 0.055 + side * 2) + 1) * 5
            + Math.sin(vertical * 0.29 + side) * 0.7 + Math.sin(vertical * 0.73 + side) * 0.35;
          const floodHorizontal = imageLeft + (centre(vertical) + side * extent - IMAGE_CROP.left) * scale;
          const channelHorizontal = imageLeft + (centre(vertical) + side * channelWidth - IMAGE_CROP.left) * scale;
          const mappedVertical = imageTop + (vertical - IMAGE_CROP.top) * scale;
          if (side === -1 && vertex === 0) {
            floodPolygon.moveTo(floodHorizontal, mappedVertical);
            channelPolygon.moveTo(channelHorizontal, mappedVertical);
          } else {
            floodPolygon.lineTo(floodHorizontal, mappedVertical);
            channelPolygon.lineTo(channelHorizontal, mappedVertical);
          }
        }
      }
      floodPolygon.closePath();
      channelPolygon.closePath();
      const lakePath = (padding: number) => {
        const path = new Path2D();
        LAKE_OUTLINE.forEach((point, index) => {
          const next = LAKE_OUTLINE[(index + 1) % LAKE_OUTLINE.length];
          for (let segment = 0; segment < 8; segment++) {
            const horizontal = point[0] + (next[0] - point[0]) * segment / 8;
            const vertical = point[1] + (next[1] - point[1]) * segment / 8;
            const direction = Math.atan2(vertical - 112, horizontal - 195);
            const extent = padding * (1 + Math.sin(vertical * 0.4 + horizontal * 0.2) * 0.15);
            const mappedHorizontal = imageLeft + (horizontal + Math.cos(direction) * extent - IMAGE_CROP.left) * scale;
            const mappedVertical = imageTop + (vertical + Math.sin(direction) * extent - IMAGE_CROP.top) * scale;
            if (index === 0 && segment === 0) path.moveTo(mappedHorizontal, mappedVertical);
            else path.lineTo(mappedHorizontal, mappedVertical);
          }
        });
        path.closePath();
        return path;
      };
      floodPolygon.addPath(lakePath(8));
      channelPolygon.addPath(lakePath(0));
      floodArea = new Path2D(floodPolygon);
      floodArea.addPath(channelPolygon);
      const mask = document.createElement('canvas');
      mask.width = width;
      mask.height = height;
      const maskContext = mask.getContext('2d');
      if (!maskContext) return;
      maskContext.fill(floodArea, 'evenodd');
      maskContext.lineWidth = 1;
      maskContext.stroke(floodPolygon);
      maskContext.stroke(channelPolygon);
      const coverage = maskContext.getImageData(0, 0, width, height).data;
      for (let vertical = 0; vertical < height; vertical += pixelSize) {
        for (let horizontal = 0; horizontal < width; horizontal += pixelSize) {
          let covered = false;
          for (let row = vertical; row < Math.min(height, vertical + pixelSize) && !covered; row++) {
            for (let column = horizontal; column < Math.min(width, horizontal + pixelSize); column++) {
              if (coverage[(row * width + column) * 4 + 3] > 0) { covered = true; break; }
            }
          }
          if (!covered) continue;
          const sample = Math.sin(horizontal * 127.1 + vertical * 311.7) * 43758.5453;
          const brightness = sample - Math.floor(sample);
          floodPixels.push({ horizontal, vertical, delay: 0, brightness });
        }
      }
      const left = Math.min(...floodPixels.map(pixel => pixel.horizontal));
      const right = Math.max(...floodPixels.map(pixel => pixel.horizontal));
      floodPixels.forEach(pixel => {
        pixel.delay = (pixel.horizontal - left) / Math.max(pixelSize, right - left) * 4.5
          + pixel.brightness * 1.2;
      });
      ready = true;
      restart();
    };
    image.src = rcmRiverImage;
    motion.addEventListener('change', restart);
    return () => {
      image.onload = null;
      window.cancelAnimationFrame(frame);
      motion.removeEventListener('change', restart);
    };
  }, []);

  return <canvas ref={canvasRef} width={280} height={160} aria-hidden="true"
    style={{ display: 'block', width: 280, height: 160, maxWidth: 'calc(100vw - 32px)' }} />;
}