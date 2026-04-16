import axios from 'axios';
import config from './config.js';

const client = axios.create({
    baseURL: config.get('apiUrl'),
});

export async function fetchInsights(category = null) {
    const params = { limit: 10 };
    if (category) params.category = category;
    const res = await client.get('/insights', { params });
    return res.data;
};

export async function fetchDigest(summaries) {
    const res = await client.post('/digest', { summaries });
    return res.data.digest;
};