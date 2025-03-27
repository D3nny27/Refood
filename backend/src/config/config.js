/**
 * Configurazione globale per il backend di Refood
 */

module.exports = {
  // Configurazione JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'refood-secret-key-deve-essere-cambiata-in-prod',
    accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION || '2h',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },
  
  // Configurazione password
  password: {
    saltRounds: 10,
    minLength: 8,
  },
  
  // Configurazione del sistema
  system: {
    defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@refood.it',
    defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPassword123!',
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minuti
  },
  
  // Configurazione validazione
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phoneRegex: /^[0-9]{9,10}$/,
  },
  
  // Configurazione notifiche
  notifications: {
    enabled: true,
    defaultExpiration: 7 * 24 * 60 * 60 * 1000, // 7 giorni
  },
  
  // Configurazione paginazione
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
}; 