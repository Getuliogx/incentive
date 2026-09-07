import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertBaseConfig } from './config.js';
import { parseMetaCommand } from './command.js';
import { resolveShow, resolveSeasonMedia, chooseMedia } from './tmdb.js';
import { renderSeasonImage, makeImageUrl, verifyImageSignature } from './image.js';
import { createIncentiveGoal, incentiveConfigured } from './incentive.js';

assertBaseConfig();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

const here = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here, '..', 'public')));

function publicBase(req) {
  return config.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
}

function safeUser(s) {
  return String(s || '').replace(/^@/, '').trim().toLowerCase();
}

function chatAuthorized(req) {
  const secret = String(req.query.key || '');
  if (!secret || secret !== config.chatSecret) return false;
  if (!config.allowedChatUsers.length) return true;
  return config.allowedChatUsers.includes(safeUser(req.query.user));
}

app.get('/health', (req, res) => {
  res.json({ ok: true, incentive: incentiveConfigured(), tmdb: Boolean(config.tmdb.bearer || config.tmdb.apiKey) });
});

app.get('/api/preview', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const season = req.query.season === undefined || req.query.season === '' ? null : Number(req.query.season);
    if (!title) return res.status(400).json({ error: 'title obrigatorio' });
    const show = await resolveShow(title);
    const seasonData = await resolveSeasonMedia(show.id, season);
    const media = chooseMedia(show, seasonData);
    const imageUrl = makeImageUrl(publicBase(req), show.name || title, season);
    res.json({ tmdbId: show.id, title: show.name, originalTitle: show.original_name, season, seasonName: seasonData?.name || null, selected: media.source, image1920x1080: imageUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/image/season', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const season = req.query.season === undefined || req.query.season === '' ? null : Number(req.query.season);
    const sig = String(req.query.sig || '');
    if (!title || !verifyImageSignature(title, season, sig)) return res.status(403).send('forbidden');
    const out = await renderSeasonImage(title, season);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.set('X-TMDB-Source', out.source);
    res.send(out.image);
  } catch (e) {
    res.status(404).send(`imagem indisponivel: ${e.message}`);
  }
});

// Endpoint feito para $(customapi) do StreamElements: GET, resposta curta (<400 bytes).
app.get('/se/meta', async (req, res) => {
  if (!chatAuthorized(req)) return res.status(200).type('text/plain').send('Comando nao autorizado.');
  try {
    const parsed = parseMetaCommand(req.query.q);
    const user = safeUser(req.query.user);
    const provider = String(req.query.provider || '').toLowerCase();

    const show = await resolveShow(parsed.title);
    const season = await resolveSeasonMedia(show.id, parsed.season);
    const media = chooseMedia(show, season); // valida que ha imagem antes de criar a meta
    const canonicalTitle = show.name || parsed.title;
    const imageUrl = makeImageUrl(publicBase(req), canonicalTitle, parsed.season);

    const result = await createIncentiveGoal({
      ...parsed,
      title: canonicalTitle,
      tmdbId: show.id,
      imageUrl,
      imageSource: media.source,
      user,
      provider
    });

    const seasonText = parsed.season == null ? '' : ` T${parsed.season}`;
    const idText = result.result ? ` [${String(result.result).slice(0, 40)}]` : '';
    return res.type('text/plain').send(`Meta criada: ${canonicalTitle}${seasonText} - R$ ${parsed.amount.toFixed(2).replace('.', ',')}${idText}`.slice(0, 390));
  } catch (e) {
    console.error('[META]', e?.response?.data || e.message || e);
    return res.status(200).type('text/plain').send(`Falha: ${String(e.message || e).slice(0, 330)}`);
  }
});

app.listen(config.port, config.host, () => {
  console.log(`Incentive Chat Meta em http://${config.host}:${config.port}`);
});
