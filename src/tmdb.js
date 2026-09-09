import axios from 'axios';
import { config } from './config.js';

const api = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  timeout: config.tmdb.timeoutMs,
  headers: { accept: 'application/json' }
});

function authOptions(params = {}) {
  const out = { params: { ...params }, headers: {} };
  if (config.tmdb.apiKey) out.params.api_key = config.tmdb.apiKey;
  if (config.tmdb.bearer) out.headers.Authorization = `Bearer ${config.tmdb.bearer}`;
  return out;
}

async function get(path, params = {}) {
  const r = await api.get(path, authOptions(params));
  return r.data;
}

function norm(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function score(item, query) {
  const q = norm(query);
  const names = [item.name, item.original_name, item.title, item.original_title].map(norm).filter(Boolean);
  let n = 0;
  for (const name of names) {
    if (name === q) n = Math.max(n, 1200);
    else if (name.startsWith(q) || q.startsWith(name)) n = Math.max(n, 850);
    else if (name.includes(q) || q.includes(name)) n = Math.max(n, 600);
  }
  n += Math.min(Number(item.popularity || 0), 250);
  return n;
}

async function searchTv(title) {
  const langs = [...new Set([config.tmdb.language, config.tmdb.fallbackLanguage].filter(Boolean))];
  let results = [];
  for (const language of langs) {
    const data = await get('/search/tv', { query: title, language, include_adult: false, page: 1 });
    results = data.results || [];
    if (results.length) break;
  }
  if (!results.length) return null;
  results.sort((a, b) => score(b, title) - score(a, title));
  const hit = results[0];
  const item = await get(`/tv/${hit.id}`, { language: config.tmdb.language });
  try {
    item.images = await get(`/tv/${hit.id}/images`, {
      include_image_language: `${config.tmdb.language.split('-')[0]},en,null`
    });
  } catch {}
  return item;
}

async function searchMovie(title) {
  const langs = [...new Set([config.tmdb.language, config.tmdb.fallbackLanguage].filter(Boolean))];
  let results = [];
  for (const language of langs) {
    const data = await get('/search/movie', { query: title, language, include_adult: false, page: 1 });
    results = data.results || [];
    if (results.length) break;
  }
  if (!results.length) return null;
  results.sort((a, b) => score(b, title) - score(a, title));
  const hit = results[0];
  const item = await get(`/movie/${hit.id}`, { language: config.tmdb.language });
  try {
    item.images = await get(`/movie/${hit.id}/images`, {
      include_image_language: `${config.tmdb.language.split('-')[0]},en,null`
    });
  } catch {}
  return item;
}

export async function resolveTitle(title, seasonNumber = null) {
  if (seasonNumber !== null && seasonNumber !== undefined) {
    const tv = await searchTv(title);
    if (!tv) throw new Error(`TMDB nao encontrou a serie: ${title}`);
    return { kind: 'tv', data: tv };
  }

  const [tv, movie] = await Promise.allSettled([searchTv(title), searchMovie(title)]);
  const tvData = tv.status === 'fulfilled' ? tv.value : null;
  const movieData = movie.status === 'fulfilled' ? movie.value : null;
  if (!tvData && !movieData) throw new Error(`TMDB nao encontrou: ${title}`);
  if (tvData && !movieData) return { kind: 'tv', data: tvData };
  if (movieData && !tvData) return { kind: 'movie', data: movieData };

  // Sem temporada, series ficam com pequena prioridade para manter o uso principal do projeto.
  const tvScore = score(tvData, title) + 20;
  const movieScore = score(movieData, title);
  return tvScore >= movieScore ? { kind: 'tv', data: tvData } : { kind: 'movie', data: movieData };
}

export async function resolveSeason(tvId, seasonNumber) {
  if (seasonNumber === null || seasonNumber === undefined) return null;
  try {
    const season = await get(`/tv/${tvId}/season/${seasonNumber}`, { language: config.tmdb.language });
    let images = { posters: [] };
    try {
      images = await get(`/tv/${tvId}/season/${seasonNumber}/images`, {
        include_image_language: `${config.tmdb.language.split('-')[0]},en,null`
      });
    } catch {}
    season.images = images;
    return season;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

function bestPoster(season) {
  const posters = [...(season?.images?.posters || [])];
  posters.sort((a, b) =>
    (Number(b.vote_average || 0) - Number(a.vote_average || 0)) ||
    ((Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)))
  );
  return posters[0]?.file_path || season?.poster_path || null;
}

function bestBackdrop(item) {
  // O backdrop_path do proprio TMDB e a arte principal escolhida para o titulo.
  // Ele costuma ser muito melhor para uma capa 16:9 do que um frame aleatorio de episodio.
  if (item?.backdrop_path) return item.backdrop_path;

  const backdrops = [...(item?.images?.backdrops || [])]
    .filter(x => x?.file_path && Number(x.width || 0) >= 1000 && Number(x.height || 0) >= 500);
  backdrops.sort((a, b) =>
    (Number(b.vote_count || 0) - Number(a.vote_count || 0)) ||
    (Number(b.vote_average || 0) - Number(a.vote_average || 0)) ||
    ((Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)))
  );
  return backdrops[0]?.file_path || null;
}

function bestStill(episodes = []) {
  return [...episodes]
    .filter(e => e.still_path)
    .sort((a, b) =>
      (Number(b.vote_average || 0) - Number(a.vote_average || 0)) ||
      (Number(b.vote_count || 0) - Number(a.vote_count || 0))
    )[0]?.still_path || null;
}

export function chooseMedia(resolved, season) {
  const item = resolved.data;

  // REGRA PRINCIPAL: nunca escolher frame de episodio antes da arte oficial.
  // Para meta, uma arte promocional limpa funciona muito melhor que uma cena aleatoria.
  const backdrop = bestBackdrop(item);
  if (backdrop) return { kind: 'landscape', source: `${resolved.kind}-official-backdrop`, path: backdrop };

  // Sem backdrop oficial, tenta a arte da temporada e transforma em 16:9 sem duplicar a imagem atras.
  if (resolved.kind === 'tv' && season) {
    const seasonPoster = bestPoster(season);
    if (seasonPoster) return { kind: 'poster', source: 'season-poster-fallback', path: seasonPoster };

    // Still fica SOMENTE como ultimo fallback de temporada.
    const still = bestStill(season.episodes || []);
    if (still) return { kind: 'landscape', source: 'season-episode-still-last-fallback', path: still };
  }

  if (item.poster_path) return { kind: 'poster', source: `${resolved.kind}-poster-fallback`, path: item.poster_path };
  throw new Error('TMDB nao possui imagem utilizavel para esse titulo.');
}

export function displayName(resolved, fallback) {
  return resolved.data.name || resolved.data.title || fallback;
}

export function originalImageUrl(path) {
  return `https://image.tmdb.org/t/p/original${path}`;
}

export async function fetchOriginal(path) {
  const r = await axios.get(originalImageUrl(path), {
    responseType: 'arraybuffer',
    timeout: Math.max(4500, config.tmdb.timeoutMs + 2000)
  });
  return Buffer.from(r.data);
}
