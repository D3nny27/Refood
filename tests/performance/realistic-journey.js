import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { browser } from 'k6/browser';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Metriche personalizzate
const searchResponseTrend = new Trend('search_response_time');
const lottiResponseTrend = new Trend('lotti_response_time');
const prenotazioniResponseTrend = new Trend('prenotazioni_response_time');
const categorieTrend = new Trend('categorie_response_time');
const errorRate = new Rate('error_rate');
const authTime = new Trend('auth_time');
const dettaglioLottoTrend = new Trend('dettaglio_lotto_time');
const searchCounter = new Counter('search_requests');

// Configurazione del test
export const options = {
  scenarios: {
    browser_scenario: {
      executor: 'shared-iterations',
      vus: 1, // Utenti virtuali per la parte browser
      iterations: 1,
      exec: 'browserJourney',
      options: {
        browser: {
          type: 'chromium',
          headless: true
        },
      },
    },
    api_scenario: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },  // Scala fino a 5 utenti
        { duration: '1m', target: 5 },   // Mantieni 5 utenti per 1 minuto
        { duration: '30s', target: 10 }, // Scala fino a 10 utenti
        { duration: '1m', target: 10 },  // Mantieni 10 utenti per 1 minuto
        { duration: '30s', target: 0 },  // Scala a 0 utenti
      ],
      exec: 'apiJourney',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% delle richieste devono essere sotto 1s
    'http_req_failed': ['rate<0.05'],     // massimo 5% di errori
  },
};

// Simulazione credenziali utenti
const users = new SharedArray('users', function() {
  return [
    { email: 'admin@refood.org', password: 'password' },
    { email: 'operatore1@example.com', password: 'password123' },
    { email: 'utente2@example.com', password: 'password123' }
  ];
});

// Base URL per le API
const API_BASE_URL = 'http://localhost:3000/api/v1';
const WEB_APP_URL = 'http://localhost:4200';

// Token cache
let adminToken = null;
let userToken = null;

