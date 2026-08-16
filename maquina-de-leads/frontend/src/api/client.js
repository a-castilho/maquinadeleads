import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const config = err.config || {};

    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Se uma descoberta antiga ficou presa em processing, o backend devolve 409.
    // Tentamos recuperar somente jobs realmente stale e repetimos a ação uma vez.
    if (
      status === 409 &&
      !config._staleRecoveryAttempted &&
      typeof config.url === 'string' &&
      /\/niches\/[^/]+\/native\/discover$/.test(config.url)
    ) {
      const match = config.url.match(/\/niches\/([^/]+)\/native\/discover$/);
      const nicheId = match?.[1];

      if (nicheId) {
        config._staleRecoveryAttempted = true;
        try {
          const recovery = await api.post(`/niches/${nicheId}/native/recover`, {});
          if (Number(recovery.data?.recoveredCount || 0) > 0) {
            console.warn(`[native-ui] job stale recuperado; repetindo descoberta niche=${nicheId}`);
            return api.request(config);
          }
        } catch (recoveryError) {
          console.error('[native-ui] falha ao recuperar job stale:', recoveryError.response?.data || recoveryError.message);
        }
      }
    }

    return Promise.reject(err);
  }
);

export default api;
