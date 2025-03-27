// URL base dell'API
// Configurazione dinamica dell'URL API in base alla piattaforma
import { Platform } from 'react-native';

// Ottieni l'indirizzo IP locale o usa valori predefiniti
const getLocalIP = () => {
  // In uno scenario reale, si potrebbe usare NetInfo per ottenere l'IP
  if (__DEV__) {
    console.log('[CONFIG] Ambiente di sviluppo rilevato');
  }
  
  // Valori di sviluppo predefiniti per diverse piattaforme
  return Platform.select({
    web: 'localhost',
    android: '10.0.2.2', // Emulatore Android -> host
    ios: 'localhost',    // Simulatore iOS
    default: 'localhost'
  });
};

// IP del server di sviluppo o di produzione
const DEV_SERVER_IP = getLocalIP();
const PROD_SERVER_IP = 'localhost'; // Sostituire con IP/dominio di produzione

// Porta del server backend
const SERVER_PORT = '3000';

// Configurazione dinamica dell'URL API
export const API_URL = __DEV__
  ? `http://${DEV_SERVER_IP}:${SERVER_PORT}/api/v1`
  : `http://${PROD_SERVER_IP}:${SERVER_PORT}/api/v1`;

// URL di backup (in caso di problemi con l'URL primario)
export const BACKUP_API_URLS = [
  `http://localhost:${SERVER_PORT}/api/v1`,
  `http://127.0.0.1:${SERVER_PORT}/api/v1`,
  `http://10.0.2.2:${SERVER_PORT}/api/v1`,
  //`http://172.16.16.247:${SERVER_PORT}/api/v1`,
  `http://192.168.123.160:${SERVER_PORT}/api/v1` // Il tuo IP precedente
];

console.log(`[CONFIG] URL API configurato: ${API_URL}`);
console.log(`[CONFIG] Piattaforma: ${Platform.OS}, Modalità dev: ${__DEV__ ? 'attiva' : 'disattiva'}`);

// Chiavi per AsyncStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_TOKEN: 'user_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  NOTIFICATIONS_COUNT: 'notifications_count',
  DEVICE_TOKEN: 'device_token',
  CACHE_PREFIX: 'cache_',
  CENTRO_ID: 'centro_id',
  UTENTE_ID: 'utente_id',
  CURRENT_VERSION: 'current_version',
  WEBSOCKET_ENABLED: 'websocket_enabled',
  LOCAL_NOTIFICATIONS: 'local_notifications',
};

// Ruoli utente
export const USER_ROLES = {
  ADMIN: 'Amministratore',
  OPERATOR: 'Operatore',
  USER: 'Utente',
};

// Colore primario dell'app
export const PRIMARY_COLOR = '#4CAF50';

// Colori di stato
export const STATUS_COLORS = {
  GREEN: '#4CAF50',
  YELLOW: '#FFC107',
  RED: '#F44336',
  BLUE: '#2196F3',
  GREY: '#9E9E9E',
};

// Timeout per le richieste API (in millisecondi)
export const API_TIMEOUT = 120000; // 120 secondi

// Intervallo di tempo per considerare i dati "freschi" (in millisecondi)
export const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minuti 