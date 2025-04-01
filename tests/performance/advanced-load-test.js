import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ========== METRICHE PERSONALIZZATE ==========

// Metriche generali
const apiDurationTrend = new Trend('api_request_duration');
const errorRate = new Rate('error_rate');
const requestCounter = new Counter('total_requests');
const concurrentUsers = new Gauge('concurrent_users');
const successRate = new Rate('success_rate');

// Metriche per endpoint specifici
const getLottiTrend = new Trend('endpoint_get_lotti');
const getSingleLottoTrend = new Trend('endpoint_get_single_lotto');
const createPrenotazioneTrend = new Trend('endpoint_create_prenotazione');
const getPrenotazioniTrend = new Trend('endpoint_get_prenotazioni');
const getNotificheTrend = new Trend('endpoint_get_notifiche');
const getUserProfileTrend = new Trend('endpoint_get_user_profile');
const searchLottiTrend = new Trend('endpoint_search_lotti');
const updatePrenotazioneTrend = new Trend('endpoint_update_prenotazione');
const createLottoTrend = new Trend('endpoint_create_lotto');

// Per tipo di richiesta
const getRequestsTrend = new Trend('http_get_requests');
const postRequestsTrend = new Trend('http_post_requests');
const putRequestsTrend = new Trend('http_put_requests');
const deleteRequestsTrend = new Trend('http_delete_requests');

// ========== CONFIGURAZIONE DEL TEST ==========

export const options = {
  scenarios: {
    // Scenario 1: Navigazione utente realistico
    realistic_user_journey: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: '30s', target: 5 },    // ramp-up a 5 req/sec in 30s
        { duration: '1m', target: 5 },     // mantieni 5 req/sec per 1 minuto
        { duration: '30s', target: 10 },   // aumenta a 10 req/sec
        { duration: '1m', target: 10 },    // mantieni 10 req/sec per 1 minuto
        { duration: '30s', target: 15 },   // aumenta a 15 req/sec
        { duration: '1m', target: 15 },    // mantieni 15 req/sec per 1 minuto
        { duration: '30s', target: 0 },    // ramp-down a 0
      ],
      exec: 'realisticUserJourney',
      tags: { scenario: 'realistic_journey' }
    },
    
    // Scenario 2: Test di resistenza a medio carico
    endurance_test: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      gracefulStop: '5s',
      exec: 'enduranceTest',
      tags: { scenario: 'endurance' }
    },
    
    // Scenario 3: Test di picco di carico elevato
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 30 },    // ramp-up rapido a 30 utenti
        { duration: '40s', target: 30 },    // mantieni 30 utenti per 40s
        { duration: '10s', target: 0 },     // ramp-down
      ],
      gracefulStop: '10s',
      exec: 'peakLoadScenario',
      tags: { scenario: 'peak_load' }
    },
    
    // Scenario 4: Test di carico elevato sulle ricerche
    search_stress: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 5,
      maxDuration: '2m',
      exec: 'searchStressTest',
      tags: { scenario: 'search_stress' }
    },
    
    // Scenario 5: Test misto operatore/beneficiario
    mixed_role_test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,
      maxDuration: '3m',
      exec: 'mixedRoleTest',
      tags: { scenario: 'mixed_roles' }
    }
  },
  thresholds: {
    'api_request_duration': ['p(95)<1200', 'p(99)<2000'],
    'endpoint_get_lotti': ['p(95)<800', 'avg<500'],
    'endpoint_get_single_lotto': ['p(95)<600', 'avg<300'],
    'endpoint_create_prenotazione': ['p(95)<1000', 'avg<700'],
    'endpoint_get_prenotazioni': ['p(95)<800', 'avg<500'],
    'endpoint_get_notifiche': ['p(95)<600', 'avg<400'],
    'endpoint_search_lotti': ['p(95)<900', 'avg<600'],
    'endpoint_update_prenotazione': ['p(95)<1000', 'avg<700'],
    'endpoint_create_lotto': ['p(95)<1200', 'avg<800'],
    'http_get_requests': ['p(95)<800', 'avg<500'],
    'http_post_requests': ['p(95)<1200', 'avg<800'],
    'http_put_requests': ['p(95)<1000', 'avg<700'],
    'error_rate': ['rate<0.05'],
    'success_rate': ['rate>0.95'],
    'http_req_duration': ['p(99)<2000'],
  },
};

// ========== FUNZIONI UTILITY ==========

