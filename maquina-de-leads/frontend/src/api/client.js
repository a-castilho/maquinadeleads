import axios from 'axios';

function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000/api';
    }

    if (hostname.includes('maquinadeleads-homolog-web.onrender.com')) {
      return 'https://maquinadeleads-homolog-api.onrender.com/api';
    }

    if (hostname.endsWith('.vercel.app')) {
      return 'https://maquinadeleads-homolog-api.onrender.com/api';
    }

    return `${protocol}//${hostname.replace('-web.', '-api.')}/api`;
  }

  return 'https://maquinadeleads-homolog-api.onrender.com/api';
}

const api = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
