import axios from 'axios';
import { API_URL, API_TIMEOUT } from '../config/constants';

// Configura l'istanza di axios con URL base e timeout
const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT || 15000
});

// Configurazione di axios con intercettore per il token
export const setAuthToken = (token: string | null) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Token impostato negli header HTTP');
  } else {
    delete axios.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['Authorization'];
    console.log('Token rimosso dagli header HTTP');
  }
};

// Intercettore per gestire errori di rete
api.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error('Timeout della richiesta API');
    } else if (!error.response) {
      console.error('Errore di rete durante la richiesta API');
    }
    return Promise.reject(error);
  }
);

export default api; 