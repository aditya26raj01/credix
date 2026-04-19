import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H2, Paragraph, Spinner, XStack, YStack } from 'tamagui';

import { Env } from '@/constants/env';
import { useAuth } from '@/context/auth-context';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { isAuthenticated, signInWithGoogle, isSigningIn, authError } = useAuth();
  const [flowError, setFlowError] = useState<string | null>(null);

  const authRequestConfig = useMemo(
    () => ({
      webClientId: Env.googleWebClientId,
      iosClientId: Env.googleIosClientId,
      androidClientId: Env.googleAndroidClientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: 'id_token' as const,
    }),
    [],
  );

  const [request, response, promptAsync] = Google.useAuthRequest(authRequestConfig);

  useEffect(() => {
    async function handleResponse() {
      if (response?.type !== 'success') {
        return;
      }

      const idToken = response.authentication?.idToken ?? response.params?.id_token;
      if (!idToken) {
        setFlowError('Google sign-in did not return an id token.');
        return;
      }

      setFlowError(null);
      try {
        await signInWithGoogle(idToken);
      } catch {
        // authError is already managed in context
      }
    }

    void handleResponse();
  }, [response, signInWithGoogle]);

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  const errorText = flowError ?? authError;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack
        background="$background"
        px="$6"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <YStack
          style={{ width: '100%', maxWidth: 420, borderRadius: 24 }}
          p="$6"
          borderWidth={1}
          borderColor="$borderColor"
          background="$background"
          gap="$4"
        >
          <H2 color="$color">Welcome to Credix</H2>
          <Paragraph color="$color10">Continue with Google to access your account.</Paragraph>

          <Button
            theme="blue"
            size="$5"
            disabled={!request || isSigningIn}
            onPress={() => {
              setFlowError(null);
              void promptAsync();
            }}
          >
            {isSigningIn ? (
              <XStack gap="$2" style={{ alignItems: 'center' }}>
                <Spinner size="small" color="$color" />
                <Paragraph color="$color">Signing in...</Paragraph>
              </XStack>
            ) : (
              'Continue with Google'
            )}
          </Button>

          {!!errorText && <Paragraph color="$red10">{errorText}</Paragraph>}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
