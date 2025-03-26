const cron = require('node-cron');
const db = require('../config/database');
const logger = require('./logger');

/**
 * Configurazione delle attività pianificate
 */
class Scheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Inizializza tutte le attività pianificate
   */
  init() {
    this.setupLottiStatusUpdate();
    this.setupExpiredLotsArchiving();
    this.setupSystemStatsCollection();
    
    logger.info('Scheduler inizializzato con successo');
  }

  /**
   * Configura l'aggiornamento automatico degli stati dei lotti
   * Eseguito ogni ora
   */
  setupLottiStatusUpdate() {
    // Pianifica l'aggiornamento ogni ora
    const job = cron.schedule('0 * * * *', async () => {
      logger.info('Avvio aggiornamento stato lotti');
      
      try {
        // Inizia una transazione
        await db.exec('BEGIN TRANSACTION');
        
        const oggi = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
        // ID utente di sistema per i cambi di stato automatici
        const SYSTEM_USER_ID = 2; // Utente amministratore con ID 2
        
        // Trova lotti che dovrebbero passare in stato arancione
        // (giorni_permanenza prima della scadenza)
        const lottiDaArancione = await db.all(`
          SELECT id, stato, data_scadenza, giorni_permanenza
          FROM Lotti 
          WHERE stato = 'Verde' 
          AND date(data_scadenza, '-' || giorni_permanenza || ' days') <= date(?)
          AND data_scadenza > date(?)
        `, [oggi, oggi]);
        
        logger.info(`Trovati ${lottiDaArancione.length} lotti da aggiornare a stato Arancione`);
        
        // Aggiorna lotti a stato arancione
        if (lottiDaArancione.length > 0) {
          // In SQLite non possiamo fare una query con più condizioni complesse, quindi iteriamo
          for (const lotto of lottiDaArancione) {
            // Aggiorna stato
            await db.run(`
              UPDATE Lotti 
              SET stato = 'Arancione', aggiornato_il = datetime('now')
              WHERE id = ?
            `, [lotto.id]);
            
            // Registra il cambio di stato nel log
            await db.run(`
              INSERT INTO LogCambioStato 
              (lotto_id, stato_precedente, stato_nuovo, cambiato_il, cambiato_da) 
              VALUES (?, ?, ?, datetime('now'), ?)
            `, [
              lotto.id, 
              lotto.stato, 
              'Arancione',
              SYSTEM_USER_ID
            ]);
          }
          
          logger.info(`${lottiDaArancione.length} lotti aggiornati a stato Arancione`);
        }
        
        // Trova lotti che dovrebbero passare in stato rosso
        // (data di scadenza raggiunta)
        const lottiDaRosso = await db.all(`
          SELECT id, stato 
          FROM Lotti 
          WHERE stato IN ('Verde', 'Arancione') 
          AND date(data_scadenza) <= date(?)
        `, [oggi]);
        
        logger.info(`Trovati ${lottiDaRosso.length} lotti da aggiornare a stato Rosso`);
        
        // Aggiorna lotti a stato rosso
        if (lottiDaRosso.length > 0) {
          // In SQLite non possiamo fare una query con più condizioni complesse, quindi iteriamo
          for (const lotto of lottiDaRosso) {
            // Aggiorna stato
            await db.run(`
              UPDATE Lotti 
              SET stato = 'Rosso', aggiornato_il = datetime('now')
              WHERE id = ?
            `, [lotto.id]);
            
            // Registra il cambio di stato nel log
            await db.run(`
              INSERT INTO LogCambioStato 
              (lotto_id, stato_precedente, stato_nuovo, cambiato_il, cambiato_da) 
              VALUES (?, ?, ?, datetime('now'), ?)
            `, [
              lotto.id, 
              lotto.stato, 
              'Rosso',
              SYSTEM_USER_ID
            ]);
          }
          
          logger.info(`${lottiDaRosso.length} lotti aggiornati a stato Rosso`);
        }
        
        // Commit della transazione
        await db.exec('COMMIT');
        logger.info('Aggiornamento stato lotti completato con successo');
      } catch (error) {
        // Rollback in caso di errore
        await db.exec('ROLLBACK');
        logger.error(`Errore nell'aggiornamento dello stato dei lotti: ${error.message}`);
      }
    });
    
    this.jobs.push(job);
    logger.info('Scheduler per aggiornamento stato lotti configurato');
  }
  
  /**
   * Configura l'archiviazione dei lotti scaduti da più di 30 giorni
   * Eseguito ogni giorno a mezzanotte
   */
  setupExpiredLotsArchiving() {
    // Pianifica l'archiviazione ogni giorno a mezzanotte
    const job = cron.schedule('0 0 * * *', async () => {
      logger.info('Avvio archiviazione lotti scaduti');
      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Data 30 giorni fa
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 30);
        
        // Trova lotti da archiviare (scaduti da più di 30 giorni)
        const [lottiDaArchiviare] = await connection.query(`
          SELECT id 
          FROM Lotti 
          WHERE stato = 'Rosso' 
          AND data_scadenza < ?
        `, [dataLimite]);
        
        if (lottiDaArchiviare.length === 0) {
          logger.info('Nessun lotto da archiviare');
          await connection.commit();
          return;
        }
        
        // IDs dei lotti da archiviare
        const lottiIds = lottiDaArchiviare.map(l => l.id);
        
        // Archivia i lotti (copia nella tabella di archivio)
        await connection.query(`
          INSERT INTO LottiArchivio 
          SELECT *, NOW() as data_archiviazione 
          FROM Lotti 
          WHERE id IN (?)
        `, [lottiIds]);
        
        // Archivia i log di stato
        await connection.query(`
          INSERT INTO StatusChangeLogArchivio 
          SELECT *, NOW() as data_archiviazione 
          FROM StatusChangeLog 
          WHERE lotto_id IN (?)
        `, [lottiIds]);
        
        // Archivia le prenotazioni
        await connection.query(`
          INSERT INTO PrenotazioniArchivio 
          SELECT *, NOW() as data_archiviazione 
          FROM Prenotazioni 
          WHERE lotto_id IN (?)
        `, [lottiIds]);
        
        // Elimina i dati originali dopo l'archiviazione
        await connection.query(`DELETE FROM Prenotazioni WHERE lotto_id IN (?)`, [lottiIds]);
        await connection.query(`DELETE FROM StatusChangeLog WHERE lotto_id IN (?)`, [lottiIds]);
        await connection.query(`DELETE FROM LottiCategorie WHERE lotto_id IN (?)`, [lottiIds]);
        await connection.query(`DELETE FROM Lotti WHERE id IN (?)`, [lottiIds]);
        
        await connection.commit();
        logger.info(`${lottiIds.length} lotti archiviati con successo`);
      } catch (error) {
        await connection.rollback();
        logger.error(`Errore nell'archiviazione dei lotti: ${error.message}`);
      } finally {
        connection.release();
      }
    });
    
    this.jobs.push(job);
  }
  
  /**
   * Configura la raccolta di statistiche di sistema
   * Eseguito ogni giorno alle 23:30
   */
  setupSystemStatsCollection() {
    const job = cron.schedule('30 23 * * *', async () => {
      logger.info('Avvio raccolta statistiche giornaliere');
      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();
        
        const oggi = new Date().toISOString().split('T')[0];
        
        // Statistiche lotti
        const [statsLotti] = await connection.query(`
          SELECT 
            COUNT(*) as totale_lotti,
            COUNT(CASE WHEN stato = 'Verde' THEN 1 END) as lotti_verdi,
            COUNT(CASE WHEN stato = 'Arancione' THEN 1 END) as lotti_arancioni,
            COUNT(CASE WHEN stato = 'Rosso' THEN 1 END) as lotti_rossi,
            SUM(quantita) as quantita_totale
          FROM Lotti
        `);
        
        // Statistiche prenotazioni
        const [statsPrenotazioni] = await connection.query(`
          SELECT 
            COUNT(*) as totale_prenotazioni,
            COUNT(CASE WHEN stato = 'Attiva' THEN 1 END) as prenotazioni_attive,
            COUNT(CASE WHEN stato = 'Completata' THEN 1 END) as prenotazioni_completate,
            COUNT(CASE WHEN stato = 'Annullata' THEN 1 END) as prenotazioni_annullate
          FROM Prenotazioni
        `);
        
        // Statistiche utenti
        const [statsUtenti] = await connection.query(`
          SELECT 
            COUNT(*) as totale_utenti,
            COUNT(CASE WHEN ruolo = 'Operatore' THEN 1 END) as operatori,
            COUNT(CASE WHEN ruolo = 'CentroSociale' THEN 1 END) as centri_sociali,
            COUNT(CASE WHEN ruolo = 'CentroRiciclaggio' THEN 1 END) as centri_riciclaggio
          FROM Utenti
        `);
        
        // Inserisci statistiche
        await connection.query(`
          INSERT INTO StatisticheGiornaliere (
            data_statistica,
            totale_lotti,
            lotti_verdi,
            lotti_arancioni,
            lotti_rossi,
            quantita_totale,
            totale_prenotazioni,
            prenotazioni_attive,
            prenotazioni_completate,
            prenotazioni_annullate,
            totale_utenti,
            utenti_operatori,
            utenti_centri_sociali,
            utenti_centri_riciclaggio
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          oggi,
          statsLotti[0].totale_lotti,
          statsLotti[0].lotti_verdi,
          statsLotti[0].lotti_arancioni,
          statsLotti[0].lotti_rossi,
          statsLotti[0].quantita_totale,
          statsPrenotazioni[0].totale_prenotazioni,
          statsPrenotazioni[0].prenotazioni_attive,
          statsPrenotazioni[0].prenotazioni_completate,
          statsPrenotazioni[0].prenotazioni_annullate,
          statsUtenti[0].totale_utenti,
          statsUtenti[0].operatori,
          statsUtenti[0].centri_sociali,
          statsUtenti[0].centri_riciclaggio
        ]);
        
        await connection.commit();
        logger.info('Statistiche giornaliere raccolte con successo');
      } catch (error) {
        await connection.rollback();
        logger.error(`Errore nella raccolta delle statistiche: ${error.message}`);
      } finally {
        connection.release();
      }
    });
    
    this.jobs.push(job);
  }
  
  /**
   * Arresta tutti i job pianificati
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    logger.info('Scheduler arrestato');
  }
}

module.exports = new Scheduler(); 