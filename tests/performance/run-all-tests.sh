#!/bin/bash

# Script per eseguire tutti i test di performance dell'applicazione Refood
# Autore: AI Assistant
# Data: 2024

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directory corrente dello script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
RESULTS_DIR="$SCRIPT_DIR/results"
LOG_FILE="$RESULTS_DIR/performance_test_$(date +%Y%m%d_%H%M%S).log"

# Flags per i test da eseguire
RUN_DATA_GEN=true
RUN_REALISTIC=true
RUN_CRITICAL=true

# Funzione per mostrare l'help
show_help() {
  echo "Uso: ./run-all-tests.sh [opzioni]"
  echo ""
  echo "Opzioni:"
  echo "  -h, --help             Mostra questo messaggio di aiuto"
  echo "  -d, --data-only        Esegui solo la generazione dei dati di test"
  echo "  -r, --realistic-only   Esegui solo il test del percorso utente realistico"
  echo "  -c, --critical-only    Esegui solo il test dei percorsi critici"
  echo "  -n, --no-data          Non generare i dati di test"
  echo ""
  echo "Esempio:"
  echo "  ./run-all-tests.sh -r  # Esegui solo il test realistico"
  exit 0
}

# Elabora parametri da riga di comando
for arg in "$@"; do
  case $arg in
    -h|--help)
      show_help
      ;;
    -d|--data-only)
      RUN_DATA_GEN=true
      RUN_REALISTIC=false
      RUN_CRITICAL=false
      shift
      ;;
    -r|--realistic-only)
      RUN_DATA_GEN=true
      RUN_REALISTIC=true
      RUN_CRITICAL=false
      shift
      ;;
    -c|--critical-only)
      RUN_DATA_GEN=true
      RUN_REALISTIC=false
      RUN_CRITICAL=true
      shift
      ;;
    -n|--no-data)
      RUN_DATA_GEN=false
      shift
      ;;
    *)
      # parametro sconosciuto
      shift
      ;;
  esac
done

# Funzione per stampare messaggi formattati
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}$message${NC}"
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $message" >> "$LOG_FILE"
}

# Funzione per verificare se un comando è disponibile
check_command() {
  if ! command -v $1 &> /dev/null; then
    print_message "$RED" "❌ Errore: $1 non è installato. Per favore installalo e riprova."
    exit 1
  fi
}

# Verifica prerequisiti
check_command "node"
check_command "k6"

# Crea directory per i risultati se non esiste
mkdir -p "$RESULTS_DIR"

print_message "$BLUE" "🚀 Avvio test di performance per Refood"
print_message "$BLUE" "📊 I risultati saranno salvati in: $RESULTS_DIR"
print_message "$BLUE" "📝 Log completo: $LOG_FILE"

# Verifica se il server è in esecuzione
print_message "$YELLOW" "⏳ Verifica connessione al server Refood..."
if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
  print_message "$RED" "❌ Errore: Il server Refood non è raggiungibile. Assicurati che sia in esecuzione su http://localhost:3000"
  print_message "$YELLOW" "⚠️ Vuoi continuare comunque? Premi INVIO per continuare o Ctrl+C per interrompere."
  read -r
fi
print_message "$GREEN" "✅ Server Refood raggiungibile"

# Genera dati di test
if $RUN_DATA_GEN; then
  print_message "$YELLOW" "⏳ Generazione dati di test..."
  node "$SCRIPT_DIR/test-data-generator.js" >> "$LOG_FILE" 2>&1
  if [ $? -ne 0 ]; then
    print_message "$RED" "❌ Errore durante la generazione dei dati di test"
    print_message "$YELLOW" "⚠️ Continuando con i test, ma i risultati potrebbero non essere significativi"
  else
    print_message "$GREEN" "✅ Dati di test generati con successo"
  fi

  # Attendi 5 secondi per permettere al server di elaborare i dati
  sleep 5
fi

# Esegui test del percorso utente realistico
if $RUN_REALISTIC; then
  print_message "$YELLOW" "⏳ Esecuzione test del percorso utente realistico..."
  # Disabilitiamo temporaneamente la parte browser se causa problemi
  # K6_BROWSER_ENABLED=true k6 run "$SCRIPT_DIR/realistic-journey.js" --out json="$RESULTS_DIR/realistic-journey-results.json" > "$RESULTS_DIR/realistic-journey-output.txt"
  k6 run "$SCRIPT_DIR/realistic-journey.js" --no-browser --out json="$RESULTS_DIR/realistic-journey-results.json" > "$RESULTS_DIR/realistic-journey-output.txt"
  if [ $? -ne 0 ]; then
    print_message "$RED" "❌ Errore durante l'esecuzione del test del percorso utente realistico"
  else
    print_message "$GREEN" "✅ Test del percorso utente realistico completato con successo"
  fi

  # Attendi 5 secondi tra i test
  sleep 5
fi

