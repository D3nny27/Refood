// Interfaccia per l'entità Utente (ex Centro)
export interface Utente {
  id: number;
  nome: string;
  tipo: string;
  indirizzo?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
  telefono?: string;
  email?: string;
  referente?: string;
  latitudine?: number;
  longitudine?: number;
  [key: string]: any; // Per proprietà aggiuntive che potrebbero essere presenti
}

// Interfaccia per l'entità Attore (ex Utente)
export interface Attore {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
  utente?: Utente; // Riferimento all'utente associato, se esiste
  [key: string]: any; // Per proprietà aggiuntive che potrebbero essere presenti
}

// Tipo per i ruoli attore
export type RuoloAttore = 'Amministratore' | 'Operatore' | 'Utente' | string;

// Tipo per i tipi di utente
export type TipoUtente = 'Privato' | 'Canale sociale' | 'Centro riciclo' | string; 