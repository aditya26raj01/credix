import { StyleSheet, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.card}>
        <ThemedText type="title">Welcome back</ThemedText>
        <ThemedText>
          Signed in as{' '}
          <ThemedText type="defaultSemiBold">{user?.email ?? 'Unknown user'}</ThemedText>
        </ThemedText>

        <ThemedText>
          Account role: <ThemedText type="defaultSemiBold">{user?.role ?? 'user'}</ThemedText>
        </ThemedText>

        <Pressable style={styles.button} onPress={() => void signOut()}>
          <ThemedText style={styles.buttonLabel}>Sign out</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    gap: 12,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ece8de',
  },
  button: {
    marginTop: 12,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2f6f5e',
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
