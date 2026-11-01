// ============================================================
// Ledger's share cards (style.md §8.16): a single city, or a year in review.
// Drawn at 1080×1350 in the app's current theme, inside the shared frame.
// ============================================================

import { scoreTier } from '../domain/score';
import {
  CARD_FORMATS,
  CONTENT_INSET,
  MONO,
  SERIF,
  canvasToBlob,
  cardFontsReady,
  clipText,
  createCard,
  currentCardTheme,
  drawEyebrow,
  drawFooter,
  drawFrame,
  drawTracked,
  fitSerif,
  readPalette,
  type CardToken,
  type Palette,
} from './card-frame';

export interface CardData {
  city: string;
  region: string;
  /** The visit, e.g. "March 2025". */
  month: string;
  score: number | null;
  /** The score's tier name, e.g. "Strong". */
  tier: string | null;
  /** Category name and the entry's average rating (1–10) in it. */
  categories: { label: string; average: number }[];
  /** Cover photo URL, same-origin so the canvas isn't tainted. */
  photoUrl?: string;
  brand: string;
  tagline: string;
}

const { width: W, height: H } = CARD_FORMATS.post;
const INNER = W - CONTENT_INSET * 2;

function tierColor(p: Palette, score: number): string {
  return p[scoreTier(score).cssVar.slice(2) as CardToken];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** The 270° score dial (§8.15), with the number in serif at its centre. */
function drawDial(ctx: CanvasRenderingContext2D, p: Palette, cx: number, cy: number, r: number, score: number | null) {
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'round';
  ctx.strokeStyle = p['chart-track'];
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + sweep);
  ctx.stroke();
  if (score !== null) {
    ctx.strokeStyle = tierColor(p, score);
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + (sweep * score) / 100);
    ctx.stroke();
  }
  ctx.fillStyle = p['text-heading'];
  ctx.textAlign = 'center';
  ctx.font = `400 ${Math.round(r * 0.78)}px ${SERIF}`;
  ctx.fillText(score === null ? '—' : String(Math.round(score)), cx, cy + r * 0.26);
  ctx.textAlign = 'left';
}

