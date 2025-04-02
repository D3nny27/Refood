### Test su Dispositivi Fisici con Expo Go

Quando esegui il test dell'applicazione su dispositivi fisici tramite Expo Go, ci sono due requisiti fondamentali da considerare:

#### 1. Requisiti di Rete

**IMPORTANTE**: Il dispositivo mobile e il computer che esegue il backend **DEVONO** essere collegati alla stessa rete Wi-Fi.

- Le connessioni tra reti diverse non funzioneranno senza configurazioni di rete avanzate
- Se stai utilizzando VPN su uno dei dispositivi, potresti riscontrare problemi di connettività
- Verifica che eventuali firewall non blocchino le connessioni sulle porte 3000 (backend) e 19000 (Expo)

#### 2. Configurazione dell'Indirizzo IP

Per consentire al dispositivo di comunicare con il server backend, è necessario configurare correttamente l'indirizzo IP nel file `refood-mobile/src/config/constants.ts`:

```typescript
// refood-mobile/src/config/constants.ts
// Imposta qui l'IP del tuo computer nella rete locale per i test su dispositivi fisici
const LOCAL_IP = '192.168.22.160'; // <-- MODIFICA QUESTO VALORE con il tuo IP locale
```

##### Come trovare l'indirizzo IP del tuo computer:

- **Windows**: Esegui `ipconfig` nel prompt dei comandi e cerca "IPv4 Address"
- **macOS**: Vai in Preferenze di Sistema > Rete e guarda l'indirizzo IP
- **Linux**: Esegui `ip addr` o `ifconfig` nel terminale e cerca l'indirizzo dopo "inet"

Se l'app si avvia ma non riesce a connettersi al backend, verifica sempre:
- Che l'indirizzo IP sia configurato correttamente
- Che entrambi i dispositivi siano sulla stessa rete
- Che il backend sia in esecuzione
- Che non ci siano firewall che bloccano la connessione

Puoi anche utilizzare la modalità "Tunnel" di Expo (anziché "LAN") per bypassare alcuni problemi di rete, ma questo potrebbe rallentare la connessione. 