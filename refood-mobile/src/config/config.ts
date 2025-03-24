// Configurazione dell'API
export const API_CONFIG = {
  // URL dell'API principale
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.123.160:3000/api/v1',
  
  // URL per le notifiche (può essere diverso in fase di sviluppo)
  NOTIFICATIONS_API_URL: __DEV__ 
    ? 'http://192.168.123.160:3000/api/v1/notifiche' 
    : process.env.EXPO_PUBLIC_API_URL 
      ? `${process.env.EXPO_PUBLIC_API_URL}/notifiche` 
      : 'http://192.168.123.160:3000/api/v1/notifiche',
  
  // Flag per abilitare dati mock per le notifiche durante lo sviluppo
  // IMPORTANTE: Questo flag fa sì che l'app non tenti di recuperare notifiche dal server,
  // ma utilizzi invece le notifiche in memoria, incluse quelle create localmente.
  // In questo modo, le notifiche create durante l'uso dell'app (es. creazione lotti)
  // saranno visibili nella sezione notifiche senza dipendere dal server.
  USE_MOCK_NOTIFICATIONS: false, // Impostato a false per permettere la sincronizzazione con il server
  
  // Timeout per le richieste API (in ms)
  REQUEST_TIMEOUT: 10000, // Aumentato per dare più tempo alle operazioni di sincronizzazione
}; 