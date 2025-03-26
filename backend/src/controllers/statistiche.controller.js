const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene un conteggio di base delle entità nel sistema
 */
exports.getCounters = async (req, res, next) => {
  try {
    // Esegui query per contare le entità principali
    const [
      lotti,
      prenotazioni,
      utenti,
      centri
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN stato = "Verde" THEN 1 END) as verdi, COUNT(CASE WHEN stato = "Arancione" THEN 1 END) as arancioni, COUNT(CASE WHEN stato = "Rosso" THEN 1 END) as rossi FROM Lotti'),
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN stato = "Prenotato" THEN 1 END) as prenotate, COUNT(CASE WHEN stato = "InTransito" THEN 1 END) as in_transito, COUNT(CASE WHEN stato = "Consegnato" THEN 1 END) as consegnate, COUNT(CASE WHEN stato = "Annullato" THEN 1 END) as annullate FROM Prenotazioni'),
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN ruolo = "Operatore" THEN 1 END) as operatori, COUNT(CASE WHEN ruolo = "Amministratore" THEN 1 END) as amministratori, COUNT(CASE WHEN ruolo = "CentroSociale" THEN 1 END) as centri_sociali, COUNT(CASE WHEN ruolo = "CentroRiciclaggio" THEN 1 END) as centri_riciclaggio FROM Utenti'),
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN tipo = "Distribuzione" THEN 1 END) as distribuzione, COUNT(CASE WHEN tipo = "Sociale" THEN 1 END) as sociali, COUNT(CASE WHEN tipo = "Riciclaggio" THEN 1 END) as riciclaggio FROM Centri')
    ]);
    
    res.json({
      lotti: {
        totale: lotti.totale,
        per_stato: {
          verde: lotti.verdi,
          arancione: lotti.arancioni,
          rosso: lotti.rossi
        }
      },
      prenotazioni: {
        totale: prenotazioni.totale,
        per_stato: {
          prenotate: prenotazioni.prenotate,
          in_transito: prenotazioni.in_transito,
          consegnate: prenotazioni.consegnate,
          annullate: prenotazioni.annullate
        }
      },
      utenti: {
        totale: utenti.totale,
        per_ruolo: {
          operatori: utenti.operatori,
          amministratori: utenti.amministratori,
          centri_sociali: utenti.centri_sociali,
          centri_riciclaggio: utenti.centri_riciclaggio
        }
      },
      centri: {
        totale: centri.totale,
        per_tipo: {
          distribuzione: centri.distribuzione,
          sociali: centri.sociali,
          riciclaggio: centri.riciclaggio
        }
      }
    });
  } catch (err) {
    logger.error(`Errore nel recupero dei contatori: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dei contatori'));
  }
};

/**
 * Ottiene le statistiche di impatto per l'intero sistema
 */
exports.getImpatto = async (req, res, next) => {
  try {
    // Ottieni il totale di CO2 risparmiata e valore economico
    const impatto = await db.get(`
      SELECT 
        SUM(co2_risparmiata_kg) as co2_totale,
        SUM(valore_economico) as valore_totale
      FROM ImpattoCO2
    `);
    
    // Ottieni il totale di cibo salvato
    const lotti = await db.get(`
      SELECT 
        COUNT(*) as lotti_totali,
        SUM(CASE WHEN unita_misura = 'kg' THEN quantita WHEN unita_misura = 'g' THEN quantita / 1000.0 ELSE 0 END) as peso_kg
      FROM Lotti
      WHERE id IN (SELECT lotto_id FROM Prenotazioni WHERE stato = 'Consegnato')
    `);
    
    // Calcola l'acqua e il terreno risparmiati basandoci su stime medie
    const acqua_risparmiata = lotti.peso_kg * 200; // 200 litri di acqua per kg di cibo
    const terreno_risparmiato = lotti.peso_kg * 0.3; // 0.3 m² di terreno per kg di cibo
    
    res.json({
      co2_risparmiata_kg: impatto.co2_totale || 0,
      valore_economico_risparmiato: impatto.valore_totale || 0,
      cibo_salvato_kg: lotti.peso_kg || 0,
      acqua_risparmiata_litri: acqua_risparmiata || 0,
      terreno_risparmiato_mq: terreno_risparmiato || 0,
      lotti_salvati: lotti.lotti_totali || 0
    });
  } catch (err) {
    logger.error(`Errore nel recupero dell'impatto: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dell\'impatto'));
  }
};

/**
 * Ottiene statistiche complete per l'app mobile
 * Fornisce dati relativi agli ultimi 12 mesi
 */
