-- ******************************************************************
-- SCRIPT DI CREAZIONE FUNZIONI PERSONALIZZATE PER SQLITE
-- ******************************************************************
-- Questo script implementa funzioni SQL estese per SQLite
-- utilizzabili nel database ReFood

-- SQLite supporta funzioni definite dall'utente attraverso estensioni C
-- Questo script contiene esempi di dichiarazioni di funzioni e come caricarle
-- Nota: è necessario compilare le estensioni prima di poterle utilizzare

-- ******************************************************************
-- FUNZIONI PER L'IMPATTO AMBIENTALE
-- ******************************************************************

/*
Istruzioni per l'uso:

1. Salvare il seguente codice in un file sorgente C chiamato "environmental_impact.c":

#include <sqlite3ext.h>
SQLITE_EXTENSION_INIT1

// Calcola la CO2 risparmiata in kg basata sulla tipologia e quantità di cibo
static void co2SavedFunction(sqlite3_context *context, int argc, sqlite3_value **argv)
{
    if (argc != 3) {
        sqlite3_result_error(context, "La funzione co2_saved richiede 3 parametri: tipo di cibo, quantità, unità di misura", -1);
        return;
    }
    
    const char *foodType = (const char*)sqlite3_value_text(argv[0]);
    double quantity = sqlite3_value_double(argv[1]);
    const char *unit = (const char*)sqlite3_value_text(argv[2]);
    
    double co2Factor = 0.0;
    double unitConversion = 1.0;
    
    // Fattori di emissione CO2 per tipo di cibo (kg CO2 / kg cibo)
    if (strcmp(foodType, "Carne") == 0) {
        co2Factor = 27.0;  // Fattore alto per carne rossa
    } else if (strcmp(foodType, "Latticini") == 0) {
        co2Factor = 13.5;  // Fattore medio-alto per latticini
    } else if (strcmp(foodType, "Cereali") == 0) {
        co2Factor = 2.7;   // Fattore basso per cereali
    } else if (strcmp(foodType, "Verdura") == 0) {
        co2Factor = 2.0;   // Fattore basso per verdure
    } else if (strcmp(foodType, "Frutta") == 0) {
        co2Factor = 1.1;   // Fattore molto basso per frutta
    } else {
        co2Factor = 3.0;   // Valore di default
    }
    
    // Conversione unità di misura
    if (strcmp(unit, "kg") == 0) {
        unitConversion = 1.0;
    } else if (strcmp(unit, "g") == 0) {
        unitConversion = 0.001;
    } else if (strcmp(unit, "lt") == 0 || strcmp(unit, "l") == 0) {
        unitConversion = 1.0;  // Assumiamo densità 1kg/l
    } else if (strcmp(unit, "pz") == 0) {
        unitConversion = 0.2;  // Assumiamo 200g per pezzo
    }
    
    double result = quantity * unitConversion * co2Factor;
    sqlite3_result_double(context, result);
}

// Calcola il valore economico stimato basato su tipo e quantità
static void economicValueFunction(sqlite3_context *context, int argc, sqlite3_value **argv)
{
    if (argc != 3) {
        sqlite3_result_error(context, "La funzione economic_value richiede 3 parametri: tipo di cibo, quantità, unità di misura", -1);
        return;
    }
    
    const char *foodType = (const char*)sqlite3_value_text(argv[0]);
    double quantity = sqlite3_value_double(argv[1]);
    const char *unit = (const char*)sqlite3_value_text(argv[2]);
    
    double priceFactor = 0.0;
    double unitConversion = 1.0;
    
    // Prezzi medi per tipo di cibo (€/kg)
    if (strcmp(foodType, "Carne") == 0) {
        priceFactor = 12.0;
    } else if (strcmp(foodType, "Latticini") == 0) {
        priceFactor = 8.0;
    } else if (strcmp(foodType, "Cereali") == 0) {
        priceFactor = 3.0;
    } else if (strcmp(foodType, "Verdura") == 0) {
        priceFactor = 2.5;
    } else if (strcmp(foodType, "Frutta") == 0) {
        priceFactor = 3.5;
    } else {
        priceFactor = 5.0;
    }
    
    // Conversione unità di misura
    if (strcmp(unit, "kg") == 0) {
        unitConversion = 1.0;
    } else if (strcmp(unit, "g") == 0) {
        unitConversion = 0.001;
    } else if (strcmp(unit, "lt") == 0 || strcmp(unit, "l") == 0) {
        unitConversion = 1.0;
    } else if (strcmp(unit, "pz") == 0) {
        unitConversion = 0.2;
    }
    
    double result = quantity * unitConversion * priceFactor;
    sqlite3_result_double(context, result);
}

// Calcola giorni rimanenti fino alla scadenza
static void daysToExpiryFunction(sqlite3_context *context, int argc, sqlite3_value **argv)
{
    if (argc != 1) {
        sqlite3_result_error(context, "La funzione days_to_expiry richiede 1 parametro: data di scadenza (YYYY-MM-DD)", -1);
        return;
    }
    
    const char *expiryDate = (const char*)sqlite3_value_text(argv[0]);
    
    sqlite3_stmt *stmt;
    sqlite3 *db = sqlite3_context_db_handle(context);
    
    const char *sql = "SELECT julianday(?) - julianday('now')";
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, 0);
    
    if (rc != SQLITE_OK) {
        sqlite3_result_error(context, "Errore nella preparazione della query", -1);
        return;
    }
    
    sqlite3_bind_text(stmt, 1, expiryDate, -1, SQLITE_TRANSIENT);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        double days = sqlite3_column_double(stmt, 0);
        sqlite3_result_double(context, days);
    } else {
        sqlite3_result_error(context, "Errore nel calcolo dei giorni", -1);
    }
    
    sqlite3_finalize(stmt);
}

// Punto di ingresso dell'estensione
int sqlite3_environmentalimpact_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi)
{
    SQLITE_EXTENSION_INIT2(pApi);
    sqlite3_create_function(db, "co2_saved", 3, SQLITE_UTF8, NULL, co2SavedFunction, NULL, NULL);
    sqlite3_create_function(db, "economic_value", 3, SQLITE_UTF8, NULL, economicValueFunction, NULL, NULL);
    sqlite3_create_function(db, "days_to_expiry", 1, SQLITE_UTF8, NULL, daysToExpiryFunction, NULL, NULL);
    return SQLITE_OK;
}

2. Compilare l'estensione (su sistemi Linux):
   gcc -fPIC -shared environmental_impact.c -o environmental_impact.so

3. Caricare l'estensione in SQLite:
   .load ./environmental_impact.so

4. Utilizzare le funzioni nelle query:
   SELECT co2_saved('Carne', 2.5, 'kg') AS co2_risparmiata;
   SELECT economic_value('Verdura', 10, 'kg') AS valore_economico;
   SELECT days_to_expiry('2023-12-31') AS giorni_alla_scadenza;
*/

