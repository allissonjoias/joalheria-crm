import axios from 'axios';

// Para producao mobile, altere a URL abaixo para o endereco do servidor
const API_URL_MOBILE = 'http://192.168.31.238:3001/api';

const getBaseURL = () => {
  // Capacitor native app: usa URL do servidor
  if ((window as any).Capacitor?.isNativePlatform()) {
    return API_URL_MOBILE;
  }
  // Browser: usa proxy do Vite
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
