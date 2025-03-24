import { EventEmitter } from 'events';

// Crea un emettitore di eventi globale per l'applicazione
const appEvents = new EventEmitter();

// Definizione degli eventi dell'applicazione
export const APP_EVENTS = {
  JWT_EXPIRED: 'jwt_expired',
  AUTH_CHANGED: 'auth_changed',
  LOGOUT_REQUESTED: 'logout_requested',
  NETWORK_ERROR: 'network_error',
  REFRESH_NOTIFICATIONS: 'refresh_notifications'
};

// Limita il numero massimo di listener per evitare memory leak warnings
appEvents.setMaxListeners(20);

// Funzioni helper per gestire gli eventi
export const emitEvent = (eventName: string, data?: any) => {
  appEvents.emit(eventName, data);
};

export const listenEvent = (eventName: string, listener: (...args: any[]) => void) => {
  appEvents.on(eventName, listener);
  
  // Restituisce una funzione per rimuovere il listener (cleanup)
  return () => {
    appEvents.off(eventName, listener);
  };
};

export default appEvents; 