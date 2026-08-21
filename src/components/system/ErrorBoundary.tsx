import * as Updates from 'expo-updates';
import { Component, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches render-time crashes anywhere in the app (a bad prop, a null
 * dereference, a third-party component throwing) that would otherwise blow
 * past React and leave a real user staring at a blank white screen. Shows a
 * real recoverable error screen instead - this is the render-crash half of
 * "error states"; storage-load resilience (safeJsonParse) is the other half
 * and lives in src/services/storage.
 *
 * Must be a class component - there is no hook equivalent for
 * componentDidCatch/getDerivedStateFromError.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (__DEV__) console.error('[ErrorBoundary] caught a render crash:', error, info.componentStack);
  }

  handleRetry = async () => {
    // A full reload (not just clearing local state) is deliberate: the
    // crash may have left module-level or store state inconsistent, and a
    // real restart is the only way to be sure the same crash won't recur
    // on the very next render.
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    try {
      await Updates.reloadAsync();
    } catch {
      // Updates.reloadAsync() isn't available in every environment (e.g.
      // some Expo Go configurations) - fall back to just re-rendering the
      // tree, which still recovers from a one-off crash.
      this.setState({ error: null });
    }
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Бир нерсе туура эмес болду</Text>
          <Text style={styles.message}>
            Колдонмодо күтүлбөгөн ката пайда болду. Кечиресиз - кайра аракет кылып көрүңүз.
          </Text>
          <Button label="Кайра аракет кыл" onPress={this.handleRetry} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
