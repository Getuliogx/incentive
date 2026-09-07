function intEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function jsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new Error(`${name} precisa ser JSON valido.`); }
}

const publicBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

export const config = {
  port: intEnv('PORT', 10000),
  host: '0.0.0.0',
  publicBaseUrl: publicBase,
  chatSecret: process.env.CHAT_SECRET || '',
  allowedChatUsers: (process.env.ALLOWED_CHAT_USERS || '')
    .split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
  tmdb: {
    bearer: process.env.TMDB_BEARER_TOKEN || '',
    apiKey: process.env.TMDB_API_KEY || '',
    language: process.env.TMDB_LANGUAGE || 'pt-BR',
    fallbackLanguage: process.env.TMDB_FALLBACK_LANGUAGE || 'en-US'
  },
  image: {
    quality: Math.max(70, Math.min(100, intEnv('IMAGE_JPEG_QUALITY', 92)))
  },
  incentive: {
    curlB64: process.env.INCENTIVE_CREATE_CURL_B64 || '',
    url: process.env.INCENTIVE_CREATE_URL || '',
    method: (process.env.INCENTIVE_CREATE_METHOD || 'POST').toUpperCase(),
    headers: jsonEnv('INCENTIVE_CREATE_HEADERS_JSON', {}),
    bodyTemplate: process.env.INCENTIVE_CREATE_BODY_TEMPLATE || '',
    resultPath: process.env.INCENTIVE_RESULT_PATH || '',
    timeoutMs: Math.max(1000, Math.min(12000, intEnv('INCENTIVE_TIMEOUT_MS', 9000)))
  }
};

export function assertBaseConfig() {
  const missing = [];
  if (!config.tmdb.bearer && !config.tmdb.apiKey) missing.push('TMDB_BEARER_TOKEN ou TMDB_API_KEY');
  if (!config.chatSecret) missing.push('CHAT_SECRET');
  if (missing.length) throw new Error(`Variaveis obrigatorias ausentes: ${missing.join(', ')}`);
}
