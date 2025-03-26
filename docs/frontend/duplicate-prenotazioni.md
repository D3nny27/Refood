# Documentazione: Gestione delle Prenotazioni Duplicate

## Introduzione

La gestione delle prenotazioni duplicate è un aspetto critico dell'applicazione ReFood, progettato per garantire che ogni lotto alimentare possa essere assegnato a un solo centro sociale alla volta, evitando conflitti e confusione nella distribuzione degli alimenti.

## Problematica

Senza una gestione appropriata delle prenotazioni duplicate, potrebbero verificarsi diversi problemi:

1. **Conflitti di assegnazione**: Più centri sociali potrebbero pensare di aver prenotato lo stesso lotto
2. **Sprechi alimentari**: Lotti potrebbero non essere distribuiti efficacemente
3. **Esperienza utente compromessa**: Frustrazione quando gli utenti scoprono che un lotto già prenotato non è disponibile
4. **Carico extra sul sistema backend**: Gestione di prenotazioni conflittuali e risoluzione manuale

## Implementazione della soluzione

### Verifica a più livelli

Il sistema implementa controlli a più livelli per prevenire prenotazioni duplicate:

#### 1. Verifica dello stato del lotto

```typescript
// Verifica se il lotto è in uno stato prenotabile
if (lotto.stato && lotto.stato !== 'Verde' && lotto.stato !== 'Disponibile') {
  return {
    success: false,
    message: `Impossibile prenotare questo lotto: non è disponibile (stato "${lotto.stato}").`,
    error: { status: 400, message: 'Lotto non disponibile per la prenotazione' }
  };
}
```

#### 2. Verifica delle prenotazioni esistenti di altri utenti

```typescript
// Richiedi tutte le prenotazioni attive
const prenotazioniResponse = await axios.get(`${API_URL}/prenotazioni`, {
  headers,
  params: { lotto_id },
  timeout: 10000
});

// Filtra per stati che indicano prenotazione attiva
const prenotazioniAttive = prenotazioniEsistenti.filter((p: any) => {
  const statiAttivi = ['Prenotato', 'InAttesa', 'Confermato', 'InTransito'];
  return statiAttivi.includes(p.stato);
});

// Se ci sono prenotazioni attive di altri utenti
if (prenotazioniAttive.length > 0 && 
    !prenotazioniAttive.some(p => p.centro_ricevente_id === centro_utente_id)) {
  return {
    success: false,
    message: `Questo lotto risulta già prenotato da un altro centro.`,
    error: { 
      status: 400, 
      message: 'Lotto già prenotato',
      prenotazioniEsistenti: prenotazioniAttive.map((p: any) => ({ 
        id: p.id, 
        stato: p.stato,
        centro: p.centro_ricevente_nome || `Centro #${p.centro_ricevente_id}`
      }))
    }
  };
}
```

#### 3. Verifica delle prenotazioni duplicate dell'utente corrente

```typescript
// Verifica se l'utente corrente ha già una prenotazione attiva
const prenotazioneUtenteCorrente = prenotazioniAttive.find((p: any) => 
  p.centro_ricevente_id === centro_utente_id
);