/** A bar list row (§8.15): label, a 4px bar and a mono value. */
function drawBar(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
  w: number,
  label: string,
  average: number,
) {
  ctx.fillStyle = p['text-muted'];
  ctx.font = `400 28px ${SERIF}`;
  ctx.fillText(clipText(ctx, label, w - 90), x, y);
  ctx.fillStyle = p['text-heading'];
  ctx.font = `400 26px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(average.toFixed(1), x + w, y);
  ctx.textAlign = 'left';
  ctx.fillStyle = p['chart-track'];
  ctx.fillRect(x, y + 16, w, 4);
  ctx.fillStyle = tierColor(p, average * 10);
  ctx.fillRect(x, y + 16, (w * average) / 10, 4);
}

export async function renderCard(data: CardData): Promise<Blob> {
  const p = readPalette(currentCardTheme());
  await cardFontsReady();
  const { canvas, ctx } = createCard(W, H);
  drawFrame(ctx, p);
  let y = drawEyebrow(ctx, p, `${data.brand} · ${data.month}`) + 48;

  if (data.photoUrl) {
    try {
      const img = await loadImage(data.photoUrl);
      drawCover(ctx, img, CONTENT_INSET, y, INNER, 420);
      ctx.strokeStyle = p['border-faint'];
      ctx.lineWidth = 2;
      ctx.strokeRect(CONTENT_INSET, y, INNER, 420);
      y += 420;
    } catch {
      // Render without the photo.
    }
  }

  // Title: the city, and the region in italic under it.
  y += 130;
  ctx.fillStyle = p['text-heading'];
  fitSerif(ctx, data.city, INNER, 112, 56);
  ctx.fillText(data.city, CONTENT_INSET, y);
  y += 62;
  ctx.fillStyle = p['text-dim'];
  ctx.font = `italic 400 40px ${SERIF}`;
  ctx.fillText(clipText(ctx, data.region, INNER), CONTENT_INSET, y);

  // The hero figure: the dial, with the tier name under it.
  y += 80;
  const r = 104;
  const cx = CONTENT_INSET + r + 8;
  drawDial(ctx, p, cx, y + r + 8, r, data.score);
  if (data.tier) {
    ctx.fillStyle = data.score === null ? p['text-dim'] : tierColor(p, data.score);
    drawTracked(ctx, data.tier, cx, y + r * 2 + 64, 22, 0.2, 'center');
  }

  // Category averages beside it.
  const barX = cx + r + 72;
  const barW = W - CONTENT_INSET - barX;
  const footerTop = H - CONTENT_INSET - 52;
  const rows = Math.max(0, Math.min(data.categories.length, Math.floor((footerTop - 40 - y) / 72)));
  data.categories.slice(0, rows).forEach(({ label, average }, i) => {
    drawBar(ctx, p, barX, y + 34 + i * 72, barW, label, average);
  });

  drawFooter(ctx, p, data.brand, data.tagline);
  return canvasToBlob(canvas);
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
  tagline: string;
}

export async function renderReviewCard(data: ReviewCardData): Promise<Blob> {
  const p = readPalette(currentCardTheme());
  await cardFontsReady();
  const { canvas, ctx } = createCard(W, H);
  drawFrame(ctx, p);
  let y = drawEyebrow(ctx, p, `${data.brand} · ${data.kicker}`);

  y += 130;
  ctx.fillStyle = p['text-heading'];
  fitSerif(ctx, data.title, INNER, 96, 48, true);
  ctx.fillText(data.title, CONTENT_INSET, y);

  // Stat tiles on a hairline grid, three to a row.
  y += 64;
  const stats = data.stats.slice(0, 6);
  const cols = 3;
  const tileW = INNER / cols;
  const tileH = 170;
  const rowsOfStats = Math.ceil(stats.length / cols);
  ctx.fillStyle = p['border-faint'];
  for (let i = 1; i < cols; i++) ctx.fillRect(CONTENT_INSET + tileW * i, y, 1, tileH * rowsOfStats);
  for (let i = 0; i <= rowsOfStats; i++) ctx.fillRect(CONTENT_INSET, y + tileH * i, INNER, 1);
  stats.forEach((stat, i) => {
    const cx = CONTENT_INSET + (i % cols) * tileW + tileW / 2;
    const top = y + Math.floor(i / cols) * tileH;
    ctx.fillStyle = p['text-heading'];
    ctx.textAlign = 'center';
    const size = fitSerif(ctx, stat.value, tileW - 32, 72, 36);
    ctx.font = `400 ${size}px ${SERIF}`;
    ctx.fillText(stat.value, cx, top + 92);
    ctx.fillStyle = p['text-dim'];
    drawTracked(ctx, stat.label, cx, top + 136, 20, 0.2, 'center');
  });
  y += tileH * rowsOfStats + 90;

  if (data.best) {
    ctx.fillStyle = p['text-dim'];
    drawTracked(ctx, data.best.label, CONTENT_INSET, y, 22, 0.25);
    y += 72;
    ctx.fillStyle = p['text-heading'];
    fitSerif(ctx, data.best.city, INNER - 200, 64, 36);
    ctx.fillText(data.best.city, CONTENT_INSET, y);
    ctx.fillStyle = tierColor(p, data.best.score);
    ctx.font = `400 72px ${SERIF}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(data.best.score)), W - CONTENT_INSET, y);
    ctx.textAlign = 'left';
    y += 76;
  }

  const footerTop = H - CONTENT_INSET - 52;
  for (const w of data.winners.slice(0, 5)) {
    if (y > footerTop - 30) break;
    ctx.fillStyle = p['text-dim'];
    drawTracked(ctx, clipText(ctx, w.label, 360), CONTENT_INSET, y, 20, 0.2);
    ctx.fillStyle = p['text-heading'];
    ctx.font = `400 32px ${SERIF}`;
    ctx.fillText(clipText(ctx, w.city, INNER - 470 - 100), CONTENT_INSET + 430, y);
    ctx.fillStyle = tierColor(p, w.average * 10);
    ctx.font = `400 28px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(w.average.toFixed(1), W - CONTENT_INSET, y);
    ctx.textAlign = 'left';
    y += 56;
  }

  drawFooter(ctx, p, data.brand, data.tagline);
  return canvasToBlob(canvas);
}