exports.getStatisticheComplete = async (req, res, next) => {
  try {
    logger.info(`Richiesta statistiche complete con parametri: ${JSON.stringify(req.query)}`);
    const periodo = req.query.periodo || 'ultimi_12_mesi';
    
    // Dati generali
    const generali = {
      totaleAlimentiSalvati: 0,
      co2Risparmiata: 0,
      valoreEconomicoRisparmiato: 0,
      numeroLottiSalvati: 0,
      numeroPrenotazioniCompletate: 0,
      numeroTrasformazioniCircolari: 0
    };
    
    // Simula dati per periodo
    const perPeriodo = [];
    const oggi = new Date();
    for (let i = 11; i >= 0; i--) {
      const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
      const mese = data.toISOString().substring(0, 7); // formato "YYYY-MM"
      
      // Genera valori casuali realistici per i dati
      const quantita = Math.floor(Math.random() * 300) + 100;
      const co2 = quantita * 2.5;
      const valore = quantita * 4;
      const numLotti = Math.floor(Math.random() * 20) + 5;
      
      // Aggiunge al totale
      generali.totaleAlimentiSalvati += quantita;
      generali.co2Risparmiata += co2;
      generali.valoreEconomicoRisparmiato += valore;
      generali.numeroLottiSalvati += numLotti;
      generali.numeroPrenotazioniCompletate += Math.floor(numLotti * 0.8);
      
      perPeriodo.push({
        periodo: mese,
        quantitaAlimentiSalvati: quantita,
        co2Risparmiata: co2,
        valoreEconomico: valore,
        numeroLotti: numLotti
      });
    }
    
    // Statistiche trasporto
    const trasporto = {
      distanzaTotale: Math.floor(Math.random() * 1000) + 500,
      emissioniCO2: Math.floor(Math.random() * 200) + 100,
      costoTotale: Math.floor(Math.random() * 500) + 200,
      numeroTrasporti: Math.floor(Math.random() * 100) + 50
    };
    
    // Statistiche per categorie
    const categorie = [
      { nome: 'Frutta', quantita: Math.floor(Math.random() * 200) + 100, percentuale: 0 },
      { nome: 'Verdura', quantita: Math.floor(Math.random() * 200) + 100, percentuale: 0 },
      { nome: 'Latticini', quantita: Math.floor(Math.random() * 100) + 50, percentuale: 0 },
      { nome: 'Carne', quantita: Math.floor(Math.random() * 100) + 30, percentuale: 0 },
      { nome: 'Panetteria', quantita: Math.floor(Math.random() * 150) + 80, percentuale: 0 }
    ];
    
    // Calcola le percentuali
    const totaleCategorie = categorie.reduce((acc, cat) => acc + cat.quantita, 0);
    categorie.forEach(cat => {
      cat.percentuale = parseFloat((cat.quantita / totaleCategorie * 100).toFixed(1));
    });
    
    // Statistiche di completamento
    const completamento = [];
    for (let i = 11; i >= 0; i--) {
      const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
      const mese = data.toISOString().substring(0, 7);
      
      const completate = Math.floor(Math.random() * 30) + 10;
      const annullate = Math.floor(Math.random() * 10) + 1;
      const percentualeCompletamento = parseFloat(((completate / (completate + annullate)) * 100).toFixed(1));
      
      completamento.push({
        periodo: mese,
        completate,
        annullate,
        percentualeCompletamento
      });
    }
    
    // Tempi di prenotazione
    const tempoPrenotazione = {
      tempoMedio: parseFloat((Math.random() * 5 + 2).toFixed(1)),
      tempoMediano: parseFloat((Math.random() * 4 + 1).toFixed(1)),
      distribuzioneTempi: [
        { intervallo: '0-2h', conteggio: Math.floor(Math.random() * 40) + 10, percentuale: 0 },
        { intervallo: '2-6h', conteggio: Math.floor(Math.random() * 80) + 20, percentuale: 0 },
        { intervallo: '6-12h', conteggio: Math.floor(Math.random() * 60) + 15, percentuale: 0 },
        { intervallo: '12-24h', conteggio: Math.floor(Math.random() * 40) + 10, percentuale: 0 },
        { intervallo: '>24h', conteggio: Math.floor(Math.random() * 20) + 5, percentuale: 0 }
      ]
    };
    
    // Calcola le percentuali di distribuzione dei tempi
    const totaleTempoDist = tempoPrenotazione.distribuzioneTempi.reduce((acc, t) => acc + t.conteggio, 0);
    tempoPrenotazione.distribuzioneTempi.forEach(t => {
      t.percentuale = parseFloat((t.conteggio / totaleTempoDist * 100).toFixed(1));
    });
    
    // Assembla la risposta completa
    const response = {
      generali,
      perPeriodo,
      trasporto,
      perCategoria: categorie,
      completamento,
      tempoPrenotazione
    };
    
    logger.info('Statistiche complete generate con successo');
    res.json(response);
    
  } catch (err) {
    logger.error(`Errore nella generazione delle statistiche complete: ${err.message}`);
    next(new ApiError(500, 'Errore nella generazione delle statistiche complete'));
  }
};

