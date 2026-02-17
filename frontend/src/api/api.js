import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 → try refresh, else logout
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const res = await axios.post(`${BASE_URL}/token/refresh/`, { refresh });
        const newAccess = res.data.access;
        localStorage.setItem('access_token', newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  me: () => api.get('/auth/me/'),
  updateProfile: (data) => api.patch('/auth/update_profile/', data),
};

// ─── Game ────────────────────────────────────────────────────────────────────
export const gameAPI = {
  getCurrent: () => api.get('/game/current/'),
  getHistory: (limit = 20) => api.get(`/game/history/?limit=${limit}`),
  placeBet: (data) => api.post('/game/bet/', data),
  cashout: (data) => api.post('/game/cashout/', data),
  myBet: () => api.get('/game/my_bet/'),
  myHistory: (limit = 20, offset = 0) =>
    api.get(`/game/my_history/?limit=${limit}&offset=${offset}`),
};

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactionAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/transactions/list_transactions/?${qs}`);
  },
  balance: () => api.get('/transactions/balance/'),
  deposit: (data) => api.post('/transactions/deposit/', data),
  completeDeposit: (data) => api.post('/transactions/complete_deposit/', data),
  withdraw: (data) => api.post('/transactions/withdraw/', data),
  checkDepositStatus: (txId) =>
    api.get(`/transactions/check_deposit_status/?transaction_id=${txId}`),
};

// ─── Chat ────────────────────────────────────────────────────────────────────
export const chatAPI = {
  messages: (limit = 50) => api.get(`/chat/messages/?limit=${limit}`),
  send: (message) => api.post('/chat/send/', { message }),
};

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  top: (limit = 10) => api.get(`/leaderboard/top/?limit=${limit}`),
};

export default api;