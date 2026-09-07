import axios from 'axios';
import { config } from './config.js';

const api = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  timeout: 7000,
  headers: { accept: 'application/json' }
});

function authParams(params = {}) {
  const out = { ...params };
  if (config.tmdb.apiKey) out.api_key = config.tmdb.apiKey;
  return out;
}

function headers() {
  return config.tmdb.bearer ? { Authorization: `Bearer ${config.tmdb.bearer}` } : {};
}

async function get(path, params = {}) {
  const r = await api.get(path, { params: authParams(params), headers: headers() });
  return r.data;
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreResult(r, query) {
  const q = norm(query);
  const names = [r.name, r.original_name].map(norm).filter(Boolean);
  let score = 0;
  for (const n of names) {
    if (n === q) score = Math.max(score, 1000);
    else if (n.startsWith(q) || q.startsWith(n)) score = Math.max(score, 700);
    else if (n.includes(q) || q.includes(n)) score = Math.max(score, 500);
  }
  score += Math.min(Number(r.popularity || 0), 200);
  if (r.first_air_date) score += 5;
  return score;
}

export async function resolveShow(title) {
  const langs = [config.tmdb.language, config.tmdb.fallbackLanguage].filter((v, i, a) => v && a.indexOf(v) === i);
  let results = [];
  for (const language of langs) {
    const data = await get('/search/tv', { query: title, language, include_adult: false, page: 1 });
    results.push(...(data.results || []));
    if (results.length) break;
  }
  if (!results.length) throw new Error(`TMDB nao encontrou: ${title}`);
  results.sort((a, b) => scoreResult(b, title) - scoreResult(a, title));
  const picked = results[0];
  const details = await get(`/tv/${picked.id}`, { language: config.tmdb.language, append_to_response: 'images' });
  return details;
}

export async function resolveSeasonMedia(showId, seasonNumber) {
  if (seasonNumber === null || seasonNumber === undefined) return null;
  try {
    const season = await get(`/tv/${showId}/season/${seasonNumber}`, {
      language: config.tmdb.language,
      append_to_response: 'images',
      include_image_language: `${config.tmdb.language.split('-')[0]},en,null`
    });
    return season;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

function bestStill(episodes = []) {
  return episodes
    .filter(e => e.still_path)
    .sort((a, b) => (Number(b.vote_average || 0) - Number(a.vote_average || 0)) || (Number(b.runtime || 0) - Number(a.runtime || 0)))[0]?.still_path || null;
}

function bestSeasonPoster(season) {
  const posters = season?.images?.posters || [];
  const p = posters.sort((a, b) => (Number(b.vote_average || 0) - Number(a.vote_average || 0)) || (Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0)))[0];
  return p?.file_path || season?.poster_path || null;
}

export function chooseMedia(show, season) {
  const seasonPoster = bestSeasonPoster(season);
  if (seasonPoster) return { kind: 'poster', source: 'season-poster', path: seasonPoster };

  const still = bestStill(season?.episodes || []);
  if (still) return { kind: 'landscape', source: 'season-episode-still', path: still };

  const backdrop = show?.backdrop_path;
  if (backdrop) return { kind: 'landscape', source: 'show-backdrop', path: backdrop };

  if (show?.poster_path) return { kind: 'poster', source: 'show-poster', path: show.poster_path };
  throw new Error('TMDB nao possui imagem utilizavel para esse titulo.');
}

export function originalImageUrl(path) {
  return `https://image.tmdb.org/t/p/original${path}`;
}

export async function fetchOriginal(path) {
  const r = await axios.get(originalImageUrl(path), { responseType: 'arraybuffer', timeout: 9000 });
  return Buffer.from(r.data);
}