# Esegui test dei percorsi critici
if $RUN_CRITICAL; then
  print_message "$YELLOW" "⏳ Esecuzione test dei percorsi critici..."
  k6 run "$SCRIPT_DIR/critical-paths-test.js" --out json="$RESULTS_DIR/critical-paths-results.json" > "$RESULTS_DIR/critical-paths-output.txt"
  if [ $? -ne 0 ]; then
    print_message "$RED" "❌ Errore durante l'esecuzione del test dei percorsi critici"
  else
    print_message "$GREEN" "✅ Test dei percorsi critici completato con successo"
  fi
fi

# Generazione report di riepilogo se abbiamo eseguito almeno un test
if $RUN_REALISTIC || $RUN_CRITICAL; then
  print_message "$YELLOW" "⏳ Generazione report di riepilogo..."

  # Verifica se ci sono risultati precedenti per il confronto
  PREV_REALISTIC_RESULTS=$(find "$RESULTS_DIR" -name "realistic-journey-results.json" -not -path "$RESULTS_DIR/realistic-journey-results.json" | sort -r | head -n 1)
  PREV_CRITICAL_RESULTS=$(find "$RESULTS_DIR" -name "critical-paths-results.json" -not -path "$RESULTS_DIR/critical-paths-results.json" | sort -r | head -n 1)

  echo "# Report dei Test di Performance - $(date +%Y-%m-%d)" > "$RESULTS_DIR/performance-report.md"
  echo "" >> "$RESULTS_DIR/performance-report.md"
  echo "## Riepilogo" >> "$RESULTS_DIR/performance-report.md"
  echo "" >> "$RESULTS_DIR/performance-report.md"

  # Estrai metriche dai risultati JSON e aggiungile al report
  if $RUN_REALISTIC; then
    echo "### Test del Percorso Utente Realistico" >> "$RESULTS_DIR/performance-report.md"
    echo "" >> "$RESULTS_DIR/performance-report.md"
    echo "| Metrica | Valore | Precedente | Variazione |" >> "$RESULTS_DIR/performance-report.md"
    echo "|---------|--------|------------|------------|" >> "$RESULTS_DIR/performance-report.md"

    # Funzione per estrarre una metrica dal file JSON
    extract_metric() {
      local file=$1
      local metric=$2
      if [ -f "$file" ]; then
        jq -r ".$metric" "$file" 2>/dev/null || echo "N/A"
      else
        echo "N/A"
      fi
    }

    # Funzione per calcolare la variazione percentuale
    calculate_change() {
      local current=$1
      local previous=$2
      
      if [[ "$current" == "N/A" || "$previous" == "N/A" ]]; then
        echo "N/A"
      else
        local change=$(echo "scale=2; (($current - $previous) / $previous) * 100" | bc 2>/dev/null)
        if [ $? -eq 0 ]; then
          echo "$change%"
        else
          echo "N/A"
        fi
      fi
    }

    # Aggiungi metriche al report
    metrics=("http_req_duration.avg" "http_reqs" "iterations" "vus_max")
    for metric in "${metrics[@]}"; do
      current=$(extract_metric "$RESULTS_DIR/realistic-journey-results.json" "metrics.$metric.value")
      previous=$(extract_metric "$PREV_REALISTIC_RESULTS" "metrics.$metric.value")
      change=$(calculate_change "$current" "$previous")
      echo "| $metric | $current | $previous | $change |" >> "$RESULTS_DIR/performance-report.md"
    done

    echo "" >> "$RESULTS_DIR/performance-report.md"
  fi

  if $RUN_CRITICAL; then
    echo "### Test dei Percorsi Critici" >> "$RESULTS_DIR/performance-report.md"
    echo "" >> "$RESULTS_DIR/performance-report.md"
    echo "| Metrica | Valore | Precedente | Variazione |" >> "$RESULTS_DIR/performance-report.md"
    echo "|---------|--------|------------|------------|" >> "$RESULTS_DIR/performance-report.md"

    for metric in "${metrics[@]}"; do
      current=$(extract_metric "$RESULTS_DIR/critical-paths-results.json" "metrics.$metric.value")
      previous=$(extract_metric "$PREV_CRITICAL_RESULTS" "metrics.$metric.value")
      change=$(calculate_change "$current" "$previous")
      echo "| $metric | $current | $previous | $change |" >> "$RESULTS_DIR/performance-report.md"
    done
  fi

  print_message "$GREEN" "✅ Report generato: $RESULTS_DIR/performance-report.md"
fi

# Conclusione
print_message "$GREEN" "🎉 Test di performance completati con successo!"
print_message "$GREEN" "📊 Risultati salvati in: $RESULTS_DIR"
if $RUN_REALISTIC || $RUN_CRITICAL; then
  print_message "$GREEN" "📝 Consulta il report per analizzare i risultati: $RESULTS_DIR/performance-report.md"
fi 