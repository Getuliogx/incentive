import sharp from 'sharp';
import { config } from './config.js';
import { resolveTitle, resolveSeason, chooseMedia, displayName, fetchOriginal } from './tmdb.js';

const cache = new Map();

function cachePut(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > config.image.cacheItems) cache.delete(cache.keys().next().value);
}

export function makePublicImageUrl(req, title, season) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.get('host');
  const u = new URL('/image/season', `${proto}://${host}`);
  u.searchParams.set('title', title);
  if (season !== null && season !== undefined) u.searchParams.set('season', String(season));
  return u.toString();
}

async function posterTo1920x1080(buf) {
  const W = 1920, H = 1080;
  const background = await sharp(buf)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .blur(28)
    .modulate({ brightness: 0.52, saturation: 0.9 })
    .jpeg({ quality: config.image.quality })
    .toBuffer();

  const poster = await sharp(buf)
    .resize({ width: 700, height: 1000, fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: config.image.quality, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const meta = await sharp(poster).metadata();
  const left = Math.round((W - meta.width) / 2);
  const top = Math.round((H - meta.height) / 2);

  const shadow = Buffer.from(`
    <svg width="${W}" height="${H}">
      <defs><filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="20" flood-opacity="0.75"/></filter></defs>
      <rect x="${left}" y="${top}" width="${meta.width}" height="${meta.height}" rx="10" fill="black" opacity="0.30" filter="url(#shadow)"/>
    </svg>`);

  return sharp(background)
    .composite([{ input: shadow }, { input: poster, left, top }])
    .jpeg({ quality: config.image.quality, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function landscapeTo1920x1080(buf) {
  return sharp(buf)
    .resize(1920, 1080, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: config.image.quality, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

export async function resolveImagePlan(title, seasonNumber) {
  const resolved = await resolveTitle(title, seasonNumber);
  const season = resolved.kind === 'tv' ? await resolveSeason(resolved.data.id, seasonNumber) : null;
  const media = chooseMedia(resolved, season);
  return {
    resolved,
    season,
    media,
    canonicalTitle: displayName(resolved, title)
  };
}

export async function renderSeasonImage(title, seasonNumber) {
  const key = `${String(title).toLowerCase()}|${seasonNumber ?? ''}`;
  if (cache.has(key)) return cache.get(key);

  const plan = await resolveImagePlan(title, seasonNumber);
  const source = await fetchOriginal(plan.media.path);
  const image = plan.media.kind === 'poster'
    ? await posterTo1920x1080(source)
    : await landscapeTo1920x1080(source);

  const result = {
    image,
    source: plan.media.source,
    canonicalTitle: plan.canonicalTitle,
    seasonName: plan.season?.name || null,
    tmdbId: plan.resolved.data.id,
    mediaType: plan.resolved.kind
  };
  cachePut(key, result);
  return result;
}
