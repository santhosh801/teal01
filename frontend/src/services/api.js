import axios from 'axios';

const API_KEY = import.meta.env.VITE_API_KEY || 'trackz-assignment-key';
const API_URL = import.meta.env.VITE_API_URL || '';

const client = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: { 'x-api-key': API_KEY },
  timeout: 10000,
});

/**
 * Fetch latest alerts from the backend REST API.
 * @param {number} limit - Number of alerts to fetch (default 50)
 */
export async function fetchAlerts(limit = 50) {
  const { data } = await client.get('/alerts', { params: { limit } });
  return data.alerts || [];
}

/**
 * Fetch tracked symbols and their latest tick state.
 */
export async function fetchSymbols() {
  const { data } = await client.get('/symbols');
  return data.data || {};
}
