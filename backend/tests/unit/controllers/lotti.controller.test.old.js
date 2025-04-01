const httpMocks = require('node-mocks-http');
const db = require('../../../src/config/database');
const lottiController = require('../../../src/controllers/lotti.controller');

// Mock delle dipendenze esterne
jest.mock('../../../src/config/database');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../src/utils/websocket', () => ({
  notifyNewLotto: jest.fn(),
  notifyLottoUpdate: jest.fn()
}));
jest.mock('../../../src/controllers/notifiche.controller', () => ({
  createNotifica: jest.fn().mockResolvedValue({})
}));

describe('Lotti Controller', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = httpMocks.createRequest();
    mockResponse = httpMocks.createResponse();
    mockNext = jest.fn();
    
    // Aggiungiamo le informazioni dell'utente, come se fosse autenticato
    mockRequest.user = {
      id: 1,
      ruolo: 'Operatore',
      tipo_utente: 1
    };
    mockRequest.query = {};

    // Resettiamo tutti i mock
    jest.clearAllMocks();
  });

  describe('getLotti', () => {
    it('dovrebbe restituire una lista vuota di lotti quando non ci sono lotti disponibili', async () => {
      // Mock della risposta del database
      db.all = jest.fn().mockResolvedValue([]);
      db.get = jest.fn().mockResolvedValue({ count: 0 });
      
      // Aggiungiamo parametri di paginazione
      mockRequest.query = { page: 1, limit: 10 };
      
      // Chiamata al controller
      await lottiController.getLotti(mockRequest, mockResponse, mockNext);
      
      // Verifica della risposta
      const data = mockResponse._getJSONData();
      
      expect(mockResponse._getStatusCode()).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.lotti).toEqual([]);
    });

    it('dovrebbe restituire una lista di lotti quando ci sono lotti disponibili', async () => {
      // Mock dei lotti nel database
      const mockLotti = [
        { id: 1, prodotto: 'Mele', stato: 'Verde', quantita: 10 },
        { id: 2, prodotto: 'Pane', stato: 'Arancione', quantita: 5 }
      ];
      
      db.all = jest.fn().mockResolvedValue(mockLotti);
      db.get = jest.fn().mockResolvedValue({ count: 2 });
      
      // Chiamata al controller
      await lottiController.getLotti(mockRequest, mockResponse, mockNext);
      
      // Verifica della risposta
      const data = mockResponse._getJSONData();
      
      expect(mockResponse._getStatusCode()).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.lotti).toHaveLength(2);
      expect(data.data.lotti[0].id).toBe(1);
      expect(data.data.lotti[1].prodotto).toBe('Pane');
    });

    it('dovrebbe gestire gli errori correttamente', async () => {
      // Mock di un errore del database
      const errorMessage = 'Errore del database';
      db.all = jest.fn().mockRejectedValue(new Error(errorMessage));
      
      // Chiamata al controller
      await lottiController.getLotti(mockRequest, mockResponse, mockNext);
      
      // Verifica che next sia stato chiamato con l'errore
      expect(mockNext).toHaveBeenCalled();
      expect(mockNext.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockNext.mock.calls[0][0].message).toBe(errorMessage);
    });
  });
}); 