function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(String(raw).toLowerCase());
}

export const config = {
  host: '0.0.0.0',
  port: Math.trunc(numberEnv('PORT', 10000)),
  tmdb: {
    bearer: process.env.TMDB_BEARER_TOKEN || '',
    apiKey: process.env.TMDB_API_KEY || '',
    language: process.env.TMDB_LANGUAGE || 'pt-BR',
    fallbackLanguage: process.env.TMDB_FALLBACK_LANGUAGE || 'en-US',
    timeoutMs: Math.max(1500, Math.min(8000, numberEnv('TMDB_TIMEOUT_MS', 4500)))
  },
  image: {
    quality: Math.max(72, Math.min(100, Math.trunc(numberEnv('IMAGE_JPEG_QUALITY', 92)))),
    cacheItems: Math.max(4, Math.min(100, Math.trunc(numberEnv('IMAGE_CACHE_ITEMS', 24))))
  },
  incentive: {
    bearer: process.env.INCENTIVE_BEARER_TOKEN || '',
    endpoint: process.env.INCENTIVE_GOAL_ENDPOINT || 'https://api.incentive.gg/v1/panel/interactions/goal',
    timeoutMs: Math.max(2500, Math.min(12000, numberEnv('INCENTIVE_TIMEOUT_MS', 7000))),
    minDonation: Math.max(0.01, numberEnv('INCENTIVE_MIN_DONATION', 1)),
    type: process.env.INCENTIVE_GOAL_TYPE || 'closed',
    enableAlerts: boolEnv('INCENTIVE_ENABLE_ALERTS', true)
  },
  commandKey: process.env.COMMAND_KEY || ''
};

export function assertConfig() {
  const missing = [];
  if (!config.tmdb.bearer && !config.tmdb.apiKey) missing.push('TMDB_BEARER_TOKEN (ou TMDB_API_KEY)');
  if (!config.incentive.bearer) missing.push('INCENTIVE_BEARER_TOKEN');
  if (missing.length) {
    throw new Error(`Faltam variaveis no Render: ${missing.join(', ')}`);
  }
}