-- ******************************************************************
-- FUNZIONI PER GESTIONE DATE E TEMPO
-- ******************************************************************

/*
Istruzioni per l'uso:

1. Salvare il seguente codice in un file sorgente C chiamato "date_utils.c":

#include <sqlite3ext.h>
#include <time.h>
#include <string.h>
SQLITE_EXTENSION_INIT1

// Restituisce il nome del giorno della settimana per una data
static void weekdayNameFunction(sqlite3_context *context, int argc, sqlite3_value **argv)
{
    if (argc != 1) {
        sqlite3_result_error(context, "La funzione weekday_name richiede 1 parametro: data (YYYY-MM-DD)", -1);
        return;
    }
    
    const char *dateStr = (const char*)sqlite3_value_text(argv[0]);
    
    sqlite3_stmt *stmt;
    sqlite3 *db = sqlite3_context_db_handle(context);
    
    const char *sql = "SELECT strftime('%w', ?)";
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, 0);
    
    if (rc != SQLITE_OK) {
        sqlite3_result_error(context, "Errore nella preparazione della query", -1);
        return;
    }
    
    sqlite3_bind_text(stmt, 1, dateStr, -1, SQLITE_TRANSIENT);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        int dayNum = sqlite3_column_int(stmt, 0);
        const char *weekdays[] = {"Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"};
        sqlite3_result_text(context, weekdays[dayNum], -1, SQLITE_TRANSIENT);
    } else {
        sqlite3_result_error(context, "Errore nel calcolo del giorno", -1);
    }
    
    sqlite3_finalize(stmt);
}

// Formatta una data in italiano
static void formatDateItFunction(sqlite3_context *context, int argc, sqlite3_value **argv)
{
    if (argc != 1) {
        sqlite3_result_error(context, "La funzione format_date_it richiede 1 parametro: data (YYYY-MM-DD)", -1);
        return;
    }
    
    const char *dateStr = (const char*)sqlite3_value_text(argv[0]);
    
    sqlite3_stmt *stmt;
    sqlite3 *db = sqlite3_context_db_handle(context);
    
    const char *sql = "SELECT strftime('%d/%m/%Y', ?)";
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, 0);
    
    if (rc != SQLITE_OK) {
        sqlite3_result_error(context, "Errore nella preparazione della query", -1);
        return;
    }
    
    sqlite3_bind_text(stmt, 1, dateStr, -1, SQLITE_TRANSIENT);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        const char *formattedDate = (const char*)sqlite3_column_text(stmt, 0);
        sqlite3_result_text(context, formattedDate, -1, SQLITE_TRANSIENT);
    } else {
        sqlite3_result_error(context, "Errore nella formattazione della data", -1);
    }
    
    sqlite3_finalize(stmt);
}

// Calcola l'età in giorni di un record
static void recordAgeFunction(sqlite3_context *context, int argc, sqlite3_value **argv)
{
    if (argc != 1) {
        sqlite3_result_error(context, "La funzione record_age richiede 1 parametro: data creazione (YYYY-MM-DD HH:MM:SS)", -1);
        return;
    }
    
    const char *creationDate = (const char*)sqlite3_value_text(argv[0]);
    
    sqlite3_stmt *stmt;
    sqlite3 *db = sqlite3_context_db_handle(context);
    
    const char *sql = "SELECT round((julianday('now') - julianday(?)) * 24 * 60) / (24 * 60)";
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, 0);
    
    if (rc != SQLITE_OK) {
        sqlite3_result_error(context, "Errore nella preparazione della query", -1);
        return;
    }
    
    sqlite3_bind_text(stmt, 1, creationDate, -1, SQLITE_TRANSIENT);
    
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        double days = sqlite3_column_double(stmt, 0);
        sqlite3_result_double(context, days);
    } else {
        sqlite3_result_error(context, "Errore nel calcolo dell'età", -1);
    }
    
    sqlite3_finalize(stmt);
}

// Punto di ingresso dell'estensione
int sqlite3_dateutils_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi)
{
    SQLITE_EXTENSION_INIT2(pApi);
    sqlite3_create_function(db, "weekday_name", 1, SQLITE_UTF8, NULL, weekdayNameFunction, NULL, NULL);
    sqlite3_create_function(db, "format_date_it", 1, SQLITE_UTF8, NULL, formatDateItFunction, NULL, NULL);
    sqlite3_create_function(db, "record_age", 1, SQLITE_UTF8, NULL, recordAgeFunction, NULL, NULL);
    return SQLITE_OK;
}

2. Compilare l'estensione (su sistemi Linux):
   gcc -fPIC -shared date_utils.c -o date_utils.so

3. Caricare l'estensione in SQLite:
   .load ./date_utils.so

4. Utilizzare le funzioni nelle query:
   SELECT weekday_name('2023-05-01') AS giorno_settimana;
   SELECT format_date_it('2023-05-01') AS data_italiana;
   SELECT record_age('2022-01-01 12:00:00') AS eta_giorni;
*/

