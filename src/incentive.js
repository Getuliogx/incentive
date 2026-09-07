import axios from 'axios';
import { config } from './config.js';
import { decodeCurlB64 } from './curlRecipe.js';

function getPath(obj, path) {
  if (!path) return undefined;
  return String(path).split('.').filter(Boolean).reduce((v, k) => v == null ? undefined : v[k], obj);
}

function template(value, vars) {
  if (value == null) return value;
  let s = String(value);
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v ?? ''));
  }
  return s;
}

function recipeFromConfig() {
  if (config.incentive.curlB64) return decodeCurlB64(config.incentive.curlB64);
  if (!config.incentive.url) throw new Error('Incentive ainda nao configurado: falta INCENTIVE_CREATE_CURL_B64 ou INCENTIVE_CREATE_URL.');
  return {
    url: config.incentive.url,
    method: config.incentive.method,
    headers: config.incentive.headers,
    body: config.incentive.bodyTemplate || null
  };
}

export function incentiveConfigured() {
  return Boolean(config.incentive.curlB64 || config.incentive.url);
}

export async function createIncentiveGoal(meta) {
  const recipe = recipeFromConfig();
  const vars = {
    TITLE: meta.title,
    AMOUNT: meta.amount.toFixed(2),
    AMOUNT_CENTS: meta.amountCents,
    SEASON: meta.season ?? '',
    IMAGE_URL: meta.imageUrl,
    TMDB_ID: meta.tmdbId,
    USER: meta.user || '',
    PROVIDER: meta.provider || ''
  };

  const url = template(recipe.url, vars);
  const unsafeReplayHeaders = new Set(['content-length', 'host', 'connection', 'accept-encoding']);
  const headers = Object.fromEntries(
    Object.entries(recipe.headers || {})
      .filter(([k]) => !unsafeReplayHeaders.has(k.toLowerCase()))
      .map(([k, v]) => [k, template(v, vars)])
  );
  let data = recipe.body == null ? undefined : template(recipe.body, vars);

  // Se o corpo parecer JSON, manda objeto JSON. Caso contrario preserva texto/form-encoded.
  if (typeof data === 'string') {
    const ct = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '';
    if (ct.includes('application/json') || /^[\s]*[\[{]/.test(data)) {
      try { data = JSON.parse(data); } catch { /* preserva raw */ }
    }
  }

  const response = await axios.request({
    url,
    method: recipe.method || 'POST',
    headers,
    data,
    timeout: config.incentive.timeoutMs,
    maxRedirects: 3,
    validateStatus: s => s >= 200 && s < 400
  });

  const result = config.incentive.resultPath ? getPath(response.data, config.incentive.resultPath) : undefined;
  return { status: response.status, result, data: response.data };
}