// Funzione per ottenere un token di autenticazione
function getToken(userType = 'normal') {
  // Per il test reale, leggi il token dal file
  try {
    // Per semplicità nell'esempio, usiamo token di esempio
    if (userType === 'operator') {
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoiYWRtaW5AcmVmb29kLm9yZyIsIm5vbWUiOiJBZG1pbiIsImNvZ25vbWUiOiJSZUZvb2RBcHAiLCJydW9sbyI6IkFtbWluaXN0cmF0b3JlIiwidGlwb191dGVudGUiOm51bGwsImp0aSI6ImZkMmY5ZGViOTcyYzM3ODg0ZDlmMGVjMDEyNzhkNWFhIiwiaWF0IjoxNzQzNTIwODA4LCJleHAiOjE3NDM1MjQ0MDh9.qgDs9NPWTStd_l8osvFv65JEj8rz20B-hc4OZ0rxAlU';
    } else if (userType === 'beneficiary') {
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoiYWRtaW5AcmVmb29kLm9yZyIsIm5vbWUiOiJBZG1pbiIsImNvZ25vbWUiOiJSZUZvb2RBcHAiLCJydW9sbyI6IkFtbWluaXN0cmF0b3JlIiwidGlwb191dGVudGUiOm51bGwsImp0aSI6ImZkMmY5ZGViOTcyYzM3ODg0ZDlmMGVjMDEyNzhkNWFhIiwiaWF0IjoxNzQzNTIwODA4LCJleHAiOjE3NDM1MjQ0MDh9.qgDs9NPWTStd_l8osvFv65JEj8rz20B-hc4OZ0rxAlU';
    } else {
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoiYWRtaW5AcmVmb29kLm9yZyIsIm5vbWUiOiJBZG1pbiIsImNvZ25vbWUiOiJSZUZvb2RBcHAiLCJydW9sbyI6IkFtbWluaXN0cmF0b3JlIiwidGlwb191dGVudGUiOm51bGwsImp0aSI6ImZkMmY5ZGViOTcyYzM3ODg0ZDlmMGVjMDEyNzhkNWFhIiwiaWF0IjoxNzQzNTIwODA4LCJleHAiOjE3NDM1MjQ0MDh9.qgDs9NPWTStd_l8osvFv65JEj8rz20B-hc4OZ0rxAlU';
    }
  } catch (e) {
    console.error('Errore nella lettura del token:', e);
    return 'invalid-token';
  }
}

// Funzione per generare un lotto casuale
function generateRandomLotto() {
  const prodotti = ['Pane', 'Pasta', 'Riso', 'Biscotti', 'Legumi', 'Verdure', 'Frutta', 'Carne', 'Pesce', 'Latticini'];
  const categorie = [1, 2, 3, 4, 5];
  const stati = ['Verde', 'Giallo', 'Arancione'];
  
  return {
    prodotto: randomItem(prodotti),
    quantita: randomIntBetween(1, 50),
    data_creazione: new Date().toISOString(),
    stato: randomItem(stati),
    descrizione: `Lotto di test generato ${new Date().toLocaleTimeString()} - ${uuidv4().substring(0, 8)}`,
    id_categoria: randomItem(categorie)
  };
}

// Funzione per generare una prenotazione casuale
function generateRandomPrenotazione(lottoId) {
  return {
    id_lotto: lottoId || randomIntBetween(1, 100),
    data_ritiro: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // domani
    note: `Prenotazione di test creata il ${new Date().toLocaleTimeString()} - ${uuidv4().substring(0, 8)}`,
    quantita: randomIntBetween(1, 10)
  };
}

// Funzione per fare una richiesta HTTP e registrare metriche
function makeRequest(method, url, token, data = null, specificTrend = null) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  let res;
  const startTime = new Date();
  
  if (method.toUpperCase() === 'GET') {
    res = http.get(url, { headers });
    getRequestsTrend.add(new Date() - startTime);
  } else if (method.toUpperCase() === 'POST') {
    res = http.post(url, JSON.stringify(data), { headers });
    postRequestsTrend.add(new Date() - startTime);
  } else if (method.toUpperCase() === 'PUT') {
    res = http.put(url, JSON.stringify(data), { headers });
    putRequestsTrend.add(new Date() - startTime);
  } else if (method.toUpperCase() === 'DELETE') {
    res = http.del(url, null, { headers });
    deleteRequestsTrend.add(new Date() - startTime);
  }
  
  const duration = new Date() - startTime;
  apiDurationTrend.add(duration);
  requestCounter.add(1);
  
  if (specificTrend) {
    specificTrend.add(duration);
  }
  
  const success = check(res, {
    'Status code is 200-299': (r) => r.status >= 200 && r.status < 300,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error(`Errore nella chiamata ${method} ${url}: ${res.status}`);
  } else {
    successRate.add(1);
    errorRate.add(0);
  }
  
  return res;
}

// ========== SCENARI DI TEST ==========

