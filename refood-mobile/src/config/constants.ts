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

// URL di base per le API - inizializzato con un valore provvisorio
export let API_URL = '';

// In modalità sviluppo, utilizziamo sempre l'URL locale
if (__DEV__) {
  // Per Android, usa 10.0.2.2 per gli emulatori o l'IP locale per i dispositivi fisici
  if (Platform.OS === 'android') {
    // Su emulatore utilizziamo 10.0.2.2, su dispositivo fisico l'IP locale
    API_URL = Platform.isTV 
      ? `http://10.0.2.2:${SERVER_PORT}/api/v1` 
      : `http://${LOCAL_IP}:${SERVER_PORT}/api/v1`;
  } 
  // Per iOS, usa localhost per emulatori o l'IP locale per dispositivi fisici
  else if (Platform.OS === 'ios') {
    API_URL = Platform.isTV 
      ? `http://localhost:${SERVER_PORT}/api/v1` 
      : `http://${LOCAL_IP}:${SERVER_PORT}/api/v1`;
  } 
  // Per il web o altre piattaforme, usa localhost
  else {
    API_URL = `http://localhost:${SERVER_PORT}/api/v1`;
  }
  
  console.log(`[DEV] Usando server locale - API_URL: ${API_URL}`);
} else {
  // In produzione usiamo sempre l'URL di produzione
  API_URL = 'https://refood-be.stage.app-it-up.com/api/v1';
  console.log(`[PROD] Usando server di produzione - API_URL: ${API_URL}`);
}

console.log(`Configurazione API completata per piattaforma: ${Platform.OS}, dev mode: ${__DEV__ ? 'attivo' : 'disattivo'}`);

// Chiavi per AsyncStorage
export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_DATA: 'user_data',
  LAST_SYNC: 'last_sync',  // Per tenere traccia dell'ultima sincronizzazione
  REFRESH_TOKEN: 'refresh_token', // Per il token di refresh
  AUTH_TOKEN: 'auth_token',
  PUSH_TOKEN: 'push_token', // Per il token delle notifiche push
  LOCAL_NOTIFICATIONS: 'local_notifications', // Per salvare le notifiche locali
};

// Definizione dei colori principali dell'applicazione
export const COLORI = {
  primario: '#4CAF50',        // Verde principale
  primarioScuro: '#388E3C',   // Verde scuro
  primarioChiaro: '#A5D6A7',  // Verde chiaro
  secondario: '#FFC107',      // Ambra
  secondarioScuro: '#FFA000', // Ambra scuro
  secondarioChiaro: '#FFECB3', // Ambra chiaro
  sfondo: '#F5F5F5',          // Grigio chiaro per sfondo
  testoPrimario: '#212121',   // Nero per testo primario
  testoSecondario: '#757575', // Grigio per testo secondario
  divider: '#BDBDBD',         // Grigio per divisori
  error: '#D32F2F',           // Rosso per errori
  success: '#388E3C',         // Verde per successi
  warning: '#FFA000',         // Ambra per avvisi
  info: '#1976D2',            // Blu per informazioni
};

// Ruoli utente
export const RUOLI = {
  AMMINISTRATORE: 'Amministratore',
  OPERATORE: 'Operatore',
  UTENTE: 'Utente',
};

// Tipi utente
export const TIPI_UTENTE = {
  PRIVATO: 'Privato',
  CANALE_SOCIALE: 'Canale sociale',
  CENTRO_RICICLO: 'centro riciclo',
};

// Configurazione della navigazione
export const ROUTES = {
  HOME: 'Home',
  LOGIN: 'Login',
  REGISTRAZIONE: 'Registrazione',
  PROFILO: 'Profilo',
  TIPI_UTENTE: 'TipiUtente',
  TIPI_UTENTE_DETTAGLIO: 'TipiUtenteDettaglio',
  TIPI_UTENTE_MODIFICA: 'TipiUtenteModifica',
  TIPI_UTENTE_NUOVO: 'TipiUtenteNuovo',
  ATTORI: 'Attori',
  ATTORI_DETTAGLIO: 'AttoriDettaglio',
};

// Configurazioni per validazioni
export const VALIDAZIONI = {
  PASSWORD_MIN_LENGTH: 8,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TELEFONO_REGEX: /^[0-9]{9,10}$/,
};

// Altre configurazioni dell'applicazione
export const CONFIG = {
  // Configurazioni per la paginazione
  ITEMS_PER_PAGE: 10,
  
  // Tempo di validità delle cache (in millisecondi)
  CACHE_DURATION: 5 * 60 * 1000, // 5 minuti
  
  // Intervallo di aggiornamento automatico dei dati (in millisecondi)
  REFRESH_INTERVAL: 30 * 1000, // 30 secondi
  
  // Configurazioni per upload file
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
};

// Impostazioni di animazione
export const ANIMAZIONI = {
  DURATA_STANDARD: 300, // millisecondi
  DURATA_VELOCE: 150,   // millisecondi
  DURATA_LENTA: 500,    // millisecondi
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