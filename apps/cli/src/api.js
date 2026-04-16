import axios from 'axios';
import config from './config.js';

const client = axios.create({
    baseURL: config.get('apiUrl'),
});

export async function fetchInsights(category = null) {
    const params = category ? {category} : {};
    const res = await client.get('/insights', { params });
    return res.data;
};