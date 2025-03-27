import React from 'react';
import { Stack } from 'expo-router';
import AuthDebug from '../src/screens/AuthDebug';

export default function DebugScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Debug Auth' }} />
      <AuthDebug />
    </>
  );
} 