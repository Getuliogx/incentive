import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from './config.js';
import { resolveShow, resolveSeasonMedia, chooseMedia, fetchOriginal } from './tmdb.js';

const CACHE_MAX = 24;
const cache = new Map();

function cacheSet(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function imageSecret() {
  return config.chatSecret;
}

export function imageSignature(title, season) {
  return crypto.createHmac('sha256', imageSecret()).update(`${title}\n${season ?? ''}`).digest('hex').slice(0, 32);
}

export function verifyImageSignature(title, season, sig) {
  const expected = imageSignature(title, season);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function makeImageUrl(baseUrl, title, season) {
  const u = new URL('/image/season', baseUrl);
  u.searchParams.set('title', title);
  if (season !== null && season !== undefined) u.searchParams.set('season', String(season));
  u.searchParams.set('sig', imageSignature(title, season));
  return u.toString();
}

async function renderPoster(buf) {
  const W = 1920, H = 1080;
  const background = await sharp(buf)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .blur(24)
    .modulate({ brightness: 0.55, saturation: 0.85 })
    .jpeg({ quality: config.image.quality })
    .toBuffer();

  const poster = await sharp(buf)
    .resize({ height: 1000, width: 720, fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: config.image.quality })
    .toBuffer();
  const meta = await sharp(poster).metadata();
  const left = Math.round((W - meta.width) / 2);
  const top = Math.round((H - meta.height) / 2);

  const shadow = Buffer.from(`<svg width="${W}" height="${H}"><defs><filter id="s"><feDropShadow dx="0" dy="10" stdDeviation="18" flood-opacity="0.7"/></filter></defs><rect x="${left}" y="${top}" width="${meta.width}" height="${meta.height}" rx="8" fill="#000" opacity="0.30" filter="url(#s)"/></svg>`);

  return sharp(background)
    .composite([{ input: shadow }, { input: poster, left, top }])
    .jpeg({ quality: config.image.quality, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function renderLandscape(buf) {
  return sharp(buf)
    .resize(1920, 1080, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: config.image.quality, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

export async function renderSeasonImage(title, seasonNumber) {
  const key = `${title.toLowerCase()}|${seasonNumber ?? ''}`;
  if (cache.has(key)) return cache.get(key);

  const show = await resolveShow(title);
  const season = await resolveSeasonMedia(show.id, seasonNumber);
  const media = chooseMedia(show, season);
  const source = await fetchOriginal(media.path);
  const image = media.kind === 'poster' ? await renderPoster(source) : await renderLandscape(source);
  const result = {
    image,
    tmdbId: show.id,
    showName: show.name || title,
    seasonName: season?.name || (seasonNumber != null ? `Temporada ${seasonNumber}` : ''),
    source: media.source
  };
  cacheSet(key, result);
  return result;
}
