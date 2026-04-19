import { Redirect } from 'expo-router';

export default function LegacyAuthRouteRedirect() {
  return <Redirect href="/login" />;
}
