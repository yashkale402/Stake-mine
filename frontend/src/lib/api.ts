import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const payload = error.response?.data;
    const message = payload?.message || error.message || 'An error occurred';
    const enriched = new Error(message) as Error & {
      statusCode?: number;
      activeGame?: unknown;
      finalState?: unknown;
    };
    enriched.statusCode = error.response?.status;
    if (payload?.activeGame) enriched.activeGame = payload.activeGame;
    if (payload?.finalState) enriched.finalState = payload.finalState;
    return Promise.reject(enriched);
  }
);

export default api;
