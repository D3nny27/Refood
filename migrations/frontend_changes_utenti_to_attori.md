# Guida per aggiornare il frontend dopo la migrazione da Utenti a Attori

Dopo aver aggiornato il database e il codice del backend per rinominare "Utenti" in "Attori", è necessario aggiornare anche il frontend per riflettere questi cambiamenti.

## File da modificare

### App Mobile (React Native)

- `refood-mobile/app/(tabs)/profilo.tsx`
- `refood-mobile/app/(tabs)/index.tsx`
- `refood-mobile/app/admin/_layout.tsx`
- `refood-mobile/app/admin/utenti/index.tsx` (potrebbe essere rinominato in `/admin/attori/index.tsx`)
- `refood-mobile/app/admin/utenti/_layout.tsx` (potrebbe essere rinominato in `/admin/attori/_layout.tsx`)
- `refood-mobile/app/admin/centri/operatori.tsx`

### App Web (React)

- `src/screens/HomeScreen.tsx`
- Altri componenti web che fanno riferimento a "Utenti"

## Modifiche da apportare

### 1. Rinominare i tipi e le interfacce

```typescript
// Prima
interface Utente {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
}

// Dopo
interface Attore {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
}
```

### 2. Aggiornare le chiamate API

```typescript
// Prima
const loadUtenti = async () => {
  try {
    const response = await api.get('/api/v1/utenti');
    setUtenti(response.data);
  } catch (error) {
    console.error('Errore nel caricamento utenti:', error);
  }
};

// Dopo
const loadAttori = async () => {
  try {
    const response = await api.get('/api/v1/attori');
    setAttori(response.data);
  } catch (error) {
    console.error('Errore nel caricamento attori:', error);
  }
};
```

### 3. Aggiornare Variabili e Stati

```typescript
// Prima
const [utenti, setUtenti] = useState<Utente[]>([]);
const [filteredUtenti, setFilteredUtenti] = useState<Utente[]>([]);

// Dopo
const [attori, setAttori] = useState<Attore[]>([]);
const [filteredAttori, setFilteredAttori] = useState<Attore[]>([]);
```

### 4. Aggiornare testo nell'interfaccia utente

```tsx
// Prima
<Appbar.Content title="Gestione Utenti" />
<Paragraph>Utenti</Paragraph>
<Title style={styles.sectionTitle}>I Miei Utenti</Title>

// Dopo
<Appbar.Content title="Gestione Attori" />
<Paragraph>Attori</Paragraph>
<Title style={styles.sectionTitle}>I Miei Attori</Title>
```

### 5. Aggiornare i percorsi delle route

Se utilizzate React Navigation o un sistema di routing simile, aggiornare i percorsi delle route:

```javascript
// Prima
navigation.navigate('admin/utenti');

// Dopo
navigation.navigate('admin/attori');
```

## Considerazioni semantiche

Importante: Valutate se, nel contesto dell'applicazione, il termine "Attori" sia adeguato dal punto di vista dell'esperienza utente. Potrebbe essere più appropriato usare termini come "Utenti", "Personale", "Operatori" nell'interfaccia utente, anche se internamente la tabella del database si chiama "Attori".

In questo caso, potreste:
1. Mantenere i termini familiari all'utente nell'interfaccia grafica
2. Mappare questi termini alla nuova struttura nel codice

## Suggerimento per l'automazione

È possibile utilizzare comandi come `grep` e `sed` per automatizzare molte di queste modifiche:

```bash
# Trova tutte le occorrenze di "utenti" nei file del frontend
grep -r "utenti" --include="*.tsx" ./refood-mobile/app/
grep -r "Utenti" --include="*.tsx" ./refood-mobile/app/

# Sostituisci con "attori" e "Attori"
find ./refood-mobile/app -type f -name "*.tsx" -exec sed -i 's/utenti/attori/g' {} \;
find ./refood-mobile/app -type f -name "*.tsx" -exec sed -i 's/Utenti/Attori/g' {} \;
```

## Controlli finali

Dopo le modifiche, verificare attentamente:

1. La corretta visualizzazione di tutte le pagine
2. Il funzionamento di tutte le interazioni utente
3. I messaggi di errore e il feedback utente
4. La coerenza semantica in tutta l'applicazione

Eseguire test approfonditi su tutte le funzionalità relative agli utenti/attori.

## Nota sui contenuti localizzati

Se l'applicazione supporta più lingue, assicurarsi di aggiornare anche i file di localizzazione (i18n) con i nuovi termini. 