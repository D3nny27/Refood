import { NotificheProvider } from './src/context/NotificheContext';

export default function App() {
  return (
    <AuthProvider>
      <NotificheProvider>
        <PaperProvider>
          <StatusBar style="auto" />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Slot />
          </GestureHandlerRootView>
        </PaperProvider>
      </NotificheProvider>
    </AuthProvider>
  );
} 