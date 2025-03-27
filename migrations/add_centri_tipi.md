# Migrazione per aggiungere la tabella CentriTipi

Questa migrazione risolve un problema di compatibilità nel database riguardante i centri e le loro tipologie.

## Problema risolto

Il codice backend faceva riferimento a una tabella `CentriTipi` e a un campo `tipo_id` nella tabella `Centri` che non esistevano nel database. Questo causava errori quando si tentava di accedere agli endpoint relativi ai centri.

## Modifiche applicate

Questo script di migrazione:

1. **Crea una nuova tabella** `CentriTipi` con i campi:
   - `id`: Identificatore numerico (chiave primaria)
   - `descrizione`: Nome descrittivo del tipo di centro
   - `codice`: Codice univoco del tipo di centro
   - `creato_il`: Data di creazione del record

2. **Inizializza la tabella** con i tre tipi esistenti:
   - Distribuzione (DISTRIB)
   - Sociale (SOCIAL)
   - Riciclaggio (RECYCLE)

3. **Aggiunge un nuovo campo** `tipo_id` alla tabella `Centri`

4. **Popola il campo** `tipo_id` mappando i valori esistenti del campo `tipo` ai corrispondenti ID nella tabella `CentriTipi`

5. **Crea un indice** sulla colonna `tipo_id` per ottimizzare le prestazioni delle query

## Istruzioni per applicare la migrazione

La migrazione è stata applicata con il seguente comando:

```bash
sqlite3 database/refood.db < migrations/add_centri_tipi.sql
```

## Note importanti

- Questa migrazione **non rimuove il campo `tipo`** dalla tabella `Centri`, mantenendo così la retrocompatibilità
- Non è stato aggiunto il vincolo di chiave esterna tra `Centri.tipo_id` e `CentriTipi.id` perché SQLite non supporta l'aggiunta di vincoli di chiave esterna con ALTER TABLE
- Se fosse necessario un vincolo di chiave esterna completo, sarebbe richiesta una migrazione più complessa che ricrea interamente la tabella `Centri`

## Verifica della migrazione

È stato verificato che dopo questa migrazione gli endpoint relativi ai centri funzionano correttamente. 