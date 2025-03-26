import React from 'react';
import LoginScreen from '../src/screens/LoginScreen';
import { useLocalSearchParams } from 'expo-router';

export default function IndexPage() {
  const params = useLocalSearchParams();
  return <LoginScreen />;
} 