/**
 * Ottiene statistiche per un centro specifico
 */
exports.getStatisticheCentro = async (req, res, next) => {
  try {
    logger.info(`Richiesta statistiche per centro con parametri: ${JSON.stringify(req.query)}`);
    const { centro_id, periodo = 'ultimi_12_mesi' } = req.query;
    
    if (!centro_id) {
      return next(new ApiError(400, 'ID del centro richiesto'));
    }
    
    // Verifica che il centro esista
    const centro = await db.get('SELECT id, nome, tipo FROM Centri WHERE id = ?', [centro_id]);
    
    if (!centro) {
      return next(new ApiError(404, 'Centro non trovato'));
    }
    
    // Genera statistiche di esempio per il centro specifico
    // Utilizziamo la stessa struttura di getStatisticheComplete ma con valori specifici per il centro
    const response = await generaStatisticheEsempio(centro);
    
    logger.info(`Statistiche generate per il centro ${centro_id}`);
    res.json(response);
    
  } catch (err) {
    logger.error(`Errore nella generazione delle statistiche per centro: ${err.message}`);
    next(new ApiError(500, 'Errore nella generazione delle statistiche per centro'));
  }
};

/**
 * Ottiene le statistiche di efficienza
 */
exports.getStatisticheEfficienza = async (req, res, next) => {
  try {
    logger.info('Richiesta statistiche di efficienza');
    
    // Genera statistiche di esempio per l'efficienza
    const response = {
      tempoMedioPrenotazione: parseFloat((Math.random() * 10 + 2).toFixed(1)),
      percentualeCompletamento: parseFloat((Math.random() * 20 + 75).toFixed(1))
    };
    
    logger.info('Statistiche di efficienza generate con successo');
    res.json(response);
    
  } catch (err) {
    logger.error(`Errore nella generazione delle statistiche di efficienza: ${err.message}`);
    next(new ApiError(500, 'Errore nella generazione delle statistiche di efficienza'));
  }
};

/**
 * Esporta le statistiche in formato CSV
 */
