// URL base dell'API
// export const API_URL = 'http://10.0.2.2:3000/api/v1'; // Per emulatore Android
// export const API_URL = 'http://localhost:3000/api/v1'; // Per sviluppo web e test locale
// export const API_URL = 'http://192.168.1.x:3000/api/v1'; // Sostituire con il tuo IP locale per dispositivi fisici

// Configurazione dinamica dell'URL API in base alla piattaforma
import { Platform } from 'react-native';

// Imposta qui l'IP del tuo computer nella rete locale per i test su dispositivi fisici
// Ad esempio: 192.168.1.5 o 10.0.0.4 ecc.
const LOCAL_IP = '192.168.123.160'; // Indirizzo IP aggiornato

// Porta del server backend
const SERVER_PORT = '3000';

// Costruzione dell'URL in base alla piattaforma
export let API_URL = `http://localhost:${SERVER_PORT}/api/v1`; // Default per web

// Per Android, usa 10.0.2.2 che è l'alias dell'host locale per l'emulatore
if (Platform.OS === 'android') {
  // Usa 10.0.2.2 per gli emulatori Android, IP locale per dispositivi fisici
  API_URL = __DEV__ && !Platform.isTV 
    ? `http://${LOCAL_IP}:${SERVER_PORT}/api/v1` 
    : `http://10.0.2.2:${SERVER_PORT}/api/v1`;
} 
// Per iOS, usa localhost per emulatori, IP locale per dispositivi fisici
else if (Platform.OS === 'ios') {
  API_URL = __DEV__ && !Platform.isTV 
    ? `http://${LOCAL_IP}:${SERVER_PORT}/api/v1` 
    : `http://localhost:${SERVER_PORT}/api/v1`;
}

console.log(`Usando API_URL: ${API_URL} per la piattaforma: ${Platform.OS}`);

// Chiavi per AsyncStorage
export const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
  LAST_SYNC: 'lastSync',  // Per tenere traccia dell'ultima sincronizzazione
  REFRESH_TOKEN: 'refreshToken', // Per il token di refresh
};

// Ruoli utente
export const RUOLI = {
  AMMINISTRATORE: 'Amministratore',
  OPERATORE: 'Operatore',
  CENTRO_SOCIALE: 'CentroSociale',
  CENTRO_RICICLAGGIO: 'CentroRiciclaggio',
};

// Colore primario dell'app
export const PRIMARY_COLOR = '#4CAF50';

// Colori di stato
export const STATUS_COLORS = {
  SUCCESS: '#4CAF50',
  WARNING: '#FFA000',
  ERROR: '#F44336',
  INFO: '#2196F3',
};

// Timeout per le richieste API (in millisecondi)
export const API_TIMEOUT = 60000; // Aumentato a 60 secondi

// Intervallo di tempo per considerare i dati "freschi" (in millisecondi)
export const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minuti 