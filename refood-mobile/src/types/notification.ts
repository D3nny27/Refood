/**
 * Definizione dei tipi per il sistema di notifiche
 */

// Tipi di notifiche supportati
export type TipoNotifica = 'CambioStato' | 'Prenotazione' | 'Alert';

// Livelli di priorità delle notifiche
export type PrioritaNotifica = 'Bassa' | 'Media' | 'Alta';

// Interfaccia principale per le notifiche
export interface Notifica {
  id: number;
  titolo: string;
  messaggio: string;
  tipo: TipoNotifica;
  priorita?: PrioritaNotifica;
  letta: boolean;
  data: Date | string;
  dataCreazione: Date | string; // Data di creazione
  dataLettura?: Date | string;  // Data di lettura (opzionale)
  dettagli?: Record<string, any>; // Dettagli aggiuntivi come key-value
  azione?: string; // URL o identificatore dell'azione associata
  testoPulsanteAzione?: string; // Testo da mostrare sul pulsante dell'azione
}

// Tipo per la risposta API delle notifiche
export interface NotificheResponse {
  data: Notifica[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Filtri per le notifiche
export interface NotificaFiltri {
  tipo?: TipoNotifica;
  letta?: boolean;
  priorita?: PrioritaNotifica;
  dataInizio?: string;
  dataFine?: string;
} 