exports.esportaStatistiche = async (req, res, next) => {
  try {
    logger.info(`Richiesta esportazione statistiche con parametri: ${JSON.stringify(req.query)}`);
    const { periodo = 'ultimi_12_mesi', formato = 'csv' } = req.query;
    
    // Genera un CSV di esempio con dati simulati
    const csvContent = `
periodo,quantita_kg,co2_risparmiata_kg,valore_economico,lotti_salvati
2023-01,340,850,1360,18
2023-02,280,700,1120,15
2023-03,420,1050,1680,22
2023-04,310,775,1240,16
2023-05,390,975,1560,20
2023-06,350,875,1400,19
2023-07,420,1050,1680,22
2023-08,280,700,1120,15
2023-09,330,825,1320,17
2023-10,370,925,1480,19
2023-11,400,1000,1600,21
2023-12,450,1125,1800,23
`.trim();
    
    // Imposta gli header per il download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=statistiche_${periodo}.csv`);
    
    // Invia il contenuto CSV
    res.send(csvContent);
    
  } catch (err) {
    logger.error(`Errore nell'esportazione delle statistiche: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'esportazione delle statistiche'));
  }
};

/**
 * Funzione di utilità per generare statistiche di esempio per un centro
 */
async function generaStatisticheEsempio(centro) {
  // Genera valori più bassi per i centri rispetto alle statistiche globali
  const fattore = Math.random() * 0.3 + 0.1; // 10-40% delle statistiche globali
  
  // Dati generali
  const generali = {
    totaleAlimentiSalvati: Math.floor((Math.random() * 2000 + 1000) * fattore),
    co2Risparmiata: Math.floor((Math.random() * 5000 + 2500) * fattore),
    valoreEconomicoRisparmiato: Math.floor((Math.random() * 8000 + 4000) * fattore),
    numeroLottiSalvati: Math.floor((Math.random() * 100 + 50) * fattore),
    numeroPrenotazioniCompletate: Math.floor((Math.random() * 80 + 40) * fattore),
    numeroTrasformazioniCircolari: Math.floor((Math.random() * 20 + 10) * fattore)
  };
  
  // Simula dati per periodo
  const perPeriodo = [];
  const oggi = new Date();
  for (let i = 11; i >= 0; i--) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const mese = data.toISOString().substring(0, 7); // formato "YYYY-MM"
    
    // Genera valori casuali realistici per i dati
    const quantita = Math.floor((Math.random() * 300 + 100) * fattore);
    const co2 = quantita * 2.5;
    const valore = quantita * 4;
    const numLotti = Math.floor((Math.random() * 20 + 5) * fattore);
    
    perPeriodo.push({
      periodo: mese,
      quantitaAlimentiSalvati: quantita,
      co2Risparmiata: co2,
      valoreEconomico: valore,
      numeroLotti: numLotti
    });
  }
  
  // Statistiche trasporto basate sul tipo di centro
  const isDistribuzione = centro.tipo === 'Distribuzione';
  const trasporto = {
    distanzaTotale: Math.floor((Math.random() * 500 + 200) * (isDistribuzione ? 1.5 : 0.8) * fattore),
    emissioniCO2: Math.floor((Math.random() * 100 + 50) * (isDistribuzione ? 1.5 : 0.8) * fattore),
    costoTotale: Math.floor((Math.random() * 300 + 100) * (isDistribuzione ? 1.5 : 0.8) * fattore),
    numeroTrasporti: Math.floor((Math.random() * 60 + 30) * (isDistribuzione ? 1.5 : 0.8) * fattore)
  };
  
  // Resto delle statistiche simile a getStatisticheComplete ma con il fattore di scala
  const categorie = [
    { nome: 'Frutta', quantita: Math.floor((Math.random() * 200 + 100) * fattore), percentuale: 0 },
    { nome: 'Verdura', quantita: Math.floor((Math.random() * 200 + 100) * fattore), percentuale: 0 },
    { nome: 'Latticini', quantita: Math.floor((Math.random() * 100 + 50) * fattore), percentuale: 0 },
    { nome: 'Carne', quantita: Math.floor((Math.random() * 100 + 30) * fattore), percentuale: 0 },
    { nome: 'Panetteria', quantita: Math.floor((Math.random() * 150 + 80) * fattore), percentuale: 0 }
  ];
  
  // Calcola le percentuali
  const totaleCategorie = categorie.reduce((acc, cat) => acc + cat.quantita, 0);
  categorie.forEach(cat => {
    cat.percentuale = parseFloat((cat.quantita / totaleCategorie * 100).toFixed(1));
  });
  
  // Statistiche di completamento
  const completamento = [];
  for (let i = 11; i >= 0; i--) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const mese = data.toISOString().substring(0, 7);
    
    const completate = Math.floor((Math.random() * 30 + 10) * fattore);
    const annullate = Math.floor((Math.random() * 10 + 1) * fattore);
    const percentualeCompletamento = parseFloat(((completate / (completate + annullate)) * 100).toFixed(1));
    
    completamento.push({
      periodo: mese,
      completate,
      annullate,
      percentualeCompletamento
    });
  }
  
  // Tempi di prenotazione
  const tempoPrenotazione = {
    tempoMedio: parseFloat((Math.random() * 5 + 2).toFixed(1)),
    tempoMediano: parseFloat((Math.random() * 4 + 1).toFixed(1)),
    distribuzioneTempi: [
      { intervallo: '0-2h', conteggio: Math.floor((Math.random() * 40 + 10) * fattore), percentuale: 0 },
      { intervallo: '2-6h', conteggio: Math.floor((Math.random() * 80 + 20) * fattore), percentuale: 0 },
      { intervallo: '6-12h', conteggio: Math.floor((Math.random() * 60 + 15) * fattore), percentuale: 0 },
      { intervallo: '12-24h', conteggio: Math.floor((Math.random() * 40 + 10) * fattore), percentuale: 0 },
      { intervallo: '>24h', conteggio: Math.floor((Math.random() * 20 + 5) * fattore), percentuale: 0 }
    ]
  };
  
  // Calcola le percentuali di distribuzione dei tempi
  const totaleTempoDist = tempoPrenotazione.distribuzioneTempi.reduce((acc, t) => acc + t.conteggio, 0);
  tempoPrenotazione.distribuzioneTempi.forEach(t => {
    t.percentuale = parseFloat((t.conteggio / totaleTempoDist * 100).toFixed(1));
  });
  
  return {
    generali,
    perPeriodo,
    trasporto,
    perCategoria: categorie,
    completamento,
    tempoPrenotazione
  };
} 