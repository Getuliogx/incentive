function cleanCandidate(value) {
  if (value === null || value === undefined) return '';
  let s = String(value).trim();
  if (!s) return '';
  try {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      const parsed = JSON.parse(s);
      if (typeof parsed === 'string') s = parsed.trim();
    }
  } catch {
    s = s.replace(/^['"]|['"]$/g, '').trim();
  }
  const urlMatch = s.match(/\/goal\/([A-Za-z0-9_-]{6,80})(?:\/|$|\?)/i)
    || s.match(/\/manager\/([A-Za-z0-9_-]{6,80})(?:\/|$|\?)/i);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]{6,80}$/.test(s)) return s;
  return '';
}

function recursiveFind(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return cleanCandidate(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = recursiveFind(item, depth + 1);
      if (hit) return hit;
    }
    return '';
  }
  if (typeof value !== 'object') return '';

  const preferred = [
    'goalId', 'goalID', 'interactionId', 'interactionID', 'id', '_id',
    'goal', 'interaction', 'slug', 'uuid', 'key', 'value', 'result', 'data'
  ];
  for (const key of preferred) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const direct = cleanCandidate(value[key]);
    if (direct) return direct;
    const nested = recursiveFind(value[key], depth + 1);
    if (nested) return nested;
  }

  for (const [key, child] of Object.entries(value)) {
    if (/^(alertWidget|goalWidget|variables)$/i.test(key)) continue;
    const nested = recursiveFind(child, depth + 1);
    if (nested) return nested;
  }
  return '';
}

export function extractGoalId(data, headers = {}) {
  const bodyId = recursiveFind(data);
  if (bodyId) return bodyId;
  const location = headers?.location || headers?.Location || headers?.['content-location'] || '';
  return cleanCandidate(location);
}
