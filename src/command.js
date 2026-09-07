function normalizeAmount(raw) {
  const cleaned = String(raw || '')
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) throw new Error('valor invalido');
  return Math.round(n * 100) / 100;
}

function normalizeSeason(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(?:t|temp|temporada|s|season)?\s*(\d{1,3})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 0 || n > 200) return null;
  return n;
}

export function parseMetaCommand(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('use: !meta VALOR | TEMPORADA | NOME');

  let parts = raw.split('|').map(v => v.trim()).filter(Boolean);
  if (parts.length < 2) {
    // Fallback: "50 2 Nome da serie" ou "50 Nome da serie"
    const tokens = raw.split(/\s+/);
    if (tokens.length < 2) throw new Error('use: !meta VALOR | TEMPORADA | NOME');
    const amountToken = tokens.shift();
    const maybeSeason = normalizeSeason(tokens[0]);
    if (maybeSeason !== null && tokens.length >= 2) {
      tokens.shift();
      parts = [amountToken, String(maybeSeason), tokens.join(' ')];
    } else {
      parts = [amountToken, tokens.join(' ')];
    }
  }

  const amount = normalizeAmount(parts[0]);
  let season = null;
  let title = '';

  if (parts.length >= 3) {
    season = normalizeSeason(parts[1]);
    if (season === null) throw new Error('temporada invalida');
    title = parts.slice(2).join(' | ').trim();
  } else {
    title = parts[1].trim();
  }

  if (!title || title.length < 2) throw new Error('nome invalido');
  if (title.length > 160) throw new Error('nome muito longo');

  return {
    amount,
    amountCents: Math.round(amount * 100),
    season,
    title
  };
}
