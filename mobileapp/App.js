import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ToastProvider } from './src/context/ToastContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <AppNavigator />
            </ToastProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