// Scenario di navigazione realistica
export function realisticUserJourney() {
  concurrentUsers.add(1);
  
  // Seleziona casualmente un tipo di utente
  const userTypes = ['normal', 'beneficiary', 'operator'];
  const userType = randomItem(userTypes);
  const token = getToken(userType);
  const baseUrl = 'http://localhost:3000/api/v1';
  
  group('User Profile and Notifications', () => {
    // Controlla il profilo utente
    makeRequest('GET', `${baseUrl}/utenti/me`, token, null, getUserProfileTrend);
    sleep(randomIntBetween(1, 2));
    
    // Controlla le notifiche
    makeRequest('GET', `${baseUrl}/notifiche`, token, null, getNotificheTrend);
    sleep(randomIntBetween(1, 2));
  });
  
  group('Browse Products', () => {
    // Lista dei lotti con paginazione casuale
    const page = randomIntBetween(1, 5);
    const limit = randomIntBetween(10, 20);
    
    makeRequest('GET', `${baseUrl}/lotti?page=${page}&limit=${limit}`, token, null, getLottiTrend);
    sleep(randomIntBetween(1, 3));
    
    // Visualizza un lotto specifico
    const lottoId = randomIntBetween(1, 100);
    makeRequest('GET', `${baseUrl}/lotti/${lottoId}`, token, null, getSingleLottoTrend);
    sleep(randomIntBetween(1, 2));
    
    // Cerca lotti per parola chiave
    const keywords = ['pane', 'pasta', 'frutta', 'verdura', 'carne', 'pesce'];
    const keyword = randomItem(keywords);
    makeRequest('GET', `${baseUrl}/lotti/search?q=${keyword}`, token, null, searchLottiTrend);
    sleep(randomIntBetween(1, 3));
  });
  
  // Azioni specifiche per il tipo di utente
  if (userType === 'beneficiary') {
    group('Beneficiary Actions', () => {
      // Visualizza le proprie prenotazioni
      makeRequest('GET', `${baseUrl}/prenotazioni`, token, null, getPrenotazioniTrend);
      sleep(randomIntBetween(1, 2));
      
      // Crea una nuova prenotazione (5% delle volte)
      if (Math.random() < 0.05) {
        const lottoId = randomIntBetween(1, 100);
        const newPrenotazione = generateRandomPrenotazione(lottoId);
        makeRequest('POST', `${baseUrl}/prenotazioni`, token, newPrenotazione, createPrenotazioneTrend);
        sleep(randomIntBetween(1, 2));
      }
    });
  } else if (userType === 'operator') {
    group('Operator Actions', () => {
      // Visualizza lotti e prenotazioni
      makeRequest('GET', `${baseUrl}/lotti?page=1&limit=50`, token, null, getLottiTrend);
      sleep(randomIntBetween(1, 2));
      
      makeRequest('GET', `${baseUrl}/prenotazioni?page=1&limit=50`, token, null, getPrenotazioniTrend);
      sleep(randomIntBetween(1, 2));
      
      // Crea un nuovo lotto (3% delle volte)
      if (Math.random() < 0.03) {
        const newLotto = generateRandomLotto();
        makeRequest('POST', `${baseUrl}/lotti`, token, newLotto, createLottoTrend);
      }
    });
  }
  
  concurrentUsers.add(-1);
  sleep(randomIntBetween(1, 3));
}

// Test di resistenza
export function enduranceTest() {
  concurrentUsers.add(1);
  
  const token = getToken('normal');
  const baseUrl = 'http://localhost:3000/api/v1';
  
  // Operazioni ripetute a bassa frequenza per testare la stabilità
  for (let i = 0; i < 3; i++) {
    // Visualizza lotti
    makeRequest('GET', `${baseUrl}/lotti?page=${i+1}&limit=10`, token, null, getLottiTrend);
    sleep(randomIntBetween(3, 5));
    
    // Visualizza notifiche
    makeRequest('GET', `${baseUrl}/notifiche`, token, null, getNotificheTrend);
    sleep(randomIntBetween(2, 4));
    
    // Visualizza dettaglio lotto
    const lottoId = randomIntBetween(1, 100);
    makeRequest('GET', `${baseUrl}/lotti/${lottoId}`, token, null, getSingleLottoTrend);
    sleep(randomIntBetween(3, 5));
  }
  
  concurrentUsers.add(-1);
}

