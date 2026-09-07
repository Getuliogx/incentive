import axios from 'axios';
import { config } from './config.js';

export function makeGoalPayload({ name, amount }) {
  return {
    name,
    slug: '',
    minDonation: config.incentive.minDonation,
    maxValue: amount,
    currentValue: 0,
    image: '',
    enableAlerts: config.incentive.enableAlerts,
    type: config.incentive.type,
    alertWidget: {
      id: '',
      type: 'default-config',
      model: 'default',
      useDefaultAlert: false,
      variables: []
    },
    goalWidget: {
      id: '',
      model: 'default',
      variables: []
    }
  };
}

function commonHeaders(extra = {}) {
  return {
    accept: 'application/json, text/plain, */*',
    authorization: `Bearer ${config.incentive.bearer}`,
    origin: 'https://incentive.gg',
    referer: 'https://incentive.gg/',
    ...extra
  };
}

function findId(data) {
  if (!data || typeof data !== 'object') return '';
  return (
    data.id ||
    data.goalId ||
    data.slug ||
    data.data?.id ||
    data.data?.goalId ||
    data.result?.id ||
    data.result?.goalId ||
    data.goal?.id ||
    ''
  );
}

export async function createGoal({ name, amount }) {
  const payload = makeGoalPayload({ name, amount });
  const response = await axios.put(config.incentive.endpoint, payload, {
    headers: commonHeaders({ 'content-type': 'application/json' }),
    timeout: config.incentive.timeoutMs,
    maxRedirects: 2,
    validateStatus: s => s >= 200 && s < 300
  });
  return { status: response.status, id: findId(response.data), data: response.data, payload };
}

export async function uploadGoalImage(goalId, imageBuffer, filename = 'poster.jpg') {
  if (!goalId) throw new Error('Incentive nao retornou o ID da meta para upload da imagem');
  if (!imageBuffer?.length) throw new Error('Buffer de imagem vazio');

  const form = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  form.append('image', blob, filename);

  const response = await axios.put(`https://api.incentive.gg/v1/panel/interactions/goal/${encodeURIComponent(goalId)}/image`, form, {
    headers: commonHeaders(form.getHeaders ? form.getHeaders() : {}),
    timeout: Math.max(config.incentive.timeoutMs, 12000),
    maxRedirects: 2,
    validateStatus: s => s >= 200 && s < 300
  });
  return { status: response.status, data: response.data };
}
