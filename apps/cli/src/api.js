import axios from 'axios';
import config from './config.js';

function client() {
  const apiKey = config.get('apiKey');
  return axios.create({
    baseURL: config.get('apiUrl'),
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
}

export async function register(email) {
  const res = await client().post('/auth/register', { email });
  return res.data.api_key;
}

export async function fetchFeed(categories = []) {
  const params = categories.length ? { categories: categories.join(',') } : {};
  const res = await client().get('/feed', { params });
  return res.data;
}

export async function storePreference(text) {
  await client().post('/preferences', { text });
}

export async function whoami() {
  const res = await client().get('/auth/me');
  return res.data.email;
}