if (prenotazioneUtenteCorrente) {
  return {
    success: false,
    message: `Hai già una prenotazione attiva per questo lotto (Stato: ${prenotazioneUtenteCorrente.stato}).`,
    error: { 
      status: 400, 
      message: 'Prenotazione duplicata',
      prenotazioneEsistente: { 
        id: prenotazioneUtenteCorrente.id, 
        stato: prenotazioneUtenteCorrente.stato 
      }
    }
  };
}
```

#### 4. Controlli lato UI

Oltre ai controlli nel service, l'interfaccia utente implementa verifiche e feedback specifici:

```typescript
// Gestione specifica degli errori di prenotazione
if (result.error?.message === 'Prenotazione duplicata') {
  // Caso di prenotazione duplicata dello stesso utente
  Toast.show({
    type: 'info',
    text1: 'Prenotazione già esistente',
    text2: `Hai già una prenotazione attiva per questo lotto (Stato: ${result.error.prenotazioneEsistente?.stato}).`,
    visibilityTime: 4000,
  });
} else if (result.error?.message === 'Lotto già prenotato') {
  // Caso di lotto già prenotato da altri
  Toast.show({
    type: 'error',
    text1: 'Lotto non disponibile',
    text2: 'Questo lotto è già stato prenotato da un altro centro',
    visibilityTime: 3000,
  });
  
  // Ricarica i lotti per rimuoverlo dalla lista
  await loadLotti(true);
}
```

## Flusso completo del sistema

1. **Visualizzazione lotti disponibili**: 
   - I lotti già prenotati vengono filtrati dalla lista visualizzata
   - Solo i lotti effettivamente disponibili sono mostrati

2. **Tentativo di prenotazione**:
   - L'utente seleziona un lotto e richiede la prenotazione
   - UI mostra una modale di conferma con data prevista di ritiro

3. **Verifica preliminare**:
   - L'app controlla lato client se l'utente ha i permessi necessari
   - Verifica che i dati inseriti siano validi

4. **Invio richiesta di prenotazione**:
   - La richiesta viene inviata al server tramite `prenotaLotto()`

5. **Verifiche lato server**:
   - Verifica dello stato del lotto (deve essere disponibile)
   - Verifica delle prenotazioni esistenti
   - Verifica di prenotazioni duplicate dell'utente corrente

6. **Gestione della risposta**:
   - **Successo**: Prenotazione registrata, UI aggiornata, notifica inviata
   - **Errore - Lotto non disponibile**: Messaggio di errore, lista aggiornata
   - **Errore - Prenotazione duplicata**: Messaggio informativo con dettagli sulla prenotazione esistente
   - **Errore - Altri problemi**: Messaggio generico, opzione per riprovare

7. **Aggiornamento in tempo reale**:
   - Tramite WebSocket, altri utenti ricevono aggiornamenti sulla disponibilità del lotto
   - Le liste vengono aggiornate in tempo reale per tutti gli utenti

## Tipi di errori e messaggi

Il sistema gestisce diversi tipi di errori con messaggi specifici:

| Tipo di errore | Codice | Messaggio utente | Azione UI |
|----------------|--------|------------------|-----------|
| Lotto non disponibile | 400 | "Impossibile prenotare questo lotto: non è disponibile (stato 'X')." | Toast errore + ricarica lista |
| Prenotazione duplicata | 400 | "Hai già una prenotazione attiva per questo lotto (Stato: 'X')." | Toast informativo |
| Lotto già prenotato | 400 | "Questo lotto risulta già prenotato da un altro centro." | Toast errore + ricarica lista |
| Centro ID mancante | - | "Inserisci il codice del tuo centro per completare la prenotazione" | Mostra campo input |
| Errore di rete | - | "Si è verificato un errore. Riprova più tardi." | Toast errore + opzione retry |

## Best Practices

1. **Ricaricamento immediato**: Dopo una prenotazione fallita dovuta a disponibilità, ricaricare immediatamente la lista
2. **Messaggi chiari**: Fornire messaggi specifici per ogni tipo di errore
3. **Distinzione visiva**: Usare colori e icone diverse per distinguere i tipi di errore (rosso per errori bloccanti, arancione per avvisi)
4. **Prevenzione proattiva**: Filtrare i lotti non disponibili prima di mostrarli all'utente
5. **Tentativi multipli**: Evitare che l'utente possa ripetere la stessa prenotazione se già fallita

## Diagramma del flusso di prenotazione

```
┌───────────────┐     ┌────────────────┐     ┌───────────────┐
│               │     │                │     │               │
│     UI        │────►│  prenotaLotto  │────►│  Backend API  │
│               │     │                │     │               │
└───────┬───────┘     └────────┬───────┘     └───────┬───────┘
        │                      │                     │
        ▼                      ▼                     ▼
┌───────────────┐     ┌────────────────┐     ┌───────────────┐
│               │     │                │     │               │
│  Input utente │     │Verifica duplicati    │Salvataggio DB │
│               │     │                │     │               │
└───────────────┘     └────────────────┘     └───────────────┘
```

## Conclusione

La gestione delle prenotazioni duplicate implementata in ReFood garantisce che:

1. Gli utenti ricevano feedback immediato e chiaro
2. I lotti siano assegnati in modo equo ed efficiente
3. Si evitino conflitti di prenotazione e conseguente spreco di risorse
4. L'esperienza utente rimanga fluida e trasparente
5. Il sistema mantenga l'integrità dei dati

Questa implementazione riduce significativamente le richieste di supporto e migliora l'efficienza complessiva della distribuzione alimentare. 