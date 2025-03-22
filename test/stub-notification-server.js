/**
 * Server stub per testare le notifiche
 * Questo server simula gli endpoint dell'API per le notifiche
 * 
 * Esegui con: node test/stub-notification-server.js
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Dati di esempio
const sampleNotifications = [
  {
    id: 1,
    titolo: 'Benvenuto in ReFood',
    messaggio: 'Grazie per aver installato la nostra app!',
    tipo: 'Alert',
    priorita: 'Alta',
    letta: false,
    data: new Date().toISOString(),
    dataCreazione: new Date().toISOString(),
  },
  {
    id: 2,
    titolo: 'Nuovo lotto disponibile',
    messaggio: 'Un nuovo lotto di prodotti è disponibile presso il Centro Test.',
    tipo: 'CambioStato',
    priorita: 'Media',
    letta: true,
    data: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    dataCreazione: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    dataLettura: new Date().toISOString(),
  },
  {
    id: 3,
    titolo: 'Prenotazione confermata',
    messaggio: 'La tua prenotazione #123 è stata confermata.',
    tipo: 'Prenotazione',
    priorita: 'Bassa',
    letta: false,
    data: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    dataCreazione: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  }
];

// Endpoint per ottenere le notifiche
app.get('/api/v1/notifiche', (req, res) => {
  console.log('GET /api/v1/notifiche');
  const { letta } = req.query;
  
  let filteredNotifications = [...sampleNotifications];
  
  // Applica filtro per notifiche lette/non lette
  if (letta !== undefined) {
    const isRead = letta === 'true';
    filteredNotifications = filteredNotifications.filter(n => n.letta === isRead);
  }
  
  res.json({
    data: filteredNotifications,
    pagination: {
      page: 1,
      limit: 20,
      total: filteredNotifications.length,
      pages: 1
    }
  });
});

// Endpoint per il conteggio delle notifiche
app.get('/api/v1/notifiche/conteggio', (req, res) => {
  console.log('GET /api/v1/notifiche/conteggio');
  const { letta } = req.query;
  
  let count = sampleNotifications.length;
  
  // Conta solo le notifiche lette/non lette
  if (letta !== undefined) {
    const isRead = letta === 'true';
    count = sampleNotifications.filter(n => n.letta === isRead).length;
  }
  
  res.json({
    totale: count
  });
});

// Endpoint per il dettaglio di una notifica
app.get('/api/v1/notifiche/:id', (req, res) => {
  console.log(`GET /api/v1/notifiche/${req.params.id}`);
  const notification = sampleNotifications.find(n => n.id === parseInt(req.params.id));
  
  if (!notification) {
    return res.status(404).json({ error: 'Notifica non trovata' });
  }
  
  res.json(notification);
});

// Endpoint per segnare una notifica come letta
app.put('/api/v1/notifiche/:id/letta', (req, res) => {
  console.log(`PUT /api/v1/notifiche/${req.params.id}/letta`);
  const index = sampleNotifications.findIndex(n => n.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Notifica non trovata' });
  }
  
  sampleNotifications[index].letta = true;
  sampleNotifications[index].dataLettura = new Date().toISOString();
  
  res.json({ success: true });
});

// Endpoint per segnare tutte le notifiche come lette
app.post('/api/v1/notifiche/segna-tutte-lette', (req, res) => {
  console.log('POST /api/v1/notifiche/segna-tutte-lette');
  
  sampleNotifications.forEach(n => {
    if (!n.letta) {
      n.letta = true;
      n.dataLettura = new Date().toISOString();
    }
  });
  
  res.json({ success: true });
});

// Endpoint per eliminare una notifica
app.delete('/api/v1/notifiche/:id', (req, res) => {
  console.log(`DELETE /api/v1/notifiche/${req.params.id}`);
  const index = sampleNotifications.findIndex(n => n.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Notifica non trovata' });
  }
  
  sampleNotifications.splice(index, 1);
  
  res.json({ success: true });
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server stub per notifiche attivo su http://localhost:${PORT}`);
  console.log('Per testare le notifiche, modifica API_URL in config/constants.ts in modo che punti a questo server');
  console.log(`API_URL dovrebbe essere: http://localhost:${PORT}/api/v1`);
}); 