-- ******************************************************************
-- FUNZIONI PER GESTIONE JSON E ANALISI DATI
-- ******************************************************************

/*
Istruzioni per l'uso:

1. Salvare il seguente codice in un file sorgente C chiamato "json_analysis.c":

#include <sqlite3ext.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>
SQLITE_EXTENSION_INIT1

// Funzione di supporto per l'estrazione di valori da JSON
static char* findJsonValue(const char* json, const char* key) {
    char searchKey[256];
    sprintf(searchKey, "\"%s\":", key);
    
    char* keyPos = strstr(json, searchKey);
    if (!keyPos) return NULL;
    
    keyPos += strlen(searchKey);
    while (isspace((unsigned char)*keyPos)) keyPos++;
    
    if (*keyPos == '"') {
        // Value is a string
        char* start = keyPos + 1;
        char* end = strchr(start, '"');
        if (!end) return NULL;
        
        int len = end - start;
        char* result = (char*)malloc(len + 1);
        strncpy(result, start, len);
        result[len] = '\0';
        return result;
    } else if (isdigit((unsigned char)*keyPos) || *keyPos == '-') {
        // Value is a number
        char* start = keyPos;
        char* end = start;
        while (isdigit((unsigned char)*end) || *end == '.' || *end == '-' || *end == 'e' || *end == 'E' || *end == '+') end++;
        
        int len = end - start;
        char* result = (char*)malloc(len + 1);
        strncpy(result, start, len);
        result[len] = '\0';
        return result;
    } else if (strncmp(keyPos, "true", 4) == 0) {
        return strdup("true");
    } else if (strncmp(keyPos, "false", 5) == 0) {
        return strdup("false");
    } else if (strncmp(keyPos, "null", 4) == 0) {
        return strdup("null");
    }
    
    return NULL;
}

// Estrae un valore da un campo JSON
static void jsonExtractFunction(sqlite3_context *context, int argc, sqlite3_value **argv) {
    if (argc != 2) {
        sqlite3_result_error(context, "La funzione json_extract_custom richiede 2 parametri: JSON e chiave", -1);
        return;
    }
    
    const char* json = (const char*)sqlite3_value_text(argv[0]);
    const char* key = (const char*)sqlite3_value_text(argv[1]);
    
    if (!json || !key) {
        sqlite3_result_null(context);
        return;
    }
    
    char* value = findJsonValue(json, key);
    if (value) {
        sqlite3_result_text(context, value, -1, SQLITE_TRANSIENT);
        free(value);
    } else {
        sqlite3_result_null(context);
    }
}

// Conta il numero di transizioni di stato in un JSON
static void countStatusTransitionsFunction(sqlite3_context *context, int argc, sqlite3_value **argv) {
    if (argc != 1) {
        sqlite3_result_error(context, "La funzione count_status_transitions richiede 1 parametro: JSON", -1);
        return;
    }
    
    const char* json = (const char*)sqlite3_value_text(argv[0]);
    
    if (!json) {
        sqlite3_result_int(context, 0);
        return;
    }
    
    // Cerchiamo le occorrenze della chiave "da" nel JSON, che indica una transizione
    // Questa è una semplificazione; un parser JSON vero e proprio sarebbe più accurato
    const char* transition = "\"da\":";
    const char* pos = json;
    int count = 0;
    
    while ((pos = strstr(pos, transition)) != NULL) {
        count++;
        pos += strlen(transition);
    }
    
    sqlite3_result_int(context, count);
}

// Punto di ingresso dell'estensione
int sqlite3_jsonanalysis_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi) {
    SQLITE_EXTENSION_INIT2(pApi);
    sqlite3_create_function(db, "json_extract_custom", 2, SQLITE_UTF8, NULL, jsonExtractFunction, NULL, NULL);
    sqlite3_create_function(db, "count_status_transitions", 1, SQLITE_UTF8, NULL, countStatusTransitionsFunction, NULL, NULL);
    return SQLITE_OK;
}

2. Compilare l'estensione (su sistemi Linux):
   gcc -fPIC -shared json_analysis.c -o json_analysis.so

3. Caricare l'estensione in SQLite:
   .load ./json_analysis.so

4. Utilizzare le funzioni nelle query:
   SELECT json_extract_custom('{"nome":"Mario","eta":30}', 'nome') AS nome;
   SELECT count_status_transitions('{"transizioni":[{"da":"Verde","a":"Arancione"},{"da":"Arancione","a":"Rosso"}]}') AS num_transizioni;
*/

