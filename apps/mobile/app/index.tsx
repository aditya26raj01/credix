import { Redirect } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H2, Paragraph, Separator, Spinner, XStack, YStack } from 'tamagui';

import { Env } from '@/constants/env';
import { useAuth } from '@/context/auth-context';
import {
  connectGmail,
  disconnectGmail,
  type GmailConnectionStatus,
  getGmailConnectionStatus,
  syncGmailNow,
} from '@/services/auth-service';

export default function HomeScreen() {
  const { isAuthenticated, user, signOut, authorizedFetch } = useAuth();
  const [gmail, setGmail] = useState<GmailConnectionStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gmailAuthConfig = useMemo(
    () => ({
      webClientId: Env.googleWebClientId,
      iosClientId: Env.googleIosClientId,
      androidClientId: Env.googleAndroidClientId,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      responseType: 'code' as const,
      shouldAutoExchangeCode: false,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }),
    [],
  );

  const [gmailRequest, gmailResponse, promptGmailAuth] = Google.useAuthRequest(gmailAuthConfig);

  const loadGmailConnection = useCallback(async () => {
    setIsLoadingStatus(true);
    setError(null);
    try {
      const status = await authorizedFetch((accessToken) => getGmailConnectionStatus(accessToken));
      setGmail(status);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load Gmail connection status.';
      setError(message);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadGmailConnection();
  }, [isAuthenticated, loadGmailConnection]);

  useEffect(() => {
    async function handleGmailOAuthResponse() {
      if (gmailResponse?.type !== 'success') {
        return;
      }

      const code = gmailResponse.params?.code;
      if (!code) {
        setError('Google Gmail connect did not return an authorization code.');
        return;
      }

      setIsMutating(true);
      setError(null);
      try {
        const connected = await authorizedFetch((accessToken) =>
          connectGmail({
            accessToken,
            code,
            redirectUri: gmailRequest?.redirectUri,
            codeVerifier: gmailRequest?.codeVerifier,
          }),
        );
        setGmail(connected);
      } catch (connectError) {
        const message =
          connectError instanceof Error
            ? connectError.message
            : 'Unable to connect Gmail right now.';
        setError(message);
      } finally {
        setIsMutating(false);
      }
    }

    void handleGmailOAuthResponse();
  }, [authorizedFetch, gmailRequest?.codeVerifier, gmailRequest?.redirectUri, gmailResponse]);

  const onDisconnect = useCallback(async () => {
    setIsMutating(true);
    setError(null);
    try {
      await authorizedFetch((accessToken) => disconnectGmail(accessToken));
      setGmail({
        connected: false,
        email: null,
        lastSyncAt: null,
        nextSyncAt: null,
        connectedAt: null,
        scopes: [],
      });
    } catch (disconnectError) {
      const message =
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Unable to disconnect Gmail right now.';
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, [authorizedFetch]);

  const onSyncNow = useCallback(async () => {
    setIsMutating(true);
    setError(null);
    try {
      const status = await authorizedFetch((accessToken) => syncGmailNow(accessToken));
      setGmail(status);
    } catch (syncError) {
      const message =
        syncError instanceof Error ? syncError.message : 'Unable to sync Gmail right now.';
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, [authorizedFetch]);

  function formatDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const isConnected = Boolean(gmail?.connected);
  const disableActions = isMutating || isLoadingStatus;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack
        background="$background"
        px="$6"
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <YStack
          style={{ width: '100%', maxWidth: 480, borderRadius: 24 }}
          p="$6"
          borderWidth={1}
          borderColor="$borderColor"
          background="$background"
          gap="$5"
        >
          <H2 color="$color">Welcome</H2>
          <Paragraph color="$color10">Signed in as {user?.email ?? 'unknown'}.</Paragraph>

          <Separator />

          <YStack gap="$2">
            <Paragraph color="$color" fontWeight="700">
              Gmail Sync
            </Paragraph>
            <Paragraph color={isConnected ? '$green10' : '$orange10'}>
              {isConnected ? 'Connected' : 'Not connected'}
            </Paragraph>
            <Paragraph color="$color10">
              Last sync: {formatDate(gmail?.lastSyncAt ?? null)}
            </Paragraph>
            <Paragraph color="$color10">
              Next sync: {formatDate(gmail?.nextSyncAt ?? null)}
            </Paragraph>
          </YStack>

          {isLoadingStatus && (
            <XStack gap="$2" style={{ alignItems: 'center' }}>
              <Spinner size="small" />
              <Paragraph color="$color10">Loading Gmail status...</Paragraph>
            </XStack>
          )}

          {!!error && <Paragraph color="$red10">{error}</Paragraph>}

          <YStack gap="$3">
            {!isConnected ? (
              <Button
                theme="blue"
                size="$4"
                disabled={!gmailRequest || disableActions}
                onPress={() => {
                  setError(null);
                  void promptGmailAuth();
                }}
              >
                Connect Gmail
              </Button>
            ) : (
              <>
                <Button
                  theme="green"
                  size="$4"
                  disabled={disableActions}
                  onPress={() => void onSyncNow()}
                >
                  Sync Now
                </Button>
                <Button
                  theme="gray"
                  size="$4"
                  disabled={disableActions}
                  onPress={() => void onDisconnect()}
                >
                  Disconnect Gmail
                </Button>
              </>
            )}
          </YStack>

          <Button theme="gray" size="$4" onPress={() => void signOut()}>
            Sign out
          </Button>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
