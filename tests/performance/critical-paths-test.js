/**
 * Test dei percorsi critici per l'API di Refood
 * 
 * Questo script testa specificamente i percorsi critici dell'applicazione
 * con carichi elevati per identificare potenziali colli di bottiglia.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Configurazione del test
export const options = {
  scenarios: {
    // Scenario 1: Test di carico sul percorso di ricerca lotti
    search_lotti: {
      executor: 'constant-arrival-rate',
      rate: 20,                 // 20 richieste al secondo
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 10,      // VUs pre-allocati
      maxVUs: 30,               // massimo numero di VUs
      exec: 'searchLotti',
    },
    
    // Scenario 2: Test di carico sul percorso autenticazione
    auth_flow: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 5,
      exec: 'authenticationFlow',
      startTime: '30s',         // Inizia dopo 30 secondi
      maxDuration: '2m',
    },
    
    // Scenario 3: Test di carico sul percorso prenotazioni
    prenotazioni_flow: {
      executor: 'ramping-arrival-rate',
      startRate: 5,             // 5 richieste al secondo
      timeUnit: '1s',
      stages: [
        { duration: '30s', target: 10 },  // Aumenta gradualmente a 10/s
        { duration: '1m', target: 10 },   // Mantieni a 10/s per 1 minuto
        { duration: '30s', target: 0 },   // Scala a 0
      ],
      preAllocatedVUs: 10,
      maxVUs: 40,
      exec: 'prenotazioniFlow',
      startTime: '1m30s',       // Inizia dopo 1m30s
    },
  },
  
  thresholds: {
    // Soglie critiche per il monitoraggio delle prestazioni
    'http_req_duration{type:login}': ['p(95)<800', 'p(99)<1200'],
    'http_req_duration{type:search}': ['p(95)<500', 'p(99)<800'],
    'http_req_duration{type:prenotazione}': ['p(95)<700', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'],  // Massimo 5% di errori
  },
};

// Metriche personalizzate
const loginDuration = new Trend('login_duration');
const searchDuration = new Trend('search_duration');
const prenotazioneDuration = new Trend('prenotazione_duration');
const errorRate = new Rate('error_rate');

// URL di base dell'API
const API_BASE_URL = 'http://localhost:3000/api/v1';

// Credenziali di test
const users = new SharedArray('users', function() {
  return [
    { email: 'admin@refood.org', password: 'password' },
    { email: 'operatore1@example.com', password: 'password123' },
    { email: 'utente2@example.com', password: 'password123' }
  ];
});

// Cache per i token JWT
let tokenCache = new Map();

// Funzione per effettuare il login e ottenere un token
function getAuthToken(userIndex = 0) {
  const user = users[userIndex % users.length];
  
  // Verifica se il token è già in cache
  const cacheKey = `${user.email}:${user.password}`;
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey);
  }
  
  const loginResponse = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { type: 'login' }
  });
  
  const success = check(loginResponse, {
    'login successo': (r) => r.status === 200,
    'token ricevuto': (r) => JSON.parse(r.body).tokens && JSON.parse(r.body).tokens.access
  });
  
  loginDuration.add(loginResponse.timings.duration);
  
  if (success) {
    const token = JSON.parse(loginResponse.body).tokens.access;
    tokenCache.set(cacheKey, token);
    return token;
  }
  
  errorRate.add(1);
  return null;
}

// Percorso critico 1: Autenticazione
export function authenticationFlow() {
  group('Percorso critico: Autenticazione', () => {
    // Seleziona un utente casuale
    const userIndex = Math.floor(Math.random() * users.length);
    const user = users[userIndex];
    
    // 1. Login
    const loginResponse = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'login' }
    });
    
    check(loginResponse, {
      'login successo': (r) => r.status === 200,
      'token ricevuto': (r) => JSON.parse(r.body).tokens && JSON.parse(r.body).tokens.access
    }) || errorRate.add(1);
    
    loginDuration.add(loginResponse.timings.duration);
    
    // Se il login fallisce, non continuare
    if (loginResponse.status !== 200) return;
    
    const tokens = JSON.parse(loginResponse.body).tokens;
    
    // 2. Verifica token
    const verifyResponse = http.get(`${API_BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokens.access}` },
      tags: { type: 'login' }
    });
    
    check(verifyResponse, {
      'verifica token successo': (r) => r.status === 200,
      'dati utente ricevuti': (r) => JSON.parse(r.body).data && JSON.parse(r.body).data.email === user.email
    }) || errorRate.add(1);
    
    sleep(1);
    
    // 3. Refresh token
    const refreshResponse = http.post(`${API_BASE_URL}/auth/refresh-token`, JSON.stringify({
      refreshToken: tokens.refresh
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'login' }
    });
    
    check(refreshResponse, {
      'refresh token successo': (r) => r.status === 200,
      'nuovo token ricevuto': (r) => JSON.parse(r.body).tokens && JSON.parse(r.body).tokens.access
    }) || errorRate.add(1);
    
    sleep(1);
    
    // 4. Logout
    const logoutResponse = http.post(`${API_BASE_URL}/auth/logout`, JSON.stringify({
      refreshToken: tokens.refresh
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.access}`
      },
      tags: { type: 'login' }
    });
    
    check(logoutResponse, {
      'logout successo': (r) => r.status === 200 || r.status === 204
    }) || errorRate.add(1);
    
    sleep(1);
  });
}

// Percorso critico 2: Ricerca lotti
export function searchLotti() {
  group('Percorso critico: Ricerca lotti', () => {
    // 1. Ricerca lotti pubblici
    const searchParams = [];
    
    // Aggiungi parametri casuali per diversificare le ricerche
    const searchTypes = ['categoria', 'termine', 'stato', 'combinato'];
    const searchType = searchTypes[Math.floor(Math.random() * searchTypes.length)];
    
    let searchUrl = `${API_BASE_URL}/lotti/public?`;
    
    switch (searchType) {
      case 'categoria':
        // Ricerca per categoria
        const categorieIds = [1, 2, 3, 4, 5];
        searchUrl += `categoria_id=${categorieIds[Math.floor(Math.random() * categorieIds.length)]}`;
        break;
      case 'termine':
        // Ricerca per termine
        const termini = ['pane', 'pasta', 'frutta', 'verdura', 'yogurt', 'carne', 'pesce'];
        searchUrl += `search=${termini[Math.floor(Math.random() * termini.length)]}`;
        break;
      case 'stato':
        // Ricerca per stato
        const stati = ['Verde', 'Arancione', 'Rosso'];
        searchUrl += `stato=${stati[Math.floor(Math.random() * stati.length)]}`;
        break;
      case 'combinato':
        // Combinazione di parametri
        const terminiCombinati = ['bio', 'fresco', 'locale', 'scadenza'];
        searchUrl += `search=${terminiCombinati[Math.floor(Math.random() * terminiCombinati.length)]}`;
        searchUrl += `&limit=20&page=1&sort=-createdAt`;
        break;
    }
    
    const searchResponse = http.get(searchUrl, {
      tags: { type: 'search' }
    });
    
    check(searchResponse, {
      'ricerca successo': (r) => r.status === 200,
      'risultati ricevuti': (r) => JSON.parse(r.body).data !== undefined
    }) || errorRate.add(1);
    
    searchDuration.add(searchResponse.timings.duration);
    
    // Pausa breve tra le richieste
    sleep(0.5);
  });
}

// Percorso critico 3: Gestione prenotazioni
export function prenotazioniFlow() {
  group('Percorso critico: Gestione prenotazioni', () => {
    // Ottieni un token di autenticazione (alterniamo gli utenti)
    const userIndex = Math.floor(Math.random() * users.length);
    const token = getAuthToken(userIndex);
    
    if (!token) {
      console.log('Impossibile ottenere token, salto questo test');
      errorRate.add(1);
      return;
    }
    
    // 1. Ottieni lotti disponibili
    const lottiResponse = http.get(`${API_BASE_URL}/lotti?limit=10&page=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { type: 'prenotazione' }
    });
    
    check(lottiResponse, {
      'lotti caricati': (r) => r.status === 200,
      'dati lotti ricevuti': (r) => JSON.parse(r.body).data !== undefined
    }) || errorRate.add(1);
    
    prenotazioneDuration.add(lottiResponse.timings.duration);
    
    let lottoId;
    try {
      const lotti = JSON.parse(lottiResponse.body).data;
      if (lotti && lotti.length > 0) {
        lottoId = lotti[0].id;
      } else {
        console.log('Nessun lotto disponibile, salto il test');
        return;
      }
    } catch (e) {
      console.error('Errore parsing lotti:', e);
      errorRate.add(1);
      return;
    }
    
    // 2. Ottieni tipi utente
    const tipiUtenteResponse = http.get(`${API_BASE_URL}/tipo-utente?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { type: 'prenotazione' }
    });
    
    check(tipiUtenteResponse, {
      'tipi utente caricati': (r) => r.status === 200
    }) || errorRate.add(1);
    
    let tipoUtenteId;
    try {
      const tipiUtente = JSON.parse(tipiUtenteResponse.body).data;
      if (tipiUtente && tipiUtente.length > 0) {
        tipoUtenteId = tipiUtente[0].id;
      } else {
        console.log('Nessun tipo utente disponibile, salto il test');
        return;
      }
    } catch (e) {
      console.error('Errore parsing tipi utente:', e);
      errorRate.add(1);
      return;
    }
    
    // 3. Crea prenotazione
    // Calcola data ritiro prevista (domani)
    const domani = new Date();
    domani.setDate(domani.getDate() + 1);
    const dataRitiro = domani.toISOString().split('T')[0];
    
    const prenotazioneData = {
      lotto_id: lottoId,
      tipo_utente_ricevente_id: tipoUtenteId,
      data_ritiro_prevista: dataRitiro,
      note: 'Test di carico prenotazione'
    };
    
    const prenotazioneResponse = http.post(`${API_BASE_URL}/prenotazioni`, JSON.stringify(prenotazioneData), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      tags: { type: 'prenotazione' }
    });
    
    check(prenotazioneResponse, {
      'prenotazione creata': (r) => r.status === 201 || r.status === 200
    }) || errorRate.add(1);
    
    prenotazioneDuration.add(prenotazioneResponse.timings.duration);
    
    let prenotazioneId;
    if (prenotazioneResponse.status === 201 || prenotazioneResponse.status === 200) {
      try {
        prenotazioneId = JSON.parse(prenotazioneResponse.body).data.id;
      } catch (e) {
        console.error('Errore parsing prenotazione:', e);
      }
    }
    
    // 4. Carica prenotazioni utente
    const miePrenotazioniResponse = http.get(`${API_BASE_URL}/prenotazioni/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { type: 'prenotazione' }
    });
    
    check(miePrenotazioniResponse, {
      'prenotazioni caricate': (r) => r.status === 200
    }) || errorRate.add(1);
    
    prenotazioneDuration.add(miePrenotazioniResponse.timings.duration);
    
    // 5. Se la prenotazione è stata creata, aggiorna lo stato (solo in alcuni casi)
    if (prenotazioneId && Math.random() < 0.3) {
      const updateData = {
        stato: 'Completata'
      };
      
      const updateResponse = http.patch(`${API_BASE_URL}/prenotazioni/${prenotazioneId}`, JSON.stringify(updateData), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        tags: { type: 'prenotazione' }
      });
      
      check(updateResponse, {
        'prenotazione aggiornata': (r) => r.status === 200
      }) || errorRate.add(1);
      
      prenotazioneDuration.add(updateResponse.timings.duration);
    }
    
    // Pausa tra le iterazioni
    sleep(1);
  });
}

// Funzione per generare report
export function handleSummary(data) {
  return {
    'results/critical-paths-summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
} 