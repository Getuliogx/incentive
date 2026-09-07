import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertConfig } from './config.js';
import { parseMetaCommand } from './command.js';
import { makePublicImageUrl, renderSeasonImage, resolveImagePlan } from './image.js';
import { createGoal } from './incentive.js';

assertConfig();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '64kb' }));

const here = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here, '..', 'public')));

const history = [];
function addHistory(item) {
  history.unshift({ at: new Date().toISOString(), ...item });
  history.length = Math.min(history.length, 20);
}

function commandAllowed(req) {
  if (!config.commandKey) return true;
  return String(req.query.key || '') === config.commandKey;
}

function moneyBR(n) {
  return Number(n).toFixed(2).replace('.', ',');
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'incentive-meta', version: '2.0.0', tmdb: true, incentive: true });
});

app.get('/api/preview', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const season = req.query.season === undefined || req.query.season === '' ? null : Number(req.query.season);
    if (!title) return res.status(400).json({ error: 'Informe title' });
    const plan = await resolveImagePlan(title, season);
    res.json({
      ok: true,
      title: plan.canonicalTitle,
      tmdbId: plan.resolved.data.id,
      mediaType: plan.resolved.kind,
      season,
      seasonName: plan.season?.name || null,
      selectedImage: plan.media.source,
      image1920x1080: makePublicImageUrl(req, title, season)
    });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

app.get('/image/season', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const season = req.query.season === undefined || req.query.season === '' ? null : Number(req.query.season);
    if (!title) return res.status(400).send('Falta title');
    if (season !== null && (!Number.isInteger(season) || season < 0 || season > 200)) return res.status(400).send('Temporada invalida');

    const out = await renderSeasonImage(title, season);
    res.set('Content-Type', 'image/jpeg');
    res.set('Content-Disposition', 'inline; filename="meta-1920x1080.jpg"');
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.set('X-Image-Width', '1920');
    res.set('X-Image-Height', '1080');
    res.set('X-TMDB-Source', out.source);
    res.send(out.image);
  } catch (e) {
    console.error('[IMAGE]', e?.response?.data || e.message || e);
    res.status(404).send(`Imagem indisponivel: ${e.message}`);
  }
});

// Endpoint chamado pelo $(customapi) do StreamElements.
app.get('/se/meta', async (req, res) => {
  res.type('text/plain; charset=utf-8');
  if (!commandAllowed(req)) return res.status(200).send('Comando nao autorizado.');

  try {
    const parsed = parseMetaCommand(req.query.q);

    // Confirma que o titulo/temporada existem e que ha uma imagem utilizavel.
    const plan = await resolveImagePlan(parsed.title, parsed.season);
    const imageUrl = makePublicImageUrl(req, parsed.title, parsed.season);

    // Mantem exatamente o nome digitado no chat. A temporada controla a imagem.
    const goal = await createGoal({
      name: parsed.title,
      amount: parsed.amount,
      imageUrl
    });

    addHistory({
      ok: true,
      name: parsed.title,
      amount: parsed.amount,
      season: parsed.season,
      tmdbTitle: plan.canonicalTitle,
      imageSource: plan.media.source,
      imageUrl,
      incentiveId: goal.id || null,
      status: goal.status
    });

    const t = parsed.season === null ? '' : ` T${parsed.season}`;
    return res.send(`Meta criada: ${parsed.title}${t} - R$ ${moneyBR(parsed.amount)}`.slice(0, 390));
  } catch (e) {
    const apiMsg = e?.response?.data;
    const raw = apiMsg ? (typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg)) : (e.message || String(e));
    addHistory({ ok: false, error: raw.slice(0, 500) });
    console.error('[META]', raw);
    return res.status(200).send(`Falha: ${raw}`.slice(0, 390));
  }
});

app.get('/api/history', (req, res) => {
  res.json({ items: history });
});

app.listen(config.port, config.host, () => {
  console.log(`Web Service pronto em ${config.host}:${config.port}`);
});
