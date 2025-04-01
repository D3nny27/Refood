# Test di Performance Refood

Questo modulo contiene gli script e gli strumenti necessari per eseguire test di performance sull'applicazione Refood.

## Requisiti

- Node.js v14 o superiore
- k6 (https://k6.io) per i test di carico
- Un'istanza dell'API Refood in esecuzione su http://localhost:3000
- Un'istanza dell'interfaccia web Refood in esecuzione su http://localhost:4200 (richiesto solo per i test con browser)

## Installazione

1. Installare le dipendenze:

```bash
cd tests/performance
npm install
```

2. Installare k6 seguendo le istruzioni sul sito ufficiale:
   - Linux: https://k6.io/docs/getting-started/installation/#linux
   - macOS: https://k6.io/docs/getting-started/installation/#macos
   - Windows: https://k6.io/docs/getting-started/installation/#windows

## Struttura

- `run-all-tests.sh` - Script principale per eseguire tutti i test
- `test-data-generator.js` - Script per generare dati di test realistici
- `realistic-journey.js` - Test del percorso utente realistico (API e browser)
- `critical-paths-test.js` - Test dei percorsi critici dell'applicazione
- `results/` - Directory dove vengono salvati i risultati dei test

## Esecuzione dei test

### Eseguire tutti i test

Per eseguire tutti i test di performance in sequenza:

```bash
./run-all-tests.sh
```

Questo script:
1. Verifica i prerequisiti necessari
2. Genera dati di test realistici
3. Esegue il test del percorso utente realistico
4. Esegue il test dei percorsi critici
5. Genera un report comparativo dei risultati

### Eseguire singoli test

Per eseguire solo specifici test:

```bash
# Test del percorso utente realistico
npm run test:realistic

# Test dei percorsi critici
npm run test:critical

# Solo generazione dati di test
npm run generate-data
```

## Test inclusi

### Realistic Journey

Simula un percorso utente realistico attraverso l'applicazione, includendo:
- Autenticazione
- Navigazione tra i lotti
- Ricerca di prodotti
- Creazione di prenotazioni
- Gestione del profilo utente

Include sia test API che browser per una copertura completa.

### Critical Paths

Testa i percorsi critici dell'applicazione con carichi elevati per identificare potenziali colli di bottiglia:
- Autenticazione e gestione token
- Ricerca e filtro dei lotti
- Creazione e gestione delle prenotazioni

## Interpretazione dei risultati

I risultati dei test vengono salvati nella directory `results/` con i seguenti file:
- Report HTML per una visualizzazione grafica
- File JSON per analisi personalizzate
- Report comparativo che mostra variazioni rispetto ai test precedenti

Le metriche principali da analizzare sono:
- Tempi di risposta medi e p95/p99
- Tasso di errore
- Throughput (richieste al secondo)
- Utilizzo risorse server (se disponibile)

## Personalizzazione

Gli script di test possono essere personalizzati modificando i seguenti parametri:
- Numero di utenti virtuali
- Durata dei test
- Soglie di performance
- Scenari specifici da testare

Per modificare i parametri, editare le sezioni `options` nei rispettivi file di test.

## Risoluzione dei problemi

- **Errore di connessione all'API**: Verificare che il server Refood sia in esecuzione su http://localhost:3000
- **Errore di connessione al browser**: Verificare che l'interfaccia web sia in esecuzione su http://localhost:4200
- **Errore durante la generazione dei dati**: Verificare le credenziali di accesso e i permessi necessari 