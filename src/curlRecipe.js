function shellSplit(s) {
  const out = [];
  let cur = '';
  let quote = null;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === '\\' && quote !== "'") { esc = true; continue; }
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (/\s/.test(ch)) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function unescapeDollarQuoted(s) {
  return s.replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

export function parseCurl(raw) {
  const normalized = String(raw || '').replace(/\\\r?\n/g, ' ').trim();
  const tokens = shellSplit(normalized);
  if (!tokens.length || tokens[0] !== 'curl') throw new Error('O texto nao comeca com curl.');

  let url = '';
  let method = 'GET';
  const headers = {};
  let body = null;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if ((t === '-X' || t === '--request') && tokens[i + 1]) { method = tokens[++i].toUpperCase(); continue; }
    if ((t === '-H' || t === '--header') && tokens[i + 1]) {
      const h = tokens[++i];
      const p = h.indexOf(':');
      if (p > 0) headers[h.slice(0, p).trim()] = h.slice(p + 1).trim();
      continue;
    }
    if (['--data-raw', '--data', '--data-binary', '-d'].includes(t) && tokens[i + 1] != null) {
      body = unescapeDollarQuoted(tokens[++i].replace(/^\$/, ''));
      if (method === 'GET') method = 'POST';
      continue;
    }
    if (!t.startsWith('-') && /^https?:\/\//i.test(t) && !url) url = t;
  }

  if (!url) throw new Error('URL nao encontrada no cURL.');
  return { url, method, headers, body };
}

export function decodeCurlB64(b64) {
  const text = Buffer.from(String(b64 || ''), 'base64').toString('utf8');
  if (!text) throw new Error('INCENTIVE_CREATE_CURL_B64 vazio/invalido.');
  return parseCurl(text);
}
