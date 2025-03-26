import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configurazione di base per axios
const API_URL = 'http://10.0.2.2:3000/api/v1'; // Indirizzo standard per il localhost dell'emulatore Android
// Per dispositivi fisici o iOS Simulator, utilizzare l'IP effettivo del computer: 'http://192.168.x.x:3000/api/v1'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere il token a tutte le richieste
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor per gestire errori comuni, come token scaduto
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Se il token è scaduto (401) e non è già un retry
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Tentativo di aggiornare il token utilizzando il refresh token
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) {
          // Se non c'è refresh token, forza il logout
          await logout();
          return Promise.reject(error);
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refresh_token: refreshToken
        });
        
        // Salva il nuovo token
        const { access_token, expires } = response.data;
        await AsyncStorage.setItem('accessToken', access_token);
        await AsyncStorage.setItem('tokenExpires', expires);
        
        // Riprova la richiesta originale con il nuovo token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Se il refresh token è scaduto o non valido, forza il logout
        await logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Funzioni di autenticazione
export const login = async (email: string, password: string) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { user, tokens } = response.data;
    
    // Salva i dati utente e i token
    await AsyncStorage.setItem('user', JSON.stringify(user));
    await AsyncStorage.setItem('accessToken', tokens.access);
    await AsyncStorage.setItem('refreshToken', tokens.refresh);
    await AsyncStorage.setItem('tokenExpires', tokens.expires);
    
    return { user, tokens };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    // Chiama l'API di logout (se necessario)
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      await api.post('/auth/logout');
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Rimuovi i dati salvati localmente
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('tokenExpires');
  }
};

export const checkAuth = async () => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    const user = await AsyncStorage.getItem('user');
    
    if (!token || !user) {
      return null;
    }
    
    // Verifica opzionalmente la validità del token con una chiamata al backend
    return JSON.parse(user);
  } catch (error) {
    console.error('Check auth error:', error);
    return null;
  }
};

export const getActiveToken = async () => {
  return await AsyncStorage.getItem('accessToken');
};

export const registerUser = async (nome: string, cognome: string, email: string, password: string) => {
  try {
    // Simuliamo il ritardo di una chiamata API reale
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Per test: genera un errore se si usa una email specifica
    if (email === 'test@test.com') {
      const error = new Error('Email già in uso');
      // @ts-ignore
      error.response = { status: 409 };
      throw error;
    }
    
    console.log('Simulando registrazione utente:', { nome, cognome, email });
    
    // Restituisce un successo simulato
    return {
      success: true,
      data: {
        user: {
          id: Math.floor(Math.random() * 1000),
          nome,
          cognome,
          email,
          ruolo: 'UTENTE'
        }
      }
    };
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    throw error;
  }
};

export default api; 