// Funzione per ottenere un token di autenticazione
function getAuthToken(userType = 'user') {
  const creds = users[Math.floor(Math.random() * users.length)];
  
  const response = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify({
    email: creds.email,
    password: creds.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(response, {
    'login successful': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  if (response.status === 200) {
    try {
      authTime.add(response.timings.duration);
      const responseBody = JSON.parse(response.body);
      if (responseBody.tokens && responseBody.tokens.access) {
        return responseBody.tokens.access;
      } else {
        console.error(`Formato di risposta inatteso per l'autenticazione di ${userType}:`, response.body);
        return null;
      }
    } catch (e) {
      console.error(`Errore nel parsing della risposta di autenticazione per ${userType}:`, e);
      return null;
    }
  }
  
  console.error(`Errore di autenticazione per ${userType}:`, response.status, response.body);
  return null;
}

// Funzione sicura per estrarre i dati da una risposta JSON
function safeGetData(response) {
  try {
    if (!response || response.status >= 400) {
      return [];
    }
    
    const body = JSON.parse(response.body);
    return (body && body.data) ? body.data : [];
  } catch (e) {
    console.error('Errore nel parsing della risposta:', e);
    return [];
  }
}

// Variabili globali per memorizzare dati tra le chiamate
let globalLottiIds = [];
let categorieIds = [];
let tipiUtenteIds = [];

// Funzione per generare headers con token JWT
function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Journey utente tramite API
export function apiJourney() {
  // Seleziona un utente casuale dalle credenziali
  const user = users[Math.floor(Math.random() * users.length)];
  let token;
  
  // STEP 1: Login
  const loginRes = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  check(loginRes, {
    'login successo': (r) => r.status === 200,
    'token ricevuto': (r) => JSON.parse(r.body).tokens.access !== undefined
  });
  
  if (loginRes.status === 200) {
    token = JSON.parse(loginRes.body).tokens.access;
    const headers = authHeaders(token);
    
    // Pausa breve tra le richieste
    sleep(1);
    
    // STEP 2: Caricamento lotti disponibili
    const lottiRes = http.get(`${API_BASE_URL}/lotti?limit=10&page=1&sort=-createdAt`, {
      headers: headers
    });
    
    check(lottiRes, {
      'lettura lotti successo': (r) => r.status === 200,
      'lotti ricevuti': (r) => JSON.parse(r.body).data !== undefined
    });
    
    let lottoId;
    if (lottiRes.status === 200) {
      const lotti = JSON.parse(lottiRes.body).data;
      if (lotti && lotti.length > 0) {
        lottoId = lotti[0].id;
        
        // Pausa breve
        sleep(1);
        
        // STEP 3: Dettaglio lotto
        const lottoDettaglioRes = http.get(`${API_BASE_URL}/lotti/${lottoId}`, {
          headers: headers
        });
        
        check(lottoDettaglioRes, {
          'dettaglio lotto successo': (r) => r.status === 200
        });
        
        // Pausa breve
        sleep(1);
        
        // STEP 4: Categorie prodotti
        const categorieRes = http.get(`${API_BASE_URL}/categorie`, {
          headers: headers
        });
        
        check(categorieRes, {
          'categorie successo': (r) => r.status === 200
        });
        
        // Pausa breve
        sleep(2);
        
        // STEP 5: Recupero tipi utente
        const tipiUtenteRes = http.get(`${API_BASE_URL}/tipo-utente?limit=5`, {
          headers: headers
        });
        
        let tipoUtenteId;
        if (tipiUtenteRes.status === 200) {
          const tipiUtente = JSON.parse(tipiUtenteRes.body).data;
          if (tipiUtente && tipiUtente.length > 0) {
            tipoUtenteId = tipiUtente[0].id;
            
            // Pausa breve
            sleep(1);
            
            // STEP 6: Crea prenotazione
            // Calcola data ritiro prevista (domani)
            const domani = new Date();
            domani.setDate(domani.getDate() + 1);
            const dataRitiro = domani.toISOString().split('T')[0];
            
            const prenotazioneRes = http.post(`${API_BASE_URL}/prenotazioni`, JSON.stringify({
              lotto_id: lottoId,
              tipo_utente_ricevente_id: tipoUtenteId,
              data_ritiro_prevista: dataRitiro,
              note: 'Prenotazione test performance'
            }), {
              headers: headers
            });
            
            check(prenotazioneRes, {
              'creazione prenotazione': (r) => r.status === 201 || r.status === 200
            });
            
            // Step 7: Caricare le proprie prenotazioni
            const miePrenotazioniRes = http.get(`${API_BASE_URL}/prenotazioni/me?limit=10&page=1`, {
              headers: headers
            });
            
            check(miePrenotazioniRes, {
              'prenotazioni caricate': (r) => r.status === 200
            });
          }
        }
      }
    }
    
    // STEP 8: Effettua logout
    const logoutRes = http.post(`${API_BASE_URL}/auth/logout`, JSON.stringify({
      refreshToken: JSON.parse(loginRes.body).tokens.refresh
    }), {
      headers: headers
    });
    
    check(logoutRes, {
      'logout successo': (r) => r.status === 200 || r.status === 204
    });
  }
  
  // Pausa tra una iterazione e l'altra
  sleep(2);
}

// Journey utente tramite browser
export async function browserJourney() {
  const page = browser.newPage();
  
  try {
    // STEP 1: Visita homepage
    await page.goto(WEB_APP_URL);
    check(page, {
      'homepage caricata': () => page.url() === WEB_APP_URL + '/'
    });
    
    await page.waitForSelector('h1');
    sleep(2);
    
    // STEP 2: Vai alla pagina di login
    await page.goto(WEB_APP_URL + '/login');
    check(page, {
      'pagina login caricata': () => page.url().includes('/login')
    });
    
    // STEP 3: Effettua login
    const user = users[0]; // Usa il primo utente
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // Attendi che il login avvenga
    await page.waitForSelector('app-dashboard', { timeout: 10000 });
    check(page, {
      'login completato': () => page.url().includes('/dashboard')
    });
    
    sleep(2);
    
    // STEP 4: Naviga alla pagina lotti
    await page.goto(WEB_APP_URL + '/lotti');
    check(page, {
      'pagina lotti caricata': () => page.url().includes('/lotti')
    });
    
    await page.waitForSelector('.lotto-card', { timeout: 10000 });
    sleep(2);
    
    // STEP 5: Cerca un lotto
    await page.fill('input[type="search"]', 'pane');
    await page.keyboard.press('Enter');
    sleep(3);
    
    // STEP 6: Naviga alla propria area personale
    await page.goto(WEB_APP_URL + '/profilo');
    check(page, {
      'profilo caricato': () => page.url().includes('/profilo')
    });
    
    await page.waitForSelector('h2', { timeout: 10000 });
    sleep(2);
    
    // STEP 7: Logout
    await page.click('[data-test="logout-button"]');
    check(page, {
      'logout effettuato': () => page.url().includes('/login')
    });
    
  } finally {
    page.close();
  }
}

// Funzione per generare report HTML
export function handleSummary(data) {
  return {
    'results/realistic-journey-summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
} 