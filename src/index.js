import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertConfig } from './config.js';
import { parseMetaCommand } from './command.js';
import { makePublicImageUrl, decodeImageKey, renderSeasonImage, resolveImagePlan } from './image.js';
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

function goalName(title, season, mediaType) {
  if (mediaType !== 'tv' || season === null || season === undefined) return title;
  if (season === 0) return `${title} - Especiais`;
  return `${title} - ${season}ª Temporada`;
}

async function resolveForGoal(title, requestedSeason) {
  let season = requestedSeason;
  let plan = await resolveImagePlan(title, season);

  // Para series/animes, se a temporada nao for informada, usa a 1ª automaticamente.
  if ((season === null || season === undefined) && plan.resolved.kind === 'tv') {
    season = 1;
    plan = await resolveImagePlan(title, season);
  }
  return { season, plan };
}

function sendJpeg(res, out) {
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Image-Width', '1920');
  res.set('X-Image-Height', '1080');
  res.set('X-TMDB-Source', out.source);
  res.send(out.image);
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'incentive-meta', version: '2.1.0', tmdb: true, incentive: true });
});

app.get('/api/preview', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const requestedSeason = req.query.season === undefined || req.query.season === '' ? null : Number(req.query.season);
    if (!title) return res.status(400).json({ error: 'Informe title' });
    const { season, plan } = await resolveForGoal(title, requestedSeason);
    // Gera agora para garantir que a URL entregue ao Incentive realmente funciona.
    await renderSeasonImage(title, season);
    res.json({
      ok: true,
      title: plan.canonicalTitle,
      goalName: goalName(title, season, plan.resolved.kind),
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

// URL curta e estavel usada no campo image do Incentive.
app.get('/image/season/:key', async (req, res) => {
  try {
    const { title, season } = decodeImageKey(req.params.key);
    const out = await renderSeasonImage(title, season);
    sendJpeg(res, out);
  } catch (e) {
    console.error('[IMAGE KEY]', e?.response?.data || e.message || e);
    res.status(404).type('text/plain').send(`Imagem indisponivel: ${e.message}`);
  }
});

// Mantido para compatibilidade com URLs da versao anterior.
app.get('/image/season', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const season = req.query.season === undefined || req.query.season === '' ? null : Number(req.query.season);
    if (!title) return res.status(400).send('Falta title');
    if (season !== null && (!Number.isInteger(season) || season < 0 || season > 200)) return res.status(400).send('Temporada invalida');
    const out = await renderSeasonImage(title, season);
    sendJpeg(res, out);
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

    const { season, plan } = await resolveForGoal(parsed.title, parsed.season);

    // PRE-GERA a imagem antes de criar a meta. Se a imagem falhar, a meta nao e criada quebrada.
    const rendered = await renderSeasonImage(parsed.title, season);
    if (!rendered?.image?.length) throw new Error('Falha ao gerar imagem 1920x1080');

    const imageUrl = makePublicImageUrl(req, parsed.title, season);
    const finalName = goalName(parsed.title, season, plan.resolved.kind);

    const goal = await createGoal({
      name: finalName,
      amount: parsed.amount,
      imageUrl
    });

    addHistory({
      ok: true,
      name: finalName,
      originalTitle: parsed.title,
      amount: parsed.amount,
      season,
      tmdbTitle: plan.canonicalTitle,
      imageSource: plan.media.source,
      imageBytes: rendered.image.length,
      imageUrl,
      incentiveId: goal.id || null,
      status: goal.status
    });

    return res.send(`Meta criada: ${finalName} - R$ ${moneyBR(parsed.amount)}`.slice(0, 390));
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