-- ******************************************************************
-- SCRIPT DI ESEMPIO PER UTILIZZARE LE FUNZIONI CUSTOM IN QUERY
-- ******************************************************************

-- Nota: queste query sono esempi di come utilizzare le funzioni custom una volta caricate
-- Devono essere adattate allo schema specifico e alle esigenze del database ReFood

/*
-- Esempio 1: Calcolo dell'impatto ambientale dei lotti
SELECT 
    l.id, 
    l.prodotto, 
    l.quantita, 
    l.unita_misura,
    co2_saved(l.prodotto, l.quantita, l.unita_misura) AS co2_risparmiata_kg,
    economic_value(l.prodotto, l.quantita, l.unita_misura) AS valore_economico_eur,
    days_to_expiry(l.data_scadenza) AS giorni_alla_scadenza
FROM Lotti l
WHERE l.stato = 'Verde';

-- Esempio 2: Formattazione date e calcolo giorni della settimana
SELECT 
    l.id, 
    l.prodotto, 
    format_date_it(l.data_scadenza) AS data_scadenza_it,
    weekday_name(l.data_scadenza) AS giorno_scadenza,
    record_age(l.creato_il) AS eta_giorni
FROM Lotti l
ORDER BY l.data_scadenza;

-- Esempio 3: Analisi delle transizioni di stato nelle prenotazioni
SELECT 
    p.id,
    p.stato,
    count_status_transitions(p.transizioni_stato) AS numero_cambi_stato,
    json_extract_custom(p.transizioni_stato, 'transizioni[0].da') AS stato_iniziale,
    json_extract_custom(p.transizioni_stato, 'transizioni[0].timestamp') AS timestamp_primo_cambio
FROM Prenotazioni p
WHERE p.transizioni_stato IS NOT NULL
ORDER BY numero_cambi_stato DESC;
*/

