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

import { extractGoalId } from './id.js';

export async function createGoal({ name, amount }) {
  const payload = makeGoalPayload({ name, amount });
  const response = await axios.put(config.incentive.endpoint, payload, {
    headers: commonHeaders({ 'content-type': 'application/json' }),
    timeout: config.incentive.timeoutMs,
    maxRedirects: 2,
    validateStatus: s => s >= 200 && s < 300
  });
  const id = extractGoalId(response.data, response.headers);
  return {
    status: response.status,
    id,
    data: response.data,
    payload,
    responseType: typeof response.data
  };
}

export async function uploadGoalImage(goalId, imageBuffer, filename = 'POSTER.jpg') {
  if (!goalId) throw new Error('Incentive criou a meta, mas o ID nao foi reconhecido');
  if (!imageBuffer?.length) throw new Error('Buffer de imagem vazio');

  const form = new FormData();
  form.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), filename);

  const response = await axios.put(
    `https://api.incentive.gg/v1/panel/interactions/goal/${encodeURIComponent(goalId)}/image`,
    form,
    {
      headers: commonHeaders(),
      timeout: Math.max(config.incentive.timeoutMs, 12000),
      maxRedirects: 2,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: s => s >= 200 && s < 300
    }
  );
  return { status: response.status, data: response.data };
}
