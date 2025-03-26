import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { login as loginApi, logout as logoutApi, checkAuth, registerUser } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Toast } from 'react-native-toast-message';
import { logger } from '../utils/logger';

// Tipi
interface User {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (nome: string, cognome: string, email: string, password: string) => Promise<boolean>;
}

// Contesto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Verifica l'autenticazione all'avvio dell'app
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoading(true);
        const userData = await checkAuth();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Funzione di login
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const { user } = await loginApi(email, password);
      setUser(user);
    } catch (error: any) {
      console.error('Login error in context:', error);
      setError(error?.response?.data?.message || 'Errore durante il login');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione di logout
  const logout = async () => {
    try {
      setIsLoading(true);
      await logoutApi();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per pulire gli errori
  const clearError = () => {
    setError(null);
  };

  // Funzione per registrare un nuovo utente
  const register = async (nome: string, cognome: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      clearError();
      
      // Chiamata al servizio di registrazione
      const response = await registerUser(nome, cognome, email, password);
      
      if (response && response.success) {
        logger.log('Registrazione completata con successo per:', email);
        
        // Mostriamo un messaggio di successo ma non effettuiamo automaticamente il login
        Toast.show({
          type: 'success',
          text1: 'Registrazione completata',
          text2: 'Puoi accedere con le tue credenziali',
          visibilityTime: 4000,
        });
        
        return true;
      } else {
        throw new Error('Errore durante la registrazione');
      }
    } catch (error: any) {
      logger.error('Errore durante la registrazione:', error);
      
      // Gestione migliorata degli errori
      if (error.response && error.response.status === 409) {
        setError('Email già in uso. Prova con un altro indirizzo email.');
      } else if (error.message && error.message.includes('Network Error')) {
        setError('Impossibile connettersi al server. Verifica la tua connessione internet.');
      } else {
        setError('Si è verificato un errore durante la registrazione. Riprova più tardi.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook personalizzato per utilizzare il contesto di autenticazione
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve essere utilizzato all\'interno di un AuthProvider');
  }
  return context;
}; 