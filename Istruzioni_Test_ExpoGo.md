# Test su Dispositivi Fisici tramite Expo Go

## Requisiti di rete

Quando si testa l'applicazione Refood su dispositivi fisici utilizzando Expo Go, è **fondamentale** che:

1. **Il dispositivo mobile e il computer che esegue il backend siano collegati alla stessa rete Wi-Fi**
   - Le connessioni non possono attraversare reti diverse senza configurazioni avanzate
   - Se usi una VPN sul computer o sul dispositivo, potrebbe impedire la connessione

2. **I firewall non blocchino le connessioni**
   - Verifica che il firewall del computer consenta le connessioni in entrata sulla porta 3000 (porta predefinita del backend)
   - Assicurati che anche la porta 19000 (Expo) sia accessibile

## Configurazione dell'Indirizzo IP

Per consentire al dispositivo di raggiungere il server backend, devi configurare correttamente l'indirizzo IP nel file `refood-mobile/src/config/constants.ts`:

```typescript
// Imposta qui l'IP del tuo computer nella rete locale per i test su dispositivi fisici
const LOCAL_IP = '192.168.22.160'; // Modifica questo valore con il tuo IP locale
```

### Come trovare il tuo indirizzo IP locale:

#### Su Windows:
1. Apri il prompt dei comandi (cmd)
2. Digita `ipconfig` e premi Invio
3. Cerca la voce "IPv4 Address" nella sezione della tua connessione di rete attiva

#### Su macOS:
1. Vai su Preferenze di Sistema > Rete
2. Seleziona la tua connessione attiva (Wi-Fi o Ethernet)
3. L'indirizzo IP viene mostrato nel pannello di destra

#### Su Linux:
1. Apri un terminale
2. Esegui `ip addr` o `ifconfig`
3. Cerca l'indirizzo IP dopo "inet" per la tua interfaccia di rete

## Procedura di Test

1. **Avvia il backend sul tuo computer**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Avvia l'applicazione mobile**:
   ```bash
   cd refood-mobile
   npx expo start
   ```

3. **Sul dispositivo mobile**:
   - Assicurati che il dispositivo sia connesso alla stessa rete Wi-Fi del computer
   - Apri l'app Expo Go
   - Puoi scansionare il QR code mostrato nel terminale o nella pagina web di Expo
   - In alternativa, puoi inserire manualmente l'URL di sviluppo (es. `exp://192.168.22.160:19000`)

4. **Verifica della connessione**:
   - Se l'app si avvia ma mostra errori di connessione al backend, controlla nuovamente:
     - Che l'indirizzo IP sia configurato correttamente in `constants.ts`
     - Che entrambi i dispositivi siano sulla stessa rete
     - Che il backend sia in esecuzione
     - Che non ci siano firewall che bloccano la connessione

## Risoluzione dei Problemi Comuni

### Errore "Network request failed"
- Verifica che l'indirizzo IP nel file `constants.ts` sia corretto
- Prova a effettuare un ping dal computer al dispositivo e viceversa
- Assicurati che il backend sia in esecuzione e risponda correttamente

### Dispositivo non trova il server Expo
- Verifica che il computer e il dispositivo siano sulla stessa rete
- Disattiva temporaneamente il firewall per verificare se è la causa del problema
- Prova a utilizzare la modalità "Tunnel" in Expo anziché "LAN"

### Il QR code non funziona
- Assicurati di utilizzare l'app Expo Go più recente
- Prova a inserire manualmente l'URL di sviluppo nell'app Expo Go
- Verifica che la fotocamera abbia l'autorizzazione per scansionare i codici QR 