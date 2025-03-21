# Refood Mobile App

App mobile React Native per il progetto Refood, una piattaforma contro lo spreco alimentare.

## Caratteristiche Principali

- **Gestione Utenti:** Login, logout e gestione sessioni
- **Dashboard Personalizzata:** Visualizzazione dati in base al ruolo dell'utente
- **Gestione Lotti:** Visualizzazione, creazione e modifica dei lotti di cibo
- **Prenotazioni:** Sistema per prenotare e gestire il ciclo di vita dei lotti
- **Statistiche:** Visualizzazione dell'impatto ambientale ed economico

## Ruoli Utente

- **Operatore:** Gestisce l'inserimento e la modifica dei lotti
- **Amministratore:** Accesso completo a statistiche e gestione utenti
- **Centro Sociale:** Prenota e gestisce i lotti disponibili
- **Centro Riciclaggio:** Gestisce i lotti in stato rosso per il riciclaggio

## Tecnologie Utilizzate

- **React Native:** Framework per lo sviluppo mobile
- **Expo:** Toolchain per semplificare lo sviluppo
- **React Navigation:** Navigazione tra schermate
- **React Native Paper:** Componenti UI
- **AsyncStorage:** Persistenza dati locale
- **Axios:** Client HTTP per le chiamate API

## Prerequisiti

- Node.js (versione 12 o superiore)
- npm o yarn
- Expo CLI

## Installazione

1. Clona il repository:
   ```
   git clone https://github.com/username/refood-mobile.git
   cd refood-mobile
   ```

2. Installa le dipendenze:
   ```
   npm install
   ```

3. Avvia l'app:
   ```
   npm start
   ```

4. Scansiona il codice QR con l'app Expo Go (Android) o la fotocamera (iOS)

## Connessione al Backend

L'app si connette al backend tramite API REST. Per impostazione predefinita, utilizza l'indirizzo `http://10.0.2.2:3000/api/v1` per l'emulatore Android.

Per dispositivi fisici o iOS, modifica l'URL nel file `src/services/authService.ts` con l'indirizzo IP del tuo computer.

## Struttura del Progetto

```
refood-mobile/
├── App.js                  # Punto di ingresso dell'applicazione
├── app.json                # Configurazione Expo
├── package.json            # Dipendenze del progetto
├── assets/                 # Risorse statiche (immagini, font)
└── src/
    ├── components/         # Componenti riutilizzabili
    ├── context/            # Context API per la gestione dello stato
    ├── navigation/         # Configurazione della navigazione
    ├── screens/            # Schermate dell'applicazione
    ├── services/           # Servizi per l'interazione con il backend
    ├── types/              # Definizioni TypeScript
    └── utils/              # Funzioni di utilità
```

## Flusso di Utilizzo

1. **Login:** L'utente accede all'app con le sue credenziali
2. **Dashboard:** Visualizza i dati rilevanti per il suo ruolo
3. **Funzionalità:**
   - Operatore: Inserisce nuovi lotti, monitora le prenotazioni
   - Centro Sociale: Prenota lotti disponibili
   - Centro Riciclaggio: Gestisce lotti in stato rosso
   - Amministratore: Visualizza statistiche, gestisce utenti

## Note per lo Sviluppo

- L'app è configurata per utilizzare TypeScript
- Il tema principale dell'app è verde (#4CAF50) in linea con i valori di sostenibilità
- Il sistema di autenticazione utilizza JWT con refresh token
- Le credenziali di accesso sono memorizzate in modo sicuro con AsyncStorage 