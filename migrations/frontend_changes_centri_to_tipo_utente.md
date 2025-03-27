# Guida per aggiornare il frontend dopo la migrazione da Centri a Tipo_Utente

Dopo aver aggiornato il database e il codice del backend per rinominare "Centri" in "Tipo_Utente", è necessario aggiornare anche il frontend per riflettere questi cambiamenti.

## File da modificare

### App Mobile (React Native)

- `refood-mobile/app/(tabs)/centri.tsx` (potrebbe essere rinominato in `/tipi-utente.tsx`)
- `refood-mobile/app/centri/_layout.tsx` (potrebbe essere rinominato in `/tipi-utente/_layout.tsx`)
- `refood-mobile/app/centri/[id].tsx` (potrebbe essere rinominato in `/tipi-utente/[id].tsx`)
- Tutti i componenti che interagiscono con i centri

### App Web (React)

- `src/screens/CentriScreen.tsx` (potrebbe essere rinominato in `TipiUtenteScreen.tsx`)
- Altri componenti web che fanno riferimento a "Centri"

## Modifiche da apportare

### 1. Rinominare i tipi e le interfacce

```typescript
// Prima
interface Centro {
  id: number;
  nome: string;
  tipo: string;
  indirizzo: string;
  telefono: string;
  email: string;
}

// Dopo
interface TipoUtente {
  id: number;
  tipo: string; // 'Privato', 'Canale sociale', 'centro riciclo'
  indirizzo: string;
  telefono: string;
  email: string;
}
```

### 2. Aggiornare le chiamate API

```typescript
// Prima
const loadCentri = async () => {
  try {
    const response = await api.get('/api/v1/centri');
    setCentri(response.data);
  } catch (error) {
    console.error('Errore nel caricamento centri:', error);
  }
};

// Dopo
const loadTipiUtente = async () => {
  try {
    const response = await api.get('/api/v1/tipi-utente');
    setTipiUtente(response.data);
  } catch (error) {
    console.error('Errore nel caricamento tipi utente:', error);
  }
};
```

### 3. Aggiornare Variabili e Stati

```typescript
// Prima
const [centri, setCentri] = useState<Centro[]>([]);
const [filtroCentri, setFiltroCentri] = useState<string>('');

// Dopo
const [tipiUtente, setTipiUtente] = useState<TipoUtente[]>([]);
const [filtroTipiUtente, setFiltroTipiUtente] = useState<string>('');
```

### 4. Aggiornare testo nell'interfaccia utente

```tsx
// Prima
<Appbar.Content title="Gestione Centri" />
<Paragraph>Centri</Paragraph>
<Title style={styles.sectionTitle}>I Miei Centri</Title>

// Dopo
<Appbar.Content title="Gestione Tipi Utente" />
<Paragraph>Tipi Utente</Paragraph>
<Title style={styles.sectionTitle}>I Miei Tipi Utente</Title>
```

### 5. Aggiornare i percorsi delle route

Se utilizzate React Navigation o un sistema di routing simile, aggiornare i percorsi delle route:

```javascript
// Prima
navigation.navigate('centri/123');

// Dopo
navigation.navigate('tipi-utente/123');
```

### 6. Aggiornare le etichette dei tipi

Aggiornare i valori delle etichette nei componenti di selezione o visualizzazione:

```typescript
// Prima
const tipiCentro = [
  { label: 'Distribuzione', value: 'Distribuzione' },
  { label: 'Sociale', value: 'Sociale' },
  { label: 'Riciclaggio', value: 'Riciclaggio' }
];

// Dopo
const tipiUtente = [
  { label: 'Privato', value: 'Privato' },
  { label: 'Canale sociale', value: 'Canale sociale' },
  { label: 'Centro riciclo', value: 'centro riciclo' }
];
```

## Considerazioni semantiche

Importante: Valutate se, nel contesto dell'applicazione, il termine "Tipo Utente" sia adeguato dal punto di vista dell'esperienza utente. Potrebbe essere più appropriato usare termini come "Organizzazioni", "Entità" o "Partner" nell'interfaccia utente, anche se internamente la tabella del database si chiama "Tipo_Utente".

In questo caso, potreste:
1. Mantenere termini più familiari e intuitivi nell'interfaccia grafica
2. Mappare questi termini alla nuova struttura nel codice

## Suggerimento per l'automazione

È possibile utilizzare comandi come `grep` e `sed` per automatizzare molte di queste modifiche:

```bash
# Trova tutte le occorrenze di "centri" nei file del frontend
grep -r "centri" --include="*.tsx" ./refood-mobile/app/
grep -r "Centri" --include="*.tsx" ./refood-mobile/app/

# Sostituisci con "tipiUtente" e "TipiUtente"
find ./refood-mobile/app -type f -name "*.tsx" -exec sed -i 's/centri/tipiUtente/g' {} \;
find ./refood-mobile/app -type f -name "*.tsx" -exec sed -i 's/Centri/TipiUtente/g' {} \;
```

## Controlli finali

Dopo le modifiche, verificare attentamente:

1. La corretta visualizzazione di tutte le pagine
2. Il funzionamento di tutte le interazioni utente
3. I messaggi di errore e il feedback utente
4. La coerenza semantica in tutta l'applicazione

Eseguire test approfonditi su tutte le funzionalità relative ai tipi utente. 