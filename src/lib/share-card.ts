// ============================================================
// Renders 1080×1350 PNG cards for sharing: a single city, or a year in review.
// Always uses the dark brand palette, whatever the app theme.
// ============================================================

import { scoreTier } from '../domain/score';

export interface CardData {
  city: string;
  region: string;
  month: string;
  score: number | null;
  /** Category name and the entry's average rating (1–10) in it. */
  categories: { label: string; average: number }[];
  /** Cover photo URL, same-origin so the canvas isn't tainted. */
  photoUrl?: string;
  brand: string;
}

const W = 1080;
const H = 1350;
const PAD = 72;
const SERIF = '"Iowan Old Style", "Apple Garamond", Baskerville, Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const C = {
  surface: '#0f0d0b',
  cream: '#f5ecd9',
  label: '#a8a29e',
  track: 'rgba(68, 64, 60, 0.55)',
  amber: '#d4a574',
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
}

/** Shrinks the font until `text` fits `maxWidth`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number, family: string) {
  let size = start;
  do {
    ctx.font = `400 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > min);
  return size;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'right' = 'left') {
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
}

export async function renderCard(data: CardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  // Solid background so the photo can fade into it without a seam.
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, W, H);
  if (!data.photoUrl) {
    // Without a photo, a warm glow fills the top of the card.
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.8);
    glow.addColorStop(0, 'rgba(212, 165, 116, 0.16)');
    glow.addColorStop(1, 'rgba(212, 165, 116, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  // Cover photo fading into the background.
  const photoH = 640;
  if (data.photoUrl) {
    try {
      drawCover(ctx, await loadImage(data.photoUrl), W, photoH);
      const fade = ctx.createLinearGradient(0, photoH * 0.45, 0, photoH);
      fade.addColorStop(0, 'rgba(15, 13, 11, 0)');
      fade.addColorStop(1, 'rgba(15, 13, 11, 1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, photoH);
    } catch {
      // Render without the photo.
    }
  }

  // Score ring.
  const cx = W - PAD - 110;
  const cy = data.photoUrl ? photoH - 40 : 260;
  const color = data.score === null ? C.amber : scoreTier(data.score).color;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.track;
  ctx.beginPath();
  ctx.arc(cx, cy, 110, 0, Math.PI * 2);
  ctx.stroke();
  if (data.score !== null) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * data.score) / 100);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(15, 13, 11, 0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.font = `500 72px ${MONO}`;
  ctx.fillText(data.score === null ? '—' : String(Math.round(data.score)), cx, cy + 22);
  ctx.fillStyle = C.label;
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText('/ 100', cx, cy + 62);
  ctx.textAlign = 'left';

  // City, region and month.
  let y = data.photoUrl ? photoH + 130 : 560;
  ctx.fillStyle = C.cream;
  fitFont(ctx, data.city, W - PAD * 2, 112, 48, SERIF);
  ctx.fillText(data.city, PAD, y);
  y += 64;
  ctx.fillStyle = C.label;
  ctx.font = `500 26px ${SANS}`;
  spaced(ctx, `${data.region} · ${data.month}`.toUpperCase(), PAD, y, 6);

  // Category bars.
  y += 70;
  const barX = 470;
  const barW = W - PAD - barX - 70;
  for (const { label, average } of data.categories.slice(0, 6)) {
    ctx.fillStyle = C.label;
    ctx.font = `500 22px ${SANS}`;
    spaced(ctx, label.toUpperCase().slice(0, 26), PAD, y + 8, 3);
    ctx.fillStyle = C.track;
    ctx.fillRect(barX, y, barW, 6);
    ctx.fillStyle = scoreTier(average * 10).color;
    ctx.fillRect(barX, y, (barW * average) / 10, 6);
    ctx.fillStyle = C.cream;
    ctx.font = `400 24px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(average.toFixed(1), W - PAD, y + 10);
    ctx.textAlign = 'left';
    y += 46;
  }

  // Footer.
  ctx.fillStyle = C.amber;
  ctx.font = `italic 400 40px ${SERIF}`;
  ctx.fillText(data.brand, PAD, H - 56);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), 'image/png'),
  );
}

// ---------- year in review ----------

export interface ReviewCardData {
  /** e.g. "Year in review" */
  kicker: string;
  /** e.g. "2025 in Ledger" */
  title: string;
  /** Up to six big numbers with labels. */
  stats: { value: string; label: string }[];
  best?: { label: string; city: string; score: number };
  /** Category winners: "Food Scene" → "Kyoto", 9.0 */
  winners: { label: string; city: string; average: number }[];
  brand: string;
}

export async function renderReviewCard(data: ReviewCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W);
  glow.addColorStop(0, 'rgba(212, 165, 116, 0.2)');
  glow.addColorStop(1, 'rgba(212, 165, 116, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  let y = PAD + 30;
  ctx.fillStyle = C.amber;
  ctx.font = `500 24px ${MONO}`;
  spaced(ctx, data.kicker.toUpperCase(), PAD, y, 8);
  y += 100;
  ctx.fillStyle = C.cream;
  const titleSize = fitFont(ctx, data.title, W - PAD * 2, 96, 48, SERIF);
  ctx.font = `italic 400 ${titleSize}px ${SERIF}`;
  ctx.fillText(data.title, PAD, y);

  // Stats grid: three columns, two rows.
  y += 110;
  const colW = (W - PAD * 2) / 3;
  data.stats.slice(0, 6).forEach((stat, i) => {
    const x = PAD + (i % 3) * colW;
    const rowY = y + Math.floor(i / 3) * 170;
    ctx.fillStyle = C.cream;
    fitFont(ctx, stat.value, colW - 24, 80, 36, MONO);
    ctx.fillText(stat.value, x, rowY + 70);
    ctx.fillStyle = C.label;
    ctx.font = `500 20px ${SANS}`;
    spaced(ctx, stat.label.toUpperCase(), x, rowY + 110, 3);
  });
  y += 340 + 30;

  // Divider.
  ctx.fillStyle = C.track;
  ctx.fillRect(PAD, y, W - PAD * 2, 2);
  y += 70;

  if (data.best) {
    const color = scoreTier(data.best.score).color;
    ctx.fillStyle = C.label;
    ctx.font = `500 22px ${SANS}`;
    spaced(ctx, data.best.label.toUpperCase(), PAD, y, 4);
    y += 66;
    ctx.fillStyle = C.cream;
    fitFont(ctx, data.best.city, W - PAD * 2 - 200, 64, 36, SERIF);
    ctx.fillText(data.best.city, PAD, y);
    ctx.fillStyle = color;
    ctx.font = `500 60px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(data.best.score)), W - PAD, y);
    ctx.textAlign = 'left';
    y += 70;
  }

  for (const w of data.winners.slice(0, 5)) {
    ctx.fillStyle = C.label;
    ctx.font = `500 21px ${SANS}`;
    spaced(ctx, w.label.toUpperCase().slice(0, 24), PAD, y, 3);
    ctx.fillStyle = C.cream;
    ctx.font = `400 30px ${SERIF}`;
    const city = w.city.length > 22 ? `${w.city.slice(0, 21)}…` : w.city;
    ctx.fillText(city, PAD + 470, y);
    ctx.fillStyle = scoreTier(w.average * 10).color;
    ctx.font = `400 26px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(w.average.toFixed(1), W - PAD, y);
    ctx.textAlign = 'left';
    y += 50;
  }

  ctx.fillStyle = C.amber;
  ctx.font = `italic 400 40px ${SERIF}`;
  ctx.fillText(data.brand, PAD, H - 56);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), 'image/png'),
  );
}
