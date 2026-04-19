import { requestJson } from '@/services/http-client';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthUser;
};

export type GmailConnectionStatus = {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  connectedAt: string | null;
  scopes: string[];
};

export async function exchangeGoogleIdToken(params: {
  idToken: string;
  deviceInfo?: string;
}): Promise<AuthTokens> {
  return requestJson<AuthTokens>('/auth/google/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return requestJson<AuthTokens>('/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await requestJson<{ success: true }>('/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getMe(accessToken: string): Promise<AuthUser> {
  return requestJson<AuthUser>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getGmailConnectionStatus(
  accessToken: string,
): Promise<GmailConnectionStatus> {
  return requestJson<GmailConnectionStatus>('/auth/google/gmail/connection', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function connectGmail(params: {
  accessToken: string;
  code: string;
  redirectUri?: string;
  codeVerifier?: string;
}): Promise<GmailConnectionStatus> {
  return requestJson<GmailConnectionStatus>('/auth/google/gmail/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      code: params.code,
      redirectUri: params.redirectUri,
      codeVerifier: params.codeVerifier,
    }),
  });
}

export async function disconnectGmail(accessToken: string): Promise<void> {
  await requestJson<{ success: true }>('/auth/google/gmail/disconnect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function syncGmailNow(accessToken: string): Promise<GmailConnectionStatus> {
  return requestJson<GmailConnectionStatus>('/auth/google/gmail/sync-now', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
