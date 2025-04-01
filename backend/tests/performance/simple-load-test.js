import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Metriche personalizzate
const getLottiTrend = new Trend('get_lotti_duration');
const errorRate = new Rate('error_rate');

// Configurazione del test
export const options = {
  vus: 3,              // 3 utenti virtuali - numero basso per non sovraccaricare il sistema
  duration: '15s',     // Durata breve per i test
  thresholds: {
    'get_lotti_duration': ['p(95)<500'],  // 95% delle richieste sotto 500ms
    'error_rate': ['rate<0.1'],          // Tasso di errore inferiore al 10%
  },
};

// Funzione per ottenere un token di autenticazione
function getToken() {
  const credentials = {
    email: 'test@example.com',
    password: 'password123'
  };
  
  // Per semplicità, invece di chiamare l'endpoint di login, generiamo un token statico
  // che potrebbe non essere valido nel tuo sistema
  // In un test reale, dovresti chiamare l'endpoint di login
  
  // Questo token è solo per esempio e non funzionerà nel tuo sistema
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicnVvbG8iOiJPcGVyYXRvcmUiLCJ0aXBvX3V0ZW50ZSI6MSwiaWF0IjoxNjE5NjEzNjIwLCJleHAiOjE2MTk3MDAwMjB9.THIS_IS_JUST_A_SAMPLE_TOKEN';
}

// Funzione principale
export default function() {
  // Per i test reali dovresti usare un token valido
  const token = getToken();
  
  // Esegui test sul endpoint GET /lotti
  group('API Lotti', () => {
    // Test dell'endpoint GET /lotti
    const startTime = new Date();
    const res = http.get('http://localhost:3000/api/lotti?page=1&limit=10', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const duration = new Date() - startTime;
    
    // Registra la durata
    getLottiTrend.add(duration);
    
    // Verifica che la risposta sia valida
    const success = check(res, {
      'status è 200': (r) => r.status === 200,
      'risposta ha formato corretto': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'success' && Array.isArray(body.data.lotti);
        } catch (e) {
          return false;
        }
      }
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`Errore nella chiamata GET /lotti: ${res.status} ${res.body}`);
    }
  });
  
  // Pausa tra le iterazioni
  sleep(1);
} 