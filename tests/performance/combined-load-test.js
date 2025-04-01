import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Metriche personalizzate principali
const apiDurationTrend = new Trend('api_request_duration');
const errorRate = new Rate('error_rate');
const requestCounter = new Counter('total_requests');
const concurrentUsers = new Gauge('concurrent_users');

// Metriche per endpoint specifici
const getLottiTrend = new Trend('endpoint_get_lotti');
const createPrenotazioneTrend = new Trend('endpoint_create_prenotazione');
const getNotificheTrend = new Trend('endpoint_get_notifiche');

// Configurazione del test
export const options = {
  scenarios: {
    // Scenario 1: Navigazione utente standard
    standard_navigation: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { duration: '30s', target: 5 },    // ramp-up a 5 req/sec in 30s
        { duration: '1m', target: 5 },     // mantieni 5 req/sec per 1 minuto
        { duration: '30s', target: 10 },   // aumenta a 10 req/sec
        { duration: '1m', target: 10 },    // mantieni 10 req/sec per 1 minuto
        { duration: '30s', target: 0 },    // ramp-down a 0
      ],
      exec: 'mixedUserJourney'
    },
    
    // Scenario 2: Test di resistenza a basso carico costante
    endurance_test: {
      executor: 'constant-vus',
      vus: 2,
      duration: '4m',
      gracefulStop: '5s',
      exec: 'browseLotti',
      tags: { scenario: 'endurance' }
    },
    
    // Scenario 3: Test di picco di carico (simulazione ore di punta)
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },    // ramp-up rapido a 20 utenti
        { duration: '30s', target: 20 },    // mantieni 20 utenti per 30s
        { duration: '10s', target: 0 },     // ramp-down
      ],
      gracefulStop: '5s',
      exec: 'peakLoadScenario',
      tags: { scenario: 'peak_load' }
    }
  },
  thresholds: {
    'api_request_duration': ['p(95)<1000'],     // 95% di tutte le richieste sotto 1s
    'endpoint_get_lotti': ['p(95)<600'],        // 95% delle richieste di lotti sotto 600ms
    'endpoint_create_prenotazione': ['p(95)<800'], // 95% delle prenotazioni sotto 800ms
    'endpoint_get_notifiche': ['p(95)<500'],    // 95% delle richieste di notifiche sotto 500ms
    'error_rate': ['rate<0.05'],                // Tasso di errore inferiore al 5%
    'http_req_duration': ['p(99)<2000'],        // 99% di tutte le richieste HTTP sotto 2s
  },
};

// Ottiene un token di autenticazione basato sul tipo di utente
function getToken(userType = 'normal') {
  // In un test reale, dovresti fare login e ottenere un token valido
  // Per questo esempio, utilizziamo token finti
  
  if (userType === 'operator') {
    return 'eyJhbG...OPERATOR_TOKEN';
  } else if (userType === 'beneficiary') {
    return 'eyJhbG...BENEFICIARY_TOKEN';
  } else {
    return 'eyJhbG...USER_TOKEN';
  }
}

// Genera dati casuali per un nuovo lotto
function generateRandomLotto() {
  const products = ['Mele', 'Pane', 'Pasta', 'Latte', 'Verdure', 'Uova', 'Formaggio'];
  const states = ['Verde', 'Giallo', 'Arancione'];
  
  return {
    prodotto: products[randomIntBetween(0, products.length - 1)],
    quantita: randomIntBetween(1, 50),
    data_creazione: new Date().toISOString(),
    stato: states[randomIntBetween(0, states.length - 1)],
    descrizione: `Lotto di test generato automaticamente ${new Date().toISOString()}`,
    id_categoria: randomIntBetween(1, 5)
  };
}

