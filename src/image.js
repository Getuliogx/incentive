import sharp from 'sharp';
import { config } from './config.js';
import { resolveTitle, resolveSeason, chooseMedia, displayName, fetchOriginal } from './tmdb.js';

const cache = new Map();

function cachePut(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > config.image.cacheItems) cache.delete(cache.keys().next().value);
}

function imageKey(title, season) {
  return Buffer.from(JSON.stringify({ t: String(title), s: season ?? null }), 'utf8').toString('base64url');
}

export function decodeImageKey(raw) {
  const key = String(raw || '').replace(/\.jpg$/i, '');
  let data;
  try {
    data = JSON.parse(Buffer.from(key, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Chave de imagem invalida');
  }
  const title = String(data?.t || '').trim();
  const season = data?.s === null || data?.s === undefined || data?.s === '' ? null : Number(data.s);
  if (!title) throw new Error('Titulo da imagem invalido');
  if (season !== null && (!Number.isInteger(season) || season < 0 || season > 200)) throw new Error('Temporada da imagem invalida');
  return { title, season };
}

export function makePublicImageUrl(req, title, season) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.get('host');
  return `${proto}://${host}/image/season/${imageKey(title, season)}.jpg`;
}

async function posterTo1920x1080(buf) {
  const W = 1920, H = 1080;
  const overlay = Buffer.from(`
    <svg width="${W}" height="${H}">
      <defs>
        <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0.08)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.18)"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#v)"/>
    </svg>`);

  return sharp(buf)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .composite([{ input: overlay }])
    .sharpen()
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
