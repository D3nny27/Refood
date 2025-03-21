import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as loginApi, logout as logoutApi, checkAuth } from '../services/authService';

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

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
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