/**
 * Utility per il logging condizionale
 * Sostituisce console.log con una versione che mostra i log solo in modalità sviluppo
 */

const isDevEnvironment = () => {
  return __DEV__ === true;
};

class Logger {
  // Versione condizionale di console.log che funziona solo in ambiente di sviluppo
  log(...args: any[]) {
    if (isDevEnvironment()) {
      console.log(...args);
    }
  }

  // Versione condizionale di console.error che funziona solo in ambiente di sviluppo
  error(...args: any[]) {
    // Gli errori vogliamo sempre mostrarli in console, anche in produzione
    console.error(...args);
  }

  // Versione condizionale di console.warn che funziona solo in ambiente di sviluppo
  warn(...args: any[]) {
    if (isDevEnvironment()) {
      console.warn(...args);
    }
  }

  // Versione condizionale di console.info che funziona solo in ambiente di sviluppo
  info(...args: any[]) {
    if (isDevEnvironment()) {
      console.info(...args);
    }
  }
}

export default new Logger(); 