// Funzione che simula il comportamento di un utente normale
export function browseLotti() {
  concurrentUsers.add(1);
  
  const token = getToken('normal');
  const baseUrl = 'http://localhost:3000/api';
  
  group('Browse Lotti', () => {
    // Lista dei lotti con paginazione
    const pageSize = 10;
    const page = randomIntBetween(1, 3);
    
    const startTime = new Date();
    const res = http.get(`${baseUrl}/lotti?page=${page}&limit=${pageSize}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const duration = new Date() - startTime;
    
    apiDurationTrend.add(duration);
    getLottiTrend.add(duration);
    requestCounter.add(1);
    
    const success = check(res, {
      'Stato 200 per lista lotti': (r) => r.status === 200,
      'Formato risposta corretto': (r) => {
        try {
          return JSON.parse(r.body) !== undefined;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`Errore nella chiamata GET /lotti: ${res.status}`);
    }
  });
  
  sleep(randomIntBetween(1, 3));
  
  concurrentUsers.add(-1);
}

// Funzione che simula un percorso utente completo e misto
export function mixedUserJourney() {
  concurrentUsers.add(1);
  
  // Determina casualmente il tipo di utente per questo journey
  const userTypes = ['normal', 'beneficiary', 'operator'];
  const userType = userTypes[randomIntBetween(0, userTypes.length - 1)];
  const token = getToken(userType);
  const baseUrl = 'http://localhost:3000/api';
  
  // Naviga i lotti (tutti gli utenti lo fanno)
  group('Browse Lotti Journey', () => {
    const res = http.get(`${baseUrl}/lotti?page=1&limit=10`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    apiDurationTrend.add(new Date() - new Date(res.timings.started));
    getLottiTrend.add(new Date() - new Date(res.timings.started));
    requestCounter.add(1);
    
    check(res, {
      'Navigazione lotti riuscita': (r) => r.status === 200
    });
    
    sleep(randomIntBetween(1, 2));
    
    // Controlla le notifiche (tutti gli utenti)
    const notificheStartTime = new Date();
    const notificheRes = http.get(`${baseUrl}/notifiche`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const notificheDuration = new Date() - notificheStartTime;
    
    apiDurationTrend.add(notificheDuration);
    getNotificheTrend.add(notificheDuration);
    requestCounter.add(1);
    
    check(notificheRes, {
      'Controllo notifiche riuscito': (r) => r.status === 200
    });
  });
  
  // Se è un beneficiario, controlla le sue prenotazioni
  if (userType === 'beneficiary') {
    group('Beneficiary Actions', () => {
      // Controlla le prenotazioni esistenti
      http.get(`${baseUrl}/prenotazioni`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      requestCounter.add(1);
      
      sleep(randomIntBetween(0.5, 1.5));
      
      // 30% di probabilità di effettuare una nuova prenotazione
      if (Math.random() < 0.3) {
        // Prima ottieni un lotto disponibile
        const lottiRes = http.get(`${baseUrl}/lotti?stato=Verde&page=1&limit=5`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        requestCounter.add(1);
        
        try {
          const lottiBody = JSON.parse(lottiRes.body);
          if (lottiBody.lotti && lottiBody.lotti.length > 0) {
            const lottoId = lottiBody.lotti[0].id;
            
            // Crea la prenotazione
            const prenotazionePayload = {
              id_lotto: lottoId,
              quantita: randomIntBetween(1, 3),
              note: `Prenotazione test: ${new Date().toISOString()}`
            };
            
            const createStartTime = new Date();
            const createRes = http.post(`${baseUrl}/prenotazioni`, JSON.stringify(prenotazionePayload), {
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            const createDuration = new Date() - createStartTime;
            
            apiDurationTrend.add(createDuration);
            createPrenotazioneTrend.add(createDuration);
            requestCounter.add(1);
            
            check(createRes, {
              'Creazione prenotazione riuscita': (r) => r.status === 201
            });
          }
        } catch (e) {
          // Ignora errori di parsing
        }
      }
    });
  }
  
  // Se è un operatore, potrebbe creare o aggiornare lotti
  if (userType === 'operator') {
    group('Operator Actions', () => {
      // 20% di probabilità di creare un nuovo lotto
      if (Math.random() < 0.2) {
        const newLotto = generateRandomLotto();
        
        http.post(`${baseUrl}/lotti`, JSON.stringify(newLotto), {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        requestCounter.add(1);
      }
    });
  }
  
  sleep(randomIntBetween(1, 3));
  
  concurrentUsers.add(-1);
}

// Funzione che simula un carico elevato (mix di operazioni)
export function peakLoadScenario() {
  concurrentUsers.add(1);
  
  // Determina casualmente il tipo di utente
  const userType = Math.random() < 0.7 ? 'normal' : 
                  (Math.random() < 0.5 ? 'beneficiary' : 'operator');
  const token = getToken(userType);
  const baseUrl = 'http://localhost:3000/api';
  
  // Tutti fanno richieste di lettura frequenti
  for (let i = 0; i < randomIntBetween(2, 4); i++) {
    const endpoints = [
      `/lotti?page=${randomIntBetween(1, 3)}&limit=10`,
      '/utenti/me',
      '/notifiche'
    ];
    
    const randomEndpoint = endpoints[randomIntBetween(0, endpoints.length - 1)];
    
    http.get(`${baseUrl}${randomEndpoint}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    requestCounter.add(1);
    
    sleep(randomIntBetween(0.2, 0.8));
  }
  
  // Azioni specifiche per tipo di utente
  if (userType === 'beneficiary') {
    // Crea una prenotazione con un ID di lotto casuale (finto)
    const prenotazionePayload = {
      id_lotto: randomIntBetween(1, 10),
      quantita: randomIntBetween(1, 3),
      note: `Prenotazione peak load test: ${new Date().toISOString()}`
    };
    
    http.post(`${baseUrl}/prenotazioni`, JSON.stringify(prenotazionePayload), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    requestCounter.add(1);
  } else if (userType === 'operator') {
    // Crea un nuovo lotto
    const newLotto = generateRandomLotto();
    
    http.post(`${baseUrl}/lotti`, JSON.stringify(newLotto), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    requestCounter.add(1);
  }
  
  sleep(randomIntBetween(0.5, 2));
  
  concurrentUsers.add(-1);
}

// Genera un report HTML al termine del test
export function handleSummary(data) {
  return {
    "summary.html": htmlReport(data),
  };
} 