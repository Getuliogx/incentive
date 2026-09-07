import axios from 'axios';
import { config } from './config.js';

export function makeGoalPayload({ name, amount, imageUrl }) {
  return {
    name,
    slug: '',
    minDonation: config.incentive.minDonation,
    maxValue: amount,
    currentValue: 0,
    image: imageUrl || '',
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

function findId(data) {
  if (!data || typeof data !== 'object') return '';
  return data.id || data.goalId || data.slug || data.data?.id || data.data?.goalId || data.result?.id || '';
}

export async function createGoal({ name, amount, imageUrl }) {
  const payload = makeGoalPayload({ name, amount, imageUrl });
  const response = await axios.put(config.incentive.endpoint, payload, {
    headers: {
      accept: 'application/json, text/plain, */*',
      authorization: `Bearer ${config.incentive.bearer}`,
      'content-type': 'application/json',
      origin: 'https://incentive.gg',
      referer: 'https://incentive.gg/'
    },
    timeout: config.incentive.timeoutMs,
    maxRedirects: 2,
    validateStatus: s => s >= 200 && s < 300
  });
  return { status: response.status, id: findId(response.data), data: response.data, payload };
}