-- ******************************************************************
-- NOTE SULL'INSTALLAZIONE E L'USO DELLE ESTENSIONI SQLITE
-- ******************************************************************

/*
Per utilizzare queste funzioni personalizzate in un'applicazione ReFood:

1. Compilare le estensioni come indicato sopra.

2. Installare le estensioni nella directory appropriate dell'applicazione.

3. All'avvio dell'applicazione o alla connessione al database, caricare le estensioni:
   - In SQLite shell:
     .load ./environmental_impact.so
     .load ./date_utils.so
     .load ./json_analysis.so
   
   - In una applicazione JavaScript/Node.js:
     db.exec("SELECT load_extension('./environmental_impact.so')");
     db.exec("SELECT load_extension('./date_utils.so')");
     db.exec("SELECT load_extension('./json_analysis.so')");
   
   - In una applicazione Python:
     conn = sqlite3.connect('refood.db')
     conn.enable_load_extension(True)
     conn.load_extension('./environmental_impact.so')
     conn.load_extension('./date_utils.so')
     conn.load_extension('./json_analysis.so')

4. Verificare l'installazione eseguendo query di test:
   SELECT co2_saved('Verdura', 10, 'kg') AS test;

Note sulla sicurezza:
- Il caricamento di estensioni può presentare rischi di sicurezza
- Assicurarsi che le estensioni provengano da fonti attendibili
- Limitare i privilegi dell'applicazione che carica le estensioni
- Considerare l'uso di SQLite compilato con opzioni di sicurezza avanzate
*/ 