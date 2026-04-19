import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Theme, TamaguiProvider, Spinner, YStack } from 'tamagui';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import tamaguiConfig from '../tamagui.config';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isHydrating } = useAuth();
  const tamaguiTheme = colorScheme === 'dark' ? 'dark' : 'light';

  if (isHydrating) {
    return (
      <TamaguiProvider config={tamaguiConfig} defaultTheme={tamaguiTheme}>
        <Theme name={tamaguiTheme}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <YStack
              background="$background"
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Spinner size="large" />
            </YStack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </Theme>
      </TamaguiProvider>
    );
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={tamaguiTheme}>
      <Theme name={tamaguiTheme}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            {isAuthenticated ? <Stack.Screen name="index" /> : <Stack.Screen name="login" />}
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </Theme>
    </TamaguiProvider>
  );
}
