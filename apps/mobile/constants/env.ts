function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export const Env = {
  apiBaseUrl: requireEnv(process.env.EXPO_PUBLIC_API_BASE_URL, 'EXPO_PUBLIC_API_BASE_URL').replace(
    /\/$/,
    '',
  ),
  googleWebClientId: requireEnv(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  ),
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};
