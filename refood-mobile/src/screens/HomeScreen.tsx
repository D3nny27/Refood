import React, { useState } from 'react';
import api from '../services/api';

const HomeScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/statistiche/counters');
      setStats(response.data);
    } catch (err) {
      setError('Errore nel recupero delle statistiche');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default HomeScreen; 