# Documentazione del Database Refood

## Descrizione delle Tabelle e Relazioni del Database Refood

Questo documento fornisce una descrizione dettagliata delle tabelle e delle relazioni presenti nel database dell'app Refood, progettata per contrastare lo spreco alimentare lungo le filiere agroalimentari.

### Modello di Circolarità

Il database è stato progettato seguendo i principi dell'economia circolare, con l'obiettivo di tracciare il percorso dei prodotti alimentari invenduti dalla loro identificazione fino alla destinazione finale, sia essa il consumo o il riciclo.

## Relazioni Principali

### 1. Ciclo di Vita dei Lotti

Il ciclo di vita di un lotto alimentare nel sistema Refood segue il seguente percorso:

1. **Inserimento**: Un utente (Operatore) inserisce un nuovo lotto specificando il centro di origine
2. **Classificazione**: Il lotto viene associato a una o più categorie di prodotti
3. **Monitoraggio**: Il sistema monitora automaticamente lo stato del lotto in base alla data di scadenza
4. **Prenotazione**: Un centro sociale può prenotare il lotto
5. **Trasporto**: Il lotto prenotato viene trasportato al centro ricevente
6. **Consumo/Trasformazione**: Se il lotto non viene consumato in tempo, può essere trasformato (compost, biogas, ecc.)

### 2. Sistema di Monitoraggio e Notifiche

Il sistema include un meccanismo automatico di monitoraggio che:

- Aggiorna lo stato dei lotti (Verde → Arancione → Rosso) in base alla vicinanza alla scadenza
- Genera notifiche per gli utenti in base a cambiamenti di stato o eventi rilevanti
- Traccia ogni modifica di stato nei log per scopi di audit e tracciabilità

### 3. Misurazione dell'Impatto

Un aspetto fondamentale del sistema è la misurazione dell'impatto ambientale ed economico:

- La tabella `ImpattoCO2` registra i dati ambientali per ogni lotto salvato
- Le `StatisticheSettimanali` aggregano i dati per centro e periodo
- I `Trasporti` tracciano l'impatto della logistica

## Casi d'Uso Principali

### Caso d'Uso 1: Inserimento e Gestione di un Lotto

1. Un operatore di un centro di distribuzione accede al sistema
2. Inserisce un nuovo lotto di prodotti alimentari in eccedenza
3. Specifica categoria, quantità, data di scadenza e altre informazioni
4. Il sistema calcola automaticamente lo stato del lotto
5. Le notifiche vengono inviate ai centri sociali registrati nella zona

### Caso d'Uso 2: Prenotazione e Ritiro

1. Un operatore di un centro sociale visualizza i lotti disponibili
2. Prenota un lotto specifico
3. Organizza il trasporto (o riceve informazioni sul trasporto organizzato dal centro di origine)
4. Effettua il ritiro
5. Conferma la ricezione del lotto nel sistema

### Caso d'Uso 3: Gestione del Fine Vita

1. Il sistema identifica lotti prossimi alla scadenza (stato Rosso)
2. Notifica i centri di riciclaggio
3. Un centro di riciclaggio può prenotare il lotto
4. Dopo la consegna, il centro registra la trasformazione (tipo, quantità, ecc.)
5. Il sistema calcola e registra l'impatto ambientale positivo della trasformazione

## Aspetti Critici del Database

### Consistenza dei Dati

- La struttura garantisce la consistenza dei dati attraverso foreign key e check constraint
- Il tracciamento delle modifiche di stato permette di mantenere l'integrità storica

### Ottimizzazione per Dispositivi Mobili

- Indici strategicamente posizionati per ottimizzare le query più frequenti
- La struttura è ottimizzata per l'uso con SQLite su dispositivi mobili

### Scalabilità

- Il database è progettato per gestire efficacemente anche grandi volumi di dati
- L'organizzazione in tabelle separate permette future espansioni senza modificare lo schema esistente

## Miglioramenti Futuri

1. **Integrazione IoT**: Predisposizione per l'integrazione di dati da sensori (temperatura, umidità) per il monitoraggio dei lotti durante il trasporto
2. **Blockchain**: Possibile evoluzione verso un sistema di tracciabilità basato su blockchain
3. **Analisi Predittiva**: Strutture dati aggiuntive per supportare algoritmi di predizione dello spreco alimentare

## Appendice: Diagramma ER Completo

Il diagramma Entity-Relationship completo è disponibile nel file `er_diagram.mermaid` nella radice del repository.
