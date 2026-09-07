function parseAmount(raw) {
  let s = String(raw || '').trim().replace(/R\$/gi, '').replace(/\s+/g, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(?:,\d{1,2})?$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error('valor invalido');
  return Math.round(n * 100) / 100;
}

function seasonFromToken(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(?:t|temp(?:orada)?|s|season)?\s*(\d{1,3})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 0 || n > 200) return null;
  return n;
}

function parsePipe(raw) {
  const parts = raw.split('|').map(v => v.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const amount = parseAmount(parts[0]);
  if (parts.length === 2) return { amount, season: null, title: parts[1] };

  const secondSeason = seasonFromToken(parts[1]);
  const lastSeason = seasonFromToken(parts[parts.length - 1]);
  if (secondSeason !== null) {
    return { amount, season: secondSeason, title: parts.slice(2).join(' | ').trim() };
  }
  if (lastSeason !== null) {
    return { amount, season: lastSeason, title: parts.slice(1, -1).join(' | ').trim() };
  }
  return { amount, season: null, title: parts.slice(1).join(' | ').trim() };
}

function parseSpace(raw) {
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) throw new Error('use: !meta VALOR | T1 | NOME');
  const amount = parseAmount(tokens.shift());
  let season = null;

  const first = seasonFromToken(tokens[0]);
  if (first !== null && tokens.length > 1) {
    season = first;
    tokens.shift();
  } else {
    const last = seasonFromToken(tokens[tokens.length - 1]);
    if (last !== null && tokens.length > 1) {
      season = last;
      tokens.pop();
    }
  }
  return { amount, season, title: tokens.join(' ').trim() };
}

export function parseMetaCommand(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('use: !meta VALOR | T1 | NOME');
  const parsed = parsePipe(raw) || parseSpace(raw);
  if (!parsed.title || parsed.title.length < 2) throw new Error('nome invalido');
  if (parsed.title.length > 160) throw new Error('nome muito longo');
  parsed.amountCents = Math.round(parsed.amount * 100);
  return parsed;
}
