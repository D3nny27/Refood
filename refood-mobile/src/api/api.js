import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Impostazione della URL base per tutte le richieste
const API_BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere il token di autenticazione a tutte le richieste
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Errore nel recupero del token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor per gestire gli errori comuni
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Gestione degli errori 401 (Unauthorized)
    if (error.response && error.response.status === 401) {
      // Tenta di aggiornare il token se l'errore è dovuto a un token scaduto
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });
          
          // Salva i nuovi token
          await SecureStore.setItemAsync('auth_token', response.data.accessToken);
          await SecureStore.setItemAsync('refresh_token', response.data.refreshToken);
          
          // Riprova la richiesta originale con il nuovo token
          error.config.headers.Authorization = `Bearer ${response.data.accessToken}`;
          return axios(error.config);
        } catch (refreshError) {
          // Se il refresh fallisce, logout forzato
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('refresh_token');
          await SecureStore.deleteItemAsync('user_data');
          
          // Qui si potrebbe aggiungere codice per reindirizzare l'utente alla pagina di login
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Funzioni di autenticazione
const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
};

// Funzioni per la gestione degli utenti
const usersAPI = {
  getAllAttori: () => api.get('/attori'),
  getAttoreById: (id) => api.get(`/attori/${id}`),
};

// Funzioni per la gestione dei tipi utente
const tipiUtenteAPI = {
  getAllTipiUtente: () => api.get('/tipi-utente'),
  getTipoUtenteById: (id) => api.get(`/tipi-utente/${id}`),
  createTipoUtente: (data) => api.post('/tipi-utente', data),
  updateTipoUtente: (id, data) => api.put(`/tipi-utente/${id}`, data),
  deleteTipoUtente: (id) => api.delete(`/tipi-utente/${id}`),
  getOperatori: (id) => api.get(`/tipi-utente/${id}/attori`),
  associaOperatore: (id, attoreId) => api.post(`/tipi-utente/${id}/attori/${attoreId}`),
  rimuoviOperatore: (id, attoreId) => api.delete(`/tipi-utente/${id}/attori/${attoreId}`),
};

export { api, authAPI, usersAPI, tipiUtenteAPI }; 