// Test di picco di carico
export function peakLoadScenario() {
  concurrentUsers.add(1);
  
  const userType = Math.random() < 0.3 ? 'operator' : 'beneficiary';
  const token = getToken(userType);
  const baseUrl = 'http://localhost:3000/api/v1';
  
  // Esegui molte operazioni in rapida successione
  for (let i = 0; i < 5; i++) {
    makeRequest('GET', `${baseUrl}/lotti?page=${randomIntBetween(1, 10)}&limit=20`, token, null, getLottiTrend);
    sleep(randomIntBetween(0.1, 0.5));
    
    if (i % 2 === 0) {
      makeRequest('GET', `${baseUrl}/notifiche`, token, null, getNotificheTrend);
    }
    
    if (i % 3 === 0) {
      const lottoId = randomIntBetween(1, 100);
      makeRequest('GET', `${baseUrl}/lotti/${lottoId}`, token, null, getSingleLottoTrend);
    }
  }
  
  // Operazioni di scrittura (meno frequenti)
  if (userType === 'operator' && Math.random() < 0.2) {
    makeRequest('POST', `${baseUrl}/lotti`, token, generateRandomLotto(), createLottoTrend);
  } else if (userType === 'beneficiary' && Math.random() < 0.3) {
    makeRequest('POST', `${baseUrl}/prenotazioni`, token, generateRandomPrenotazione(), createPrenotazioneTrend);
  }
  
  concurrentUsers.add(-1);
  sleep(randomIntBetween(0.5, 1));
}

// Test di stress sulle ricerche
export function searchStressTest() {
  concurrentUsers.add(1);
  
  const token = getToken('normal');
  const baseUrl = 'http://localhost:3000/api/v1';
  
  const searchTerms = [
    'pane', 'pasta', 'riso', 'biscotti', 'frutta', 'verdura', 
    'carne', 'pesce', 'latticini', 'legumi', 'cereali', 'conserve',
    'p', 'pa', 'fr', 've', 'ca', 'pe', 'la', 'le', 'ce', 'co'
  ];
  
  // Esegui molte ricerche in rapida successione
  for (let i = 0; i < 10; i++) {
    const term = randomItem(searchTerms);
    makeRequest('GET', `${baseUrl}/lotti/search?q=${term}`, token, null, searchLottiTrend);
    sleep(randomIntBetween(0.2, 1));
  }
  
  concurrentUsers.add(-1);
}

// Test misto con diversi ruoli
export function mixedRoleTest() {
  concurrentUsers.add(1);
  
  // Distribuisci i ruoli in modo più realistico
  const roll = Math.random();
  let userType;
  
  if (roll < 0.6) {
    userType = 'beneficiary';
  } else if (roll < 0.9) {
    userType = 'operator';
  } else {
    userType = 'normal';
  }
  
  const token = getToken(userType);
  const baseUrl = 'http://localhost:3000/api/v1';
  
  if (userType === 'beneficiary') {
    // Azioni tipiche di un beneficiario
    makeRequest('GET', `${baseUrl}/lotti?page=1&limit=20`, token, null, getLottiTrend);
    sleep(randomIntBetween(1, 2));
    
    makeRequest('GET', `${baseUrl}/prenotazioni`, token, null, getPrenotazioniTrend);
    sleep(randomIntBetween(1, 2));
    
    // Crea una prenotazione (30% delle volte)
    if (Math.random() < 0.3) {
      const prenotazione = generateRandomPrenotazione();
      makeRequest('POST', `${baseUrl}/prenotazioni`, token, prenotazione, createPrenotazioneTrend);
      
      // Aggiorna la prenotazione (50% delle volte dopo averla creata)
      if (Math.random() < 0.5) {
        prenotazione.note = `Prenotazione aggiornata - ${uuidv4().substring(0, 8)}`;
        makeRequest('PUT', `${baseUrl}/prenotazioni/${randomIntBetween(1, 100)}`, token, prenotazione, updatePrenotazioneTrend);
      }
    }
  } else if (userType === 'operator') {
    // Azioni tipiche di un operatore
    makeRequest('GET', `${baseUrl}/lotti`, token, null, getLottiTrend);
    sleep(randomIntBetween(1, 2));
    
    // Crea un nuovo lotto (40% delle volte)
    if (Math.random() < 0.4) {
      makeRequest('POST', `${baseUrl}/lotti`, token, generateRandomLotto(), createLottoTrend);
    }
    
    // Gestisci le prenotazioni
    makeRequest('GET', `${baseUrl}/prenotazioni?page=1&limit=50`, token, null, getPrenotazioniTrend);
  } else {
    // Utente normale - principalmente lettura
    makeRequest('GET', `${baseUrl}/lotti?page=${randomIntBetween(1, 5)}&limit=10`, token, null, getLottiTrend);
    sleep(randomIntBetween(1, 3));
    
    // Visualizza un lotto specifico
    makeRequest('GET', `${baseUrl}/lotti/${randomIntBetween(1, 100)}`, token, null, getSingleLottoTrend);
  }
  
  concurrentUsers.add(-1);
}

// ========== REPORT E RIEPILOGO ==========

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
    'console.log': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'test_results/performance_test_summary.html': htmlReport(data)
  };
} 