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
  // Token valido ottenuto dalla chiamata di login precedente
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoiYWRtaW5AcmVmb29kLm9yZyIsIm5vbWUiOiJBZG1pbiIsImNvZ25vbWUiOiJSZUZvb2RBcHAiLCJydW9sbyI6IkFtbWluaXN0cmF0b3JlIiwidGlwb191dGVudGUiOm51bGwsImp0aSI6ImZkMmY5ZGViOTcyYzM3ODg0ZDlmMGVjMDEyNzhkNWFhIiwiaWF0IjoxNzQzNTIwODA4LCJleHAiOjE3NDM1MjQ0MDh9.qgDs9NPWTStd_l8osvFv65JEj8rz20B-hc4OZ0rxAlU';
}

// Funzione principale
export default function() {
  const token = getToken();
  
  // Esegui la chiamata GET /lotti con il percorso corretto /api/v1/
  const res = http.get(`http://localhost:3000/api/v1/lotti?page=1&limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Verifica che la risposta sia corretta (status code 200)
  check(res, {
    'Status code è 200 o 304': (r) => r.status === 200 || r.status === 304,
    'Response ha proprietà data': (r) => {
      try {
        // Se lo status è 304, il corpo potrebbe essere vuoto
        return r.status === 304 || JSON.parse(r.body).data !== undefined;
      } catch (e) {
        return false;
      }
    },
    'Response ha proprietà status': (r) => {
      try {
        // Se lo status è 304, il corpo potrebbe essere vuoto
        return r.status === 304 || JSON.parse(r.body).status === 'success';
      } catch (e) {
        return false;
      }
    }
  });
  
  // Traccia la durata della chiamata
  getLottiTrend.add(res.timings.duration);
  
  // Traccia gli errori (anche 304 è una risposta valida)
  if (res.status !== 200 && res.status !== 304) {
    console.error(`ERRO[${__VU}] Errore nella chiamata GET /lotti: ${res.status} ${res.body}`);
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  
  // Pausa tra le chiamate per evitare sovraccarichi
  sleep(1);
} 